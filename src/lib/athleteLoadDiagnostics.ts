import type { Session } from '../types/acwr';
import type { AttendanceSession } from '../types/attendance';
import type { AthleteTeamRpeMap } from './rpeRecordHydration';
import { buildAthleteAcwrSessions, teamSessionConfirmedId } from './athleteLoadSources';

export interface AthleteLoadSourceDiagnostics {
  baseSessionCount: number;
  unifiedSessionCount: number;
  addedTeamRpeSessionCount: number;
  dedupedConfirmedTeamSessionCount: number;
  teamRpeRecordCount: number;
  baseTotalLoad: number;
  unifiedTotalLoad: number;
  addedTeamRpeTotalLoad: number;
}

function totalLoad(sessions: Session[]): number {
  return sessions.reduce((sum, session) => sum + session.tl, 0);
}

export function getAthleteLoadSourceDiagnostics(input: {
  sessions: Session[];
  attendanceSessions: AttendanceSession[];
  teamRpeMap: AthleteTeamRpeMap;
  playerName: string;
}): AthleteLoadSourceDiagnostics {
  const { sessions, attendanceSessions, teamRpeMap, playerName } = input;
  const unifiedSessions = buildAthleteAcwrSessions({ sessions, attendanceSessions, teamRpeMap, playerName });
  const baseSessionIds = new Set(sessions.map(session => session.id));
  const confirmedTeamSessionIds = new Set(
    attendanceSessions
      .map(session => session.id)
      .filter(sessionId => baseSessionIds.has(teamSessionConfirmedId(sessionId))),
  );
  const addedTeamRpeSessions = unifiedSessions.filter(session => !baseSessionIds.has(session.id));

  return {
    baseSessionCount: sessions.length,
    unifiedSessionCount: unifiedSessions.length,
    addedTeamRpeSessionCount: addedTeamRpeSessions.length,
    dedupedConfirmedTeamSessionCount: confirmedTeamSessionIds.size,
    teamRpeRecordCount: teamRpeMap.size,
    baseTotalLoad: totalLoad(sessions),
    unifiedTotalLoad: totalLoad(unifiedSessions),
    addedTeamRpeTotalLoad: totalLoad(addedTeamRpeSessions),
  };
}
