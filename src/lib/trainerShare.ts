import type { Session, PlannedSession, ACWRDataPoint } from '../types/acwr';
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
    te: s.te, rpe: s.rpe, dauer: s.dauer, tl: s.tl,
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
