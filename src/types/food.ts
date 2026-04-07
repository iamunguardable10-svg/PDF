export type MealType = 'fruehstueck' | 'mittagessen' | 'abendessen' | 'snack';
export type DrinkType = 'wasser' | 'sportgetraenk' | 'saft' | 'milch' | 'kaffee_tee' | 'sonstiges';

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

export const DRINK_LABELS: Record<DrinkType, string> = {
  wasser:        'Wasser',
  sportgetraenk: 'Sportgetränk',
  saft:          'Saft / Smoothie',
  milch:         'Milch / Shake',
  kaffee_tee:    'Kaffee / Tee',
  sonstiges:     'Sonstiges',
};

export const DRINK_EMOJI: Record<DrinkType, string> = {
  wasser:        '💧',
  sportgetraenk: '⚡',
  saft:          '🧃',
  milch:         '🥛',
  kaffee_tee:    '☕',
  sonstiges:     '🥤',
};

export interface FoodEntry {
  id: string;
  date: string;
  isDrink: boolean;
  mealType?: MealType;
  drinkType?: DrinkType;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  amount?: string;
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
