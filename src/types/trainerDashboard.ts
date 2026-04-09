// ── Trainer Dashboard Types ───────────────────────────────────────────────────

export interface ManagedAthlete {
  id: string;
  name: string;
  sport?: string;
  token: string;       // Supabase live-link token
  groupIds: string[];
  addedAt: string;     // ISO date
}

export interface AthleteGroup {
  id: string;
  name: string;
  color: string;       // tailwind color key, e.g. 'violet', 'sky', 'emerald'
}

export interface TrainerRoster {
  athletes: ManagedAthlete[];
  groups: AthleteGroup[];
}

/** ACWR risk classification */
export type ACWRZone = 'optimal' | 'low' | 'elevated' | 'high' | 'building' | 'nodata';

/** Computed live status for one athlete */
export interface AthleteStatus {
  id: string;
  name: string;
  sport?: string;
  token: string;
  groupIds: string[];
  acwr: number | null;
  acuteLoad: number;
  chronicLoad: number;
  zone: ACWRZone;
  /** Difference to 7 days ago — positive = rising */
  trend: number | null;
  lastLoadDate: string | null;
  /** Days since the share data was generated */
  dataAge: number;
  loading: boolean;
  error: boolean;
}

/** Aggregate stats for a group or custom selection */
export interface SelectionStats {
  count: number;
  avgAcwr: number | null;
  zoneBreakdown: Record<ACWRZone, number>;
  riskCount: number;   // elevated + high
  avgAcute: number;
  avgChronic: number;
  /** Day-by-day average ACWR time series across all athletes in selection */
  avgHistory: { date: string; acwr: number }[];
}
