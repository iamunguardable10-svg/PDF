import type { Session, PlannedSession, ACWRDataPoint } from '../types/acwr';

export interface TrainerShareData {
  athleteName: string;
  sport: string;
  generatedAt: string;
  acwrHistory: Array<{ d: string; v: number | null; a: number; c: number }>;
  planned: Array<{ d: string; t: string; u?: string; dur?: number }>;
  sessions28: Array<{ d: string; te: string; rpe: number; tl: number }>;
}

/** Komprimiert ACWR-Daten in einen URL-sicheren Base64-String */
export function encodeShareData(
  athleteName: string,
  sport: string,
  acwrHistory: ACWRDataPoint[],
  plannedSessions: PlannedSession[],
  sessions: Session[],
): string {
  const today = new Date().toISOString().split('T')[0];
  const cutoff28 = new Date();
  cutoff28.setDate(cutoff28.getDate() - 28);
  const cutoff28str = cutoff28.toISOString().split('T')[0];

  const cutoff60 = new Date();
  cutoff60.setDate(cutoff60.getDate() - 60);
  const cutoff60str = cutoff60.toISOString().split('T')[0];

  const future14 = new Date();
  future14.setDate(future14.getDate() + 14);
  const future14str = future14.toISOString().split('T')[0];

  const data: TrainerShareData = {
    athleteName,
    sport,
    generatedAt: today,
    // Letzte 60 Tage ACWR (kompakt)
    acwrHistory: acwrHistory
      .filter(p => p.datum >= cutoff60str)
      .map(p => ({ d: p.datum, v: p.acwr, a: p.acuteLoad, c: p.chronicLoad })),
    // Nächste 14 Tage geplante Sessions
    planned: plannedSessions
      .filter(s => !s.confirmed && s.datum >= today && s.datum <= future14str)
      .map(s => ({ d: s.datum, t: s.te, u: s.uhrzeit, dur: s.geschaetzteDauer })),
    // Letzte 28 Tage abgeschlossene Sessions
    sessions28: sessions
      .filter(s => s.datum >= cutoff28str)
      .map(s => ({ d: s.datum, te: s.te, rpe: s.rpe, tl: s.tl })),
  };

  try {
    return btoa(encodeURIComponent(JSON.stringify(data)));
  } catch {
    return '';
  }
}

/** Dekodiert einen Share-String zurück in TrainerShareData */
export function decodeShareData(encoded: string): TrainerShareData | null {
  try {
    return JSON.parse(decodeURIComponent(atob(encoded))) as TrainerShareData;
  } catch {
    return null;
  }
}
