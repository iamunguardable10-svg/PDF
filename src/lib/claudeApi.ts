import Groq from 'groq-sdk';
import type { WearableData, TrainingGoal, TrainingActivity } from '../types/health';
import type { AthleteProfile } from '../types/profile';
import { calcTDEE, calcMacros, LEVEL_LABELS, GOAL_LABELS } from '../types/profile';
import type { NutritionForecast } from './foodApi';

const client = new Groq({
  apiKey: import.meta.env.VITE_GROQ_API_KEY,
  dangerouslyAllowBrowser: true,
});

const MODEL = 'llama-3.3-70b-versatile';

export interface MealPlanRequest {
  wearable: WearableData;
  goal: TrainingGoal;
  forecast?: NutritionForecast | null;
  activities: TrainingActivity[];
  days: number;
  preferences?: string;
  profile?: AthleteProfile;
  acwr?: number | null;
}

export async function generateMealPlan(
  request: MealPlanRequest,
  onChunk: (text: string) => void,
  onComplete: () => void,
): Promise<void> {
  const { wearable, activities, days, preferences, profile, acwr, forecast } = request;

  const recentActivitySummary = activities
    .map(a => `- ${a.type} (${a.duration} Min, ${a.caloriesBurned} kcal, ${a.intensity})`)
    .join('\n');

  // Calculate personalized targets if profile is available
  let targetCalories: number;
  let proteinTarget: number;
  let carbTarget: number;
  let fatTarget: number;
  let profileContext = '';

  if (profile) {
    targetCalories = calcTDEE(profile, acwr);
    const macros = calcMacros(profile, targetCalories);
    proteinTarget = macros.protein;
    carbTarget = macros.carbs;
    fatTarget = macros.fat;

    const acwrInfo = acwr != null
      ? `ACWR aktuell: ${acwr.toFixed(2)} (${acwr > 1.3 ? '🔴 Hohe Belastung — Regeneration priorisieren' : acwr > 1.1 ? '🟡 Erhöhte Belastung' : acwr < 0.7 ? '🟢 Leichte Phase' : '🟢 Optimale Zone'})`
      : 'ACWR: keine Daten';

    profileContext = `
Athleten-Profil:
- Name: ${profile.name}
- Niveau: ${LEVEL_LABELS[profile.level]}
- Sport: ${profile.sport}
- Ziel: ${GOAL_LABELS[profile.primaryGoal]}
- Körper: ${profile.weight}kg, ${profile.height}cm, ${profile.age} Jahre, ${profile.gender === 'weiblich' ? 'weiblich' : profile.gender === 'maennlich' ? 'männlich' : 'divers'}
- Training: ${profile.weeklyTrainings}× pro Woche
- ${acwrInfo}
${profile.dietaryPreferences ? `- Ernährungspräferenzen: ${profile.dietaryPreferences}` : ''}`;
  } else {
    targetCalories = request.goal.dailyCalorieTarget;
    proteinTarget = request.goal.proteinTarget;
    carbTarget = request.goal.carbTarget;
    fatTarget = request.goal.fatTarget;
  }

  const focusLabel: Record<string, string> = {
    loading: 'SPIELTAG/HOCHBELASTUNG',
    recovery: 'RECOVERY',
    rest: 'RUHETAG',
    normal: 'TRAINING',
  };

  // Per-Tag Ziele aus Forecast wenn verfügbar, sonst einheitliches Tagesziel
  const perDayTargets = forecast?.days?.length
    ? forecast.days.slice(0, days).map(d => ({
        label: d.dayLabel,
        focus: d.focus,
        kcal: d.calorieTarget,
        protein: d.proteinTarget,
        carbs: d.carbTarget,
        fat: d.fatTarget,
        msg: d.keyMessage,
      }))
    : null;

  const forecastContext = perDayTargets
    ? [
        '',
        '=== Vorausschauende Ernährungsprognose – NUTZE DIESE PRO TAG ===',
        `Wochenstrategie: ${forecast!.weekStrategy}`,
        perDayTargets.map((d, i) =>
          `Tag ${i + 1} (${d.label}) [${focusLabel[d.focus] ?? d.focus}]: ` +
          `${d.kcal} kcal | P ${d.protein}g | KH ${d.carbs}g | F ${d.fat}g — ${d.msg}`
        ).join('\n'),
        forecast!.topWarnings?.length ? `⚠ Warnungen: ${forecast!.topWarnings.join(' | ')}` : '',
        '=== WICHTIG: Mahlzeiten-Kalorien pro Tag müssen zum obigen Tagesziel passen ===',
      ].filter(Boolean).join('\n')
    : '';

  // Build explicit per-day calorie targets for the prompt
  const perDayLines = perDayTargets
    ? perDayTargets.map((d, i) => {
        const breakfast = Math.round(d.kcal * 0.25);
        const lunch     = Math.round(d.kcal * 0.35);
        const dinner    = Math.round(d.kcal * 0.30);
        const snack     = d.kcal - breakfast - lunch - dinner;
        return `Tag ${i + 1} (${d.label}, ${focusLabel[d.focus] ?? d.focus}): Tagesziel ${d.kcal} kcal = Frühstück ${breakfast} + Mittagessen ${lunch} + Abendessen ${dinner} + Snack ${snack} kcal | P ${d.protein}g | KH ${d.carbs}g | F ${d.fat}g`;
      }).join('\n')
    : (() => {
        const breakfast = Math.round(targetCalories * 0.25);
        const lunch     = Math.round(targetCalories * 0.35);
        const dinner    = Math.round(targetCalories * 0.30);
        const snack     = targetCalories - breakfast - lunch - dinner;
        return Array.from({ length: days }, (_, i) =>
          `Tag ${i + 1}: Tagesziel ${targetCalories} kcal = Frühstück ${breakfast} + Mittagessen ${lunch} + Abendessen ${dinner} + Snack ${snack} kcal | P ${proteinTarget}g | KH ${carbTarget}g | F ${fatTarget}g`
        ).join('\n');
      })();

  const prompt = `Du bist ein Ernährungsberater und Fitness-Coach für Leistungssportler. Erstelle einen detaillierten Ernährungsplan für ${days} Tage.
${profileContext}

Heutige Aktivitätsdaten (Wearable):
- Schritte: ${wearable.steps.toLocaleString('de-DE')}
- Verbrannte Kalorien: ${wearable.caloriesBurned} kcal
- Herzrate: ${wearable.heartRateAvg} bpm (Max: ${wearable.heartRateMax} bpm)
- Schlaf: ${wearable.sleepHours}h (${wearable.sleepQuality})
- Aktive Minuten: ${wearable.activeMinutes} Min

Letzte Aktivitäten:
${recentActivitySummary}
${preferences ? `\nZusätzliche Präferenzen: ${preferences}` : ''}

=== KALORIENVERTEILUNG PRO TAG — BINDEND ===
${perDayLines}
${forecastContext}

KRITISCHE RECHENREGELN — PFLICHT:
1. Die Kalorien jeder einzelnen Mahlzeit MÜSSEN sich auf exakt das Tagesziel summieren (±2%).
   Beispiel Tag 1: wenn Frühstück=480, Mittagessen=680, Abendessen=580, Snack=160 → Summe=1900 kcal ✓
2. Das Feld "totalCalories" MUSS = Summe aller meal.calories dieses Tages sein. Niemals ein anderer Wert.
3. Berechne zuerst die 4 Mahlzeiten-Kalorien, summiere sie, dann schreibe totalCalories = diese Summe.
4. Makros (Protein, KH, Fett) der Mahlzeiten müssen sich auch auf das Tagesziel summieren (±5%).

Antworte NUR mit diesem JSON (kein Text davor oder danach):

{
  "days": [
    {
      "day": "Tag 1 - Montag",
      "totalCalories": 1900,
      "meals": [
        {
          "name": "Haferflocken mit Früchten",
          "time": "07:30",
          "calories": 480,
          "protein": 18,
          "carbs": 72,
          "fat": 12,
          "ingredients": ["80g Haferflocken", "1 Banane", "200ml Hafermilch", "1 EL Honig"],
          "preparation": "Haferflocken mit heißer Milch übergießen, 3 Min quellen lassen, Banane und Honig dazu."
        }
      ]
    }
  ],
  "shoppingList": [
    { "name": "Haferflocken", "amount": "500g", "category": "Getreide & Hülsenfrüchte" }
  ],
  "tips": "Personalisierte Ernährungstipps hier"
}

Weitere Regeln:
- Exakt 4 Mahlzeiten pro Tag: Frühstück, Mittagessen, Abendessen, Snack
- Zutaten bei Rewe/Edeka erhältlich, konkrete Mengenangaben (z.B. "180g Hähnchenbrust")
- Kategorien Einkaufsliste: "Obst & Gemüse", "Fleisch & Fisch", "Milchprodukte", "Getreide & Hülsenfrüchte", "Snacks & Sonstiges"
- Bei Trainingstagen: kohlenhydratreiche Mahlzeit 2-3h vor Training, proteinreiche Mahlzeit innerhalb 45min nach Training
- Tipps müssen konkret sein (Uhrzeit + Menge), nicht allgemein`;

  const stream = await client.chat.completions.create({
    model: MODEL,
    max_tokens: 6000,
    messages: [{ role: 'user', content: prompt }],
    stream: true,
  });

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content ?? '';
    if (text) onChunk(text);
  }

  onComplete();
}
