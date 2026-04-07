export type MealType = 'fruehstueck' | 'mittagessen' | 'abendessen' | 'snack';

export const MEAL_LABELS: Record<MealType, string> = {
  fruehstueck: 'Frühstück',
  mittagessen:  'Mittagessen',
  abendessen:   'Abendessen',
  snack:        'Snack',
};

export const MEAL_EMOJI: Record<MealType, string> = {
  fruehstueck: '🌅',
  mittagessen:  '☀️',
  abendessen:   '🌙',
  snack:        '🍎',
};

export interface FoodEntry {
  id: string;
  date: string;       // YYYY-MM-DD
  mealType: MealType;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  amount?: string;    // z.B. "200g"
  source: 'manual' | 'barcode' | 'photo';
  barcode?: string;
}

export interface DailyNutrition {
  date: string;
  entries: FoodEntry[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
}

export function sumEntries(entries: FoodEntry[]): Omit<DailyNutrition, 'date' | 'entries'> {
  return entries.reduce(
    (acc, e) => ({
      totalCalories: acc.totalCalories + e.calories,
      totalProtein:  acc.totalProtein  + e.protein,
      totalCarbs:    acc.totalCarbs    + e.carbs,
      totalFat:      acc.totalFat      + e.fat,
    }),
    { totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0 },
  );
}
