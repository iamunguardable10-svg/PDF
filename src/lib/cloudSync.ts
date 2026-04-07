/**
 * Cloud sync helpers — all fire-and-forget (don't block UI).
 * localStorage remains the primary cache; Supabase is the cloud backup.
 */
import { supabase } from './supabase';
import type { Session, PlannedSession } from '../types/acwr';
import type { AthleteProfile } from '../types/profile';
import type { FoodEntry } from '../types/food';

// ── Profile ───────────────────────────────────────────────────────────────────

export async function pushProfile(userId: string, p: AthleteProfile) {
  await supabase.from('profiles').upsert({
    id:                   userId,
    name:                 p.name,
    sport:                p.sport,
    level:                p.level,
    weight:               p.weight,
    height:               p.height,
    age:                  p.age,
    gender:               p.gender,
    weekly_trainings:     p.weeklyTrainings,
    primary_goal:         p.primaryGoal,
    dietary_preferences:  p.dietaryPreferences ?? null,
    onboarding_completed: p.onboardingCompleted,
    updated_at:           new Date().toISOString(),
  });
}

export async function pullProfile(userId: string): Promise<AthleteProfile | null> {
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (!data) return null;
  return {
    name:                data.name,
    sport:               data.sport,
    level:               data.level,
    weight:              data.weight,
    height:              data.height,
    age:                 data.age,
    gender:              data.gender,
    weeklyTrainings:     data.weekly_trainings,
    primaryGoal:         data.primary_goal,
    dietaryPreferences:  data.dietary_preferences ?? undefined,
    onboardingCompleted: data.onboarding_completed,
  } as AthleteProfile;
}

// ── Sessions ──────────────────────────────────────────────────────────────────

export async function pushSessions(userId: string, sessions: Session[]) {
  if (sessions.length === 0) return;
  await supabase.from('sessions').upsert(
    sessions.map(s => ({
      id: s.id, user_id: userId,
      name: s.name, datum: s.datum, te: s.te,
      rpe: s.rpe, dauer: s.dauer, tl: s.tl,
    }))
  );
}

export async function pullSessions(userId: string): Promise<Session[]> {
  const { data } = await supabase.from('sessions').select('*').eq('user_id', userId);
  return (data ?? []).map(r => ({
    id: r.id, name: r.name ?? '', datum: r.datum,
    te: r.te, rpe: r.rpe, dauer: r.dauer, tl: r.tl,
  }));
}

export async function deleteSession(id: string) {
  await supabase.from('sessions').delete().eq('id', id);
}

// ── Planned Sessions ──────────────────────────────────────────────────────────

export async function pushPlannedSessions(userId: string, sessions: PlannedSession[]) {
  if (sessions.length === 0) return;
  await supabase.from('planned_sessions').upsert(
    sessions.map(s => ({
      id: s.id, user_id: userId,
      datum: s.datum, te: s.te,
      uhrzeit: s.uhrzeit ?? null,
      geschaetzte_dauer: s.geschaetzteDauer ?? null,
      notiz: s.notiz ?? null,
      confirmed: s.confirmed,
      reminder_scheduled: s.reminderScheduled,
      rpe: s.rpe ?? null,
      actual_dauer: s.actualDauer ?? null,
    }))
  );
}

export async function pullPlannedSessions(userId: string): Promise<PlannedSession[]> {
  const { data } = await supabase.from('planned_sessions').select('*').eq('user_id', userId);
  return (data ?? []).map(r => ({
    id: r.id, datum: r.datum, te: r.te,
    uhrzeit: r.uhrzeit ?? undefined,
    geschaetzteDauer: r.geschaetzte_dauer ?? undefined,
    notiz: r.notiz ?? undefined,
    confirmed: r.confirmed,
    reminderScheduled: r.reminder_scheduled,
    rpe: r.rpe ?? undefined,
    actualDauer: r.actual_dauer ?? undefined,
  }));
}

export async function deletePlannedSession(id: string) {
  await supabase.from('planned_sessions').delete().eq('id', id);
}

// ── Food Log ──────────────────────────────────────────────────────────────────

export async function pushFoodLog(userId: string, entries: FoodEntry[]) {
  if (entries.length === 0) return;
  await supabase.from('food_log').upsert(
    entries.map(e => ({
      id: e.id, user_id: userId,
      date: e.date, is_drink: e.isDrink,
      meal_type: e.mealType ?? null, drink_type: e.drinkType ?? null,
      name: e.name, calories: e.calories, protein: e.protein,
      carbs: e.carbs, fat: e.fat, amount: e.amount ?? null,
      source: e.source, barcode: e.barcode ?? null,
    }))
  );
}

export async function pullFoodLog(userId: string): Promise<FoodEntry[]> {
  const { data } = await supabase.from('food_log').select('*').eq('user_id', userId);
  return (data ?? []).map(r => ({
    id: r.id, date: r.date, isDrink: r.is_drink,
    mealType: r.meal_type ?? undefined, drinkType: r.drink_type ?? undefined,
    name: r.name, calories: r.calories, protein: r.protein,
    carbs: r.carbs, fat: r.fat, amount: r.amount ?? undefined,
    source: r.source, barcode: r.barcode ?? undefined,
  }));
}

export async function deleteFoodEntry(id: string) {
  await supabase.from('food_log').delete().eq('id', id);
}

// ── Load everything at once after login ──────────────────────────────────────

export async function pullAllData(userId: string) {
  const [profile, sessions, plannedSessions, foodLog] = await Promise.all([
    pullProfile(userId),
    pullSessions(userId),
    pullPlannedSessions(userId),
    pullFoodLog(userId),
  ]);
  return { profile, sessions, plannedSessions, foodLog };
}
