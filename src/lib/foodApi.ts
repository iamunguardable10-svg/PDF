import Groq from 'groq-sdk';
import type { MealType as _MealType } from '../types/food';

const client = new Groq({
  apiKey: import.meta.env.VITE_GROQ_API_KEY,
  dangerouslyAllowBrowser: true,
});

// ── Open Food Facts barcode lookup ──────────────────────────────────────────

export interface BarcodeResult {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  amount: string;
}

export async function lookupBarcode(barcode: string): Promise<BarcodeResult | null> {
  const res = await fetch(
    `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=product_name,nutriments,serving_size`,
  );
  if (!res.ok) return null;
  const data = await res.json();
  if (data.status !== 1 || !data.product) return null;

  const p = data.product;
  const n = p.nutriments ?? {};

  // Per 100g values
  const cal = Math.round(n['energy-kcal_100g'] ?? n['energy_100g'] ?? 0);
  const protein = Math.round((n['proteins_100g'] ?? 0) * 10) / 10;
  const carbs   = Math.round((n['carbohydrates_100g'] ?? 0) * 10) / 10;
  const fat     = Math.round((n['fat_100g'] ?? 0) * 10) / 10;

  return {
    name:     p.product_name ?? 'Unbekanntes Produkt',
    calories: cal,
    protein,
    carbs,
    fat,
    amount:   '100g',
  };
}

// ── Groq Vision food recognition ─────────────────────────────────────────────

export interface PhotoResult {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  amount: string;
  confidence: string;
}

export async function analyzeFoodPhoto(base64: string, mimeType: string): Promise<PhotoResult | null> {
  const response = await client.chat.completions.create({
    model: 'llama-3.2-11b-vision-preview',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image_url',
          image_url: { url: `data:${mimeType};base64,${base64}` },
        },
        {
          type: 'text',
          text: `Analysiere dieses Essen und schätze die Nährwerte. Antworte NUR mit JSON:

{
  "name": "Hähnchenbrust mit Reis",
  "amount": "300g (geschätzt)",
  "calories": 480,
  "protein": 45,
  "carbs": 52,
  "fat": 8,
  "confidence": "mittel"
}

Regeln:
- Schätze realistisch basierend auf dem sichtbaren Essen
- confidence: "hoch" | "mittel" | "gering"
- Alle Zahlen gerundet auf ganze Zahlen
- name auf Deutsch`,
        },
      ],
    }],
  });

  const text = response.choices[0]?.message?.content ?? '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    return JSON.parse(jsonMatch[0]) as PhotoResult;
  } catch {
    return null;
  }
}

// ── Predictive nutrition forecast ────────────────────────────────────────────

export interface ForecastDay {
  date: string;
  dayLabel: string;
  plannedSessions: string[];
  estimatedLoad: number;       // TL estimate
  calorieTarget: number;
  proteinTarget: number;
  carbTarget: number;
  fatTarget: number;
  tips: string[];
  focus: 'recovery' | 'loading' | 'normal' | 'rest';
}

export interface NutritionForecast {
  days: ForecastDay[];
  weekSummary: string;
  topTips: string[];
}

export async function generateNutritionForecast(
  plannedSessions: Array<{ datum: string; te: string; geschaetzteDauer?: number }>,
  baseTDEE: number,
  baseProtein: number,
  acwr: number | null,
  onChunk: (text: string) => void,
): Promise<NutritionForecast | null> {
  const today = new Date();
  const next7: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    next7.push(d.toISOString().split('T')[0]);
  }

  const sessionsByDay: Record<string, string[]> = {};
  for (const date of next7) {
    sessionsByDay[date] = plannedSessions
      .filter(s => s.datum === date)
      .map(s => `${s.te}${s.geschaetzteDauer ? ` (${s.geschaetzteDauer}min)` : ''}`);
  }

  const scheduleText = next7.map(date => {
    const d = new Date(date);
    const wd = d.toLocaleDateString('de-DE', { weekday: 'long' });
    const sessions = sessionsByDay[date];
    return `${wd} (${date}): ${sessions.length ? sessions.join(', ') : 'Ruhetag'}`;
  }).join('\n');

  const prompt = `Du bist ein Sporternährungsberater. Erstelle eine vorausschauende Ernährungsplanung für die nächsten 7 Tage basierend auf dem Trainingsplan.

Basis-Kalorienbedarf (TDEE): ${baseTDEE} kcal/Tag
Basis-Protein: ${baseProtein}g/Tag
Aktueller ACWR: ${acwr != null ? acwr.toFixed(2) : 'unbekannt'}

Trainingsplan nächste 7 Tage:
${scheduleText}

Antworte NUR mit diesem JSON:

{
  "days": [
    {
      "date": "YYYY-MM-DD",
      "dayLabel": "Montag",
      "plannedSessions": ["Team (90min)"],
      "estimatedLoad": 630,
      "calorieTarget": 3200,
      "proteinTarget": 170,
      "carbTarget": 420,
      "fatTarget": 90,
      "tips": ["Konkrete Empfehlung 1", "Konkrete Empfehlung 2"],
      "focus": "loading"
    }
  ],
  "weekSummary": "Kurze Zusammenfassung der Trainingswoche und Ernährungsstrategie",
  "topTips": ["Wichtigster Tipp 1", "Wichtigster Tipp 2", "Wichtigster Tipp 3"]
}

Regeln:
- focus: "loading" (vor/an Spieltagen), "recovery" (nach Spielen, hoher ACWR), "normal" (Trainingstage), "rest" (Ruhetage)
- An Spieltagen: +15-20% KH (Carb-Loading), normale Kalorien
- Ruhetage: -10% Kalorien, normale Protein
- Nach Spiel/hoher Belastung: +10% Kalorien, +Protein für Recovery
- tips: konkrete, umsetzbare Empfehlungen (z.B. "2h vor dem Spiel: 80g Nudeln + Hühnchen")
- Alle Zahlen ganzzahlig`;

  const stream = await client.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 3000,
    messages: [{ role: 'user', content: prompt }],
    stream: true,
  });

  let fullText = '';
  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content ?? '';
    if (text) { fullText += text; onChunk(fullText); }
  }

  const jsonMatch = fullText.match(/```json\s*([\s\S]*?)\s*```/) || fullText.match(/(\{[\s\S]*\})/);
  const jsonStr = jsonMatch ? jsonMatch[1] : fullText.trim();

  try {
    return JSON.parse(jsonStr) as NutritionForecast;
  } catch {
    return null;
  }
}
