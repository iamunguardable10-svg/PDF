import type { Session } from '../types/acwr';
import type { AttendanceSession } from '../types/attendance';
import type { AthleteTeamRpeMap } from './rpeRecordHydration';
import { teamSessionConfirmedId } from './athleteLoadSources';

export type TeamRpeSourceAlignmentStatus =
  | 'open'
  | 'recorded-in-attendance'
  | 'confirmed-in-acwr'
  | 'duplicated';

export interface TeamRpeSourceAlignment {
  sessionId: string;
  status: TeamRpeSourceAlignmentStatus;
  hasAttendanceRpe: boolean;
  hasConfirmedAcwrSession: boolean;
  rpe: number | null;
  actualDuration: number | null;
  confirmedSessionId: string;
}

function hasCompleteTeamRpe(teamRpeMap: AthleteTeamRpeMap, sessionId: string): boolean {
  const entry = teamRpeMap.get(sessionId);
  return entry?.rpe != null && entry.actualDuration != null;
}

export function getTeamRpeSourceAlignment(input: {
  attendanceSession: AttendanceSession;
  sessions: Session[];
  teamRpeMap: AthleteTeamRpeMap;
}): TeamRpeSourceAlignment {
  const { attendanceSession, sessions, teamRpeMap } = input;
  const confirmedSessionId = teamSessionConfirmedId(attendanceSession.id);
  const hasConfirmedAcwrSession = sessions.some(session => session.id === confirmedSessionId);
  const hasAttendanceRpe = hasCompleteTeamRpe(teamRpeMap, attendanceSession.id);
  const rpeEntry = teamRpeMap.get(attendanceSession.id);

  let status: TeamRpeSourceAlignmentStatus = 'open';
  if (hasAttendanceRpe && hasConfirmedAcwrSession) status = 'duplicated';
  else if (hasAttendanceRpe) status = 'recorded-in-attendance';
  else if (hasConfirmedAcwrSession) status = 'confirmed-in-acwr';

  return {
    sessionId: attendanceSession.id,
    status,
    hasAttendanceRpe,
    hasConfirmedAcwrSession,
    rpe: rpeEntry?.rpe ?? null,
    actualDuration: rpeEntry?.actualDuration ?? null,
    confirmedSessionId,
  };
}

export function getTeamRpeSourceAlignments(input: {
  attendanceSessions: AttendanceSession[];
  sessions: Session[];
  teamRpeMap: AthleteTeamRpeMap;
}): TeamRpeSourceAlignment[] {
  const { attendanceSessions, sessions, teamRpeMap } = input;
  return attendanceSessions.map(attendanceSession => getTeamRpeSourceAlignment({
    attendanceSession,
    sessions,
    teamRpeMap,
  }));
}

export function shouldAskForTeamRpe(alignment: TeamRpeSourceAlignment): boolean {
  return alignment.status === 'open';
}

export function canReuseTeamRpe(alignment: TeamRpeSourceAlignment): boolean {
  return alignment.status === 'recorded-in-attendance';
}

export function isPotentialDuplicateTeamRpe(alignment: TeamRpeSourceAlignment): boolean {
  return alignment.status === 'duplicated';
}
