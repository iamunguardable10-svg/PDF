import Groq from 'groq-sdk';
import type { WearableData, TrainingGoal, TrainingActivity } from '../types/health';

const client = new Groq({
  apiKey: import.meta.env.VITE_GROQ_API_KEY,
  dangerouslyAllowBrowser: true,
});

const MODEL = 'llama-3.3-70b-versatile';

export interface MealPlanRequest {
  wearable: WearableData;
  goal: TrainingGoal;
  activities: TrainingActivity[];
  days: number;
  preferences?: string;
}

export async function generateMealPlan(
  request: MealPlanRequest,
  onChunk: (text: string) => void,
  onComplete: () => void,
): Promise<void> {
  const { wearable, goal, activities, days, preferences } = request;

  const recentActivitySummary = activities
    .map(a => `- ${a.type} (${a.duration} Min, ${a.caloriesBurned} kcal, ${a.intensity})`)
    .join('\n');

  const prompt = `Du bist ein Ernährungsberater und Fitness-Coach. Erstelle einen detaillierten Ernährungsplan für ${days} Tage auf Basis der folgenden Gesundheitsdaten:

Heutige Wearable-Daten:
- Schritte: ${wearable.steps.toLocaleString('de-DE')}
- Verbrannte Kalorien: ${wearable.caloriesBurned} kcal
- Herzrate: ${wearable.heartRateAvg} bpm (Max: ${wearable.heartRateMax} bpm)
- Schlaf: ${wearable.sleepHours}h (${wearable.sleepQuality})
- Aktive Minuten: ${wearable.activeMinutes} Min

Trainingsziel: ${goal.label}
- Kalorien/Tag: ${goal.dailyCalorieTarget} kcal
- Protein: ${goal.proteinTarget}g | KH: ${goal.carbTarget}g | Fett: ${goal.fatTarget}g

Letzte Aktivitäten:
${recentActivitySummary}
${preferences ? `\nPräferenzen: ${preferences}` : ''}

Antworte NUR mit diesem JSON (kein Text davor oder danach):

{
  "days": [
    {
      "day": "Tag 1 - Montag",
      "totalCalories": 2800,
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

Regeln:
- 3-4 Mahlzeiten pro Tag
- Zutaten die bei Rewe/Edeka erhältlich sind
- Kategorien: "Obst & Gemüse", "Fleisch & Fisch", "Milchprodukte", "Getreide & Hülsenfrüchte", "Snacks & Sonstiges"`;

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
