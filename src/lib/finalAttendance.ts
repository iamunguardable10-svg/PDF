import type { FinalAttendanceStatus } from '../types/attendance';

const STORAGE_KEY = 'teamload_final_attendance_v1';

export type CoachFinalAttendanceInput = {
  status: FinalAttendanceStatus;
  minutesParticipated?: number;
  note?: string;
};

export type CoachFinalAttendanceRecord = {
  id: string;
  sessionId: string;
  athleteId: string;
  athleteName: string;
  status: FinalAttendanceStatus;
  minutesParticipated?: number;
  note: string;
  finalizedAt: string;
};

export function loadFinalAttendanceRecords(): CoachFinalAttendanceRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CoachFinalAttendanceRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function loadFinalAttendanceForSession(sessionId: string): CoachFinalAttendanceRecord[] {
  return loadFinalAttendanceRecords().filter(record => record.sessionId === sessionId);
}

export function saveFinalAttendance(sessionId: string, athleteId: string, athleteName: string, input: CoachFinalAttendanceInput): CoachFinalAttendanceRecord {
  const records = loadFinalAttendanceRecords();
  const now = new Date().toISOString();
  const record: CoachFinalAttendanceRecord = {
    id: `${sessionId}:${athleteId}`,
    sessionId,
    athleteId,
    athleteName,
    status: input.status,
    minutesParticipated: input.minutesParticipated,
    note: input.note?.trim() ?? '',
    finalizedAt: now,
  };
  const next = [record, ...records.filter(item => item.id !== record.id)];
  persist(next);
  return record;
}

export function clearFinalAttendance(sessionId: string, athleteId: string): void {
  const next = loadFinalAttendanceRecords().filter(record => record.id !== `${sessionId}:${athleteId}`);
  persist(next);
}

export function validateFinalAttendance(input: CoachFinalAttendanceInput): string | null {
  if (input.status === 'partial') {
    const minutes = input.minutesParticipated ?? 0;
    if (minutes < 1 || minutes > 240) return 'Partial needs minutes between 1 and 240.';
  }
  return null;
}

export function finalAttendanceLabel(status: FinalAttendanceStatus): string {
  if (status === 'present') return 'Present';
  if (status === 'late') return 'Late';
  if (status === 'partial') return 'Partial';
  if (status === 'excused_absent') return 'Excused';
  return 'Unexcused';
}

function persist(records: CoachFinalAttendanceRecord[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}
