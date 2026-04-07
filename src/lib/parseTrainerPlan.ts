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

  // Nächste 14 Tage als Kontext aufbauen — deutsch + englisch
  const EN_DAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const EN_SHORT = ['sun','mon','tue','wed','thu','fri','sat'];

  const nextDays: Record<string, string> = {};
  for (let i = 0; i < 14; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const iso = d.toISOString().split('T')[0];
    const wdDE = d.toLocaleDateString('de-DE', { weekday: 'long' }).toLowerCase();
    const wdIdx = d.getDay();
    // German: full + 2-char short (Mo, Di, Mi…)
    nextDays[wdDE] = iso;
    nextDays[wdDE.slice(0, 2)] = iso;
    // English: full + 3-char short
    nextDays[EN_DAYS[wdIdx]] = iso;
    nextDays[EN_SHORT[wdIdx]] = iso;
  }

  const dayTable = Object.entries(nextDays)
    .filter(([k]) => k.length >= 3)
    .map(([k, v]) => `${k} = ${v}`)
    .join('\n');

  // Pre-filter: strip lines that are clearly rest/off days before sending to AI
  const OFF_PATTERN = /\b(off|rest|frei|pause|ruhetag|keine\s+einheit|no\s+training|recovery\s+day)\b/i;
  const cleanedMessage = message
    .split('\n')
    .filter(line => !OFF_PATTERN.test(line))
    .join('\n')
    .trim();

  const prompt = `Du parst eine Trainer-Nachricht und extrahierst Trainingseinheiten als JSON.

Heute: ${today} | Monat/Jahr: ${month}/${year}

Wochentage → Datum:
${dayTable}

Erlaubte TE-Typen (EXAKT so schreiben):
- Team       → Mannschaftstraining, Teamtraining, Training
- S&C        → Kraft, Kraftraum, Gym, Athletik, Fitness, Kondition
- Spiel      → Match, Wettkampf, Partie, Heimspiel, Auswärtsspiel
- Aufwärmen  → Warm-up, Einlaufen, Aufwärmen
- Indi       → Individuell, Einzeltraining, Extra
- Schulsport → Schule, PE, Sport
- Prävention → Physio, Reha, Prävention, Regen, Regeneration

Trainer-Nachricht:
---
${cleanedMessage}
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
- te MUSS exakt eines sein von: ${TRAINING_UNITS.join(', ')} — kein anderer Wert erlaubt
- Aufwärmen wird automatisch zu Spielen hinzugefügt, du musst es NICHT einfügen
- geschaetzteDauer in Minuten (Team≈90, S&C≈60, Spiel≈90, Aufwärmen≈30)
- Ruhetage/OFF/Rest/Pause/frei → einfach NICHT in sessions aufführen
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

  // Fuzzy-Normalisierung: falls Modell einen ungültigen TE-Typ liefert → auf nächsten erlaubten mappen
  const TE_ALIASES: Record<string, TrainingUnit> = {
    team: 'Team', mannschaft: 'Team', training: 'Team', gruppentraining: 'Team',
    'sc': 'S&C', 's&c': 'S&C', kraft: 'S&C', gym: 'S&C', athletik: 'S&C', fitness: 'S&C', kondition: 'S&C',
    spiel: 'Spiel', match: 'Spiel', wettkampf: 'Spiel', partie: 'Spiel', heimspiel: 'Spiel', auswärtsspiel: 'Spiel',
    aufwärmen: 'Aufwärmen', warmup: 'Aufwärmen', 'warm-up': 'Aufwärmen', einlaufen: 'Aufwärmen',
    indi: 'Indi', individuell: 'Indi', einzeltraining: 'Indi', extra: 'Indi',
    schulsport: 'Schulsport', schule: 'Schulsport', pe: 'Schulsport',
    prävention: 'Prävention', physio: 'Prävention', reha: 'Prävention', regeneration: 'Prävention', regen: 'Prävention',
  };

  function normalizeTE(raw: string): TrainingUnit {
    const key = raw.toLowerCase().trim().replace(/\s+/g, '');
    if ((TRAINING_UNITS as string[]).includes(raw)) return raw as TrainingUnit;
    return TE_ALIASES[key] ?? TE_ALIASES[raw.toLowerCase()] ?? 'Team';
  }

  const sessions: PlannedSession[] = (parsed.sessions ?? []).map((s: {
    datum: string; te: TrainingUnit; uhrzeit?: string;
    geschaetzteDauer?: number; notiz?: string;
  }) => ({
    id: `plan-${s.datum}-${s.te}-${Math.random().toString(36).slice(2, 10)}`,
    datum: s.datum,
    te: normalizeTE(s.te),
    uhrzeit: s.uhrzeit,
    geschaetzteDauer: s.geschaetzteDauer,
    notiz: s.notiz,
    reminderScheduled: false,
    confirmed: false,
  }));

  // Jedes Spiel bekommt automatisch ein Aufwärmen (30 Min vor Spiel),
  // falls noch keines für diesen Tag existiert.
  const datesWithAufwaermen = new Set(
    sessions.filter(s => s.te === 'Aufwärmen').map(s => s.datum)
  );
  const aufwaermenToAdd: PlannedSession[] = sessions
    .filter(s => s.te === 'Spiel' && !datesWithAufwaermen.has(s.datum))
    .map(s => {
      // Uhrzeit: 30 Min vor Spielbeginn, falls bekannt
      let uhrzeit: string | undefined;
      if (s.uhrzeit) {
        const [h, m] = s.uhrzeit.split(':').map(Number);
        const totalMin = h * 60 + m - 30;
        const wh = Math.floor(Math.max(0, totalMin) / 60).toString().padStart(2, '0');
        const wm = (Math.max(0, totalMin) % 60).toString().padStart(2, '0');
        uhrzeit = `${wh}:${wm}`;
      }
      return {
        id: `plan-${s.datum}-Aufwärmen-${Math.random().toString(36).slice(2, 10)}`,
        datum: s.datum,
        te: 'Aufwärmen' as TrainingUnit,
        uhrzeit,
        geschaetzteDauer: 30,
        notiz: 'Automatisch vor Spiel eingefügt',
        reminderScheduled: false,
        confirmed: false,
      };
    });

  return [...sessions, ...aufwaermenToAdd].sort((a, b) =>
    a.datum.localeCompare(b.datum) || (a.uhrzeit ?? '').localeCompare(b.uhrzeit ?? '')
  );
}
