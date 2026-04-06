import type { WearableData, TrainingGoal, TrainingActivity } from '../types/health';

export const wearableData: WearableData = {
  steps: 8432,
  caloriesBurned: 2140,
  heartRateAvg: 68,
  heartRateMax: 142,
  sleepHours: 7.2,
  sleepQuality: 'gut',
  activeMinutes: 52,
  distance: 6.1,
};

export const trainingGoals: TrainingGoal[] = [
  {
    type: 'muskelaufbau',
    label: 'Muskelaufbau',
    weeklyWorkouts: 4,
    dailyCalorieTarget: 2800,
    proteinTarget: 160,
    carbTarget: 320,
    fatTarget: 80,
  },
  {
    type: 'gewichtsverlust',
    label: 'Gewichtsverlust',
    weeklyWorkouts: 5,
    dailyCalorieTarget: 1800,
    proteinTarget: 140,
    carbTarget: 180,
    fatTarget: 60,
  },
  {
    type: 'ausdauer',
    label: 'Ausdauer & Fitness',
    weeklyWorkouts: 5,
    dailyCalorieTarget: 2400,
    proteinTarget: 130,
    carbTarget: 300,
    fatTarget: 70,
  },
  {
    type: 'gesundheit',
    label: 'Gesunde Ernährung',
    weeklyWorkouts: 3,
    dailyCalorieTarget: 2200,
    proteinTarget: 120,
    carbTarget: 260,
    fatTarget: 75,
  },
];

export const recentActivities: TrainingActivity[] = [
  {
    id: '1',
    type: 'Laufen',
    emoji: '🏃',
    date: 'Heute',
    duration: 35,
    caloriesBurned: 340,
    intensity: 'mittel',
    notes: '5 km Intervalltraining',
  },
  {
    id: '2',
    type: 'Krafttraining',
    emoji: '💪',
    date: 'Gestern',
    duration: 55,
    caloriesBurned: 280,
    intensity: 'intensiv',
    notes: 'Brust & Trizeps',
  },
  {
    id: '3',
    type: 'Radfahren',
    emoji: '🚴',
    date: 'Di.',
    duration: 45,
    caloriesBurned: 380,
    intensity: 'mittel',
  },
  {
    id: '4',
    type: 'Yoga',
    emoji: '🧘',
    date: 'Mo.',
    duration: 30,
    caloriesBurned: 110,
    intensity: 'leicht',
  },
];
