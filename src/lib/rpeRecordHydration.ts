import { loadMyRecords } from './attendanceStorage';
import type { AttendanceRecord } from '../types/attendance';

export interface AthleteTeamRpeEntry {
  sessionId: string;
  rpe: number | null;
  actualDuration: number | null;
  rpeSubmittedAt: string | null;
}

export type AthleteTeamRpeMap = Map<string, AthleteTeamRpeEntry>;

function toNullableNumber(value: number | undefined): number | null {
  return typeof value === 'number' ? value : null;
}

function toEntry(record: AttendanceRecord): AthleteTeamRpeEntry {
  return {
    sessionId: record.sessionId,
    rpe: toNullableNumber(record.rpe),
    actualDuration: toNullableNumber(record.actualDuration),
    rpeSubmittedAt: record.rpeSubmittedAt ?? null,
  };
}

export async function loadAthleteTeamRpeMap(userId: string): Promise<AthleteTeamRpeMap> {
  const records = await loadMyRecords(userId);
  const map: AthleteTeamRpeMap = new Map();

  for (const record of records) {
    if (record.rpe == null && record.actualDuration == null && !record.rpeSubmittedAt) continue;
    map.set(record.sessionId, toEntry(record));
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
