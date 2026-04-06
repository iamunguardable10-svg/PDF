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
  'Team':        '#1e40af', // dark blue
  'S&C':         '#ca8a04', // yellow
  'Spiel':       '#7c3aed', // purple
  'Aufwärmen':   '#db2777', // pink
  'Indi':        '#0891b2', // cyan
  'Schulsport':  '#16a34a', // green
  'Prävention':  '#9f1239', // dark red
};

export interface Session {
  id: string;
  name: string;
  datum: string;       // YYYY-MM-DD
  te: TrainingUnit;
  rpe: number;         // 1–10
  dauer: number;       // Minuten
  tl: number;          // = RPE × Dauer (auto-calculated)
}

export interface DayLoad {
  datum: string;
  loads: Partial<Record<TrainingUnit, number>>;
  taeglLoad: number;   // Gesamtload des Tages
}

export interface ACWRDataPoint {
  datum: string;
  taeglLoad: number;
  acuteLoad: number;   // 7-Tage Durchschnitt
  chronicLoad: number; // 28-Tage Durchschnitt
  acwr: number | null; // acute / chronic
}

export const ACWR_ZONES = {
  low:  0.8,
  high: 1.3,
} as const;
