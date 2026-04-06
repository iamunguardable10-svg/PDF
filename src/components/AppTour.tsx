import { useState } from 'react';

interface Props {
  onDone: () => void;
}

const STEPS = [
  {
    emoji: '👋',
    title: 'Willkommen bei FitFuel!',
    desc: 'Dein persönlicher KI-Assistent für Ernährung und Trainingssteuerung. Hier ein kurzer Überblick.',
    details: [
      { icon: '🥗', text: 'Tab "Ernährung" — KI-Ernährungsplan' },
      { icon: '📊', text: 'Tab "ACWR" — Trainingsbelastung tracken' },
      { icon: '⚙️', text: 'Profil oben rechts jederzeit ändern' },
    ],
  },
  {
    emoji: '🤖',
    title: 'KI-Ernährungsplan',
    desc: 'Vollständig personalisiert auf dein Profil, Niveau und deinen aktuellen ACWR-Wert.',
    details: [
      { icon: '🔥', text: 'Kalorienbedarf steigt bei ACWR >1.3 automatisch (+12% Recovery)' },
      { icon: '💪', text: 'Leistungssportler: 2,0g Protein/kg · Einsteiger: 1,2g/kg' },
      { icon: '🛒', text: 'Einkaufsliste wird automatisch mitgeneriert' },
    ],
  },
  {
    emoji: '⌚',
    title: 'Wearable Daten',
    desc: 'Gib deine täglichen Werte manuell ein — direkt aus deiner Smartwatch-App abgelesen.',
    details: [
      { icon: '✏️', text: 'Klick auf "Bearbeiten" im Wearable-Bereich' },
      { icon: '📲', text: 'Schritte, Herzrate, Schlaf, Kalorien eintragen' },
      { icon: '🔄', text: 'Werte fließen sofort in den Ernährungsplan ein' },
    ],
  },
  {
    emoji: '📋',
    title: 'Trainer-Plan einlesen',
    desc: 'Kopiere die Nachricht deines Trainers rein — die KI erkennt Datum, Einheit und Uhrzeit automatisch.',
    details: [
      { icon: '🏆', text: 'Bei jedem Spiel wird Aufwärmen automatisch eingefügt' },
      { icon: '✍️', text: 'Manuell eintragen: alle TE-Typen inkl. Aufwärmen wählbar' },
      { icon: '🔔', text: 'Push-Erinnerung nach Training: RPE & Dauer eintragen' },
    ],
  },
  {
    emoji: '📈',
    title: 'ACWR verstehen',
    desc: 'Der ACWR misst deine aktuelle Belastung (7 Tage) im Verhältnis zu deiner Fitness (28 Tage).',
    details: [
      { icon: '🟢', text: 'Optimal: 0.8 – 1.3 · geringes Verletzungsrisiko' },
      { icon: '🔴', text: 'High Risk: >1.3 · Regeneration priorisieren' },
      { icon: '🔵', text: 'Low Risk: <0.8 · zu wenig Reiz, Fitness baut ab' },
      { icon: '📅', text: 'TL = RPE × Dauer (Minuten) nach jeder Einheit eintragen' },
    ],
  },
];

export function AppTour({ onDone }: Props) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-gray-900 rounded-3xl border border-gray-800 shadow-2xl overflow-hidden">

        {/* Progress bar */}
        <div className="flex">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 transition-all duration-300 ${i <= step ? 'bg-violet-500' : 'bg-gray-800'}`}
            />
          ))}
        </div>

        <div className="p-7">
          {/* Icon + title */}
          <div className="text-center mb-5">
            <div className="text-5xl mb-3">{current.emoji}</div>
            <h2 className="text-xl font-bold text-white">{current.title}</h2>
            <p className="text-gray-400 text-sm mt-2 leading-relaxed">{current.desc}</p>
          </div>

          {/* Details list */}
          <div className="space-y-2.5 mb-6">
            {current.details.map((d, i) => (
              <div key={i} className="flex items-start gap-3 bg-gray-800/60 rounded-xl px-4 py-2.5">
                <span className="text-lg leading-none mt-0.5 shrink-0">{d.icon}</span>
                <span className="text-sm text-gray-300">{d.text}</span>
              </div>
            ))}
          </div>

          {/* Step dots */}
          <div className="flex gap-1.5 justify-center mb-6">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`rounded-full transition-all ${i === step ? 'w-5 h-1.5 bg-violet-500' : 'w-1.5 h-1.5 bg-gray-700 hover:bg-gray-600'}`}
              />
            ))}
          </div>

          {/* Navigation */}
          <div className="flex gap-2">
            <button
              onClick={onDone}
              className="px-4 py-2.5 rounded-xl border border-gray-700 text-gray-500 hover:text-gray-300 text-sm transition-colors"
            >
              Überspringen
            </button>
            {step > 0 && (
              <button
                onClick={() => setStep(s => s - 1)}
                className="px-4 py-2.5 rounded-xl border border-gray-700 text-gray-400 hover:text-white text-sm transition-colors"
              >
                ←
              </button>
            )}
            <button
              onClick={() => isLast ? onDone() : setStep(s => s + 1)}
              className="flex-1 py-2.5 rounded-xl font-semibold text-sm bg-violet-600 hover:bg-violet-500 text-white transition-colors"
            >
              {isLast ? "✓ Los geht's" : 'Weiter →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
