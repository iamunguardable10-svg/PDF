export type TrainingUnit =
  | 'Team'
  | 'S&C'
  | 'Spiel'
  | 'Aufwärmen'
  | 'Indi'
  | 'Schulsport'
  | 'Prävention';

export const TRAINING_UNITS: TrainingUnit[] = [
  'Team', 'S&C', 'Spiel', 'Aufwärmen', 'Indi', 'Schulsport', 'Prävention',
];

export const TE_COLORS: Record<TrainingUnit, string> = {
  'Team':        '#1e40af',
  'S&C':         '#ca8a04',
  'Spiel':       '#7c3aed',
  'Aufwärmen':   '#db2777',
  'Indi':        '#0891b2',
  'Schulsport':  '#16a34a',
  'Prävention':  '#9f1239',
};

export const TE_EMOJI: Record<TrainingUnit, string> = {
  'Team':        '🏀',
  'S&C':         '💪',
  'Spiel':       '🏆',
  'Aufwärmen':   '🔥',
  'Indi':        '🎯',
  'Schulsport':  '🏫',
  'Prävention':  '🩺',
};

/** Abgeschlossene Session mit vollständigen Daten → fließt in ACWR ein */
export interface Session {
  id: string;
  name: string;
  datum: string;    // YYYY-MM-DD
  te: TrainingUnit;
  rpe: number;      // 1–10
  dauer: number;    // Minuten
  tl: number;       // RPE × Dauer
}

/** Geplante Session aus Trainer-Plan — RPE & tatsächliche Dauer fehlen noch */
export interface PlannedSession {
  id: string;
  datum: string;          // YYYY-MM-DD
  te: TrainingUnit;
  uhrzeit?: string;       // z.B. "17:00"
  geschaetzteDauer?: number; // Minuten, aus Trainer-Plan
  notiz?: string;         // z.B. "Hallenboden, Vollzug"
  reminderScheduled: boolean;
  // Nach Eintragen befüllt:
  confirmed: boolean;
  rpe?: number;
  actualDauer?: number;
}

export interface DayLoad {
  datum: string;
  loads: Partial<Record<TrainingUnit, number>>;
  taeglLoad: number;
}

export interface ACWRDataPoint {
  datum: string;
  taeglLoad: number;
  acuteLoad: number;
  chronicLoad: number;
  acwr: number | null;
  chronicFull?: boolean;    // true ab Tag 28 — volles 28d-Fenster
  forecastBasis?: string;   // Basis der Lastschätzung für projizierte Punkte
  plannedTeLoads?: Partial<Record<TrainingUnit, number>>; // Per-TE-Last geplanter Sessions (via medianRpe)
}

export const ACWR_ZONES = {
  low:  0.8,
  high: 1.3,
} as const;
