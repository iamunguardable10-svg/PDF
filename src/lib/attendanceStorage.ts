import { supabase, CLOUD_ENABLED } from './supabase';
import type {
  AttendanceTeam, AttendanceTeamMember, AttendanceSession, SessionAthlete,
  AttendanceRecord, TeamMessage, SessionMessage,
  AttendanceOverrideStatus, AbsenceReason, FinalAttendanceStatus,
  AthleteAttendanceStats, AttendanceAlert, AttendanceAlertLevel,
} from '../types/attendance';
import { checkFacilityConflict } from './organizationStorage';

// ── Session operation result types ────────────────────────────────────────────

/**
 * Returned by createSession().
 * session is always populated on success.
 * facilityError is set when the session was saved but the facility booking
 * was skipped due to a conflict or blackout — the UI should show this as a
 * warning (session exists, but no room is reserved).
 */
export interface SessionCreateResult {
  session: AttendanceSession;
  facilityError?: string;
}

/**
 * Returned by updateSession().
 * facilityError is set when the facility booking could not be updated due
 * to a conflict or blackout.  All other fields were still written normally.
 */
export interface SessionUpdateResult {
  facilityError?: string;
}

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
    // New columns — read when present, undefined otherwise
    organizationId: (r.organization_id as string | null) ?? undefined,
    departmentId: (r.department_id as string | null) ?? undefined,
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
  if (error || !data) { console.error('[createTeam]', JSON.stringify(error)); return null; }
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

  // Primary: direct user_id match (athlete joined via invite link)
  const { data: direct } = await supabase
    .from('att_team_members')
    .select('*')
    .eq('athlete_user_id', userId);

  // Secondary: find memberships where trainer added athlete from roster
  // Uses SECURITY DEFINER RPC to bypass RLS on trainer_roster + trainer_shares
  const { data: rosterRows } = await supabase
    .rpc('get_roster_team_memberships', { p_user_id: userId });

  const rosterLinked = (rosterRows ?? []).map(rowToMember);

  // Self-heal: stamp athlete_user_id on any roster-linked rows so future direct queries find them
  const unlinked = (rosterRows ?? []).filter((r: Record<string, unknown>) => !r.athlete_user_id);
  if (unlinked.length > 0) {
    const ids = unlinked.map((r: Record<string, unknown>) => r.id as string);
    supabase.from('att_team_members').update({ athlete_user_id: userId }).in('id', ids).then(() => {});
  }

  // Merge, deduplicate by member id
  const seen = new Set<string>();
  const all: AttendanceTeamMember[] = [];
  for (const m of [...(direct ?? []).map(rowToMember), ...rosterLinked]) {
    if (!seen.has(m.id)) { seen.add(m.id); all.push(m); }
  }
  return all;
}

/** Resolve a live-share token to its Supabase auth user_id via SECURITY DEFINER RPC */
async function resolveUserIdFromToken(token: string): Promise<string | null> {
  const { data } = await supabase
    .rpc('lookup_user_by_share_token', { p_token: token });
  return (data as string | null) ?? null;
}

export async function addMemberFromRoster(
  teamId: string,
  rosterId: string,
  name: string,
  sport: string,
  athleteToken?: string,
): Promise<AttendanceTeamMember | null> {
  if (!CLOUD_ENABLED) return null;
  const athleteUserId = athleteToken ? await resolveUserIdFromToken(athleteToken) : null;
  const id = 'tm_' + randomId();
  const { data, error } = await supabase
    .from('att_team_members')
    .insert({
      id, team_id: teamId, athlete_roster_id: rosterId, name, sport,
      ...(athleteUserId ? { athlete_user_id: athleteUserId } : {}),
    })
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

/**
 * Look up a team by invite token, then join it.
 * Accepts a raw token (ti_xxx) or a full URL containing the token.
 */
export async function joinTeamByToken(
  token: string,
  userId: string,
  name: string,
  sport: string,
): Promise<boolean> {
  if (!CLOUD_ENABLED) return false;
  const team = await fetchTeamByInviteToken(token);
  if (!team || !team.inviteActive) return false;
  return joinTeamViaLink(team.id, userId, name, sport);
}

export async function removeMember(memberId: string): Promise<void> {
  if (!CLOUD_ENABLED) return;
  await supabase.from('att_team_members').delete().eq('id', memberId);
}

// ── Sessions ──────────────────────────────────────────────────────────────────

/**
 * Convert a Supabase att_sessions row to AttendanceSession.
 * Supports both old schema (datum / start_time / end_time) and new schema
 * (starts_at / ends_at).  Old fields take priority when both are present so
 * existing writes are never silently overridden.
 */
function rowToSession(r: Record<string, unknown>): AttendanceSession {
  // ── Legacy date/time fields (always written by current code) ──────────────
  let datum    = (r.datum     as string | null | undefined) ?? undefined;
  let startTime = (r.start_time as string | null | undefined) ?? undefined;
  let endTime   = (r.end_time   as string | null | undefined) ?? undefined;

  // ── New timestamp fields — used as fallback when legacy fields are absent ─
  const startsAt = (r.starts_at as string | null | undefined) ?? undefined;
  const endsAt   = (r.ends_at   as string | null | undefined) ?? undefined;

  if (!datum && startsAt) {
    // Derive local YYYY-MM-DD from ISO timestamp
    datum = localDateFromISO(startsAt);
  }
  if (!startTime && startsAt) {
    startTime = localTimeFromISO(startsAt);
  }
  if (!endTime && endsAt) {
    endTime = localTimeFromISO(endsAt);
  }

  return {
    id:           r.id as string,
    trainerId:    (r.trainer_id as string | null) ?? '',
    title:        r.title as string,
    description:  (r.description as string | null) ?? '',
    datum:        datum ?? '',
    startTime,
    endTime,
    location:     (r.location as string | null) ?? '',
    lat:          r.lat as number | undefined,
    lng:          r.lng as number | undefined,
    radiusM:      (r.radius_m as number | null) ?? 100,
    teamId:       (r.team_id  as string | null) ?? undefined,
    trainingType: (r.training_type as AttendanceSession['trainingType']) ?? '',
    coachNote:    (r.coach_note as string | null) ?? '',
    createdAt:    r.created_at as string,
    // New columns — populate when present
    startsAt,
    endsAt,
    organizationId:   (r.organization_id    as string | null) ?? undefined,
    departmentId:     (r.department_id      as string | null) ?? undefined,
    recurrenceRuleId: (r.recurrence_rule_id as string | null) ?? undefined,
  };
}

/** "2026-04-16T17:00:00+00:00" → "2026-04-16" (local timezone) */
function localDateFromISO(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "2026-04-16T17:00:00+00:00" → "17:00" (local timezone) */
function localTimeFromISO(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Convert a Europe/Berlin local date+time to a UTC ISO 8601 string.
 * Works correctly across CET (UTC+1) and CEST (UTC+2) without any
 * third-party library — uses Intl.DateTimeFormat.formatToParts.
 *
 * Example: "2026-04-16", "17:00" → "2026-04-16T15:00:00.000Z" (CEST)
 */
function berlinToISO(datum: string, time: string): string {
  // Treat the naive local string as UTC to get a rough Date
  const rough = new Date(`${datum}T${time}:00Z`);
  // Ask Intl what time Europe/Berlin shows for that UTC instant
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Berlin',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(rough);
  const p: Record<string, string> = {};
  for (const { type, value } of parts) p[type] = value;
  const shownMin = parseInt(p.hour === '24' ? '0' : p.hour, 10) * 60 + parseInt(p.minute, 10);
  const [wh, wm] = time.split(':').map(Number);
  const wantMin  = wh * 60 + wm;
  // offsetMin = how many minutes ahead Berlin is from UTC at this moment
  let offsetMin = shownMin - wantMin;
  if (offsetMin >  12 * 60) offsetMin -= 24 * 60;
  if (offsetMin < -12 * 60) offsetMin += 24 * 60;
  return new Date(rough.getTime() - offsetMin * 60_000).toISOString();
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
  // New model fields — optional; written additively alongside old columns
  organizationId?: string;
  departmentId?: string;
  /** If provided, also writes an event_facility_bookings row */
  facilityUnitId?: string;
  // Who participates
  memberIds: Array<{ id: string; userId?: string; rosterId?: string; name: string }>;
}

export async function createSession(input: CreateSessionInput): Promise<SessionCreateResult | null> {
  if (!CLOUD_ENABLED) { console.warn('[createSession] CLOUD_ENABLED=false'); return null; }
  const sessionId = 'as_' + randomId();
  console.log('[createSession] inserting', { sessionId, trainerId: input.trainerId, datum: input.datum });

  // ── Compute new-model timestamps (Europe/Berlin → UTC ISO) ──────────────────
  const startsAt = input.startTime ? berlinToISO(input.datum, input.startTime) : null;
  const endsAt   = input.endTime   ? berlinToISO(input.datum, input.endTime)   : null;

  // ── Facility conflict pre-check ──────────────────────────────────────────────
  // Run before any DB write. If a conflict is found, the session is still
  // created (no hard block on the session itself) but the facility booking
  // is skipped and the caller receives facilityError to show the user.
  let facilityError: string | undefined;
  if (input.facilityUnitId && startsAt && endsAt) {
    const conflict = await checkFacilityConflict(input.facilityUnitId, startsAt, endsAt);
    if (conflict.hasConflict) {
      facilityError = conflict.reason ?? 'Hallenkonflikt: Buchung konnte nicht gespeichert werden.';
    }
  }

  const { data, error } = await supabase
    .from('att_sessions')
    .insert({
      // ── Legacy fields — kept for backward-compat ───────────────────────────
      id:            sessionId,
      trainer_id:    input.trainerId,
      title:         input.title,
      description:   input.description,
      datum:         input.datum,
      start_time:    input.startTime ?? null,
      end_time:      input.endTime   ?? null,
      location:      input.location,
      lat:           input.lat   ?? null,
      lng:           input.lng   ?? null,
      radius_m:      input.radiusM ?? 100,
      team_id:       input.teamId ?? null,
      training_type: input.trainingType ?? '',
      coach_note:    input.coachNote ?? '',
      // ── New-model fields — written additively ──────────────────────────────
      starts_at:       startsAt,
      ends_at:         endsAt,
      organization_id: input.organizationId ?? null,
      department_id:   input.departmentId   ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    console.error('[createSession] FAILED', JSON.stringify(error));
    return null;
  }

  // ── Side-table writes (new model) — fire in parallel, non-blocking ──────────
  const sideWrites: PromiseLike<unknown>[] = [];

  // event_teams: one row per participating team
  if (input.teamId) {
    sideWrites.push(
      supabase.from('event_teams').insert({
        id:         'et_' + randomId(),
        session_id: sessionId,
        team_id:    input.teamId,
      }),
    );
  }

  // event_coaches: trainer as head_coach
  sideWrites.push(
    supabase.from('event_coaches').insert({
      id:         'ec_' + randomId(),
      session_id: sessionId,
      user_id:    input.trainerId,
      role:       'head_coach',
    }),
  );

  // event_facility_bookings: only when a facility unit is selected AND no conflict
  if (input.facilityUnitId && startsAt && endsAt && !facilityError) {
    sideWrites.push(
      supabase.from('event_facility_bookings').insert({
        id:               'efb_' + randomId(),
        session_id:       sessionId,
        facility_unit_id: input.facilityUnitId,
        starts_at:        startsAt,
        ends_at:          endsAt,
      }),
    );
  }

  // ── Legacy participant rows ────────────────────────────────────────────────
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
    sideWrites.push(
      supabase.from('att_session_athletes').insert(athleteRows),
      supabase.from('att_records').insert(recordRows),
    );
  }

  await Promise.all(sideWrites);

  return { session: rowToSession(data), facilityError };
}

export async function updateSession(
  sessionId: string,
  // trainerId is now includable so event_coaches can be resynced on trainer change
  patch: Partial<Omit<CreateSessionInput, 'memberIds'>>,
): Promise<SessionUpdateResult> {
  if (!CLOUD_ENABLED) return {};

  // ── Read-first ────────────────────────────────────────────────────────────
  // We always fetch the current row when any field that drives a side-table
  // write is touched.  This lets us (a) fill in missing date/time components
  // when computing starts_at/ends_at, and (b) detect actual changes for
  // event_teams / event_coaches so we don't do unnecessary deletes.
  // We also fetch the current facility_unit_id so that when only timestamps
  // change we can re-check conflict against the existing booking's unit.
  const needsReadFirst =
    patch.datum          !== undefined ||
    patch.startTime      !== undefined ||
    patch.endTime        !== undefined ||
    patch.teamId         !== undefined ||
    patch.trainerId      !== undefined ||
    patch.facilityUnitId !== undefined;

  let cur: Record<string, unknown> = {};
  let curFacilityUnitId: string | null = null;
  if (needsReadFirst) {
    const [sessionResult, bookingResult] = await Promise.all([
      supabase
        .from('att_sessions')
        .select('datum, start_time, end_time, team_id, trainer_id')
        .eq('id', sessionId)
        .single(),
      supabase
        .from('event_facility_bookings')
        .select('facility_unit_id')
        .eq('session_id', sessionId)
        .maybeSingle(),
    ]);
    cur = (sessionResult.data as Record<string, unknown> | null) ?? {};
    curFacilityUnitId = (bookingResult.data as Record<string, unknown> | null)?.facility_unit_id as string | null ?? null;
  }

  // ── Effective merged values (patch wins over current DB) ──────────────────
  const effectiveDatum     = patch.datum     ?? (cur.datum      as string | undefined);
  const effectiveStartTime = patch.startTime ?? (cur.start_time as string | undefined);
  const effectiveEndTime   = patch.endTime   ?? (cur.end_time   as string | undefined);
  const prevTrainerId      = (cur.trainer_id as string | null)  ?? null;

  // ── Build att_sessions patch (legacy + new fields) ────────────────────────
  const dbPatch: Record<string, unknown> = {};

  // Legacy fields — all unchanged, still always written
  if (patch.title         !== undefined) dbPatch.title         = patch.title;
  if (patch.description   !== undefined) dbPatch.description   = patch.description;
  if (patch.datum         !== undefined) dbPatch.datum         = patch.datum;
  if (patch.startTime     !== undefined) dbPatch.start_time    = patch.startTime;
  if (patch.endTime       !== undefined) dbPatch.end_time      = patch.endTime;
  if (patch.location      !== undefined) dbPatch.location      = patch.location;
  if (patch.lat           !== undefined) dbPatch.lat           = patch.lat;
  if (patch.lng           !== undefined) dbPatch.lng           = patch.lng;
  if (patch.radiusM       !== undefined) dbPatch.radius_m      = patch.radiusM;
  if (patch.teamId        !== undefined) dbPatch.team_id       = patch.teamId ?? null;
  if (patch.trainerId     !== undefined) dbPatch.trainer_id    = patch.trainerId;
  if (patch.trainingType  !== undefined) dbPatch.training_type = patch.trainingType;
  if (patch.coachNote     !== undefined) dbPatch.coach_note    = patch.coachNote;

  // New-model timestamps — recomputed from effective (merged) date + times
  // Both components must be known; otherwise we leave the column untouched.
  if (effectiveDatum && effectiveStartTime) {
    dbPatch.starts_at = berlinToISO(effectiveDatum, effectiveStartTime);
  }
  if (effectiveDatum && effectiveEndTime) {
    dbPatch.ends_at = berlinToISO(effectiveDatum, effectiveEndTime);
  }

  // New-model org / dept
  if (patch.organizationId !== undefined) dbPatch.organization_id = patch.organizationId ?? null;
  if (patch.departmentId   !== undefined) dbPatch.department_id   = patch.departmentId   ?? null;

  // ── Main UPDATE ───────────────────────────────────────────────────────────
  await supabase.from('att_sessions').update(dbPatch).eq('id', sessionId);

  // ── Side-table sync (new model) ───────────────────────────────────────────
  // Each group is delete-then-insert so we avoid unique-constraint races.
  // Independent groups run in parallel via Promise.all.
  const sideGroups: Promise<void>[] = [];

  // event_teams — replace when teamId changes
  if (patch.teamId !== undefined) {
    sideGroups.push((async () => {
      await supabase.from('event_teams').delete().eq('session_id', sessionId);
      if (patch.teamId) {
        await supabase.from('event_teams').insert({
          id:         'et_' + randomId(),
          session_id: sessionId,
          team_id:    patch.teamId,
        });
      }
    })());
  }

  // event_coaches — replace head_coach when trainerId changes
  if (patch.trainerId !== undefined && patch.trainerId !== prevTrainerId) {
    sideGroups.push((async () => {
      await supabase
        .from('event_coaches')
        .delete()
        .eq('session_id', sessionId)
        .eq('role', 'head_coach');
      if (patch.trainerId) {
        await supabase.from('event_coaches').insert({
          id:         'ec_' + randomId(),
          session_id: sessionId,
          user_id:    patch.trainerId,
          role:       'head_coach',
        });
      }
    })());
  }

  // ── Facility conflict check ───────────────────────────────────────────────
  // We check when:
  //   (a) the caller explicitly sets a new facilityUnitId, or
  //   (b) timestamps change and there is already a booking on this session.
  // In both cases the session update proceeds; only the booking is blocked.
  let facilityError: string | undefined;

  const targetUnitId = patch.facilityUnitId !== undefined ? patch.facilityUnitId : curFacilityUnitId;
  const newStartsAt  = effectiveDatum && effectiveStartTime ? berlinToISO(effectiveDatum, effectiveStartTime) : null;
  const newEndsAt    = effectiveDatum && effectiveEndTime   ? berlinToISO(effectiveDatum, effectiveEndTime)   : null;

  const shouldCheckConflict =
    targetUnitId && newStartsAt && newEndsAt &&
    (patch.facilityUnitId !== undefined ||
     patch.datum !== undefined ||
     patch.startTime !== undefined ||
     patch.endTime !== undefined);

  if (shouldCheckConflict && targetUnitId && newStartsAt && newEndsAt) {
    const conflict = await checkFacilityConflict(targetUnitId, newStartsAt, newEndsAt, sessionId);
    if (conflict.hasConflict) {
      facilityError = conflict.reason ?? 'Hallenkonflikt: Buchung konnte nicht gespeichert werden.';
    }
  }

  // event_facility_bookings — replace when facilityUnitId is explicitly patched
  // (skipped entirely when a conflict was detected)
  if (patch.facilityUnitId !== undefined && !facilityError) {
    sideGroups.push((async () => {
      await supabase.from('event_facility_bookings').delete().eq('session_id', sessionId);
      if (patch.facilityUnitId && effectiveDatum && effectiveStartTime && effectiveEndTime) {
        await supabase.from('event_facility_bookings').insert({
          id:               'efb_' + randomId(),
          session_id:       sessionId,
          facility_unit_id: patch.facilityUnitId,
          starts_at:        berlinToISO(effectiveDatum, effectiveStartTime),
          ends_at:          berlinToISO(effectiveDatum, effectiveEndTime),
        });
      }
    })());
  } else if (patch.facilityUnitId === undefined && curFacilityUnitId && newStartsAt && newEndsAt && !facilityError) {
    // Timestamps changed but unit is the same — update the existing booking's timestamps
    sideGroups.push((async () => {
      await supabase
        .from('event_facility_bookings')
        .update({ starts_at: newStartsAt, ends_at: newEndsAt })
        .eq('session_id', sessionId);
    })());
  }

  if (sideGroups.length > 0) await Promise.all(sideGroups);

  return { facilityError };
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

export async function loadRecordsBySessionIds(sessionIds: string[]): Promise<AttendanceRecord[]> {
  if (!CLOUD_ENABLED || sessionIds.length === 0) return [];
  const { data } = await supabase
    .from('att_records')
    .select('*')
    .in('session_id', sessionIds);
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

// ── New Read Layer — additive, no writes changed ───────────────────────────────
// These functions read from the new schema tables / new columns.
// Old functions above remain unchanged as fallback.

import type { TeamMembership, DepartmentCalendarSession } from '../types/organization';

// ── Team reads via new schema ─────────────────────────────────────────────────

/**
 * Load all teams belonging to an organization.
 * Uses the new att_teams.organization_id column (must be set after migration).
 * Falls back gracefully to empty when CLOUD_ENABLED = false.
 */
export async function loadTeamsByOrganization(orgId: string): Promise<AttendanceTeam[]> {
  if (!CLOUD_ENABLED) return [];
  const { data, error } = await supabase
    .from('att_teams')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: true });
  if (error) { console.warn('[loadTeamsByOrganization]', error.message); return []; }
  return (data ?? []).map(rowToTeam);
}

/**
 * Load all teams belonging to a department.
 * Uses the new att_teams.department_id column.
 */
export async function loadTeamsByDepartment(deptId: string): Promise<AttendanceTeam[]> {
  if (!CLOUD_ENABLED) return [];
  const { data, error } = await supabase
    .from('att_teams')
    .select('*')
    .eq('department_id', deptId)
    .order('created_at', { ascending: true });
  if (error) { console.warn('[loadTeamsByDepartment]', error.message); return []; }
  return (data ?? []).map(rowToTeam);
}

// ── Team membership reads via new table ───────────────────────────────────────

function rowToTeamMembership(r: Record<string, unknown>): TeamMembership {
  return {
    id:          r.id as string,
    teamId:      r.team_id as string,
    userId:      r.user_id as string,
    role:        (r.role as TeamMembership['role']) ?? 'athlete',
    displayName: (r.display_name as string | null) ?? null,
    joinedAt:    r.joined_at as string,
  };
}

/**
 * Load team members from the NEW team_memberships table.
 * Returns TeamMembership[] — richer than old AttendanceTeamMember (has role, userId).
 * Use loadTeamMembers() (old) for name/sport from att_team_members.
 */
export async function loadTeamMembershipsNew(teamId: string): Promise<TeamMembership[]> {
  if (!CLOUD_ENABLED) return [];
  const { data, error } = await supabase
    .from('team_memberships')
    .select('*')
    .eq('team_id', teamId)
    .order('joined_at', { ascending: true });
  if (error) { console.warn('[loadTeamMembershipsNew]', error.message); return []; }
  return (data ?? []).map(rowToTeamMembership);
}

/**
 * Load all team memberships for a user (athlete or coach) from the new table.
 * Use loadMyTeamMemberships() (old) to get the full legacy member record.
 */
export async function loadMyTeamMembershipsNew(userId: string): Promise<TeamMembership[]> {
  if (!CLOUD_ENABLED) return [];
  const { data, error } = await supabase
    .from('team_memberships')
    .select('*')
    .eq('user_id', userId)
    .order('joined_at', { ascending: true });
  if (error) { console.warn('[loadMyTeamMembershipsNew]', error.message); return []; }
  return (data ?? []).map(rowToTeamMembership);
}

/**
 * Load team memberships for a specific role in a team.
 * e.g. loadTeamMembersByRole(teamId, 'head_coach') to find coaches.
 */
export async function loadTeamMembersByRole(
  teamId: string,
  role: TeamMembership['role'],
): Promise<TeamMembership[]> {
  if (!CLOUD_ENABLED) return [];
  const { data, error } = await supabase
    .from('team_memberships')
    .select('*')
    .eq('team_id', teamId)
    .eq('role', role)
    .order('joined_at', { ascending: true });
  if (error) { console.warn('[loadTeamMembersByRole]', error.message); return []; }
  return (data ?? []).map(rowToTeamMembership);
}

// ── Department calendar reads ─────────────────────────────────────────────────

/**
 * Convert an att_sessions row to DepartmentCalendarSession.
 * Requires starts_at / ends_at to be present (new schema).
 */
function rowToDeptSession(r: Record<string, unknown>): DepartmentCalendarSession {
  const startsAt = r.starts_at as string;
  const endsAt   = r.ends_at   as string;
  // Derive legacy fields for backward compat with existing calendar components
  const datum     = (r.datum      as string | null) ?? localDateFromISO(startsAt);
  const startTime = (r.start_time as string | null) ?? localTimeFromISO(startsAt);
  const endTime   = (r.end_time   as string | null) ?? localTimeFromISO(endsAt);
  return {
    id:               r.id as string,
    startsAt,
    endsAt,
    datum,
    startTime,
    endTime,
    title:            (r.title         as string | null) ?? '',
    location:         (r.location      as string | null) ?? '',
    trainingType:     (r.training_type as string | null) ?? '',
    coachNote:        (r.coach_note    as string | null) ?? '',
    teamId:           (r.team_id       as string | null) ?? null,
    organizationId:   (r.organization_id    as string | null) ?? null,
    departmentId:     (r.department_id      as string | null) ?? null,
    recurrenceRuleId: (r.recurrence_rule_id as string | null) ?? null,
    trainerId:        (r.trainer_id    as string | null) ?? null,
    createdAt:        r.created_at as string,
  };
}

/**
 * Load sessions for a department using the new att_sessions.department_id column
 * and the new starts_at / ends_at timestamps.
 *
 * @param deptId  - department UUID
 * @param from    - ISO date string "YYYY-MM-DD" (inclusive start of window)
 * @param to      - ISO date string "YYYY-MM-DD" (inclusive end of window)
 *
 * Returns DepartmentCalendarSession[] with both new (startsAt/endsAt) and
 * legacy (datum/startTime/endTime) fields populated so existing components work.
 */
export async function loadSessionsByDepartment(
  deptId: string,
  from?: string,
  to?: string,
): Promise<DepartmentCalendarSession[]> {
  if (!CLOUD_ENABLED) return [];

  let query = supabase
    .from('att_sessions')
    .select('*')
    .eq('department_id', deptId);

  if (from) query = query.gte('starts_at', `${from}T00:00:00`);
  if (to)   query = query.lte('starts_at', `${to}T23:59:59`);

  query = query.order('starts_at', { ascending: true });

  const { data, error } = await query;
  if (error) { console.warn('[loadSessionsByDepartment]', error.message); return []; }
  // Filter out rows missing starts_at (legacy rows not yet migrated)
  return (data ?? [])
    .filter((r: Record<string, unknown>) => !!r.starts_at)
    .map(rowToDeptSession);
}

/**
 * Load sessions for an organization using att_sessions.organization_id.
 * Uses starts_at / ends_at for ordering and filtering.
 */
export async function loadSessionsByOrganization(
  orgId: string,
  from?: string,
  to?: string,
): Promise<DepartmentCalendarSession[]> {
  if (!CLOUD_ENABLED) return [];

  let query = supabase
    .from('att_sessions')
    .select('*')
    .eq('organization_id', orgId);

  if (from) query = query.gte('starts_at', `${from}T00:00:00`);
  if (to)   query = query.lte('starts_at', `${to}T23:59:59`);

  query = query.order('starts_at', { ascending: true });

  const { data, error } = await query;
  if (error) { console.warn('[loadSessionsByOrganization]', error.message); return []; }
  return (data ?? [])
    .filter((r: Record<string, unknown>) => !!r.starts_at)
    .map(rowToDeptSession);
}

/**
 * Load the event_teams rows for a session — which teams are attached.
 * Useful when a session has multiple teams (new many-to-many model).
 */
export async function loadEventTeams(sessionId: string): Promise<{ teamId: string; teamName?: string }[]> {
  if (!CLOUD_ENABLED) return [];
  const { data, error } = await supabase
    .from('event_teams')
    .select('team_id, att_teams(name)')
    .eq('session_id', sessionId);
  if (error) { console.warn('[loadEventTeams]', error.message); return []; }
  return (data ?? []).map((r: Record<string, unknown>) => ({
    teamId:   r.team_id as string,
    teamName: ((r.att_teams as Record<string, unknown> | null)?.name as string | undefined),
  }));
}

/**
 * Load the event_coaches rows for a session — which coaches are attached.
 */
export async function loadEventCoaches(sessionId: string): Promise<{ userId: string; role: string }[]> {
  if (!CLOUD_ENABLED) return [];
  const { data, error } = await supabase
    .from('event_coaches')
    .select('user_id, role')
    .eq('session_id', sessionId);
  if (error) { console.warn('[loadEventCoaches]', error.message); return []; }
  return (data ?? []).map((r: Record<string, unknown>) => ({
    userId: r.user_id as string,
    role:   (r.role as string) ?? '',
  }));
}

/**
 * Bulk-load facility info for a list of sessions.
 * Returns a map of sessionId → { facilityName, unitName } using the
 * event_facility_bookings → facility_units → facilities join chain.
 * Sessions with no booking are simply absent from the map.
 */
export async function loadFacilityInfoBulk(
  sessionIds: string[],
): Promise<Record<string, { facilityName: string; unitName: string }>> {
  if (!CLOUD_ENABLED || sessionIds.length === 0) return {};
  const { data, error } = await supabase
    .from('event_facility_bookings')
    .select('session_id, facility_units(name, facilities(name))')
    .in('session_id', sessionIds);
  if (error) { console.warn('[loadFacilityInfoBulk]', error.message); return {}; }
  const map: Record<string, { facilityName: string; unitName: string }> = {};
  for (const row of (data ?? []) as Record<string, unknown>[]) {
    const sid  = row.session_id as string;
    const unit = row.facility_units as Record<string, unknown> | null;
    if (unit) {
      const fac = unit.facilities as Record<string, unknown> | null;
      map[sid] = {
        unitName:     (unit.name as string) ?? '',
        facilityName: (fac?.name as string) ?? '',
      };
    }
  }
  return map;
}
