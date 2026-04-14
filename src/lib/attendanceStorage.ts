import { supabase, CLOUD_ENABLED } from './supabase';
import type {
  AttendanceTeam, AttendanceTeamMember, AttendanceSession, SessionAthlete,
  AttendanceRecord, TeamMessage, SessionMessage,
  AttendanceOverrideStatus, AbsenceReason, FinalAttendanceStatus,
  AthleteAttendanceStats, AttendanceAlert, AttendanceAlertLevel,
} from '../types/attendance';

function randomId(len = 20): string {
  const c = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: len }, () => c[Math.floor(Math.random() * c.length)]).join('');
}

// ── Teams ─────────────────────────────────────────────────────────────────────

function rowToTeam(r: Record<string, unknown>): AttendanceTeam {
  return {
    id: r.id as string,
    trainerId: r.trainer_id as string,
    name: r.name as string,
    sport: r.sport as string,
    color: r.color as string,
    inviteToken: r.invite_token as string | null,
    inviteActive: r.invite_active as boolean,
    createdAt: r.created_at as string,
  };
}

export async function loadTeams(trainerId: string): Promise<AttendanceTeam[]> {
  if (!CLOUD_ENABLED) return [];
  const { data } = await supabase
    .from('att_teams')
    .select('*')
    .eq('trainer_id', trainerId)
    .order('created_at', { ascending: true });
  return (data ?? []).map(rowToTeam);
}

export async function createTeam(
  trainerId: string,
  name: string,
  sport: string,
  color: string,
): Promise<AttendanceTeam | null> {
  if (!CLOUD_ENABLED) return null;
  const id = 'team_' + randomId();
  const inviteToken = 'ti_' + randomId(24);
  const { data, error } = await supabase
    .from('att_teams')
    .insert({ id, trainer_id: trainerId, name, sport, color, invite_token: inviteToken })
    .select()
    .single();
  if (error || !data) return null;
  return rowToTeam(data);
}

export async function updateTeam(
  teamId: string,
  patch: Partial<{ name: string; sport: string; color: string }>,
): Promise<void> {
  if (!CLOUD_ENABLED) return;
  await supabase.from('att_teams').update(patch).eq('id', teamId);
}

export async function deleteTeam(teamId: string): Promise<void> {
  if (!CLOUD_ENABLED) return;
  await supabase.from('att_teams').delete().eq('id', teamId);
}

export async function regenerateTeamInvite(teamId: string): Promise<string | null> {
  if (!CLOUD_ENABLED) return null;
  const token = 'ti_' + randomId(24);
  const { error } = await supabase
    .from('att_teams')
    .update({ invite_token: token, invite_active: true })
    .eq('id', teamId);
  return error ? null : token;
}

export async function fetchTeamByInviteToken(token: string): Promise<AttendanceTeam | null> {
  if (!CLOUD_ENABLED) return null;
  const { data } = await supabase
    .from('att_teams')
    .select('*')
    .eq('invite_token', token)
    .eq('invite_active', true)
    .single();
  return data ? rowToTeam(data) : null;
}

// ── Team Members ──────────────────────────────────────────────────────────────

function rowToMember(r: Record<string, unknown>): AttendanceTeamMember {
  return {
    id: r.id as string,
    teamId: r.team_id as string,
    athleteUserId: r.athlete_user_id as string | undefined,
    athleteRosterId: r.athlete_roster_id as string | undefined,
    name: r.name as string,
    sport: r.sport as string,
    joinedAt: r.joined_at as string,
  };
}

export async function loadTeamMembers(teamId: string): Promise<AttendanceTeamMember[]> {
  if (!CLOUD_ENABLED) return [];
  const { data } = await supabase
    .from('att_team_members')
    .select('*')
    .eq('team_id', teamId)
    .order('joined_at', { ascending: true });
  return (data ?? []).map(rowToMember);
}

export async function loadMyTeamMemberships(userId: string): Promise<AttendanceTeamMember[]> {
  if (!CLOUD_ENABLED) return [];
  const { data } = await supabase
    .from('att_team_members')
    .select('*')
    .eq('athlete_user_id', userId);
  return (data ?? []).map(rowToMember);
}

export async function addMemberFromRoster(
  teamId: string,
  rosterId: string,
  name: string,
  sport: string,
): Promise<AttendanceTeamMember | null> {
  if (!CLOUD_ENABLED) return null;
  const id = 'tm_' + randomId();
  const { data, error } = await supabase
    .from('att_team_members')
    .insert({ id, team_id: teamId, athlete_roster_id: rosterId, name, sport })
    .select()
    .single();
  if (error || !data) return null;
  return rowToMember(data);
}

export async function joinTeamViaLink(
  teamId: string,
  userId: string,
  name: string,
  sport: string,
): Promise<boolean> {
  if (!CLOUD_ENABLED) return false;
  const id = 'tm_' + randomId();
  const { error } = await supabase
    .from('att_team_members')
    .insert({ id, team_id: teamId, athlete_user_id: userId, name, sport });
  return !error;
}

export async function removeMember(memberId: string): Promise<void> {
  if (!CLOUD_ENABLED) return;
  await supabase.from('att_team_members').delete().eq('id', memberId);
}

// ── Sessions ──────────────────────────────────────────────────────────────────

function rowToSession(r: Record<string, unknown>): AttendanceSession {
  return {
    id: r.id as string,
    trainerId: r.trainer_id as string,
    title: r.title as string,
    description: r.description as string,
    datum: r.datum as string,
    startTime: r.start_time as string | undefined,
    endTime: r.end_time as string | undefined,
    location: r.location as string,
    lat: r.lat as number | undefined,
    lng: r.lng as number | undefined,
    radiusM: r.radius_m as number,
    teamId: r.team_id as string | undefined,
    trainingType: r.training_type as AttendanceSession['trainingType'],
    coachNote: r.coach_note as string,
    createdAt: r.created_at as string,
  };
}

export async function loadTrainerSessions(trainerId: string): Promise<AttendanceSession[]> {
  if (!CLOUD_ENABLED) return [];
  const { data } = await supabase
    .from('att_sessions')
    .select('*')
    .eq('trainer_id', trainerId)
    .order('datum', { ascending: true });
  return (data ?? []).map(rowToSession);
}

export async function loadMySessions(userId: string): Promise<AttendanceSession[]> {
  if (!CLOUD_ENABLED) return [];
  const { data } = await supabase
    .from('att_session_athletes')
    .select('session_id')
    .eq('athlete_user_id', userId);
  if (!data || data.length === 0) return [];
  const ids = data.map((r: { session_id: string }) => r.session_id);
  const { data: sessions } = await supabase
    .from('att_sessions')
    .select('*')
    .in('id', ids)
    .order('datum', { ascending: true });
  return (sessions ?? []).map(rowToSession);
}

export interface CreateSessionInput {
  trainerId: string;
  title: string;
  description: string;
  datum: string;
  startTime?: string;
  endTime?: string;
  location: string;
  lat?: number;
  lng?: number;
  radiusM?: number;
  teamId?: string;
  trainingType?: string;
  coachNote?: string;
  // Who participates
  memberIds: Array<{ id: string; userId?: string; rosterId?: string; name: string }>;
}

export async function createSession(input: CreateSessionInput): Promise<AttendanceSession | null> {
  if (!CLOUD_ENABLED) { console.warn('[createSession] CLOUD_ENABLED=false'); return null; }
  const sessionId = 'as_' + randomId();
  console.log('[createSession] inserting', { sessionId, trainerId: input.trainerId, datum: input.datum });

  const { data, error } = await supabase
    .from('att_sessions')
    .insert({
      id: sessionId,
      trainer_id: input.trainerId,
      title: input.title,
      description: input.description,
      datum: input.datum,
      start_time: input.startTime,
      end_time: input.endTime,
      location: input.location,
      lat: input.lat,
      lng: input.lng,
      radius_m: input.radiusM ?? 100,
      team_id: input.teamId,
      training_type: input.trainingType ?? '',
      coach_note: input.coachNote ?? '',
    })
    .select()
    .single();

  if (error || !data) {
    console.error('[createSession] FAILED', JSON.stringify(error));
    return null;
  }

  // Create session_athletes + att_records for each participant
  if (input.memberIds.length > 0) {
    const athleteRows = input.memberIds.map(m => ({
      id: 'sa_' + randomId(),
      session_id: sessionId,
      athlete_user_id: m.userId ?? null,
      athlete_roster_id: m.rosterId ?? null,
      name: m.name,
    }));
    const recordRows = input.memberIds.map(m => ({
      id: 'ar_' + randomId(),
      session_id: sessionId,
      athlete_user_id: m.userId ?? null,
      athlete_roster_id: m.rosterId ?? null,
      athlete_name: m.name,
    }));
    await Promise.all([
      supabase.from('att_session_athletes').insert(athleteRows),
      supabase.from('att_records').insert(recordRows),
    ]);
  }

  return rowToSession(data);
}

export async function updateSession(
  sessionId: string,
  patch: Partial<Omit<CreateSessionInput, 'trainerId' | 'memberIds'>>,
): Promise<void> {
  if (!CLOUD_ENABLED) return;
  const dbPatch: Record<string, unknown> = {};
  if (patch.title !== undefined) dbPatch.title = patch.title;
  if (patch.description !== undefined) dbPatch.description = patch.description;
  if (patch.datum !== undefined) dbPatch.datum = patch.datum;
  if (patch.startTime !== undefined) dbPatch.start_time = patch.startTime;
  if (patch.endTime !== undefined) dbPatch.end_time = patch.endTime;
  if (patch.location !== undefined) dbPatch.location = patch.location;
  if (patch.lat !== undefined) dbPatch.lat = patch.lat;
  if (patch.lng !== undefined) dbPatch.lng = patch.lng;
  if (patch.radiusM !== undefined) dbPatch.radius_m = patch.radiusM;
  if (patch.teamId !== undefined) dbPatch.team_id = patch.teamId;
  if (patch.trainingType !== undefined) dbPatch.training_type = patch.trainingType;
  if (patch.coachNote !== undefined) dbPatch.coach_note = patch.coachNote;
  await supabase.from('att_sessions').update(dbPatch).eq('id', sessionId);
}

export async function deleteSession(sessionId: string): Promise<void> {
  if (!CLOUD_ENABLED) return;
  await supabase.from('att_sessions').delete().eq('id', sessionId);
}

// ── Session Athletes ──────────────────────────────────────────────────────────

function rowToSessionAthlete(r: Record<string, unknown>): SessionAthlete {
  return {
    id: r.id as string,
    sessionId: r.session_id as string,
    athleteUserId: r.athlete_user_id as string | undefined,
    athleteRosterId: r.athlete_roster_id as string | undefined,
    name: r.name as string,
  };
}

export async function loadSessionAthletes(sessionId: string): Promise<SessionAthlete[]> {
  if (!CLOUD_ENABLED) return [];
  const { data } = await supabase
    .from('att_session_athletes')
    .select('*')
    .eq('session_id', sessionId);
  return (data ?? []).map(rowToSessionAthlete);
}

// ── Attendance Records ────────────────────────────────────────────────────────

function rowToRecord(r: Record<string, unknown>): AttendanceRecord {
  return {
    id: r.id as string,
    sessionId: r.session_id as string,
    athleteUserId: r.athlete_user_id as string | undefined,
    athleteRosterId: r.athlete_roster_id as string | undefined,
    athleteName: r.athlete_name as string,
    overrideStatus: r.override_status as AttendanceOverrideStatus | undefined,
    absenceReason: r.absence_reason as AbsenceReason | undefined,
    absenceNote: (r.absence_note as string) ?? '',
    overrideAt: r.override_at as string | undefined,
    check1At: r.check1_at as string | undefined,
    check1Detected: r.check1_detected as boolean | undefined,
    check2At: r.check2_at as string | undefined,
    check2Detected: r.check2_detected as boolean | undefined,
    locationSuggestion: r.location_suggestion as AttendanceRecord['locationSuggestion'],
    finalStatus: r.final_status as FinalAttendanceStatus | undefined,
    finalizedAt: r.finalized_at as string | undefined,
  };
}

export async function loadSessionRecords(sessionId: string): Promise<AttendanceRecord[]> {
  if (!CLOUD_ENABLED) return [];
  const { data } = await supabase
    .from('att_records')
    .select('*')
    .eq('session_id', sessionId);
  return (data ?? []).map(rowToRecord);
}

export async function loadMyRecords(userId: string): Promise<AttendanceRecord[]> {
  if (!CLOUD_ENABLED) return [];
  const { data } = await supabase
    .from('att_records')
    .select('*')
    .eq('athlete_user_id', userId)
    .order('session_id');
  return (data ?? []).map(rowToRecord);
}

export async function submitAthleteOverride(
  sessionId: string,
  userId: string,
  status: AttendanceOverrideStatus,
  reason?: AbsenceReason,
  note?: string,
): Promise<void> {
  if (!CLOUD_ENABLED) return;
  await supabase
    .from('att_records')
    .update({
      override_status: status,
      absence_reason: reason ?? null,
      absence_note: note ?? '',
      override_at: new Date().toISOString(),
    })
    .eq('session_id', sessionId)
    .eq('athlete_user_id', userId);
}

export async function clearAthleteOverride(sessionId: string, userId: string): Promise<void> {
  if (!CLOUD_ENABLED) return;
  await supabase
    .from('att_records')
    .update({ override_status: null, absence_reason: null, absence_note: '', override_at: null })
    .eq('session_id', sessionId)
    .eq('athlete_user_id', userId);
}

export async function setFinalStatus(
  recordId: string,
  status: FinalAttendanceStatus,
): Promise<void> {
  if (!CLOUD_ENABLED) return;
  await supabase
    .from('att_records')
    .update({ final_status: status, finalized_at: new Date().toISOString() })
    .eq('id', recordId);
}

export async function clearFinalStatus(recordId: string): Promise<void> {
  if (!CLOUD_ENABLED) return;
  await supabase
    .from('att_records')
    .update({ final_status: null, finalized_at: null })
    .eq('id', recordId);
}

// ── GPS Checks ────────────────────────────────────────────────────────────────

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function runLocationCheck(
  sessionLat: number,
  sessionLng: number,
  radiusM: number,
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('GPS nicht verfügbar')); return; }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const dist = haversineDistance(pos.coords.latitude, pos.coords.longitude, sessionLat, sessionLng);
        resolve(dist <= radiusM);
      },
      () => reject(new Error('Standortabfrage fehlgeschlagen')),
      { timeout: 10000, maximumAge: 30000 },
    );
  });
}

export async function saveLocationCheck(
  sessionId: string,
  userId: string,
  checkNumber: 1 | 2,
  detected: boolean,
): Promise<void> {
  if (!CLOUD_ENABLED) return;
  const col = checkNumber === 1
    ? { check1_at: new Date().toISOString(), check1_detected: detected }
    : { check2_at: new Date().toISOString(), check2_detected: detected };
  await supabase.from('att_records').update(col)
    .eq('session_id', sessionId).eq('athlete_user_id', userId);
}

// ── Chat ─────────────────────────────────────────────────────────────────────

function rowToTeamMsg(r: Record<string, unknown>): TeamMessage {
  return {
    id: r.id as string,
    teamId: r.team_id as string,
    senderUserId: r.sender_user_id as string,
    senderName: r.sender_name as string,
    message: r.message as string,
    createdAt: r.created_at as string,
  };
}

function rowToSessionMsg(r: Record<string, unknown>): SessionMessage {
  return {
    id: r.id as string,
    sessionId: r.session_id as string,
    senderUserId: r.sender_user_id as string,
    senderName: r.sender_name as string,
    message: r.message as string,
    createdAt: r.created_at as string,
  };
}

export async function loadTeamMessages(teamId: string, limit = 60): Promise<TeamMessage[]> {
  if (!CLOUD_ENABLED) return [];
  const { data } = await supabase
    .from('att_team_messages')
    .select('*')
    .eq('team_id', teamId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return ((data ?? []) as Record<string, unknown>[]).map(rowToTeamMsg).reverse();
}

export async function sendTeamMessage(
  teamId: string,
  senderUserId: string,
  senderName: string,
  message: string,
): Promise<void> {
  if (!CLOUD_ENABLED) return;
  await supabase.from('att_team_messages').insert({ team_id: teamId, sender_user_id: senderUserId, sender_name: senderName, message });
}

export async function loadSessionMessages(sessionId: string, limit = 60): Promise<SessionMessage[]> {
  if (!CLOUD_ENABLED) return [];
  const { data } = await supabase
    .from('att_session_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return ((data ?? []) as Record<string, unknown>[]).map(rowToSessionMsg).reverse();
}

export async function sendSessionMessage(
  sessionId: string,
  senderUserId: string,
  senderName: string,
  message: string,
): Promise<void> {
  if (!CLOUD_ENABLED) return;
  await supabase.from('att_session_messages').insert({ session_id: sessionId, sender_user_id: senderUserId, sender_name: senderName, message });
}

// ── Analytics ─────────────────────────────────────────────────────────────────

export function calculateAthleteStats(
  athleteId: string,
  athleteName: string,
  records: AttendanceRecord[],
): AthleteAttendanceStats {
  const mine = records.filter(r => r.athleteUserId === athleteId || r.athleteRosterId === athleteId);
  const eligible = mine.length;
  const present = mine.filter(r => r.finalStatus === 'present').length;
  const late = mine.filter(r => r.finalStatus === 'late').length;
  const partial = mine.filter(r => r.finalStatus === 'partial').length;
  const excusedAbsent = mine.filter(r => r.finalStatus === 'excused_absent').length;
  const unexcusedAbsent = mine.filter(r => r.finalStatus === 'unexcused_absent').length;
  const noShow = mine.filter(r => r.overrideStatus === 'no' && !r.finalStatus).length;
  const overrideCount = mine.filter(r => r.overrideStatus).length;
  return {
    athleteId, athleteName, eligible, present, late, partial, excusedAbsent, unexcusedAbsent, noShow, overrideCount,
    attendanceRate: eligible > 0 ? Math.round(((present + late + partial) / eligible) * 100) : 0,
    lateRate: eligible > 0 ? Math.round((late / eligible) * 100) : 0,
    excusedRate: eligible > 0 ? Math.round((excusedAbsent / eligible) * 100) : 0,
  };
}

export function generateAttendanceAlerts(
  stats: AthleteAttendanceStats[],
): AttendanceAlert[] {
  const alerts: AttendanceAlert[] = [];
  for (const s of stats) {
    if (s.eligible < 3) continue;
    if (s.attendanceRate < 60) {
      alerts.push({ athleteId: s.athleteId, athleteName: s.athleteName, level: 'critical' as AttendanceAlertLevel,
        message: `Sehr niedrige Anwesenheit: ${s.attendanceRate}% (${s.present}/${s.eligible} Einheiten)` });
    } else if (s.attendanceRate < 75) {
      alerts.push({ athleteId: s.athleteId, athleteName: s.athleteName, level: 'warning' as AttendanceAlertLevel,
        message: `Niedrige Anwesenheit: ${s.attendanceRate}%` });
    }
    if (s.lateRate > 25) {
      alerts.push({ athleteId: s.athleteId, athleteName: s.athleteName, level: 'warning' as AttendanceAlertLevel,
        message: `Häufig verspätet: ${s.lateRate}% der Einheiten` });
    }
    if (s.unexcusedAbsent >= 2) {
      alerts.push({ athleteId: s.athleteId, athleteName: s.athleteName, level: 'warning' as AttendanceAlertLevel,
        message: `${s.unexcusedAbsent}× unentschuldigt gefehlt` });
    }
  }
  return alerts.sort((a, b) => {
    const o: Record<AttendanceAlertLevel, number> = { critical: 0, warning: 1, info: 2 };
    return o[a.level] - o[b.level];
  });
}
