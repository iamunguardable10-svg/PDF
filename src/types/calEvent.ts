// Unified event format for all coach calendar views.
// Sessions, facility bookings, and blackouts are all CalEvents.

export type CalEventKind = 'session' | 'booking' | 'blackout';
export type CalContext   = 'team' | 'department' | 'facility';

export interface CalEvent {
  id: string;
  kind: CalEventKind;
  title: string;
  datum: string;       // YYYY-MM-DD
  startTime: string;   // HH:MM
  endTime: string;     // HH:MM
  color: string;       // hex — border/accent color
  bgColor?: string;    // hex + alpha — background color
  teamId?: string;
  teamName?: string;
  departmentId?: string;
  trainingType?: string;
  facilityUnitId?: string;
  isConflict?: boolean;
  reason?: string;
  coachName?: string;
  sourceId?: string;   // original session / booking ID
}
