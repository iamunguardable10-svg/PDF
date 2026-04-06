import { useState } from 'react';
import type { AthleteProfile, AthleteLevel, PrimaryGoal, Gender } from '../types/profile';
import {
  LEVEL_LABELS, LEVEL_DESC, LEVEL_EMOJI,
  GOAL_LABELS, GOAL_EMOJI, DEFAULT_PROFILE,
} from '../types/profile';

interface Props {
  onComplete: (profile: AthleteProfile) => void;
}

const SPORTS = ['Basketball', 'Fußball', 'Volleyball', 'Handball', 'Leichtathletik', 'Schwimmen', 'Radfahren', 'Fitness / Gym', 'Tennis', 'Sonstiges'];

function StepDot({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex gap-2 justify-center mb-6">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`h-1.5 rounded-full transition-all ${i === current ? 'w-6 bg-violet-500' : i < current ? 'w-3 bg-violet-800' : 'w-3 bg-gray-700'}`} />
      ))}
    </div>
  );
}

export function Onboarding({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<AthleteProfile>({ ...DEFAULT_PROFILE });

  const set = <K extends keyof AthleteProfile>(key: K, value: AthleteProfile[K]) =>
    setProfile(p => ({ ...p, [key]: value }));

  const next = () => setStep(s => s + 1);
  const back = () => setStep(s => s - 1);

  const finish = () => onComplete({ ...profile, onboardingCompleted: true });

  const TOTAL = 5;

  return (
    <div className="min-h-screen bg-[#0a0b0f] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-gradient-to-br from-violet-500 to-purple-700 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-3">🥗</div>
          <h1 className="text-2xl font-bold text-white">FitFuel</h1>
          <p className="text-gray-500 text-sm mt-1">Personalisierter KI-Assistent</p>
        </div>

        <div className="bg-gray-900 rounded-3xl border border-gray-800 p-6">
          <StepDot total={TOTAL} current={step} />

          {/* ── Step 0: Willkommen + Name + Geschlecht ── */}
          {step === 0 && (
            <div className="space-y-5">
              <div className="text-center">
                <div className="text-3xl mb-2">👋</div>
                <h2 className="text-xl font-bold text-white">Willkommen!</h2>
                <p className="text-gray-400 text-sm mt-1">Lass uns dein Profil einrichten.</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide block mb-2">Dein Name</label>
                <input
                  type="text"
                  value={profile.name}
                  onChange={e => set('name', e.target.value)}
                  placeholder="z.B. Max"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide block mb-2">Geschlecht</label>
                <div className="grid grid-cols-3 gap-2">
                  {([['maennlich','Männlich','♂️'],['weiblich','Weiblich','♀️'],['divers','Divers','⚧']] as [Gender, string, string][]).map(([v, l, e]) => (
                    <button key={v} onClick={() => set('gender', v)}
                      className={`py-2.5 rounded-xl border text-sm font-medium transition-all ${profile.gender === v ? 'border-violet-500 bg-violet-900/30 text-white' : 'border-gray-700 text-gray-400 hover:border-gray-600'}`}>
                      {e} {l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 1: Sportler-Niveau ── */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-3xl mb-2">🏅</div>
                <h2 className="text-xl font-bold text-white">Dein Niveau</h2>
                <p className="text-gray-400 text-sm mt-1">Das bestimmt deinen Kalorienbedarf.</p>
              </div>
              <div className="space-y-2">
                {(Object.keys(LEVEL_LABELS) as AthleteLevel[]).map(level => (
                  <button key={level} onClick={() => set('level', level)}
                    className={`w-full flex items-center gap-3 p-4 rounded-2xl border text-left transition-all ${profile.level === level ? 'border-violet-500 bg-violet-900/20' : 'border-gray-700 hover:border-gray-600'}`}>
                    <span className="text-2xl">{LEVEL_EMOJI[level]}</span>
                    <div>
                      <div className="font-semibold text-white text-sm">{LEVEL_LABELS[level]}</div>
                      <div className="text-xs text-gray-500">{LEVEL_DESC[level]}</div>
                    </div>
                    {profile.level === level && <span className="ml-auto text-violet-400">✓</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Step 2: Körperdaten + Sport ── */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-3xl mb-2">📊</div>
                <h2 className="text-xl font-bold text-white">Körperdaten</h2>
                <p className="text-gray-400 text-sm mt-1">Für genaue Kalorienberechnung.</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {([
                  ['Alter', 'age', 'Jahre', 10, 80],
                  ['Gewicht', 'weight', 'kg', 30, 200],
                  ['Größe', 'height', 'cm', 100, 250],
                ] as [string, keyof AthleteProfile, string, number, number][]).map(([label, key, unit, min, max]) => (
                  <div key={key}>
                    <label className="text-xs text-gray-500 block mb-1.5">{label}</label>
                    <div className="relative">
                      <input
                        type="number" min={min} max={max}
                        value={profile[key] as number}
                        onChange={e => set(key, Number(e.target.value))}
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 pr-8"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">{unit}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide block mb-2">Sportart</label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                  {SPORTS.map(s => (
                    <button key={s} onClick={() => set('sport', s)}
                      className={`py-2 px-3 rounded-xl border text-sm text-left transition-all ${profile.sport === s ? 'border-violet-500 bg-violet-900/20 text-white' : 'border-gray-700 text-gray-400 hover:border-gray-600'}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 3: Ziel + Trainingsfrequenz ── */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-3xl mb-2">🎯</div>
                <h2 className="text-xl font-bold text-white">Dein Ziel</h2>
              </div>
              <div className="space-y-2">
                {(Object.keys(GOAL_LABELS) as PrimaryGoal[]).map(goal => (
                  <button key={goal} onClick={() => set('primaryGoal', goal)}
                    className={`w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${profile.primaryGoal === goal ? 'border-violet-500 bg-violet-900/20' : 'border-gray-700 hover:border-gray-600'}`}>
                    <span className="text-xl">{GOAL_EMOJI[goal]}</span>
                    <span className={`text-sm font-medium ${profile.primaryGoal === goal ? 'text-white' : 'text-gray-300'}`}>{GOAL_LABELS[goal]}</span>
                    {profile.primaryGoal === goal && <span className="ml-auto text-violet-400">✓</span>}
                  </button>
                ))}
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-2">Trainingseinheiten pro Woche: <span className="text-white font-semibold">{profile.weeklyTrainings}×</span></label>
                <input type="range" min={1} max={14} value={profile.weeklyTrainings}
                  onChange={e => set('weeklyTrainings', Number(e.target.value))}
                  className="w-full accent-violet-500" />
                <div className="flex justify-between text-xs text-gray-600 mt-1"><span>1×</span><span>7×</span><span>14×</span></div>
              </div>
            </div>
          )}

          {/* ── Step 4: Ernährungspräferenzen ── */}
          {step === 4 && (
            <div className="space-y-5">
              <div className="text-center">
                <div className="text-3xl mb-2">🥦</div>
                <h2 className="text-xl font-bold text-white">Ernährung</h2>
                <p className="text-gray-400 text-sm mt-1">Optional — kannst du überspringen.</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide block mb-2">Einschränkungen / Präferenzen</label>
                <input
                  type="text"
                  value={profile.dietaryPreferences}
                  onChange={e => set('dietaryPreferences', e.target.value)}
                  placeholder="z.B. vegetarisch, keine Laktose, halal..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500 text-sm"
                />
              </div>

              {/* Zusammenfassung */}
              <div className="bg-gray-800/50 rounded-2xl p-4 space-y-2 text-sm">
                <div className="font-semibold text-white mb-2">Dein Profil</div>
                {[
                  ['👤', profile.name],
                  ['🏅', LEVEL_LABELS[profile.level]],
                  ['⚽', profile.sport],
                  ['🎯', GOAL_LABELS[profile.primaryGoal]],
                  ['📏', `${profile.weight}kg · ${profile.height}cm · ${profile.age}J`],
                  ['🏋️', `${profile.weeklyTrainings}× Training/Woche`],
                ].map(([icon, val]) => (
                  <div key={icon} className="flex gap-2 text-gray-300">
                    <span>{icon}</span><span>{val}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-2 mt-6">
            {step > 0 && (
              <button onClick={back} className="px-4 py-3 rounded-xl border border-gray-700 text-gray-400 hover:text-white text-sm transition-colors">
                ← Zurück
              </button>
            )}
            {step < TOTAL - 1 ? (
              <button onClick={next}
                disabled={step === 0 && !profile.name.trim()}
                className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all ${step === 0 && !profile.name.trim() ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-violet-600 hover:bg-violet-500 text-white'}`}>
                Weiter →
              </button>
            ) : (
              <button onClick={finish} className="flex-1 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white transition-all">
                ✨ Loslegen
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
