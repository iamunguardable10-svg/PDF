import { CLOUD_ENABLED, supabase } from './supabase';

export type AthleteAvailabilityStatus = 'expected' | 'maybe' | 'no' | 'late';

export interface AthleteAvailabilityRecord {
  id: string;
  sessionId: string;
  athleteUserId: string;
  status: AthleteAvailabilityStatus;
  reason: string;
  lateMinutes?: number;
  updatedAt: string;
}

export interface SaveAvailabilityInput {
  sessionId: string;
  athleteUserId: string;
  status: AthleteAvailabilityStatus;
  reason?: string;
  lateMinutes?: number;
}

type AvailabilityRow = {
  id?: string | null;
  session_id?: string | null;
  athlete_user_id?: string | null;
  override_status?: AthleteAvailabilityStatus | null;
  absence_reason?: string | null;
  late_minutes?: number | null;
  override_at?: string | null;
  updated_at?: string | null;
};

const STORAGE_KEY = 'teamload_availability_v1';

export function validateAvailability(input: SaveAvailabilityInput): string | null {
  if (input.status === 'expected') return null;
  if ((input.status === 'maybe' || input.status === 'no') && !input.reason?.trim()) {
    return 'Bitte gib einen Grund an.';
  }
  if (input.status === 'late') {
    const minutes = input.lateMinutes ?? 0;
    if (!Number.isFinite(minutes) || minutes < 5) return 'Bitte gib an, wie viele Minuten du zu spät kommst.';
    if (minutes > 120) return 'Verspätung darf maximal 120 Minuten betragen.';
  }
  return null;
}

export function loadAvailabilityRecords(): AthleteAvailabilityRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as AthleteAvailabilityRecord[] : [];
  } catch {
    return [];
  }
}

export function saveAvailability(input: SaveAvailabilityInput): AthleteAvailabilityRecord | null {
  const error = validateAvailability(input);
  if (error) return null;

  const all = loadAvailabilityRecords();
  const existingIndex = all.findIndex(item => item.sessionId === input.sessionId && item.athleteUserId === input.athleteUserId);
  const record: AthleteAvailabilityRecord = {
    id: existingIndex >= 0 ? all[existingIndex].id : crypto.randomUUID(),
    sessionId: input.sessionId,
    athleteUserId: input.athleteUserId,
    status: input.status,
    reason: input.reason?.trim() ?? '',
    lateMinutes: input.status === 'late' ? Math.max(5, Math.min(120, Math.round(input.lateMinutes ?? 15))) : undefined,
    updatedAt: new Date().toISOString(),
  };

  if (existingIndex >= 0) all[existingIndex] = record;
  else all.push(record);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  return record;
}

export function clearAvailability(sessionId: string, athleteUserId: string): void {
  const next = loadAvailabilityRecords().filter(item => !(item.sessionId === sessionId && item.athleteUserId === athleteUserId));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function getAvailabilityForSession(sessionId: string, athleteUserId: string): AthleteAvailabilityRecord | null {
  return loadAvailabilityRecords().find(item => item.sessionId === sessionId && item.athleteUserId === athleteUserId) ?? null;
}

export function loadAvailabilityForSessions(sessionIds: string[], athleteUserId: string): Record<string, AthleteAvailabilityRecord> {
  const idSet = new Set(sessionIds);
  return Object.fromEntries(
    loadAvailabilityRecords()
      .filter(item => item.athleteUserId === athleteUserId && idSet.has(item.sessionId))
      .map(item => [item.sessionId, item]),
  );
}

export async function loadAvailabilityForSessionsAsync(sessionIds: string[], athleteUserId: string): Promise<Record<string, AthleteAvailabilityRecord>> {
  const local = loadAvailabilityForSessions(sessionIds, athleteUserId);
  if (!CLOUD_ENABLED || sessionIds.length === 0) return local;

  try {
    const { data, error } = await supabase
      .from('att_records')
      .select('id, session_id, athlete_user_id, override_status, absence_reason, late_minutes, override_at, updated_at')
      .eq('athlete_user_id', athleteUserId)
      .in('session_id', sessionIds);

    if (error) {
      console.warn('[loadAvailabilityForSessionsAsync]', error.message);
      return local;
    }

    const cloud = (data ?? [])
      .map(rowToAvailabilityRecord)
      .filter((record): record is AthleteAvailabilityRecord => Boolean(record));

    if (cloud.length === 0) return local;
    return { ...local, ...Object.fromEntries(cloud.map(record => [record.sessionId, record])) };
  } catch (error) {
    console.warn('[loadAvailabilityForSessionsAsync]', error);
    return local;
  }
}

export async function saveAvailabilityAsync(input: SaveAvailabilityInput): Promise<AthleteAvailabilityRecord | null> {
  const record = saveAvailability(input);
  if (!record || !CLOUD_ENABLED) return record;

  try {
    const { data: existing, error: selectError } = await supabase
      .from('att_records')
      .select('id')
      .eq('session_id', input.sessionId)
      .eq('athlete_user_id', input.athleteUserId)
      .maybeSingle();

    if (selectError) {
      console.warn('[saveAvailabilityAsync:select]', selectError.message);
      return record;
    }

    const patch = {
      override_status: input.status,
      absence_reason: input.reason?.trim() ?? '',
      late_minutes: input.status === 'late' ? record.lateMinutes ?? null : null,
      override_at: record.updatedAt,
    };

    if (existing?.id) {
      const { error } = await supabase.from('att_records').update(patch).eq('id', existing.id);
      if (error) console.warn('[saveAvailabilityAsync:update]', error.message);
    } else {
      const { error } = await supabase.from('att_records').insert({
        id: record.id,
        session_id: input.sessionId,
        athlete_user_id: input.athleteUserId,
        athlete_name: 'Athlete',
        ...patch,
      });
      if (error) console.warn('[saveAvailabilityAsync:insert]', error.message);
    }
  } catch (error) {
    console.warn('[saveAvailabilityAsync]', error);
  }

  return record;
}

export async function clearAvailabilityAsync(sessionId: string, athleteUserId: string): Promise<void> {
  clearAvailability(sessionId, athleteUserId);
  if (!CLOUD_ENABLED) return;

  try {
    const { error } = await supabase
      .from('att_records')
      .update({ override_status: null, absence_reason: '', late_minutes: null, override_at: new Date().toISOString() })
      .eq('session_id', sessionId)
      .eq('athlete_user_id', athleteUserId);

    if (error) console.warn('[clearAvailabilityAsync]', error.message);
  } catch (error) {
    console.warn('[clearAvailabilityAsync]', error);
  }
}

export function statusLabel(status: AthleteAvailabilityStatus): string {
  const labels: Record<AthleteAvailabilityStatus, string> = {
    expected: 'Erwartet',
    maybe: 'Unsicher',
    no: 'Absage',
    late: 'Verspätet',
  };
  return labels[status];
}

export function summarizeAvailability(record: AthleteAvailabilityRecord | null): string {
  if (!record || record.status === 'expected') return 'Erwartet / verfügbar';
  if (record.status === 'late') return `${record.lateMinutes ?? 0} Min. zu spät${record.reason ? ` · ${record.reason}` : ''}`;
  return record.reason ? `${statusLabel(record.status)} · ${record.reason}` : statusLabel(record.status);
}

function rowToAvailabilityRecord(row: AvailabilityRow): AthleteAvailabilityRecord | null {
  if (!row.session_id || !row.athlete_user_id || !row.override_status) return null;
  return {
    id: row.id ?? `${row.session_id}:${row.athlete_user_id}`,
    sessionId: row.session_id,
    athleteUserId: row.athlete_user_id,
    status: row.override_status,
    reason: row.absence_reason ?? '',
    lateMinutes: row.late_minutes ?? undefined,
    updatedAt: row.override_at ?? row.updated_at ?? new Date().toISOString(),
  };
}
