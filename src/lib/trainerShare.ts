import type { Session, PlannedSession, ACWRDataPoint, TrainingUnit } from '../types/acwr';
import { calculateACWR } from './acwrCalculations';
import { supabase, CLOUD_ENABLED } from './supabase';

export interface TrainerShareData {
  athleteName: string;
  sport: string;
  generatedAt: string;
  acwrHistory: Array<{ d: string; v: number | null; a: number; c: number }>;
  planned: Array<{ d: string; t: string; u?: string; dur?: number }>;
  sessions28: Array<{ d: string; te: string; rpe: number; tl: number }>;
}

// ── Token prefix that distinguishes live links from legacy base64 ─────────────
const LIVE_PREFIX = 'live_';
export const isLiveToken = (s: string) => s.startsWith(LIVE_PREFIX);

function localISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function randomToken(len = 16): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// ── Live share management (Supabase) ──────────────────────────────────────────

export async function getActiveShare(userId: string): Promise<string | null> {
  if (!CLOUD_ENABLED) return null;
  const { data } = await supabase
    .from('trainer_shares')
    .select('id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  return data?.id ?? null;
}

export async function createLiveShare(userId: string): Promise<string | null> {
  if (!CLOUD_ENABLED) return null;
  // Deactivate any existing shares first
  await supabase
    .from('trainer_shares')
    .update({ is_active: false })
    .eq('user_id', userId);

  const token = LIVE_PREFIX + randomToken(16);
  const { error } = await supabase
    .from('trainer_shares')
    .insert({ id: token, user_id: userId, is_active: true });

  return error ? null : token;
}

export async function revokeLiveShare(token: string): Promise<void> {
  if (!CLOUD_ENABLED) return;
  await supabase
    .from('trainer_shares')
    .update({ is_active: false })
    .eq('id', token);
}

// ── Fetch live data (called by TrainerView, unauthenticated) ──────────────────

interface RawSession {
  id: string; name: string; datum: string;
  te: string; rpe: number; dauer: number; tl: number;
}
interface RawPlanned {
  id: string; datum: string; te: string;
  uhrzeit?: string; geschaetzte_dauer?: number;
}
interface RawData {
  profile: { name: string; sport: string } | null;
  sessions: RawSession[];
  plannedSessions: RawPlanned[];
}

export async function fetchLiveTrainerData(token: string): Promise<TrainerShareData | null> {
  if (!CLOUD_ENABLED) return null;
  const { data, error } = await supabase.rpc('get_trainer_data', { share_token: token });
  if (error || !data) return null;

  const raw = data as RawData;
  if (!raw.profile) return null;

  const sessions: Session[] = (raw.sessions ?? []).map(s => ({
    id: s.id, name: s.name ?? '', datum: s.datum,
    te: s.te as TrainingUnit, rpe: s.rpe, dauer: s.dauer, tl: s.tl,
  }));

  const acwrPoints: ACWRDataPoint[] = calculateACWR(sessions);

  const today      = localISO(new Date());
  const c28        = new Date(); c28.setDate(c28.getDate() - 28);
  const c60        = new Date(); c60.setDate(c60.getDate() - 60);
  const f14        = new Date(); f14.setDate(f14.getDate() + 14);
  const cut28      = localISO(c28);
  const cut60      = localISO(c60);
  const future14   = localISO(f14);

  return {
    athleteName: raw.profile.name,
    sport:       raw.profile.sport,
    generatedAt: today,
    acwrHistory: acwrPoints
      .filter(p => p.datum >= cut60)
      .map(p => ({ d: p.datum, v: p.acwr, a: p.acuteLoad, c: p.chronicLoad })),
    planned: (raw.plannedSessions ?? [])
      .filter(ps => ps.datum >= today && ps.datum <= future14)
      .map(ps => ({ d: ps.datum, t: ps.te, u: ps.uhrzeit ?? undefined, dur: ps.geschaetzte_dauer ?? undefined })),
    sessions28: sessions
      .filter(s => s.datum >= cut28)
      .sort((a, b) => b.datum.localeCompare(a.datum))
      .slice(0, 28)
      .map(s => ({ d: s.datum, te: s.te, rpe: s.rpe, tl: s.tl })),
  };
}

// ── Trainer roster (Supabase) ────────────────────────────────────────────────

export interface SupabaseAthlete {
  id: string;
  trainer_id: string;
  token: string;
  name: string;
  sport: string;
  group_ids: string[];
  added_at: string;
}

export interface SupabaseGroup {
  id: string;
  trainer_id: string;
  name: string;
  color: string;
}

export async function loadRosterFromSupabase(
  trainerId: string,
): Promise<{ athletes: SupabaseAthlete[]; groups: SupabaseGroup[] }> {
  if (!CLOUD_ENABLED) return { athletes: [], groups: [] };
  const [{ data: athletes }, { data: groups }] = await Promise.all([
    supabase.from('trainer_roster').select('*').eq('trainer_id', trainerId),
    supabase.from('trainer_groups').select('*').eq('trainer_id', trainerId),
  ]);
  return {
    athletes: (athletes ?? []) as SupabaseAthlete[],
    groups:   (groups   ?? []) as SupabaseGroup[],
  };
}

export async function upsertAthleteInSupabase(
  trainerId: string,
  athlete: { id: string; token: string; name: string; sport?: string; groupIds: string[]; addedAt: string },
): Promise<void> {
  if (!CLOUD_ENABLED) return;
  await supabase.from('trainer_roster').upsert({
    id:         athlete.id,
    trainer_id: trainerId,
    token:      athlete.token,
    name:       athlete.name,
    sport:      athlete.sport ?? '',
    group_ids:  athlete.groupIds,
    added_at:   athlete.addedAt,
  }, { onConflict: 'id' });
}

export async function deleteAthleteFromSupabase(athleteId: string): Promise<void> {
  if (!CLOUD_ENABLED) return;
  await supabase.from('trainer_roster').delete().eq('id', athleteId);
}

export async function upsertGroupInSupabase(
  trainerId: string,
  group: { id: string; name: string; color: string },
): Promise<void> {
  if (!CLOUD_ENABLED) return;
  await supabase.from('trainer_groups').upsert({
    id: group.id, trainer_id: trainerId, name: group.name, color: group.color,
  }, { onConflict: 'id' });
}

export async function deleteGroupFromSupabase(groupId: string): Promise<void> {
  if (!CLOUD_ENABLED) return;
  await supabase.from('trainer_groups').delete().eq('id', groupId);
}

export async function updateAthleteGroupsInSupabase(athleteId: string, groupIds: string[]): Promise<void> {
  if (!CLOUD_ENABLED) return;
  await supabase.from('trainer_roster').update({ group_ids: groupIds }).eq('id', athleteId);
}

// ── Trainer invite system ─────────────────────────────────────────────────────

/** Create an invite link code (stored in trainer_invites table) */
export async function createTrainerInvite(
  trainerId: string,
  trainerName: string,
): Promise<string | null> {
  if (!CLOUD_ENABLED) return null;
  const id = 'inv_' + randomToken(20);
  const { error } = await supabase
    .from('trainer_invites')
    .insert({ id, trainer_id: trainerId, trainer_name: trainerName });
  return error ? null : id;
}

/** Fetch invite metadata (public — athlete sees trainer name) */
export async function fetchInvite(
  inviteId: string,
): Promise<{ trainerName: string; expired: boolean } | null> {
  if (!CLOUD_ENABLED) return null;
  const { data, error } = await supabase
    .from('trainer_invites')
    .select('trainer_name, accepted, expires_at')
    .eq('id', inviteId)
    .single();
  if (error || !data) return null;
  const expired = data.accepted || new Date(data.expires_at) < new Date();
  return { trainerName: data.trainer_name, expired };
}

/** Athlete accepts invite — writes their live token to the row */
export async function acceptInvite(
  inviteId: string,
  athleteToken: string,
  athleteName: string,
): Promise<boolean> {
  if (!CLOUD_ENABLED) return false;
  const { error } = await supabase
    .from('trainer_invites')
    .update({ athlete_token: athleteToken, athlete_name: athleteName, accepted: true })
    .eq('id', inviteId)
    .eq('accepted', false);
  return !error;
}

/** Trainer polls for accepted invites */
export async function listAcceptedInvites(
  trainerId: string,
): Promise<Array<{ id: string; athleteToken: string; athleteName: string; createdAt: string }>> {
  if (!CLOUD_ENABLED) return [];
  const { data, error } = await supabase
    .from('trainer_invites')
    .select('id, athlete_token, athlete_name, created_at')
    .eq('trainer_id', trainerId)
    .eq('accepted', true)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map(r => ({
    id: r.id,
    athleteToken: r.athlete_token,
    athleteName:  r.athlete_name,
    createdAt:    r.created_at,
  }));
}

/** Trainer lists all their pending (unaccepted) invites */
export async function listPendingInvites(
  trainerId: string,
): Promise<Array<{ id: string; createdAt: string; expiresAt: string }>> {
  if (!CLOUD_ENABLED) return [];
  const { data, error } = await supabase
    .from('trainer_invites')
    .select('id, created_at, expires_at')
    .eq('trainer_id', trainerId)
    .eq('accepted', false)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map(r => ({ id: r.id, createdAt: r.created_at, expiresAt: r.expires_at }));
}

/** Delete / revoke an invite */
export async function deleteInvite(inviteId: string): Promise<void> {
  if (!CLOUD_ENABLED) return;
  await supabase.from('trainer_invites').delete().eq('id', inviteId);
}

// ── Legacy base64 (kept for backward compat) ──────────────────────────────────

export function encodeShareData(
  athleteName: string, sport: string,
  acwrHistory: ACWRDataPoint[],
  plannedSessions: PlannedSession[],
  sessions: Session[],
): string {
  const today = localISO(new Date());
  const c28 = new Date(); c28.setDate(c28.getDate() - 28);
  const c60 = new Date(); c60.setDate(c60.getDate() - 60);
  const f14 = new Date(); f14.setDate(f14.getDate() + 14);

  const data: TrainerShareData = {
    athleteName, sport, generatedAt: today,
    acwrHistory: acwrHistory.filter(p => p.datum >= localISO(c60))
      .map(p => ({ d: p.datum, v: p.acwr, a: p.acuteLoad, c: p.chronicLoad })),
    planned: plannedSessions
      .filter(s => !s.confirmed && s.datum >= today && s.datum <= localISO(f14))
      .map(s => ({ d: s.datum, t: s.te, u: s.uhrzeit, dur: s.geschaetzteDauer })),
    sessions28: sessions
      .filter(s => s.datum >= localISO(c28))
      .map(s => ({ d: s.datum, te: s.te, rpe: s.rpe, tl: s.tl })),
  };
  try { return btoa(encodeURIComponent(JSON.stringify(data))); } catch { return ''; }
}

export function decodeShareData(encoded: string): TrainerShareData | null {
  try { return JSON.parse(decodeURIComponent(atob(encoded))) as TrainerShareData; } catch { return null; }
}
