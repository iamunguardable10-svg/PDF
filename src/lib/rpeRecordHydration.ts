import { CLOUD_ENABLED, supabase } from './supabase';

export interface AthleteTeamRpeEntry {
  sessionId: string;
  rpe: number | null;
  actualDuration: number | null;
  rpeSubmittedAt: string | null;
}

export type AthleteTeamRpeMap = Map<string, AthleteTeamRpeEntry>;

function toNullableNumber(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

function toNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

export async function loadAthleteTeamRpeMap(userId: string): Promise<AthleteTeamRpeMap> {
  const map: AthleteTeamRpeMap = new Map();
  if (!CLOUD_ENABLED) return map;

  const { data, error } = await supabase
    .from('att_records')
    .select('session_id, rpe, actual_duration, rpe_submitted_at')
    .eq('athlete_user_id', userId)
    .not('rpe_submitted_at', 'is', null);

  if (error) {
    console.warn('[loadAthleteTeamRpeMap]', error.message);
    return map;
  }

  for (const row of data ?? []) {
    const sessionId = toNullableString(row.session_id);
    if (!sessionId) continue;

    map.set(sessionId, {
      sessionId,
      rpe: toNullableNumber(row.rpe),
      actualDuration: toNullableNumber(row.actual_duration),
      rpeSubmittedAt: toNullableString(row.rpe_submitted_at),
    });
  }

  return map;
}

export function applyTeamRpeToSession<T extends { id: string }>(
  session: T,
  rpeMap: AthleteTeamRpeMap,
): T & { rpe: number | null; actualDuration: number | null; rpeSubmittedAt: string | null } {
  const entry = rpeMap.get(session.id);
  return {
    ...session,
    rpe: entry?.rpe ?? null,
    actualDuration: entry?.actualDuration ?? null,
    rpeSubmittedAt: entry?.rpeSubmittedAt ?? null,
  };
}
