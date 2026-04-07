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

export interface MealOption {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  ingredients: string;   // "200g Hähnchen, 150g Reis, ..."
}

export interface ForecastMeal {
  type: 'fruehstueck' | 'mittagessen' | 'abendessen' | 'snack';
  options: [MealOption, MealOption];  // always 2 alternatives
}

export interface ForecastDay {
  date: string;
  dayLabel: string;
  plannedSessions: string[];
  calorieTarget: number;
  proteinTarget: number;
  carbTarget: number;
  fatTarget: number;
  focus: 'recovery' | 'loading' | 'normal' | 'rest';
  keyMessage: string;   // one-liner why this day is special
  tips: string[];
  meals: ForecastMeal[];
}

export interface NutritionForecast {
  analysis: string;       // 2-3 sentences: what the AI sees in your training data
  weekStrategy: string;   // overall nutrition strategy for the week
  days: ForecastDay[];
  topWarnings: string[];  // e.g. "Mittwoch + Donnerstag back-to-back Spiele — Recovery kritisch"
}

export interface ForecastInput {
  plannedSessions: Array<{ datum: string; te: string; geschaetzteDauer?: number }>;
  recentSessions: Array<{ datum: string; te: string; tl: number; rpe: number; dauer: number }>;
  acwrHistory: Array<{ datum: string; acwr: number | null; acuteLoad: number; chronicLoad: number }>;
  baseTDEE: number;
  baseProtein: number;
  sport: string;
  level: string;
  dietaryPreferences?: string;
}

export async function generateNutritionForecast(
  input: ForecastInput,
  onChunk: (text: string) => void,
): Promise<NutritionForecast | null> {
  const { plannedSessions, recentSessions, acwrHistory, baseTDEE, baseProtein, sport, level, dietaryPreferences } = input;

  const today = new Date();
  const next7: string[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    return d.toISOString().split('T')[0];
  });

  // Summarise recent training (last 14 days)
  const recentSummary = recentSessions.length === 0
    ? 'Keine Sessions in den letzten 14 Tagen eingetragen.'
    : recentSessions
        .slice(-14)
        .map(s => `${s.datum}: ${s.te} | RPE ${s.rpe} | ${s.dauer}min | TL ${s.tl}`)
        .join('\n');

  // ACWR trend (last 14 data points)
  const acwrTrend = acwrHistory.length === 0
    ? 'Keine ACWR-Daten vorhanden.'
    : acwrHistory
        .slice(-14)
        .map(d => `${d.datum}: ACWR ${d.acwr?.toFixed(2) ?? '—'} | Acute ${d.acuteLoad} | Chronic ${d.chronicLoad}`)
        .join('\n');

  const currentACWR = acwrHistory.length > 0
    ? acwrHistory[acwrHistory.length - 1].acwr
    : null;

  // Pre-compute focus per day from actual TE types — don't let the AI guess
  function computeFocus(date: string): ForecastDay['focus'] {
    const daySessions = plannedSessions.filter(s => s.datum === date);
    if (daySessions.length === 0) return 'rest';
    if (daySessions.some(s => s.te === 'Spiel')) return 'loading';
    // Day after a game = recovery
    const prev = new Date(date);
    prev.setDate(prev.getDate() - 1);
    const prevDate = prev.toISOString().split('T')[0];
    const hadGameYesterday = plannedSessions.some(s => s.datum === prevDate && s.te === 'Spiel')
      || recentSessions.some(s => s.datum === prevDate && s.te === 'Spiel');
    if (hadGameYesterday) return 'recovery';
    if (currentACWR != null && currentACWR > 1.3) return 'recovery';
    return 'normal';
  }

  // Next 7 days schedule — with pre-computed focus label so AI can't misclassify
  const scheduleText = next7.map(date => {
    const wd = new Date(date).toLocaleDateString('de-DE', { weekday: 'long' });
    const daySessions = plannedSessions
      .filter(s => s.datum === date)
      .map(s => `${s.te}${s.geschaetzteDauer ? ` (${s.geschaetzteDauer}min)` : ''}`);
    const focus = computeFocus(date);
    const focusLabel = { loading: '[SPIELTAG]', recovery: '[RECOVERY]', normal: '[TRAINING]', rest: '[RUHETAG]' }[focus];
    return `${wd} (${date}) ${focusLabel}: ${daySessions.length ? daySessions.join(', ') : '—'}`;
  }).join('\n');

  const dietNote = dietaryPreferences ? `Ernährungspräferenzen: ${dietaryPreferences}` : '';

  const prompt = `Du bist ein Sporternährungsberater für ${level}-Athleten (${sport}).

TDEE Basis: ${baseTDEE} kcal/Tag | Protein-Basis: ${baseProtein}g/Tag
Aktueller ACWR: ${currentACWR != null ? currentACWR.toFixed(2) : 'unbekannt'}
${dietNote}

=== Letzte Trainingseinheiten (14 Tage) ===
${recentSummary}

=== ACWR-Verlauf (14 Tage) ===
${acwrTrend}

=== Trainingsplan nächste 7 Tage ===
${scheduleText}

Erstelle eine datenbasierte, vorausschauende Ernährungsplanung. Antworte NUR mit JSON:

{
  "analysis": "2-3 Sätze: Was siehst du in den Trainingsdaten? ACWR-Trend, Belastungsmuster, worauf musst du achten?",
  "weekStrategy": "Gesamtstrategie für die Ernährung diese Woche (2 Sätze)",
  "topWarnings": ["Konkrete Warnung falls nötig, z.B. Back-to-Back Spiele"],
  "days": [
    {
      "date": "YYYY-MM-DD",
      "dayLabel": "Montag",
      "plannedSessions": ["Team (90min)"],
      "calorieTarget": 3400,
      "proteinTarget": 175,
      "carbTarget": 440,
      "fatTarget": 90,
      "focus": "loading",
      "keyMessage": "Warum ist dieser Tag ernährungstechnisch besonders? (1 Satz)",
      "tips": [
        "Konkreter Tipp 1 mit Uhrzeit und Menge (z.B. '2h vor Training: 80g Reis + 150g Hähnchen')",
        "Konkreter Tipp 2"
      ],
      "meals": [
        {
          "type": "fruehstueck",
          "options": [
            {
              "name": "Haferbrei mit Banane & Whey",
              "calories": 520,
              "protein": 35,
              "carbs": 70,
              "fat": 10,
              "ingredients": "80g Haferflocken, 1 Banane, 30g Whey Protein, 200ml Hafermilch, 1 TL Honig"
            },
            {
              "name": "Eier-Vollkorn-Toast mit Avocado",
              "calories": 490,
              "protein": 28,
              "carbs": 52,
              "fat": 18,
              "ingredients": "3 Eier, 2 Scheiben Vollkornbrot, ½ Avocado, 1 Tomate, Salz/Pfeffer"
            }
          ]
        },
        {
          "type": "mittagessen",
          "options": [
            { "name": "...", "calories": 700, "protein": 45, "carbs": 80, "fat": 20, "ingredients": "..." },
            { "name": "...", "calories": 680, "protein": 42, "carbs": 78, "fat": 22, "ingredients": "..." }
          ]
        },
        {
          "type": "abendessen",
          "options": [
            { "name": "...", "calories": 650, "protein": 50, "carbs": 60, "fat": 18, "ingredients": "..." },
            { "name": "...", "calories": 630, "protein": 48, "carbs": 58, "fat": 20, "ingredients": "..." }
          ]
        },
        {
          "type": "snack",
          "options": [
            { "name": "...", "calories": 250, "protein": 20, "carbs": 30, "fat": 5, "ingredients": "..." },
            { "name": "...", "calories": 230, "protein": 18, "carbs": 28, "fat": 6, "ingredients": "..." }
          ]
        }
      ]
    }
  ]
}

Regeln:
- focus MUSS exakt dem Label im Trainingsplan entsprechen: [SPIELTAG]→"loading", [RECOVERY]→"recovery", [TRAINING]→"normal", [RUHETAG]→"rest"
- NIEMALS "loading" für Tage mit nur Team/S&C — nur wenn "Spiel" explizit vorhanden
- Kalorien-Targets pro focus (Basis = ${baseTDEE} kcal):
  [SPIELTAG]: ${Math.round(baseTDEE * 1.13)} kcal (+13%), KH-Anteil erhöhen auf ~55%
  [RECOVERY]: ${Math.round(baseTDEE * 1.08)} kcal (+8%), Protein erhöhen auf ~35%, Antioxidantien
  [TRAINING]:  ${baseTDEE} kcal, ausgewogene Makros
  [RUHETAG]:  ${Math.round(baseTDEE * 0.90)} kcal (-10%), weniger KH
- Mahlzeiten-Kalorien MÜSSEN sich zum calorieTarget summieren (±5% Toleranz):
  Frühstück ≈ 25% | Mittagessen ≈ 35% | Abendessen ≈ 30% | Snack ≈ 10%
- Bei Trainingstagen (normal/loading): pre-training Mahlzeit 2-3h vorher (KH-reich), post-training Snack innerhalb 45min (Protein+KH)
- tips: IMMER konkret mit Uhrzeit und Menge (z.B. "17:00 Uhr – 60g Haferflocken + 30g Whey vor dem Training")
- ingredients: Komma-getrennte Liste mit konkreten Mengen ("180g Hähnchenbrust, 150g Basmatireis, ...")
- Alle Zahlen ganzzahlig
- ${dietaryPreferences ? `Ernährungspräferenzen beachten: ${dietaryPreferences}` : 'Keine Einschränkungen'}`;

  const stream = await client.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }],
    stream: true,
  });

  let fullText = '';
  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content ?? '';
    if (text) { fullText += text; onChunk(fullText); }
  }

  const jsonMatch = fullText.match(/```json\s*([\s\S]*?)\s*```/) || fullText.match(/(\{[\s\S]*\})/s);
  const jsonStr = jsonMatch ? jsonMatch[1] : fullText.trim();

  try {
    return JSON.parse(jsonStr) as NutritionForecast;
  } catch {
    return null;
  }
}

