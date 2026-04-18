/**
 * Calendar data loaders.
 * Each loader fetches data from Supabase and maps it to the unified CalEvent format.
 * Screens import these instead of calling attendanceStorage directly.
 */
import { loadSessionsByTeam, loadSessionsByDepartment } from './attendanceStorage';
import type { CalEvent } from '../types/calEvent';
import type { DepartmentCalendarSession } from '../types/organization';

// ── Color maps ────────────────────────────────────────────────────────────────

export const SESSION_TYPE_COLORS: Record<string, string> = {
  Training:     '#7c3aed',
  Spiel:        '#e11d48',
  Wettkampf:    '#ea580c',
  'S&C':        '#059669',
  Taktik:       '#2563eb',
  Videoanalyse: '#0284c7',
  Regeneration: '#0d9488',
  Sonstiges:    '#6b7280',
};

const TEAM_PALETTE = [
  '#7c3aed', '#0284c7', '#059669', '#e11d48', '#d97706',
  '#db2777', '#0891b2', '#65a30d', '#dc2626', '#9333ea',
];

// ── Internal mapper ───────────────────────────────────────────────────────────

function sessionToCalEvent(
  s: DepartmentCalendarSession,
  teamName?: string,
  teamColorOverride?: string,
): CalEvent {
  const typeColor = SESSION_TYPE_COLORS[s.trainingType ?? ''] ?? '#6b7280';
  const color     = typeColor;
  const bgColor   = (teamColorOverride ?? typeColor) + '22';
  return {
    id:           s.id,
    kind:         'session',
    title:        s.title,
    datum:        s.datum,
    startTime:    s.startTime ?? '08:00',
    endTime:      s.endTime   ?? '09:30',
    color,
    bgColor,
    teamId:       s.teamId       ?? undefined,
    teamName,
    departmentId: s.departmentId ?? undefined,
    trainingType: s.trainingType,
    sourceId:     s.id,
  };
}

// ── Public loaders ────────────────────────────────────────────────────────────

/**
 * Load sessions for one team as CalEvents.
 * Used by TeamScreen.
 */
export async function loadTeamSessionsAsEvents(
  teamId: string,
  teamName: string,
  from?: string,
  to?: string,
): Promise<CalEvent[]> {
  const sessions = await loadSessionsByTeam(teamId, from, to);
  return sessions.map(s => sessionToCalEvent(s, teamName));
}

/**
 * Load sessions for a department as CalEvents.
 * Multiple teams get distinct palette colors for visual separation.
 * Used by DepartmentScreen.
 */
export async function loadDeptSessionsAsEvents(
  deptId: string,
  teamNameMap: Record<string, string>,
  from?: string,
  to?: string,
): Promise<CalEvent[]> {
  const sessions = await loadSessionsByDepartment(deptId, from, to);

  // Assign a stable palette color per team
  const teamIds = [...new Set(sessions.map(s => s.teamId).filter(Boolean) as string[])];
  const colorMap: Record<string, string> = {};
  teamIds.forEach((id, i) => { colorMap[id] = TEAM_PALETTE[i % TEAM_PALETTE.length]; });

  return sessions.map(s => {
    const tid = s.teamId ?? undefined;
    return sessionToCalEvent(s, tid ? (teamNameMap[tid] ?? '') : '', tid ? colorMap[tid] : undefined);
  });
}
