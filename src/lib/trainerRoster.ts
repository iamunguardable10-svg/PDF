import type { TrainerRoster, ManagedAthlete, AthleteStatus, ACWRZone, SelectionStats } from '../types/trainerDashboard';
import type { TrainerShareData } from './trainerShare';

const ROSTER_KEY = 'fitfuel_coach_roster';

// ── Persistence ───────────────────────────────────────────────────────────────

export function loadRoster(): TrainerRoster {
  try {
    const raw = localStorage.getItem(ROSTER_KEY);
    if (!raw) return { athletes: [], groups: [] };
    return JSON.parse(raw) as TrainerRoster;
  } catch {
    return { athletes: [], groups: [] };
  }
}

export function saveRoster(roster: TrainerRoster): void {
  localStorage.setItem(ROSTER_KEY, JSON.stringify(roster));
}

// ── Token extraction ──────────────────────────────────────────────────────────

/** Extract live-link token from a full URL or raw token string */
export function extractToken(input: string): string | null {
  const trimmed = input.trim();
  // Full URL: ...#trainer/{token}
  const match = trimmed.match(/#trainer\/([A-Za-z0-9_-]{10,})$/);
  if (match) return match[1];
  // Raw token (UUID-like or nanoid)
  if (/^[A-Za-z0-9_-]{10,}$/.test(trimmed)) return trimmed;
  return null;
}

// ── Status computation ────────────────────────────────────────────────────────

function classifyZone(acwr: number | null, historyLength: number): ACWRZone {
  if (historyLength < 8) return 'building';
  if (acwr === null)     return 'nodata';
  if (acwr >= 0.8 && acwr <= 1.3) return 'optimal';
  if (acwr < 0.8)                 return 'low';
  if (acwr <= 1.5)                return 'elevated';
  return 'high';
}

export function computeAthleteStatus(
  athlete: ManagedAthlete,
  data: TrainerShareData,
): AthleteStatus {
  const history = data.acwrHistory ?? [];

  // Latest valid ACWR point
  const latest = [...history].reverse().find(p => p.v !== null) ?? null;

  // ACWR 7 days ago (for trend)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const cutISO = sevenDaysAgo.toISOString().split('T')[0];
  const old = [...history].reverse().find(p => p.d <= cutISO && p.v !== null) ?? null;

  const acwr = latest?.v ?? null;
  const trend = (acwr !== null && old?.v != null) ? Math.round((acwr - old.v) * 100) / 100 : null;

  return {
    id:          athlete.id,
    name:        athlete.name,
    sport:       athlete.sport,
    token:       athlete.token,
    groupIds:    athlete.groupIds,
    acwr,
    acuteLoad:   latest?.a ?? 0,
    chronicLoad: latest?.c ?? 0,
    zone:        classifyZone(acwr, history.length),
    trend,
    lastLoadDate: latest?.d ?? null,
    dataAge:     Math.floor((Date.now() - new Date(data.generatedAt).getTime()) / 86400000),
    loading:     false,
    error:       false,
  };
}

// ── Selection/group stats ─────────────────────────────────────────────────────

export function computeSelectionStats(
  statuses: AthleteStatus[],
  histories: Map<string, { d: string; v: number | null }[]>,
): SelectionStats {
  const valid = statuses.filter(s => !s.error && !s.loading && s.acwr !== null);

  const avgAcwr = valid.length > 0
    ? Math.round((valid.reduce((sum, s) => sum + s.acwr!, 0) / valid.length) * 100) / 100
    : null;

  const zoneBreakdown: Record<ACWRZone, number> = {
    optimal: 0, low: 0, elevated: 0, high: 0, building: 0, nodata: 0,
  };
  for (const s of statuses) zoneBreakdown[s.zone]++;

  const avgHistory = buildAverageHistory(statuses.map(s => s.id), histories);

  return {
    count:         statuses.length,
    avgAcwr,
    zoneBreakdown,
    riskCount:     zoneBreakdown.elevated + zoneBreakdown.high,
    avgAcute:      valid.length > 0 ? Math.round(valid.reduce((s, a) => s + a.acuteLoad,  0) / valid.length) : 0,
    avgChronic:    valid.length > 0 ? Math.round(valid.reduce((s, a) => s + a.chronicLoad, 0) / valid.length) : 0,
    avgHistory,
  };
}

/** Build day-by-day average ACWR across multiple athletes (aligned by date) */
function buildAverageHistory(
  athleteIds: string[],
  histories: Map<string, { d: string; v: number | null }[]>,
): { date: string; acwr: number }[] {
  if (athleteIds.length === 0) return [];

  // Collect all dates present in any athlete's history
  const dateSet = new Set<string>();
  for (const id of athleteIds) {
    for (const pt of histories.get(id) ?? []) {
      if (pt.v !== null) dateSet.add(pt.d);
    }
  }

  const dates = Array.from(dateSet).sort();
  // Only show dates where at least half the selected athletes have data
  const minCount = Math.ceil(athleteIds.length / 2);

  // Build per-athlete lookup
  const lookups = athleteIds.map(id => {
    const map = new Map<string, number>();
    for (const pt of histories.get(id) ?? []) {
      if (pt.v !== null) map.set(pt.d, pt.v);
    }
    return map;
  });

  const result: { date: string; acwr: number }[] = [];
  for (const date of dates) {
    const vals = lookups.map(m => m.get(date)).filter((v): v is number => v !== undefined);
    if (vals.length < minCount) continue;
    const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
    result.push({ date, acwr: Math.round(avg * 100) / 100 });
  }

  // Keep last 60 days max
  return result.slice(-60);
}

// ── Alert generation ──────────────────────────────────────────────────────────

export type AlertLevel = 'info' | 'warning' | 'critical';

export interface CoachAlert {
  athleteId: string;
  athleteName: string;
  level: AlertLevel;
  message: string;
}

export function generateAlerts(statuses: AthleteStatus[]): CoachAlert[] {
  const alerts: CoachAlert[] = [];

  for (const s of statuses) {
    if (s.loading || s.error) continue;

    if (s.zone === 'high') {
      alerts.push({ athleteId: s.id, athleteName: s.name, level: 'critical',
        message: `Hohe Überbelastung (ACWR ${s.acwr?.toFixed(2)}) — Erholung dringend empfohlen` });
    } else if (s.zone === 'elevated') {
      alerts.push({ athleteId: s.id, athleteName: s.name, level: 'warning',
        message: `Erhöhte Belastung (ACWR ${s.acwr?.toFixed(2)}) — Intensität prüfen` });
    } else if (s.zone === 'low') {
      alerts.push({ athleteId: s.id, athleteName: s.name, level: 'info',
        message: `Unterbelastung (ACWR ${s.acwr?.toFixed(2)}) — zusätzliche Reize möglich` });
    }

    if (s.trend !== null && s.trend > 0.2 && s.zone !== 'optimal') {
      alerts.push({ athleteId: s.id, athleteName: s.name, level: 'warning',
        message: `Steigende Belastung (+${s.trend.toFixed(2)} vs. letzte Woche)` });
    }

    if (s.dataAge > 2) {
      alerts.push({ athleteId: s.id, athleteName: s.name, level: 'info',
        message: `Daten ${s.dataAge} Tage alt — Link ggf. erneuern` });
    }
  }

  // Sort: critical first
  const order: AlertLevel[] = ['critical', 'warning', 'info'];
  return alerts.sort((a, b) => order.indexOf(a.level) - order.indexOf(b.level));
}

// ── Sort helpers ──────────────────────────────────────────────────────────────

export type SortMode = 'risk' | 'name' | 'acwr-asc' | 'acwr-desc';

const zoneRiskOrder: Record<ACWRZone, number> = {
  high: 0, elevated: 1, low: 2, building: 3, optimal: 4, nodata: 5,
};

export function sortStatuses(statuses: AthleteStatus[], mode: SortMode): AthleteStatus[] {
  return [...statuses].sort((a, b) => {
    switch (mode) {
      case 'risk':      return zoneRiskOrder[a.zone] - zoneRiskOrder[b.zone];
      case 'name':      return a.name.localeCompare(b.name);
      case 'acwr-asc':  return (a.acwr ?? -1) - (b.acwr ?? -1);
      case 'acwr-desc': return (b.acwr ?? -1) - (a.acwr ?? -1);
    }
  });
}

// ── Group colors ──────────────────────────────────────────────────────────────

export const GROUP_COLORS = [
  { key: 'violet', bg: '#7c3aed', light: '#ddd6fe' },
  { key: 'sky',    bg: '#0284c7', light: '#bae6fd' },
  { key: 'emerald',bg: '#059669', light: '#a7f3d0' },
  { key: 'amber',  bg: '#d97706', light: '#fde68a' },
  { key: 'rose',   bg: '#e11d48', light: '#fecdd3' },
  { key: 'cyan',   bg: '#0891b2', light: '#a5f3fc' },
];

export function groupColor(key: string) {
  return GROUP_COLORS.find(c => c.key === key) ?? GROUP_COLORS[0];
}
