export interface WearableData {
  steps: number;
  caloriesBurned: number;
  heartRateAvg: number;
  heartRateMax: number;
  sleepHours: number;
  sleepQuality: 'gut' | 'mittel' | 'schlecht';
  activeMinutes: number;
  distance: number; // km
}

export interface TrainingGoal {
  type: 'gewichtsverlust' | 'muskelaufbau' | 'ausdauer' | 'abnehmen' | 'gesundheit';
  label: string;
  weeklyWorkouts: number;
  dailyCalorieTarget: number;
  proteinTarget: number; // g/day
  carbTarget: number; // g/day
  fatTarget: number; // g/day
}

export interface TrainingActivity {
  id: string;
  type: string;
  emoji: string;
  date: string;
  duration: number; // minutes
  caloriesBurned: number;
  intensity: 'leicht' | 'mittel' | 'intensiv';
  notes?: string;
}

export interface Meal {
  name: string;
  time: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  ingredients: string[];
  preparation?: string;
}

export interface DayMealPlan {
  day: string;
  totalCalories: number;
  meals: Meal[];
}

export interface ShoppingItem {
  name: string;
  amount: string;
  category: 'Obst & Gemüse' | 'Fleisch & Fisch' | 'Milchprodukte' | 'Getreide & Hülsenfrüchte' | 'Snacks & Sonstiges';
  checked: boolean;
}
