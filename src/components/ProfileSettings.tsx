import { useState } from 'react';
import type { AthleteProfile, AthleteLevel, PrimaryGoal, Gender } from '../types/profile';
import {
  LEVEL_LABELS, LEVEL_DESC, LEVEL_EMOJI,
  GOAL_LABELS, GOAL_EMOJI,
  calcBMI, bmiLabel, calcBMR, calcTDEE, calcMacros,
} from '../types/profile';

const SPORTS = ['Basketball', 'Fußball', 'Volleyball', 'Handball', 'Leichtathletik', 'Schwimmen', 'Radfahren', 'Fitness / Gym', 'Tennis', 'Sonstiges'];

interface Props {
  profile: AthleteProfile;
  onSave: (profile: AthleteProfile) => void;
  onClose: () => void;
}

export function ProfileSettings({ profile: initial, onSave, onClose }: Props) {
  const [profile, setProfile] = useState<AthleteProfile>({ ...initial });

  const set = <K extends keyof AthleteProfile>(key: K, value: AthleteProfile[K]) =>
    setProfile(p => ({ ...p, [key]: value }));

  const handleSave = () => {
    // Werte klemmen, damit Berechnungen nicht mit Extremwerten brechen
    onSave({
      ...profile,
      age:    Math.min(80,  Math.max(10,  profile.age)),
      weight: Math.min(200, Math.max(30,  profile.weight)),
      height: Math.min(250, Math.max(100, profile.height)),
    });
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-sm bg-[#0f1117] border-l border-gray-800 z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div>
            <h2 className="text-lg font-bold text-white">Profil bearbeiten</h2>
            <p className="text-xs text-gray-500">Änderungen wirken sich auf deinen Plan aus</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl transition-colors">✕</button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">

          {/* Name + Gender */}
          <section className="space-y-3">
            <h3 className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Persönlich</h3>
            <div>
              <label className="text-xs text-gray-500 block mb-1.5">Name</label>
              <input
                type="text"
                value={profile.name}
                onChange={e => set('name', e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1.5">Geschlecht</label>
              <div className="grid grid-cols-3 gap-2">
                {([['maennlich', 'Männlich', '♂️'], ['weiblich', 'Weiblich', '♀️'], ['divers', 'Divers', '⚧']] as [Gender, string, string][]).map(([v, l, e]) => (
                  <button key={v} onClick={() => set('gender', v)}
                    className={`py-2 rounded-xl border text-xs font-medium transition-all ${profile.gender === v ? 'border-violet-500 bg-violet-900/30 text-white' : 'border-gray-700 text-gray-400 hover:border-gray-600'}`}>
                    {e} {l}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Body data */}
          <section className="space-y-3">
            <h3 className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Körperdaten</h3>
            <div className="grid grid-cols-3 gap-3">
              {([
                ['Alter', 'age', 'J', 10, 80],
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
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 pr-7"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">{unit}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Level */}
          <section className="space-y-3">
            <h3 className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Sportler-Niveau</h3>
            <div className="space-y-2">
              {(Object.keys(LEVEL_LABELS) as AthleteLevel[]).map(level => (
                <button key={level} onClick={() => set('level', level)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${profile.level === level ? 'border-violet-500 bg-violet-900/20' : 'border-gray-700 hover:border-gray-600'}`}>
                  <span className="text-xl">{LEVEL_EMOJI[level]}</span>
                  <div className="min-w-0">
                    <div className="font-semibold text-white text-xs">{LEVEL_LABELS[level]}</div>
                    <div className="text-xs text-gray-500 truncate">{LEVEL_DESC[level]}</div>
                  </div>
                  {profile.level === level && <span className="ml-auto text-violet-400 text-sm">✓</span>}
                </button>
              ))}
            </div>
          </section>

          {/* Sport */}
          <section className="space-y-3">
            <h3 className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Sportart</h3>
            <div className="grid grid-cols-2 gap-2">
              {SPORTS.map(s => (
                <button key={s} onClick={() => set('sport', s)}
                  className={`py-2 px-3 rounded-xl border text-xs text-left transition-all ${profile.sport === s ? 'border-violet-500 bg-violet-900/20 text-white' : 'border-gray-700 text-gray-400 hover:border-gray-600'}`}>
                  {s}
                </button>
              ))}
            </div>
          </section>

          {/* Goal */}
          <section className="space-y-3">
            <h3 className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Primäres Ziel</h3>
            <div className="space-y-2">
              {(Object.keys(GOAL_LABELS) as PrimaryGoal[]).map(goal => (
                <button key={goal} onClick={() => set('primaryGoal', goal)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${profile.primaryGoal === goal ? 'border-violet-500 bg-violet-900/20' : 'border-gray-700 hover:border-gray-600'}`}>
                  <span className="text-lg">{GOAL_EMOJI[goal]}</span>
                  <span className={`text-xs font-medium ${profile.primaryGoal === goal ? 'text-white' : 'text-gray-300'}`}>{GOAL_LABELS[goal]}</span>
                  {profile.primaryGoal === goal && <span className="ml-auto text-violet-400 text-sm">✓</span>}
                </button>
              ))}
            </div>
          </section>

          {/* Dietary */}
          <section className="space-y-3">
            <h3 className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Ernährungspräferenzen</h3>
            <input
              type="text"
              value={profile.dietaryPreferences}
              onChange={e => set('dietaryPreferences', e.target.value)}
              placeholder="z.B. vegetarisch, keine Laktose, halal..."
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500"
            />
          </section>
        </div>

        {/* Computed stats */}
        {(() => {
          const bmi = calcBMI(profile);
          const { label: bmiLbl, color: bmiColor } = bmiLabel(bmi);
          const bmr = calcBMR(profile);
          const tdee = calcTDEE(profile);
          const macros = calcMacros(profile, tdee);
          return (
            <div className="px-5 pb-4">
              <h3 className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-3">Berechnete Werte</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-gray-800 rounded-xl p-3">
                  <div className="text-xs text-gray-500">BMI</div>
                  <div className={`text-xl font-bold ${bmiColor}`}>{bmi}</div>
                  <div className={`text-xs ${bmiColor}`}>{bmiLbl}</div>
                </div>
                <div className="bg-gray-800 rounded-xl p-3">
                  <div className="text-xs text-gray-500">Grundumsatz</div>
                  <div className="text-xl font-bold text-white">{bmr} <span className="text-xs font-normal text-gray-500">kcal</span></div>
                </div>
                <div className="bg-gray-800 rounded-xl p-3">
                  <div className="text-xs text-gray-500">Leistungsumsatz</div>
                  <div className="text-xl font-bold text-violet-400">{tdee} <span className="text-xs font-normal text-gray-500">kcal</span></div>
                </div>
                <div className="bg-gray-800 rounded-xl p-3">
                  <div className="text-xs text-gray-500">Protein-Ziel</div>
                  <div className="text-xl font-bold text-orange-400">{macros.protein}g</div>
                </div>
              </div>
              <p className="text-xs text-gray-600 mt-2">Leistungsumsatz passt sich beim Ernährungsplan dynamisch an deinen ACWR an</p>
            </div>
          );
        })()}

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-800">
          <button
            onClick={handleSave}
            disabled={!profile.name.trim()}
            className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${profile.name.trim() ? 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}>
            Speichern
          </button>
        </div>
      </div>
    </>
  );
}
