import type { Session, DayLoad, ACWRDataPoint } from '../types/acwr';

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

/** Füllt fehlende Tage (Ruhetage) mit Load=0 auf */
function fillMissingDays(days: DayLoad[]): DayLoad[] {
  if (days.length === 0) return [];
  const result: DayLoad[] = [];
  const start = new Date(days[0].datum);
  const end   = new Date(days[days.length - 1].datum);
  const dayMap = new Map(days.map(d => [d.datum, d]));

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().split('T')[0];
    result.push(dayMap.get(key) ?? { datum: key, loads: {}, taeglLoad: 0 });
  }
  return result;
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

/** Aktuellster ACWR-Wert */
export function getCurrentACWR(dataPoints: ACWRDataPoint[]): ACWRDataPoint | null {
  const active = dataPoints.filter(d => d.taeglLoad > 0);
  return active[active.length - 1] ?? dataPoints[dataPoints.length - 1] ?? null;
}

export function getACWRZoneLabel(acwr: number): { label: string; color: string; bg: string } {
  if (acwr < 0.8)  return { label: 'Low Risk',    color: '#60a5fa', bg: 'bg-blue-900/30'   };
  if (acwr <= 1.3) return { label: 'Optimal',     color: '#4ade80', bg: 'bg-green-900/30'  };
  return              { label: 'High Risk',   color: '#f87171', bg: 'bg-red-900/30'    };
}
