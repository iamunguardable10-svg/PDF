// ── Attendance & Session Planning Types ──────────────────────────────────────

export type AttendanceOverrideStatus = 'maybe' | 'no';
export type AbsenceReason = 'verletzt' | 'krank' | 'schule' | 'arbeit' | 'privat' | 'sonstiges';
export type LocationSuggestion = 'present' | 'late' | 'absent';
export type FinalAttendanceStatus = 'present' | 'late' | 'partial' | 'excused_absent' | 'unexcused_absent';
export type AttendanceTrainingType =
  | 'Training' | 'Spiel' | 'Wettkampf' | 'S&C' | 'Taktik'
  | 'Videoanalyse' | 'Regeneration' | 'Sonstiges';

// ── Team ─────────────────────────────────────────────────────────────────────

export interface AttendanceTeam {
  id: string;
  trainerId: string;
  name: string;
  sport: string;
  color: string;
  inviteToken: string | null;
  inviteActive: boolean;
  createdAt: string;
  // ── New columns (additive, nullable) ──────────────────────────────────────
  /** FK → organizations.id  (set after migration) */
  organizationId?: string;
  /** FK → departments.id    (set after migration) */
  departmentId?: string;
}

export interface AttendanceTeamMember {
  id: string;
  teamId: string;
  athleteUserId?: string;
  athleteRosterId?: string;
  name: string;
  sport: string;
  joinedAt: string;
}

// ── Session ───────────────────────────────────────────────────────────────────

export interface AttendanceSession {
  id: string;
  trainerId: string;
  title: string;
  description: string;
  datum: string;        // YYYY-MM-DD  (legacy; derived from startsAt when missing)
  startTime?: string;   // "HH:MM"    (legacy; derived from startsAt when missing)
  endTime?: string;     // "HH:MM"    (legacy; derived from endsAt when missing)
  location: string;
  lat?: number;
  lng?: number;
  radiusM: number;
  teamId?: string;
  trainingType: AttendanceTrainingType | '';
  coachNote: string;
  createdAt: string;
  // ── New columns (additive, nullable) ──────────────────────────────────────
  /** ISO 8601 timestamp — new canonical start time (replaces datum+start_time) */
  startsAt?: string;
  /** ISO 8601 timestamp — new canonical end time   (replaces datum+end_time)   */
  endsAt?: string;
  /** FK → organizations.id */
  organizationId?: string;
  /** FK → departments.id */
  departmentId?: string;
  /** FK → recurrence_rules.id */
  recurrenceRuleId?: string;
}

export interface SessionAthlete {
  id: string;
  sessionId: string;
  athleteUserId?: string;
  athleteRosterId?: string;
  name: string;
}

// ── Attendance Record ─────────────────────────────────────────────────────────

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  athleteUserId?: string;
  athleteRosterId?: string;
  athleteName: string;
  // Athlete override (pre-session)
  overrideStatus?: AttendanceOverrideStatus;
  absenceReason?: AbsenceReason;
  absenceNote: string;
  overrideAt?: string;
  // GPS checks
  check1At?: string;
  check1Detected?: boolean;
  check2At?: string;
  check2Detected?: boolean;
  locationSuggestion?: LocationSuggestion;
  // Trainer final
  finalStatus?: FinalAttendanceStatus;
  finalizedAt?: string;
}

// Derived effective status for display
export type EffectiveAttendanceStatus =
  | 'expected'       // default, no override
  | 'maybe'          // athlete said unsure
  | 'no'             // athlete cancelled
  | 'present'
  | 'late'
  | 'partial'
  | 'excused_absent'
  | 'unexcused_absent';

export function getEffectiveStatus(record: AttendanceRecord): EffectiveAttendanceStatus {
  if (record.finalStatus) return record.finalStatus;
  if (record.overrideStatus === 'no') return 'no';
  if (record.overrideStatus === 'maybe') return 'maybe';
  return 'expected';
}

// ── Chat ─────────────────────────────────────────────────────────────────────

export interface TeamMessage {
  id: string;
  teamId: string;
  senderUserId: string;
  senderName: string;
  message: string;
  createdAt: string;
}

export interface SessionMessage {
  id: string;
  sessionId: string;
  senderUserId: string;
  senderName: string;
  message: string;
  createdAt: string;
}

// ── Analytics ─────────────────────────────────────────────────────────────────

export interface AthleteAttendanceStats {
  athleteId: string;
  athleteName: string;
  eligible: number;
  present: number;
  late: number;
  partial: number;
  excusedAbsent: number;
  unexcusedAbsent: number;
  noShow: number;         // cancelled but no final status
  attendanceRate: number; // present+late+partial / eligible
  lateRate: number;
  excusedRate: number;
  overrideCount: number;  // how often they submitted overrides
}

export interface TeamAttendanceStats {
  sessionCount: number;
  avgAttendanceRate: number;
  lateRate: number;
  topAbsenceReasons: { reason: AbsenceReason; count: number }[];
  athleteStats: AthleteAttendanceStats[];
  weeklyRates: { week: string; rate: number }[];
}

// ── Session with records (combined view) ─────────────────────────────────────

export interface SessionWithRecords {
  session: AttendanceSession;
  athletes: SessionAthlete[];
  records: AttendanceRecord[];
  team?: AttendanceTeam;
}

// ── Alerts ────────────────────────────────────────────────────────────────────

export type AttendanceAlertLevel = 'info' | 'warning' | 'critical';

export interface AttendanceAlert {
  athleteId: string;
  athleteName: string;
  level: AttendanceAlertLevel;
  message: string;
}
