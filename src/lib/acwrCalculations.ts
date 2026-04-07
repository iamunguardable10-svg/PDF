import type { Session, PlannedSession, DayLoad, ACWRDataPoint } from '../types/acwr';
import { ACWR_ZONES } from '../types/acwr';

/** Aggregiert alle Sessions zu tägl. Load pro Tag */
export function aggregateDailyLoads(sessions: Session[]): DayLoad[] {
  const map = new Map<string, DayLoad>();

  for (const s of sessions) {
    if (!map.has(s.datum)) {
      map.set(s.datum, { datum: s.datum, loads: {}, taeglLoad: 0 });
    }
    const day = map.get(s.datum)!;
    day.loads[s.te] = (day.loads[s.te] ?? 0) + s.tl;
    day.taeglLoad += s.tl;
  }

  return Array.from(map.values()).sort((a, b) => a.datum.localeCompare(b.datum));
}

/** Füllt fehlende Tage (Ruhetage) mit Load=0 auf, mind. bis heute */
function fillMissingDays(days: DayLoad[]): DayLoad[] {
  if (days.length === 0) return [];
  const result: DayLoad[] = [];
  const start = new Date(days[0].datum + 'T00:00');
  const todayISO = localISO(new Date());
  const lastSession = days[days.length - 1].datum;
  const end = new Date((lastSession < todayISO ? todayISO : lastSession) + 'T00:00');
  const dayMap = new Map(days.map(d => [d.datum, d]));

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = localISO(d);
    result.push(dayMap.get(key) ?? { datum: key, loads: {}, taeglLoad: 0 });
  }
  return result;
}

function localISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Gleitender Durchschnitt über window-Tage (inkl. Nulltage) */
function rollingAvg(loads: number[], index: number, window: number): number {
  const start = Math.max(0, index - window + 1);
  const slice = loads.slice(start, index + 1);
  // Pad mit 0 wenn weniger als window Tage verfügbar (Standard ACWR)
  const sum = slice.reduce((a, b) => a + b, 0);
  return sum / window;
}

/** Berechnet vollständige ACWR-Zeitreihe aus Sessions */
export function calculateACWR(sessions: Session[]): ACWRDataPoint[] {
  const days = fillMissingDays(aggregateDailyLoads(sessions));
  const loads = days.map(d => d.taeglLoad);

  return days.map((day, i) => {
    const acute   = rollingAvg(loads, i, 7);
    const chronic = rollingAvg(loads, i, 28);
    const acwr    = chronic > 0 ? acute / chronic : null;

    return {
      datum:       day.datum,
      taeglLoad:   day.taeglLoad,
      acuteLoad:   Math.round(acute),
      chronicLoad: Math.round(chronic),
      acwr:        acwr !== null ? Math.round(acwr * 100) / 100 : null,
    };
  });
}

/** Aktuellster ACWR-Wert — bevorzugt heutigen Eintrag (Ruhetage senken Acute Load korrekt) */
export function getCurrentACWR(dataPoints: ACWRDataPoint[]): ACWRDataPoint | null {
  if (dataPoints.length === 0) return null;
  // Der letzte Eintrag ist heute (fillMissingDays verlängert bis heute)
  return dataPoints[dataPoints.length - 1];
}

export function getACWRZoneLabel(acwr: number): { label: string; color: string; bg: string } {
  if (acwr < ACWR_ZONES.low)  return { label: 'Low Risk',  color: '#60a5fa', bg: 'bg-blue-900/30'  };
  if (acwr <= ACWR_ZONES.high) return { label: 'Optimal',  color: '#4ade80', bg: 'bg-green-900/30' };
  return                              { label: 'High Risk', color: '#f87171', bg: 'bg-red-900/30'   };
}

/** Geschätzte RPE-Defaults nach TE-Typ für die Projektion */
const PROJECTED_RPE: Record<string, number> = {
  Spiel: 8, Team: 7, 'S&C': 7, Indi: 6,
  Aufwärmen: 5, Schulsport: 5, Prävention: 4,
};

/**
 * Projiziert den ACWR für die nächsten `daysAhead` Tage basierend auf
 * geplanten Sessions (unbestätigt) mit geschätztem TL = DefaultRPE × geschaetzteDauer.
 * Gibt ACWRDataPoints nur für zukünftige Tage zurück (ab morgen).
 */
export function projectFutureACWR(
  sessions: Session[],
  plannedSessions: PlannedSession[],
  daysAhead = 21,
): ACWRDataPoint[] {
  const today = localISO(new Date());
  const historicalDays = fillMissingDays(aggregateDailyLoads(sessions));
  if (historicalDays.length === 0) return [];

  // Geplanten Load pro Tag berechnen (nur zukünftig, unbestätigt)
  const plannedMap = new Map<string, number>();
  for (const ps of plannedSessions) {
    if (ps.confirmed || ps.datum <= today) continue;
    const rpe = PROJECTED_RPE[ps.te] ?? 6;
    const dur = ps.geschaetzteDauer ?? 90;
    plannedMap.set(ps.datum, (plannedMap.get(ps.datum) ?? 0) + rpe * dur);
  }

  // Basis-Load-Array aus History
  const extLoads = historicalDays.map(d => d.taeglLoad);
  const lastDate = historicalDays[historicalDays.length - 1].datum;

  const projected: ACWRDataPoint[] = [];

  for (let i = 1; i <= daysAhead; i++) {
    const d = new Date(lastDate + 'T00:00');
    d.setDate(d.getDate() + i);
    const iso = localISO(d);
    const load = plannedMap.get(iso) ?? 0;
    extLoads.push(load);
    const idx = extLoads.length - 1;
    const acute   = rollingAvg(extLoads, idx, 7);
    const chronic = rollingAvg(extLoads, idx, 28);
    const acwr    = chronic > 0 ? acute / chronic : null;
    projected.push({
      datum:       iso,
      taeglLoad:   load,
      acuteLoad:   Math.round(acute),
      chronicLoad: Math.round(chronic),
      acwr:        acwr !== null ? Math.round(acwr * 100) / 100 : null,
    });
  }

  return projected;
}
