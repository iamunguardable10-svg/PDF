import { useState } from 'react';
import type { PlannedSession, ACWRDataPoint } from '../types/acwr';
import { TE_EMOJI } from '../types/acwr';
import type { Session } from '../types/acwr';
import type { NutritionForecast as ForecastData, ForecastDay, ForecastMeal, MealOption } from '../lib/foodApi';
import { generateNutritionForecast } from '../lib/foodApi';
import type { AthleteProfile } from '../types/profile';
import { LEVEL_LABELS } from '../types/profile';

interface Props {
  plannedSessions: PlannedSession[];
  recentSessions: Session[];
  acwrHistory: ACWRDataPoint[];
  baseTDEE: number;
  baseProtein: number;
  profile: AthleteProfile;
  acwr: number | null;
  outdated?: boolean;
  onForecastGenerated?: () => void;
}

const FOCUS_CONFIG = {
  loading:  { label: 'Spieltag / Wettkampf', color: 'text-blue-400',   bg: 'bg-blue-950/40',   border: 'border-blue-800/60',  emoji: '⚡' },
  recovery: { label: 'Recovery',             color: 'text-orange-400', bg: 'bg-orange-950/40', border: 'border-orange-800/60', emoji: '🔄' },
  normal:   { label: 'Training',             color: 'text-violet-400', bg: 'bg-violet-950/40', border: 'border-violet-800/60', emoji: '💪' },
  rest:     { label: 'Ruhetag',              color: 'text-gray-400',   bg: 'bg-gray-900/40',   border: 'border-gray-800',      emoji: '😴' },
};

const MEAL_LABELS: Record<string, string> = {
  fruehstueck: '🌅 Frühstück',
  mittagessen: '☀️ Mittagessen',
  abendessen:  '🌙 Abendessen',
  snack:       '🍎 Snack',
};

function MealOptionCard({ opt, selected, onSelect }: { opt: MealOption; selected: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-3 rounded-xl border transition-all ${selected ? 'border-violet-500 bg-violet-900/20' : 'border-gray-800 bg-gray-900/60 hover:border-gray-700'}`}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="text-sm font-semibold text-white leading-tight">{opt.name}</span>
        <span className="text-sm font-bold text-orange-400 shrink-0">{opt.calories} kcal</span>
      </div>
      <div className="flex gap-3 text-xs text-gray-500 mb-1.5">
        <span>P <span className="text-orange-400">{opt.protein}g</span></span>
        <span>KH <span className="text-blue-400">{opt.carbs}g</span></span>
        <span>F <span className="text-yellow-400">{opt.fat}g</span></span>
      </div>
      <p className="text-xs text-gray-500 leading-relaxed">{opt.ingredients}</p>
    </button>
  );
}

function MealSection({ meal }: { meal: ForecastMeal }) {
  const [selected, setSelected] = useState(0);
  return (
    <div>
      <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">
        {MEAL_LABELS[meal.type] ?? meal.type}
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        {meal.options.map((opt, i) => (
          <MealOptionCard key={i} opt={opt} selected={selected === i} onSelect={() => setSelected(i)} />
        ))}
      </div>
    </div>
  );
}

function DayCard({ day }: { day: ForecastDay }) {
  const [open, setOpen] = useState(false);
  const cfg = FOCUS_CONFIG[day.focus] ?? FOCUS_CONFIG.normal;
  const isToday = day.date === new Date().toISOString().split('T')[0];

  return (
    <div className={`rounded-2xl border ${cfg.bg} ${cfg.border} ${isToday ? 'ring-1 ring-violet-500' : ''}`}>
      <button className="w-full text-left p-4" onClick={() => setOpen(o => !o)}>
        <div className="flex items-center gap-3">
          <span className="text-xl">{cfg.emoji}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-white">{day.dayLabel}</span>
              {isToday && <span className="text-xs bg-violet-600 text-white px-1.5 py-0.5 rounded-full">Heute</span>}
              <span className={`text-xs px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color} ${cfg.border}`}>{cfg.label}</span>
            </div>
            {day.plannedSessions.length > 0 && (
              <p className="text-xs text-gray-500 mt-0.5 truncate">{day.plannedSessions.join(' · ')}</p>
            )}
            {day.keyMessage && (
              <p className="text-xs text-gray-400 mt-1 italic">{day.keyMessage}</p>
            )}
          </div>
          <div className="text-right shrink-0">
            <div className={`text-lg font-bold ${cfg.color}`}>{day.calorieTarget}</div>
            <div className="text-xs text-gray-500">kcal</div>
          </div>
          <span className="text-gray-600 text-xs">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-800/50 pt-4">
          {/* Macros */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-gray-900/60 rounded-xl p-2">
              <div className="text-xs text-gray-500">Protein</div>
              <div className="font-bold text-orange-400">{day.proteinTarget}g</div>
            </div>
            <div className="bg-gray-900/60 rounded-xl p-2">
              <div className="text-xs text-gray-500">Kohlenhydrate</div>
              <div className="font-bold text-blue-400">{day.carbTarget}g</div>
            </div>
            <div className="bg-gray-900/60 rounded-xl p-2">
              <div className="text-xs text-gray-500">Fett</div>
              <div className="font-bold text-yellow-400">{day.fatTarget}g</div>
            </div>
          </div>

          {/* Tips */}
          {day.tips.length > 0 && (
            <div className="space-y-1.5">
              {day.tips.map((tip, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-gray-300 bg-gray-900/40 rounded-xl px-3 py-2">
                  <span className="text-green-400 shrink-0 mt-0.5">→</span>
                  <span>{tip}</span>
                </div>
              ))}
            </div>
          )}

          {/* Meal options */}
          {day.meals && day.meals.length > 0 && (
            <div className="space-y-4">
              <div className="text-xs text-gray-500 uppercase tracking-wide">Mahlzeiten (2 Optionen wählen)</div>
              {day.meals.map((meal, i) => (
                <MealSection key={i} meal={meal} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function NutritionForecast({
  plannedSessions, recentSessions, acwrHistory,
  baseTDEE, baseProtein, profile, acwr: _acwr, outdated, onForecastGenerated,
}: Props) {
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');

  const today = new Date().toISOString().split('T')[0];
  const upcoming = plannedSessions.filter(s => s.datum >= today && !s.confirmed);

  const handleGenerate = async () => {
    setLoading(true);
    setProgress('');
    setError('');
    setForecast(null);
    try {
      const result = await generateNutritionForecast(
        {
          plannedSessions: upcoming,
          recentSessions: recentSessions.map(s => ({
            datum: s.datum, te: s.te, tl: s.tl, rpe: s.rpe, dauer: s.dauer,
          })),
          acwrHistory: acwrHistory.map(p => ({
            datum: p.datum, acwr: p.acwr, acuteLoad: p.acuteLoad, chronicLoad: p.chronicLoad,
          })),
          baseTDEE,
          baseProtein,
          sport: profile.sport,
          level: LEVEL_LABELS[profile.level],
          dietaryPreferences: profile.dietaryPreferences,
        },
        text => setProgress(text),
      );
      if (result) { setForecast(result); onForecastGenerated?.(); }
      else setError('Fehler beim Generieren. Bitte erneut versuchen.');
    } catch {
      setError('Verbindungsfehler. Bitte erneut versuchen.');
    }
    setLoading(false);
    setProgress('');
  };

  return (
    <div className="bg-gray-900/50 rounded-3xl p-6 border border-gray-800 space-y-5">
      <div className="flex items-center gap-3">
        <span className="text-2xl">🔮</span>
        <div>
          <h2 className="text-lg font-semibold text-white">Vorausschauende Ernährung</h2>
          <p className="text-sm text-gray-400">KI-Analyse basierend auf ACWR-Verlauf + Trainingsplan</p>
        </div>
      </div>

      {/* Outdated notice */}
      {outdated && !loading && (
        <div className="flex items-center gap-3 bg-orange-900/20 border border-orange-800/50 rounded-2xl p-3">
          <span className="text-orange-400 text-lg">🔔</span>
          <span className="text-sm text-orange-300 flex-1">Trainingsplan aktualisiert — Prognose erneuern?</span>
          <button onClick={handleGenerate}
            className="text-xs px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-semibold transition-colors">
            Aktualisieren
          </button>
        </div>
      )}

      {/* Upcoming sessions preview chips */}
      {upcoming.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(
            upcoming
              .filter(s => { const d = new Date(); d.setDate(d.getDate() + 7); return s.datum <= d.toISOString().split('T')[0]; })
              .sort((a, b) => a.datum.localeCompare(b.datum))
              .reduce<Record<string, PlannedSession[]>>((acc, s) => { (acc[s.datum] ??= []).push(s); return acc; }, {})
          ).map(([date, sessions]) => {
            const label = new Date(date).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'numeric' });
            return (
              <div key={date} className="flex items-center gap-1.5 bg-gray-900 rounded-xl px-3 py-1.5 border border-gray-800 text-xs">
                <span className="text-gray-500">{label}</span>
                {sessions.map(s => <span key={s.id}>{TE_EMOJI[s.te]} {s.te}</span>)}
              </div>
            );
          })}
        </div>
      )}

      {upcoming.length === 0 && (
        <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 text-sm text-gray-500 text-center">
          Noch keine Trainingseinheiten geplant — im ACWR-Tab Trainer-Plan hochladen oder manuell eintragen.
        </div>
      )}

      <button
        onClick={handleGenerate}
        disabled={loading}
        className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all ${
          loading ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white shadow-lg shadow-violet-900/30'
        }`}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Analysiere ACWR + Trainingsplan…
          </span>
        ) : '🔮 KI-Ernährungsprognose erstellen'}
      </button>

      {error && <div className="bg-red-900/30 border border-red-800 rounded-xl p-3 text-red-400 text-sm">{error}</div>}

      {loading && progress && (
        <div className="bg-gray-900 rounded-xl p-3 border border-gray-800 max-h-20 overflow-hidden opacity-60">
          <pre className="text-xs text-gray-600 font-mono">{progress.slice(-300)}</pre>
        </div>
      )}

      {forecast && (
        <div className="space-y-4">
          {/* Analysis */}
          <div className="bg-violet-900/20 border border-violet-800/50 rounded-2xl p-4 space-y-2">
            <div className="text-xs text-violet-400 uppercase tracking-wide font-semibold">KI-Analyse deiner Trainingsdaten</div>
            <p className="text-sm text-gray-300 leading-relaxed">{forecast.analysis}</p>
            <p className="text-sm text-gray-400 leading-relaxed border-t border-violet-800/30 pt-2">{forecast.weekStrategy}</p>
          </div>

          {/* Warnings */}
          {forecast.topWarnings?.length > 0 && (
            <div className="space-y-2">
              {forecast.topWarnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 bg-red-900/20 border border-red-800/40 rounded-xl px-4 py-2.5">
                  <span className="text-red-400 shrink-0">⚠️</span>
                  <span className="text-sm text-red-300">{w}</span>
                </div>
              ))}
            </div>
          )}

          {/* Day cards */}
          <div className="space-y-2">
            {forecast.days.map(day => <DayCard key={day.date} day={day} />)}
          </div>
        </div>
      )}
    </div>
  );
}
