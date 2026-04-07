import type { FoodEntry } from '../types/food';

const KEY = 'fitfuel_food_log';

export function loadFoodLog(): FoodEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveFoodLog(entries: FoodEntry[]): void {
  localStorage.setItem(KEY, JSON.stringify(entries));
}

export function getEntriesForDate(entries: FoodEntry[], date: string): FoodEntry[] {
  return entries.filter(e => e.date === date);
}
