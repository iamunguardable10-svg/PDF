import { useState } from 'react';

interface Props {
  onDone: () => void;
}

const STEPS = [
  {
    emoji: '🏀',
    title: 'Welcome to TeamLoad',
    desc: 'TeamLoad is the coach workflow for team sports: sessions, availability, final attendance and load context.',
    details: [
      { icon: '📅', text: 'Sessions: plan practices, games and team events' },
      { icon: '✅', text: 'Availability: athletes only report exceptions' },
      { icon: '📊', text: 'Load: use participation context for smarter decisions' },
    ],
  },
  {
    emoji: '📅',
    title: 'Start with sessions',
    desc: 'The session calendar is the operational base. Every availability and attendance decision should connect back to a real team event.',
    details: [
      { icon: '🧩', text: 'Create trainings, games and recovery blocks' },
      { icon: '👥', text: 'Assign sessions to the right team or group' },
      { icon: '📝', text: 'Add coach notes so athletes know the context' },
    ],
  },
  {
    emoji: '🙋',
    title: 'Athletes report exceptions',
    desc: 'Players are expected by default. They only need to act when something changes.',
    details: [
      { icon: '🟢', text: 'Expected: no action needed' },
      { icon: '🟡', text: 'Maybe or late: reason/context matters' },
      { icon: '🔴', text: 'No: coach sees the absence before planning' },
    ],
  },
  {
    emoji: '🧾',
    title: 'Coach finalizes attendance',
    desc: 'Availability is planned intent. Final attendance is the coach-confirmed truth after the session.',
    details: [
      { icon: '✅', text: 'Present, late, partial or absent' },
      { icon: '🧠', text: 'Final status creates better load context' },
      { icon: '☁️', text: 'Shared cloud persistence is the next production gate' },
    ],
  },
  {
    emoji: '🧭',
    title: 'Use the Coach Workspace first',
    desc: 'The newest TeamLoad product path is the Coach Workspace. Older personal or legacy areas are secondary and mainly useful for testing.',
    details: [
      { icon: '⭐', text: 'Recommended: Coach Dashboard, Sessions, Calendar, Attendance, Load' },
      { icon: '🧪', text: 'Demo mode: inspect the product with sample club data' },
      { icon: '🔒', text: 'Real teams need accounts and shared sync' },
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
        <div className="flex">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 transition-all duration-300 ${i <= step ? 'bg-violet-500' : 'bg-gray-800'}`}
            />
          ))}
        </div>

        <div className="p-7">
          <div className="text-center mb-5">
            <div className="text-5xl mb-3">{current.emoji}</div>
            <h2 className="text-xl font-bold text-white">{current.title}</h2>
            <p className="text-gray-400 text-sm mt-2 leading-relaxed">{current.desc}</p>
          </div>

          <div className="space-y-2.5 mb-6">
            {current.details.map((d, i) => (
              <div key={i} className="flex items-start gap-3 bg-gray-800/60 rounded-xl px-4 py-2.5">
                <span className="text-lg leading-none mt-0.5 shrink-0">{d.icon}</span>
                <span className="text-sm text-gray-300">{d.text}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-1.5 justify-center mb-6">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`rounded-full transition-all ${i === step ? 'w-5 h-1.5 bg-violet-500' : 'w-1.5 h-1.5 bg-gray-700 hover:bg-gray-600'}`}
                aria-label={`Go to tour step ${i + 1}`}
              />
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={onDone}
              className="px-4 py-2.5 rounded-xl border border-gray-700 text-gray-500 hover:text-gray-300 text-sm transition-colors"
            >
              Skip
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
              {isLast ? "Open TeamLoad" : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
