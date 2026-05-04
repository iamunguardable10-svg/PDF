import type { FinalAttendanceStatus } from '../types/attendance';
import { CLOUD_ENABLED, supabase } from './supabase';

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

type FinalAttendanceRow = {
  id?: string | null;
  session_id?: string | null;
  athlete_user_id?: string | null;
  athlete_roster_id?: string | null;
  athlete_name?: string | null;
  final_status?: FinalAttendanceStatus | null;
  minutes_participated?: number | null;
  final_note?: string | null;
  finalized_at?: string | null;
  updated_at?: string | null;
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

export async function loadFinalAttendanceForSessionAsync(sessionId: string): Promise<CoachFinalAttendanceRecord[]> {
  const local = loadFinalAttendanceForSession(sessionId);
  if (!CLOUD_ENABLED) return local;

  try {
    const { data, error } = await supabase
      .from('att_records')
      .select('id, session_id, athlete_user_id, athlete_roster_id, athlete_name, final_status, minutes_participated, final_note, finalized_at, updated_at')
      .eq('session_id', sessionId);

    if (error) {
      console.warn('[loadFinalAttendanceForSessionAsync]', error.message);
      return local;
    }

    const cloud = (data ?? [])
      .map(rowToFinalAttendanceRecord)
      .filter((record): record is CoachFinalAttendanceRecord => Boolean(record));

    if (cloud.length === 0) return local;
    return mergeFinalRecords(local, cloud);
  } catch (error) {
    console.warn('[loadFinalAttendanceForSessionAsync]', error);
    return local;
  }
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

export async function saveFinalAttendanceAsync(sessionId: string, athleteId: string, athleteName: string, input: CoachFinalAttendanceInput): Promise<CoachFinalAttendanceRecord> {
  const record = saveFinalAttendance(sessionId, athleteId, athleteName, input);
  if (!CLOUD_ENABLED) return record;

  try {
    const { data: existing, error: selectError } = await supabase
      .from('att_records')
      .select('id')
      .eq('session_id', sessionId)
      .or(`athlete_user_id.eq.${athleteId},athlete_roster_id.eq.${athleteId}`)
      .maybeSingle();

    if (selectError) {
      console.warn('[saveFinalAttendanceAsync:select]', selectError.message);
      return record;
    }

    const patch = {
      final_status: input.status,
      finalized_at: record.finalizedAt,
      final_note: record.note,
      minutes_participated: input.status === 'partial' ? input.minutesParticipated ?? null : null,
    };

    if (existing?.id) {
      const { error } = await supabase.from('att_records').update(patch).eq('id', existing.id);
      if (error) console.warn('[saveFinalAttendanceAsync:update]', error.message);
    } else {
      const { error } = await supabase.from('att_records').insert({
        id: record.id,
        session_id: sessionId,
        athlete_user_id: athleteId,
        athlete_name: athleteName,
        ...patch,
      });
      if (error) console.warn('[saveFinalAttendanceAsync:insert]', error.message);
    }
  } catch (error) {
    console.warn('[saveFinalAttendanceAsync]', error);
  }

  return record;
}

export function clearFinalAttendance(sessionId: string, athleteId: string): void {
  const next = loadFinalAttendanceRecords().filter(record => record.id !== `${sessionId}:${athleteId}`);
  persist(next);
}

export async function clearFinalAttendanceAsync(sessionId: string, athleteId: string): Promise<void> {
  clearFinalAttendance(sessionId, athleteId);
  if (!CLOUD_ENABLED) return;

  try {
    const { error } = await supabase
      .from('att_records')
      .update({ final_status: null, finalized_at: null, final_note: '', minutes_participated: null })
      .eq('session_id', sessionId)
      .or(`athlete_user_id.eq.${athleteId},athlete_roster_id.eq.${athleteId}`);

    if (error) console.warn('[clearFinalAttendanceAsync]', error.message);
  } catch (error) {
    console.warn('[clearFinalAttendanceAsync]', error);
  }
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

function rowToFinalAttendanceRecord(row: FinalAttendanceRow): CoachFinalAttendanceRecord | null {
  if (!row.session_id || !row.final_status) return null;
  const athleteId = row.athlete_user_id ?? row.athlete_roster_id;
  if (!athleteId) return null;
  return {
    id: `${row.session_id}:${athleteId}`,
    sessionId: row.session_id,
    athleteId,
    athleteName: row.athlete_name ?? 'Athlete',
    status: row.final_status,
    minutesParticipated: row.minutes_participated ?? undefined,
    note: row.final_note ?? '',
    finalizedAt: row.finalized_at ?? row.updated_at ?? new Date().toISOString(),
  };
}

function mergeFinalRecords(local: CoachFinalAttendanceRecord[], cloud: CoachFinalAttendanceRecord[]): CoachFinalAttendanceRecord[] {
  const merged = new Map<string, CoachFinalAttendanceRecord>();
  for (const record of local) merged.set(record.id, record);
  for (const record of cloud) merged.set(record.id, record);
  return Array.from(merged.values()).sort((a, b) => b.finalizedAt.localeCompare(a.finalizedAt));
}
