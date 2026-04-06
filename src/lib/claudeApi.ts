import Anthropic from '@anthropic-ai/sdk';
import type { WearableData, TrainingGoal, TrainingActivity } from '../types/health';

const client = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true,
});

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

**Heutige Wearable-Daten:**
- Schritte: ${wearable.steps.toLocaleString('de-DE')}
- Verbrannte Kalorien: ${wearable.caloriesBurned} kcal
- Ø Herzrate: ${wearable.heartRateAvg} bpm (Max: ${wearable.heartRateMax} bpm)
- Schlaf: ${wearable.sleepHours}h (Qualität: ${wearable.sleepQuality})
- Aktive Minuten: ${wearable.activeMinutes} Min
- Zurückgelegte Strecke: ${wearable.distance} km

**Trainingsziel: ${goal.label}**
- Tägliches Kalorienziel: ${goal.dailyCalorieTarget} kcal
- Protein: ${goal.proteinTarget}g | Kohlenhydrate: ${goal.carbTarget}g | Fett: ${goal.fatTarget}g
- Trainingseinheiten/Woche: ${goal.weeklyWorkouts}

**Letzte Trainingsaktivitäten:**
${recentActivitySummary}

${preferences ? `**Ernährungspräferenzen:** ${preferences}` : ''}

Erstelle einen Ernährungsplan im folgenden JSON-Format:

\`\`\`json
{
  "days": [
    {
      "day": "Tag 1 - Montag",
      "totalCalories": 2800,
      "meals": [
        {
          "name": "Mahlzeitenname",
          "time": "07:30",
          "calories": 500,
          "protein": 35,
          "carbs": 55,
          "fat": 15,
          "ingredients": ["200g Haferflocken", "1 Banane", "200ml Mandelmilch"],
          "preparation": "Kurze Zubereitungsanleitung"
        }
      ]
    }
  ],
  "shoppingList": [
    {
      "name": "Zutatename",
      "amount": "500g",
      "category": "Obst & Gemüse"
    }
  ],
  "tips": "Kurze personalisierte Ernährungstipps basierend auf den Aktivitätsdaten"
}
\`\`\`

Wichtig:
- 3-4 Mahlzeiten pro Tag (Frühstück, Mittagessen, Abendessen + ggf. Snack)
- Mahlzeiten passend zu Trainingsintensität anpassen
- Realistische Zutaten die bei Knuspr/Rewe erhältlich sind
- Vollständige Einkaufsliste aller benötigten Zutaten
- Kategorien für Einkaufsliste: "Obst & Gemüse", "Fleisch & Fisch", "Milchprodukte", "Getreide & Hülsenfrüchte", "Snacks & Sonstiges"
- Antworte NUR mit dem JSON-Block, kein Text davor oder danach`;

  const stream = client.messages.stream({
    model: 'claude-opus-4-6',
    max_tokens: 8000,
    thinking: { type: 'adaptive' },
    messages: [{ role: 'user', content: prompt }],
  });

  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      onChunk(event.delta.text);
    }
  }

  onComplete();
}
