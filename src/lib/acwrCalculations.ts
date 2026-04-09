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

function medianOf(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Gleitender Durchschnitt — Nenner = Fenstergröße inkl. Ruhetage (Load = 0).
 * Ruhetage senken den Durchschnitt korrekt (Detraining-Effekt).
 */
function rollingAvg(loads: number[], index: number, window: number): number {
  const start = Math.max(0, index - window + 1);
  const slice = loads.slice(start, index + 1);
  if (slice.length === 0) return 0;
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

/** Berechnet vollständige ACWR-Zeitreihe aus Sessions */
export function calculateACWR(sessions: Session[]): ACWRDataPoint[] {
  const days = fillMissingDays(aggregateDailyLoads(sessions));
  const loads = days.map(d => d.taeglLoad);

  return days.map((day, i) => {
    const acute   = rollingAvg(loads, i, 7);
    const chronic = rollingAvg(loads, i, 28);
    // ACWR erst ab Tag 8 (i>=7): vorher sind Acute- und Chronic-Fenster identisch → ACWR wäre immer 1.0
    // Ab Tag 28 (i>=27): volles 7/28-Fenster
    const acwr = (i >= 7 && acute > 0 && chronic > 0) ? acute / chronic : null;

    return {
      datum:        day.datum,
      taeglLoad:    day.taeglLoad,
      acuteLoad:    Math.round(acute),
      chronicLoad:  Math.round(chronic),
      acwr:         acwr !== null ? Math.round(acwr * 100) / 100 : null,
      chronicFull:  i >= 27,
    };
  });
}

/** Aktuellster ACWR-Wert */
export function getCurrentACWR(dataPoints: ACWRDataPoint[]): ACWRDataPoint | null {
  if (dataPoints.length === 0) return null;
  return dataPoints[dataPoints.length - 1];
}

export function getACWRZoneLabel(acwr: number): { label: string; color: string; bg: string } {
  if (acwr < ACWR_ZONES.low)  return { label: 'Low Risk',  color: '#60a5fa', bg: 'bg-blue-900/30'  };
  if (acwr <= ACWR_ZONES.high) return { label: 'Optimal',  color: '#4ade80', bg: 'bg-green-900/30' };
  return                              { label: 'High Risk', color: '#f87171', bg: 'bg-red-900/30'   };
}

/**
 * EWMA-basierter ACWR.
 * lambda_acute   = 2 / (7  + 1) = 0.25
 * lambda_chronic = 2 / (28 + 1) ≈ 0.069
 */
export function calculateEWMA(sessions: Session[]): ACWRDataPoint[] {
  const days = fillMissingDays(aggregateDailyLoads(sessions));
  if (days.length === 0) return [];

  const lambdaA = 2 / (7  + 1);
  const lambdaC = 2 / (28 + 1);

  let ewmaAcute   = days[0].taeglLoad;
  let ewmaChronic = days[0].taeglLoad;

  return days.map((day, i) => {
    if (i > 0) {
      ewmaAcute   = lambdaA * day.taeglLoad + (1 - lambdaA) * ewmaAcute;
      ewmaChronic = lambdaC * day.taeglLoad + (1 - lambdaC) * ewmaChronic;
    }
    const acwr = (i >= 7 && ewmaAcute > 0 && ewmaChronic > 0) ? ewmaAcute / ewmaChronic : null;
    return {
      datum:        day.datum,
      taeglLoad:    day.taeglLoad,
      acuteLoad:    Math.round(ewmaAcute),
      chronicLoad:  Math.round(ewmaChronic),
      acwr:         acwr !== null ? Math.round(acwr * 100) / 100 : null,
      chronicFull:  i >= 27,
    };
  });
}

/**
 * Fachliche Belastungsprognose für die nächsten 14 Tage.
 *
 * Für jeden zukünftigen Tag wird zuerst ein predicted_load geschätzt:
 *
 * A) Wenn geplante Sessions vorhanden:
 *    predicted_load = 0.7 × planned_load + 0.2 × weekdayMedian + 0.1 × recentSameWeekdayMedian
 *    — RPE-Fallback: historischer Median-RPE der jeweiligen Trainingsart
 *
 * B) Wenn Wochentag historisch ≥ 75 % Ruhetage (kein Plan):
 *    predicted_load = 0
 *
 * C) Sonst (kein Plan, kein typischer Ruhetag):
 *    predicted_load = 0.5 × weekdayMedian + 0.3 × recentSameWeekdayMedian + 0.2 × recent7DayMean
 *
 * Aus der kombinierten Zeitreihe (hist. Loads + predicted_load) wird dann
 * Acute, Chronic und ACWR berechnet — nie direkt extrapoliert.
 */
export function projectFutureACWR(
  sessions: Session[],
  plannedSessions: PlannedSession[],
  daysAhead = 14,
): ACWRDataPoint[] {
  const today = localISO(new Date());
  const historicalDays = fillMissingDays(aggregateDailyLoads(sessions));
  if (historicalDays.length === 0) return [];

  // ── Planned sessions grouped by date ─────────────────────────────────────
  const maxEndDate = new Date(today + 'T00:00');
  maxEndDate.setDate(maxEndDate.getDate() + daysAhead);
  const endISO = localISO(maxEndDate);

  const plannedMap = new Map<string, PlannedSession[]>();
  for (const ps of plannedSessions) {
    if (!ps.confirmed && ps.datum > today && ps.datum <= endISO) {
      if (!plannedMap.has(ps.datum)) plannedMap.set(ps.datum, []);
      plannedMap.get(ps.datum)!.push(ps);
    }
  }

  // ── Median RPE per training type from history ────────────────────────────
  const rpeByTE = new Map<string, number[]>();
  for (const s of sessions) {
    if (!rpeByTE.has(s.te)) rpeByTE.set(s.te, []);
    rpeByTE.get(s.te)!.push(s.rpe);
  }
  const medianRpeByTE = new Map<string, number>();
  for (const [te, rpes] of rpeByTE) {
    medianRpeByTE.set(te, medianOf(rpes));
  }

  // ── Weekday load statistics (last 12 weeks = 84 days) ────────────────────
  const cut84 = new Date();
  cut84.setDate(cut84.getDate() - 84);
  const cut84ISO = localISO(cut84);
  const recentHistory = historicalDays.filter(d => d.datum >= cut84ISO);

  // loadsByWeekday[0..6]: array of all daily loads for that weekday
  const loadsByWeekday: number[][] = [[], [], [], [], [], [], []];
  for (const d of recentHistory) {
    const wd = new Date(d.datum + 'T00:00').getDay();
    loadsByWeekday[wd].push(d.taeglLoad);
  }

  // ── Extend historical loads for rolling avg calculation ──────────────────
  const extLoads = historicalDays.map(d => d.taeglLoad);
  const lastDate = historicalDays[historicalDays.length - 1].datum;

  // recent7DayMean: fixed from historical data (not updated during projection)
  const recent7 = extLoads.slice(-7);
  const recent7DayMean = recent7.length > 0
    ? recent7.reduce((a, b) => a + b, 0) / recent7.length
    : 0;

  // ── Project day by day ───────────────────────────────────────────────────
  const projected: ACWRDataPoint[] = [];
  const current = new Date(lastDate + 'T00:00');

  while (true) {
    current.setDate(current.getDate() + 1);
    const iso = localISO(current);
    if (iso > endISO) break;

    const wd = current.getDay();
    const wdLoads = loadsByWeekday[wd];

    const weekdayMedian         = medianOf(wdLoads);
    const recentSameWdLoads     = wdLoads.slice(-4);
    const recentSameWeekdayMedian = medianOf(recentSameWdLoads);

    const offDayFraction = wdLoads.length > 0
      ? wdLoads.filter(l => l === 0).length / wdLoads.length
      : 0;

    let predictedLoad: number;
    let forecastBasis: string;

    const dayPlanned = plannedMap.get(iso);

    if (dayPlanned && dayPlanned.length > 0) {
      // A) Geplante Sessions — RPE aus History-Median falls nicht angegeben
      let plannedLoad = 0;
      for (const ps of dayPlanned) {
        const rpe = medianRpeByTE.get(ps.te) ?? 6;
        const dur = ps.geschaetzteDauer ?? 90;
        plannedLoad += rpe * dur;
      }
      predictedLoad = Math.round(
        0.7 * plannedLoad +
        0.2 * weekdayMedian +
        0.1 * recentSameWeekdayMedian,
      );
      forecastBasis = `Plan (${dayPlanned.map(p => p.te).join(', ')})`;

    } else if (offDayFraction >= 0.75) {
      // B) Historisch typischer Ruhetag
      predictedLoad = 0;
      forecastBasis = 'Ruhetag (historisch)';

    } else {
      // C) Wochentagmuster
      predictedLoad = Math.round(
        0.5 * weekdayMedian +
        0.3 * recentSameWeekdayMedian +
        0.2 * recent7DayMean,
      );
      forecastBasis = 'Wochentagmuster';
    }

    extLoads.push(predictedLoad);
    const idx = extLoads.length - 1;
    const acute   = rollingAvg(extLoads, idx, 7);
    const chronic = rollingAvg(extLoads, idx, 28);
    const acwr    = (idx >= 7 && acute > 0 && chronic > 0) ? acute / chronic : null;

    projected.push({
      datum:         iso,
      taeglLoad:     predictedLoad,
      acuteLoad:     Math.round(acute),
      chronicLoad:   Math.round(chronic),
      acwr:          acwr !== null ? Math.round(acwr * 100) / 100 : null,
      chronicFull:   idx >= 27,
      forecastBasis,
    });
  }

  return projected;
}
