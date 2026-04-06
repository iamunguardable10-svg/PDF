import Anthropic from '@anthropic-ai/sdk';
import type { PlannedSession, TrainingUnit } from '../types/acwr';
import { TRAINING_UNITS } from '../types/acwr';

const client = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true,
});

interface ParsedPlan {
  sessions: Array<{
    datum: string;
    te: TrainingUnit;
    uhrzeit?: string;
    geschaetzteDauer?: number;
    notiz?: string;
  }>;
  woche?: string;
}

/**
 * Parst eine Trainer-Nachricht mit Claude und extrahiert geplante Sessions.
 * Gibt den Stream-Callback für Live-Feedback und am Ende die Sessions zurück.
 */
export async function parseTrainerPlan(
  message: string,
  onProgress: (text: string) => void,
): Promise<PlannedSession[]> {
  const today = new Date().toISOString().split('T')[0];
  const [year, month] = today.split('-');

  // Nächste 14 Tage als Kontext
  const nextDays: Record<string, string> = {};
  for (let i = 0; i < 14; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const iso = d.toISOString().split('T')[0];
    const wd = d.toLocaleDateString('de-DE', { weekday: 'long' });
    nextDays[wd.toLowerCase()] = iso;
    nextDays[wd.toLowerCase().slice(0, 2)] = iso; // Mo, Di, Mi etc.
    nextDays[wd.toLowerCase().slice(0, 3)] = iso; // Mon, Die etc.
  }

  const prompt = `Du bist ein Assistent für Sportdaten-Analyse. Deine Aufgabe ist es, eine Trainer-Nachricht zu parsen und geplante Trainingseinheiten zu extrahieren.

Heute ist ${today} (${new Date().toLocaleDateString('de-DE', { weekday: 'long' })}).
Aktueller Monat/Jahr: ${month}/${year}

Nächste 14 Tage (Wochentag → Datum):
${Object.entries(nextDays).filter(([k]) => k.length > 2).map(([k, v]) => `${k} = ${v}`).join('\n')}

Erlaubte Trainingseinheiten (TE): ${TRAINING_UNITS.join(', ')}

Trainer-Nachricht:
---
${message}
---

Extrahiere alle Trainingseinheiten und gib NUR das folgende JSON zurück (kein Text davor/danach):

{
  "woche": "kurze Beschreibung der Woche, z.B. KW 15",
  "sessions": [
    {
      "datum": "YYYY-MM-DD",
      "te": "Team",
      "uhrzeit": "17:00",
      "geschaetzteDauer": 90,
      "notiz": "optionale Zusatzinfo"
    }
  ]
}

Regeln:
- Datum immer als YYYY-MM-DD
- te muss exakt einer der erlaubten Werte sein
- Bei Spielen: te = "Spiel", Aufwärmen davor = "Aufwärmen" (separate Session)
- geschaetzteDauer in Minuten (Team ≈ 90, S&C ≈ 60, Spiel ≈ 40, Aufwärmen ≈ 30–60)
- Wenn keine Uhrzeit angegeben: uhrzeit weglassen
- Ruhetage / freie Tage NICHT als Session aufführen`;

  const stream = client.messages.stream({
    model: 'claude-opus-4-6',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });

  let fullText = '';
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      fullText += event.delta.text;
      onProgress(fullText);
    }
  }

  // JSON extrahieren
  const jsonMatch = fullText.match(/```json\s*([\s\S]*?)\s*```/) ||
    fullText.match(/(\{[\s\S]*\})/);
  const jsonStr = jsonMatch ? jsonMatch[1] : fullText.trim();

  const parsed: ParsedPlan = JSON.parse(jsonStr);

  return (parsed.sessions ?? []).map(s => ({
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
