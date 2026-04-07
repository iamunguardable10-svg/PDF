import { useState } from 'react';
import type { PlannedSession } from '../types/acwr';
import { TE_EMOJI } from '../types/acwr';
import type { NutritionForecast as ForecastData, ForecastDay } from '../lib/foodApi';
import { generateNutritionForecast } from '../lib/foodApi';

interface Props {
  plannedSessions: PlannedSession[];
  baseTDEE: number;
  baseProtein: number;
  acwr: number | null;
}

const FOCUS_CONFIG = {
  loading:  { label: 'Carb-Loading',  color: 'text-blue-400',   bg: 'bg-blue-900/20',   border: 'border-blue-800',  emoji: '⚡' },
  recovery: { label: 'Recovery',      color: 'text-orange-400', bg: 'bg-orange-900/20', border: 'border-orange-800', emoji: '🔄' },
  normal:   { label: 'Training',      color: 'text-violet-400', bg: 'bg-violet-900/20', border: 'border-violet-800', emoji: '💪' },
  rest:     { label: 'Ruhetag',       color: 'text-gray-400',   bg: 'bg-gray-900/20',   border: 'border-gray-800',   emoji: '😴' },
};

function DayCard({ day }: { day: ForecastDay }) {
  const [open, setOpen] = useState(false);
  const cfg = FOCUS_CONFIG[day.focus];
  const isToday = day.date === new Date().toISOString().split('T')[0];

  return (
    <div className={`rounded-2xl border p-4 ${cfg.bg} ${cfg.border} ${isToday ? 'ring-1 ring-violet-500' : ''}`}>
      <button className="w-full text-left" onClick={() => setOpen(o => !o)}>
        <div className="flex items-center gap-3">
          <div className="text-center min-w-[2.5rem]">
            <div className={`text-xl font-bold ${cfg.color}`}>{cfg.emoji}</div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">{day.dayLabel}</span>
              {isToday && <span className="text-xs bg-violet-600 text-white px-1.5 py-0.5 rounded-full">Heute</span>}
              <span className={`text-xs px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color} border ${cfg.border}`}>{cfg.label}</span>
            </div>
            {day.plannedSessions.length > 0 && (
              <div className="text-xs text-gray-500 mt-0.5 truncate">
                {day.plannedSessions.join(' · ')}
              </div>
            )}
          </div>
          <div className="text-right shrink-0">
            <div className={`text-lg font-bold ${cfg.color}`}>{day.calorieTarget}</div>
            <div className="text-xs text-gray-500">kcal</div>
          </div>
          <div className="text-gray-600 text-sm">{open ? '▲' : '▼'}</div>
        </div>
      </button>

      {open && (
        <div className="mt-3 space-y-3 border-t border-gray-800 pt-3">
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
                <div key={i} className="flex items-start gap-2 text-xs text-gray-300">
                  <span className="text-green-500 shrink-0 mt-0.5">→</span>
                  <span>{tip}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function NutritionForecast({ plannedSessions, baseTDEE, baseProtein, acwr }: Props) {
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');

  // Upcoming sessions only (today + next 7 days)
  const today = new Date().toISOString().split('T')[0];
  const upcoming = plannedSessions.filter(s => s.datum >= today && !s.confirmed);

  const handleGenerate = async () => {
    setLoading(true);
    setProgress('');
    setError('');
    setForecast(null);
    try {
      const result = await generateNutritionForecast(
        upcoming,
        baseTDEE,
        baseProtein,
        acwr,
        text => setProgress(text),
      );
      if (result) setForecast(result);
      else setError('Fehler beim Generieren. Bitte erneut versuchen.');
    } catch {
      setError('Verbindungsfehler. Bitte erneut versuchen.');
    }
    setLoading(false);
    setProgress('');
  };

  // Upcoming sessions preview
  const upcomingByDay = upcoming.reduce<Record<string, PlannedSession[]>>((acc, s) => {
    (acc[s.datum] ??= []).push(s);
    return acc;
  }, {});

  return (
    <div className="bg-gray-900/50 rounded-3xl p-6 border border-gray-800 space-y-5">
      <div className="flex items-center gap-3">
        <span className="text-2xl">🔮</span>
        <div>
          <h2 className="text-lg font-semibold text-white">Vorausschauende Ernährung</h2>
          <p className="text-sm text-gray-400">7-Tage-Plan basierend auf deinem Trainingsplan</p>
        </div>
      </div>

      {/* Upcoming sessions preview */}
      {Object.keys(upcomingByDay).length > 0 ? (
        <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-3">Geplante Einheiten (nächste 7 Tage)</div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(upcomingByDay)
              .filter(([date]) => date <= (() => { const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().split('T')[0]; })())
              .sort(([a], [b]) => a.localeCompare(b))
              .slice(0, 14)
              .map(([date, sessions]) => {
                const d = new Date(date);
                const label = d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'numeric' });
                return (
                  <div key={date} className="bg-gray-800 rounded-xl px-3 py-2 text-xs">
                    <div className="text-gray-400 mb-1">{label}</div>
                    <div className="flex gap-1 flex-wrap">
                      {sessions.map(s => (
                        <span key={s.id} className="bg-gray-700 rounded-lg px-1.5 py-0.5 text-white">
                          {TE_EMOJI[s.te]} {s.te}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      ) : (
        <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 text-sm text-gray-500 text-center">
          Noch keine Trainingseinheiten geplant — trage zuerst Einheiten im ACWR-Tab ein oder lade einen Trainer-Plan hoch.
        </div>
      )}

      {/* Generate button */}
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
            Analysiere Trainingsplan…
          </span>
        ) : '🔮 7-Tage-Ernährungsplan erstellen'}
      </button>

      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded-xl p-3 text-red-400 text-sm">{error}</div>
      )}

      {loading && progress && (
        <div className="bg-gray-900 rounded-xl p-3 border border-gray-800 max-h-24 overflow-hidden">
          <pre className="text-xs text-gray-500 font-mono">{progress.slice(-200)}</pre>
        </div>
      )}

      {/* Forecast result */}
      {forecast && (
        <div className="space-y-4">
          {/* Week summary */}
          <div className="bg-violet-900/20 border border-violet-800 rounded-2xl p-4">
            <div className="text-xs text-violet-400 uppercase tracking-wide mb-2">Wochen-Analyse</div>
            <p className="text-sm text-gray-300">{forecast.weekSummary}</p>
          </div>

          {/* Top tips */}
          {forecast.topTips?.length > 0 && (
            <div className="bg-green-900/10 border border-green-900 rounded-2xl p-4 space-y-2">
              <div className="text-xs text-green-500 uppercase tracking-wide mb-1">Top-Tipps der Woche</div>
              {forecast.topTips.map((tip, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-gray-300">
                  <span className="text-green-500 shrink-0">✓</span>
                  <span>{tip}</span>
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
