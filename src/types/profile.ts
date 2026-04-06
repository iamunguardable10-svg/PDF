export type AthleteLevel =
  | 'leistungssportler'
  | 'vereinssportler'
  | 'hobbysportler'
  | 'einsteiger';

export type Gender = 'maennlich' | 'weiblich' | 'divers';

export type PrimaryGoal =
  | 'performance'
  | 'muskelaufbau'
  | 'gewichtsverlust'
  | 'ausdauer'
  | 'gesundheit';

export const LEVEL_LABELS: Record<AthleteLevel, string> = {
  leistungssportler: 'Leistungssportler',
  vereinssportler:   'Vereinssportler',
  hobbysportler:     'Hobbysportler',
  einsteiger:        'Einsteiger',
};

export const LEVEL_DESC: Record<AthleteLevel, string> = {
  leistungssportler: 'Kader, Profi, Vollzeit-Training',
  vereinssportler:   '3–5× pro Woche, Wettkampf',
  hobbysportler:     '1–3× pro Woche, Freizeit',
  einsteiger:        'Gerade gestartet, <1× Woche',
};

export const LEVEL_EMOJI: Record<AthleteLevel, string> = {
  leistungssportler: '🏆',
  vereinssportler:   '🥈',
  hobbysportler:     '🏅',
  einsteiger:        '🌱',
};

export const GOAL_LABELS: Record<PrimaryGoal, string> = {
  performance:    'Maximale Performance',
  muskelaufbau:   'Muskelaufbau',
  gewichtsverlust:'Gewichtsverlust',
  ausdauer:       'Ausdauer & Fitness',
  gesundheit:     'Gesundheit & Wohlbefinden',
};

export const GOAL_EMOJI: Record<PrimaryGoal, string> = {
  performance:    '⚡',
  muskelaufbau:   '💪',
  gewichtsverlust:'🔥',
  ausdauer:       '🏃',
  gesundheit:     '❤️',
};

export interface AthleteProfile {
  name: string;
  gender: Gender;
  age: number;
  weight: number;   // kg
  height: number;   // cm
  sport: string;    // Freitext, z.B. "Basketball"
  level: AthleteLevel;
  primaryGoal: PrimaryGoal;
  weeklyTrainings: number;
  dietaryPreferences: string; // z.B. "vegetarisch, laktosefrei"
  onboardingCompleted: boolean;
}

export const DEFAULT_PROFILE: AthleteProfile = {
  name: 'Athlet',
  gender: 'maennlich',
  age: 22,
  weight: 80,
  height: 180,
  sport: 'Basketball',
  level: 'vereinssportler',
  primaryGoal: 'performance',
  weeklyTrainings: 4,
  dietaryPreferences: '',
  onboardingCompleted: false,
};

/** BMI */
export function calcBMI(profile: AthleteProfile): number {
  const hm = profile.height / 100;
  return Math.round((profile.weight / (hm * hm)) * 10) / 10;
}

export function bmiLabel(bmi: number): { label: string; color: string } {
  if (bmi < 18.5) return { label: 'Untergewicht', color: 'text-blue-400' };
  if (bmi < 25)   return { label: 'Normalgewicht', color: 'text-green-400' };
  if (bmi < 30)   return { label: 'Übergewicht', color: 'text-yellow-400' };
  return             { label: 'Adipositas', color: 'text-red-400' };
}

/** Grundumsatz (BMR) nach Harris-Benedict */
export function calcBMR(profile: AthleteProfile): number {
  if (profile.gender === 'weiblich') {
    return Math.round(447.593 + (9.247 * profile.weight) + (3.098 * profile.height) - (4.330 * profile.age));
  }
  return Math.round(88.362 + (13.397 * profile.weight) + (4.799 * profile.height) - (5.677 * profile.age));
}

/** Berechnet den täglichen Kalorienbedarf basierend auf Profil */
export function calcTDEE(profile: AthleteProfile, acwr?: number | null): number {
  // Harris-Benedict BMR
  let bmr: number;
  if (profile.gender === 'weiblich') {
    bmr = 447.593 + (9.247 * profile.weight) + (3.098 * profile.height) - (4.330 * profile.age);
  } else {
    bmr = 88.362 + (13.397 * profile.weight) + (4.799 * profile.height) - (5.677 * profile.age);
  }

  // Aktivitätsfaktor nach Niveau + Trainingsfrequenz
  const baseFactors: Record<AthleteLevel, number> = {
    leistungssportler: 1.9,
    vereinssportler:   1.65,
    hobbysportler:     1.45,
    einsteiger:        1.3,
  };
  const factor = baseFactors[profile.level] + (profile.weeklyTrainings - 3) * 0.03;

  let tdee = Math.round(bmr * Math.max(1.2, Math.min(2.2, factor)));

  // ACWR-Anpassung: High Load → mehr Kalorien für Recovery
  if (acwr !== null && acwr !== undefined) {
    if (acwr > 1.3)      tdee = Math.round(tdee * 1.12); // +12% Recovery
    else if (acwr > 1.1) tdee = Math.round(tdee * 1.06); // +6%
    else if (acwr < 0.7) tdee = Math.round(tdee * 0.95); // -5% leichte Phase
  }

  // Ziel-Anpassung
  const goalAdj: Record<PrimaryGoal, number> = {
    performance:    0,
    muskelaufbau:   200,
    gewichtsverlust:-400,
    ausdauer:       100,
    gesundheit:     0,
  };
  return tdee + goalAdj[profile.primaryGoal];
}

/** Makro-Verteilung nach Niveau + Ziel */
export function calcMacros(profile: AthleteProfile, tdee: number) {
  // Protein: Leistungssportler brauchen mehr
  const proteinPerKg: Record<AthleteLevel, number> = {
    leistungssportler: 2.0,
    vereinssportler:   1.7,
    hobbysportler:     1.4,
    einsteiger:        1.2,
  };
  const protein = Math.round(profile.weight * proteinPerKg[profile.level]);
  const proteinKcal = protein * 4;

  // Fett: 25–30% der Kalorien
  const fat = Math.round((tdee * 0.27) / 9);
  const fatKcal = fat * 9;

  // KH: Rest
  const carbs = Math.round((tdee - proteinKcal - fatKcal) / 4);

  return { protein, fat, carbs };
}
