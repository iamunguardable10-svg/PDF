import type { Session, TrainingUnit } from '../types/acwr';
import type { AttendanceSession } from '../types/attendance';
import type { AthleteTeamRpeMap } from './rpeRecordHydration';

export function mapAttendanceTrainingTypeToTrainingUnit(trainingType: string | undefined): TrainingUnit {
  const map: Record<string, TrainingUnit> = {
    Training: 'Team',
    Spiel: 'Spiel',
    Wettkampf: 'Spiel',
    'S&C': 'S&C',
    Taktik: 'Team',
    Videoanalyse: 'Team',
    Regeneration: 'Prävention',
    Sonstiges: 'Team',
  };
  return trainingType ? map[trainingType] ?? 'Team' : 'Team';
}

export function teamSessionConfirmedId(sessionId: string): string {
  return `confirmed-att_${sessionId}`;
}

export function teamSessionDerivedLoadId(sessionId: string): string {
  return `att-record_${sessionId}`;
}

export function hasConfirmedTeamLoad(sessions: Session[], sessionId: string): boolean {
  return sessions.some(session => session.id === teamSessionConfirmedId(sessionId));
}

export function buildAthleteAcwrSessions(input: {
  sessions: Session[];
  attendanceSessions: AttendanceSession[];
  teamRpeMap: AthleteTeamRpeMap;
  playerName: string;
}): Session[] {
  const { sessions, attendanceSessions, teamRpeMap, playerName } = input;
  const unified: Session[] = [...sessions];
  const existingIds = new Set(sessions.map(session => session.id));

  for (const attendanceSession of attendanceSessions) {
    if (hasConfirmedTeamLoad(sessions, attendanceSession.id)) continue;

    const rpeEntry = teamRpeMap.get(attendanceSession.id);
    if (!rpeEntry || rpeEntry.rpe == null || rpeEntry.actualDuration == null) continue;

    const id = teamSessionDerivedLoadId(attendanceSession.id);
    if (existingIds.has(id)) continue;

    unified.push({
      id,
      name: playerName,
      datum: attendanceSession.datum,
      te: mapAttendanceTrainingTypeToTrainingUnit(attendanceSession.trainingType),
      rpe: rpeEntry.rpe,
      dauer: rpeEntry.actualDuration,
      tl: rpeEntry.rpe * rpeEntry.actualDuration,
    });
    existingIds.add(id);
  }

  return unified;
}
