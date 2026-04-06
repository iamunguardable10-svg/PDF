import Groq from 'groq-sdk';
import type { PlannedSession, TrainingUnit } from '../types/acwr';
import { TRAINING_UNITS } from '../types/acwr';

const client = new Groq({
  apiKey: import.meta.env.VITE_GROQ_API_KEY,
  dangerouslyAllowBrowser: true,
});

const MODEL = 'llama-3.3-70b-versatile';

export async function parseTrainerPlan(
  message: string,
  onProgress: (text: string) => void,
): Promise<PlannedSession[]> {
  const today = new Date().toISOString().split('T')[0];
  const [year, month] = today.split('-');

  // Nächste 14 Tage als Kontext aufbauen
  const nextDays: Record<string, string> = {};
  for (let i = 0; i < 14; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const iso = d.toISOString().split('T')[0];
    const wd = d.toLocaleDateString('de-DE', { weekday: 'long' }).toLowerCase();
    nextDays[wd] = iso;
    nextDays[wd.slice(0, 2)] = iso; // Mo, Di, Mi...
  }

  const dayTable = Object.entries(nextDays)
    .filter(([k]) => k.length > 2)
    .map(([k, v]) => `${k} = ${v}`)
    .join('\n');

  const prompt = `Du parst eine Trainer-Nachricht und extrahierst Trainingseinheiten als JSON.

Heute: ${today} | Monat/Jahr: ${month}/${year}

Wochentage → Datum:
${dayTable}

Erlaubte TE-Typen: ${TRAINING_UNITS.join(', ')}

Trainer-Nachricht:
---
${message}
---

Antworte NUR mit diesem JSON (kein Text davor/danach):

{
  "sessions": [
    {
      "datum": "YYYY-MM-DD",
      "te": "Team",
      "uhrzeit": "17:00",
      "geschaetzteDauer": 90,
      "notiz": "optional"
    }
  ]
}

Regeln:
- datum immer YYYY-MM-DD
- te exakt aus der Liste: ${TRAINING_UNITS.join(', ')}
- Spiel + Aufwärmen = zwei separate Sessions
- geschaetzteDauer in Minuten (Team≈90, S&C≈60, Spiel≈40, Aufwärmen≈30)
- Ruhetage NICHT aufführen
- uhrzeit nur wenn angegeben, sonst weglassen`;

  const stream = await client.chat.completions.create({
    model: MODEL,
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
    stream: true,
  });

  let fullText = '';
  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content ?? '';
    if (text) {
      fullText += text;
      onProgress(fullText);
    }
  }

  // JSON extrahieren
  const jsonMatch = fullText.match(/```json\s*([\s\S]*?)\s*```/) ||
    fullText.match(/(\{[\s\S]*\})/);
  const jsonStr = jsonMatch ? jsonMatch[1] : fullText.trim();

  const parsed = JSON.parse(jsonStr);

  return (parsed.sessions ?? []).map((s: {
    datum: string; te: TrainingUnit; uhrzeit?: string;
    geschaetzteDauer?: number; notiz?: string;
  }) => ({
    id: `plan-${s.datum}-${s.te}-${Math.random().toString(36).slice(2, 6)}`,
    datum: s.datum,
    te: s.te,
    uhrzeit: s.uhrzeit,
    geschaetzteDauer: s.geschaetzteDauer,
    notiz: s.notiz,
    reminderScheduled: false,
    confirmed: false,
  }));
}
