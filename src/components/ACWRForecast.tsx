import { useState } from 'react';
import type { ACWRDataPoint } from '../types/acwr';

interface Props {
  projected: ACWRDataPoint[];
  currentAcwr: number | null;
  currentAcute: number;
  currentChronic: number;
  plannedCount?: number;
}

function fmtDate(iso: string) {
  const d = new Date(iso + 'T00:00');
  return d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'numeric' });
}

function zoneOf(v: number) {
  if (v < 0.8)  return { label: 'Niedrig', color: '#60a5fa', bg: '#1e3a5f' };
  if (v <= 1.3) return { label: 'Optimal', color: '#4ade80', bg: '#14532d' };
  return              { label: 'Hoch',    color: '#f87171', bg: '#450a0a' };
}

export function ACWRForecast({ projected, currentAcwr, currentAcute, currentChronic, plannedCount = 0 }: Props) {
  const [open, setOpen] = useState(false);

  if (projected.length === 0) return null;

  // Days with actual ACWR values (need 28-day history)
  const forecastDays = projected.filter(p => p.acwr !== null);

  // Find the projected ACWR in ~7 days (or closest available)
  const day7 = forecastDays.find((_, i) => i >= 6) ?? forecastDays[forecastDays.length - 1] ?? null;

  // Danger days
  const dangerDays = forecastDays.filter(p => p.acwr! > 1.3 || p.acwr! < 0.8);
  const highDays   = forecastDays.filter(p => p.acwr! > 1.3);
  const lowDays    = forecastDays.filter(p => p.acwr! < 0.8);

  // Days with planned load
  const loadDays = projected.filter(p => p.taeglLoad > 0);

  const trend = day7 && currentAcwr != null
    ? day7.acwr! - currentAcwr
    : null;

  const highCount = projected.filter(p => p.acwr != null && p.acwr > 1.3).length;

  return (
    <div className="bg-gray-900/50 rounded-3xl border border-gray-800 overflow-hidden">

      {/* Collapsible header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-base shrink-0">📈</span>
          <span className="text-sm font-semibold text-white">Belastungsprognose</span>
          {day7?.acwr != null && (() => {
            const z = zoneOf(day7.acwr!);
            return (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
                style={{ backgroundColor: z.bg + '80', color: z.color }}>
                ACWR in 7d: {day7.acwr!.toFixed(2)}
              </span>
            );
          })()}
          {highCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-900/40 text-red-400 border border-red-800/40 shrink-0">
              ⚠ {highCount}d Überbelastung
            </span>
          )}
        </div>
        <span className={`text-gray-500 text-xs transition-transform shrink-0 ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>

      {!open && (
        <div className="px-4 sm:px-5 pb-3 text-xs text-gray-600">
          Basiert auf {plannedCount} geplanten Einheit{plannedCount !== 1 ? 'en' : ''} — aufklappen für Details
        </div>
      )}

      {open && (
      <div className="px-4 sm:px-5 pb-5 space-y-4 border-t border-gray-800 pt-4">

      {/* Explanation */}
      <p className="text-xs text-gray-500 leading-relaxed">
        Projektion basierend auf {plannedCount} geplanten Einheit{plannedCount !== 1 ? 'en' : ''}.
        ACWR = Acute Load (7d-Ø) ÷ Chronic Load (28d-Ø) — optimale Zone 0.8–1.3.
      </p>

      {/* Current → Projected summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-gray-900 rounded-2xl p-3 border border-gray-800 text-center">
          <div className="text-xs text-gray-500 mb-1">Acute (jetzt)</div>
          <div className="text-lg font-bold text-sky-400">{currentAcute}</div>
          <div className="text-xs text-gray-600">AU / 7d</div>
        </div>
        <div className="bg-gray-900 rounded-2xl p-3 border border-gray-800 text-center">
          <div className="text-xs text-gray-500 mb-1">Chronic (jetzt)</div>
          <div className="text-lg font-bold text-amber-400">{currentChronic}</div>
          <div className="text-xs text-gray-600">AU / 28d</div>
        </div>
        {day7 && (
          <div className="bg-gray-900 rounded-2xl p-3 border border-gray-800 text-center">
            <div className="text-xs text-gray-500 mb-1">Acute (in 7d)</div>
            <div className="text-lg font-bold text-sky-300">{day7.acuteLoad}</div>
            <div className="text-xs text-gray-600">AU / 7d</div>
          </div>
        )}
        {day7?.acwr != null && (() => {
          const z = zoneOf(day7.acwr!);
          return (
            <div className="rounded-2xl p-3 border text-center"
              style={{ backgroundColor: z.bg + '55', borderColor: z.color + '40' }}>
              <div className="text-xs text-gray-400 mb-1">ACWR in 7d</div>
              <div className="text-lg font-bold" style={{ color: z.color }}>{day7.acwr!.toFixed(2)}</div>
              <div className="text-xs mt-0.5" style={{ color: z.color }}>{z.label}</div>
            </div>
          );
        })()}
      </div>

      {/* Trend arrow */}
      {trend !== null && currentAcwr !== null && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">Trend:</span>
          <span className={`font-semibold ${Math.abs(trend) < 0.05 ? 'text-gray-400' : trend > 0 ? 'text-red-400' : 'text-blue-400'}`}>
            {trend > 0.05 ? '↑ Steigend' : trend < -0.05 ? '↓ Sinkend' : '→ Stabil'}
          </span>
          {Math.abs(trend) >= 0.05 && (
            <span className="text-gray-600 text-xs">({trend > 0 ? '+' : ''}{trend.toFixed(2)})</span>
          )}
        </div>
      )}

      {/* Danger warnings */}
      {dangerDays.length > 0 && (
        <div className="space-y-1.5">
          {highDays.length > 0 && (
            <div className="flex items-start gap-2 bg-red-900/20 border border-red-800/40 rounded-xl px-3 py-2">
              <span className="text-red-400 shrink-0">⚠</span>
              <div className="text-xs text-red-300">
                <strong>Überbelastung geplant:</strong>{' '}
                {highDays.slice(0, 3).map(p => `${fmtDate(p.datum)} (${p.acwr!.toFixed(2)})`).join(', ')}
                {highDays.length > 3 && ` +${highDays.length - 3} weitere`}
                {' '}— Erholungseinheiten einplanen oder Intensität reduzieren.
              </div>
            </div>
          )}
          {lowDays.length > 0 && (
            <div className="flex items-start gap-2 bg-blue-900/20 border border-blue-800/40 rounded-xl px-3 py-2">
              <span className="text-blue-400 shrink-0">💤</span>
              <div className="text-xs text-blue-300">
                <strong>Unterbelastung:</strong>{' '}
                {lowDays.slice(0, 3).map(p => fmtDate(p.datum)).join(', ')}
                {' '}— zusätzliche Trainingsreize könnten sinnvoll sein.
              </div>
            </div>
          )}
        </div>
      )}

      {/* Day-by-day forecast — only show days with load or ACWR value */}
      {forecastDays.length > 0 && (
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Tag für Tag</div>
          <div className="space-y-1">
            {projected.map(p => {
              if (p.acwr == null && p.taeglLoad === 0) return null;
              const z = p.acwr != null ? zoneOf(p.acwr) : null;
              return (
                <div key={p.datum} className="flex items-center gap-2 py-1.5 border-b border-gray-800/50 last:border-0">
                  <div className="text-xs text-gray-500 w-28 shrink-0">{fmtDate(p.datum)}</div>
                  <div className="flex-1 flex items-center gap-2 min-w-0">
                    {p.taeglLoad > 0 && (
                      <span className="text-xs text-orange-400 font-medium">{p.taeglLoad} AU</span>
                    )}
                    <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-orange-500/60"
                        style={{ width: `${Math.min(100, (p.taeglLoad / 1000) * 100)}%` }} />
                    </div>
                  </div>
                  {p.acwr != null && z && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-xs font-semibold" style={{ color: z.color }}>
                        {p.acwr.toFixed(2)}
                      </span>
                      <span className="text-xs px-1.5 py-0.5 rounded-md text-xs"
                        style={{ backgroundColor: z.bg + '80', color: z.color }}>
                        {z.label}
                      </span>
                    </div>
                  )}
                  {p.acwr == null && (
                    <span className="text-xs text-gray-700">— Aufbauend</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {forecastDays.length === 0 && loadDays.length > 0 && (
        <div className="text-xs text-gray-600 text-center py-2">
          ACWR-Projektion verfügbar sobald 28 Tage Verlaufsdaten vorhanden sind.
          Geplante Last wird bereits berücksichtigt.
        </div>
      )}
    </div>
      )}
  </div>
);
}
