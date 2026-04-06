import { useMemo, useState } from 'react';
import type { Session, DayLoad } from '../types/acwr';
import { TE_COLORS } from '../types/acwr';
import { calculateACWR, aggregateDailyLoads, getCurrentACWR, getACWRZoneLabel } from '../lib/acwrCalculations';
import { ACWRChart } from './ACWRChart';
import { SessionForm } from './SessionForm';

interface Props {
  sessions: Session[];
  onAddSession: (s: Session) => void;
  playerName: string;
}

function StatCard({ label, value, unit, color }: { label: string; value: string | number; unit?: string; color: string }) {
  return (
    <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 text-center">
      <div className={`text-2xl font-bold ${color}`}>
        {value}{unit && <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>}
      </div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}

export function ACWRSection({ sessions, onAddSession, playerName }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [showLog, setShowLog] = useState(false);

  const acwrData   = useMemo(() => calculateACWR(sessions), [sessions]);
  const dailyLoads = useMemo(() => aggregateDailyLoads(sessions), [sessions]);
  const current    = useMemo(() => getCurrentACWR(acwrData), [acwrData]);

  const acwr  = current?.acwr ?? null;
  const zone  = acwr !== null ? getACWRZoneLabel(acwr) : null;

  // Letzte 7 Tage Sessions
  const last7 = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    return sessions
      .filter(s => new Date(s.datum) >= cutoff)
      .sort((a, b) => b.datum.localeCompare(a.datum));
  }, [sessions]);

  // Wöchentlicher Load (letzte 7 Tage)
  const weeklyLoad = last7.reduce((sum, s) => sum + s.tl, 0);

  function formatDate(datum: string) {
    const [y, m, d] = datum.split('-');
    return `${d}.${m}.${y.slice(2)}`;
  }

  const handleAdd = (s: Session) => {
    onAddSession(s);
    setShowForm(false);
  };

  // Letzte N DayLoads für den Log
  const recentDays: DayLoad[] = [...dailyLoads]
    .sort((a, b) => b.datum.localeCompare(a.datum))
    .slice(0, 14);

  return (
    <div className="space-y-4">
      {/* Header + ACWR Status */}
      <div className="bg-gray-900/50 rounded-3xl p-6 border border-gray-800">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📊</span>
            <div>
              <h2 className="text-lg font-semibold text-white">ACWR – Load Management</h2>
              <p className="text-sm text-gray-400">Acute:Chronic Workload Ratio · {playerName}</p>
            </div>
          </div>
          <button
            onClick={() => setShowForm(f => !f)}
            className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors"
          >
            {showForm ? '✕ Schließen' : '+ Session'}
          </button>
        </div>

        {/* Session Form */}
        {showForm && (
          <div className="mb-5 p-4 bg-gray-900 rounded-2xl border border-gray-700">
            <SessionForm playerName={playerName} onAdd={handleAdd} />
          </div>
        )}

        {/* Kennzahlen */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <StatCard
            label="Aktueller ACWR"
            value={acwr !== null ? acwr.toFixed(2) : '—'}
            color={zone ? '' : 'text-gray-400'}
            {...(zone && { color: '' })}
          />
          <StatCard label="Acute Load (7d Ø)" value={current?.acuteLoad ?? '—'} unit="AU" color="text-blue-400" />
          <StatCard label="Chronic Load (28d Ø)" value={current?.chronicLoad ?? '—'} unit="AU" color="text-amber-400" />
          <StatCard label="Load diese Woche" value={weeklyLoad} unit="AU" color="text-green-400" />
        </div>

        {/* ACWR-Ampel */}
        {acwr !== null && zone && (
          <div className={`rounded-2xl p-4 border flex items-center gap-4 ${zone.bg} border-gray-700 mb-5`}>
            <div className="text-4xl font-black" style={{ color: zone.color }}>
              {acwr.toFixed(2)}
            </div>
            <div>
              <div className="font-bold text-white">{zone.label}</div>
              <div className="text-sm text-gray-400">
                {acwr < 0.8  && 'Zu wenig Belastung – Verletzungsrisiko durch Unterbelastung.'}
                {acwr >= 0.8 && acwr <= 1.3 && 'Optimale Zone – Gute Balance zwischen Belastung und Erholung.'}
                {acwr > 1.3  && 'Achtung! Überbelastung – erhöhtes Verletzungsrisiko.'}
              </div>
            </div>
            {/* Zone-Balken */}
            <div className="ml-auto flex gap-1 items-end h-8 shrink-0">
              {[0.4, 0.6, 0.8, 1.0, 1.2, 1.3, 1.5].map((v, i) => (
                <div
                  key={i}
                  className="w-3 rounded-sm transition-all"
                  style={{
                    height: `${30 + i * 6}px`,
                    backgroundColor: v <= acwr
                      ? (acwr < 0.8 ? '#60a5fa' : acwr <= 1.3 ? '#4ade80' : '#f87171')
                      : '#374151',
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Risikozonen Legende */}
        <div className="flex gap-3 text-xs">
          <span className="flex items-center gap-1.5 text-blue-400">
            <span className="w-3 h-1 bg-blue-400 rounded inline-block" />Low Risk &lt;0.8
          </span>
          <span className="flex items-center gap-1.5 text-green-400">
            <span className="w-3 h-1 bg-green-400 rounded inline-block" />Optimal 0.8–1.3
          </span>
          <span className="flex items-center gap-1.5 text-red-400">
            <span className="w-3 h-1 bg-red-400 rounded inline-block" />High Risk &gt;1.3
          </span>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-gray-900/50 rounded-3xl p-6 border border-gray-800">
        <h3 className="text-sm font-semibold text-white mb-4">ACWR Verlauf (letzte 60 Tage)</h3>
        <ACWRChart data={acwrData} />
      </div>

      {/* Session Log */}
      <div className="bg-gray-900/50 rounded-3xl border border-gray-800 overflow-hidden">
        <button
          onClick={() => setShowLog(l => !l)}
          className="w-full flex items-center justify-between p-6 text-left hover:bg-gray-900/30 transition-colors"
        >
          <h3 className="text-sm font-semibold text-white">
            Tagesprotokolle (letzte 14 Tage)
          </h3>
          <span className="text-gray-500 text-sm">{showLog ? '▲ Einklappen' : '▼ Ausklappen'}</span>
        </button>

        {showLog && (
          <div className="border-t border-gray-800 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left px-4 py-2.5 text-xs text-gray-500 font-medium">Datum</th>
                  <th className="text-right px-3 py-2.5 text-xs text-gray-500 font-medium">Team</th>
                  <th className="text-right px-3 py-2.5 text-xs text-gray-500 font-medium">S&C</th>
                  <th className="text-right px-3 py-2.5 text-xs text-gray-500 font-medium">Spiel</th>
                  <th className="text-right px-3 py-2.5 text-xs text-gray-500 font-medium">Indi</th>
                  <th className="text-right px-3 py-2.5 text-xs text-gray-500 font-medium">Sonstige</th>
                  <th className="text-right px-4 py-2.5 text-xs text-gray-500 font-medium">Tagesl.</th>
                </tr>
              </thead>
              <tbody>
                {recentDays.map(day => {
                  const acwrPt = acwrData.find(d => d.datum === day.datum);
                  const acwrVal = acwrPt?.acwr;
                  const zoneColor = acwrVal == null ? '#6b7280'
                    : acwrVal < 0.8 ? '#60a5fa'
                    : acwrVal <= 1.3 ? '#4ade80'
                    : '#f87171';
                  const sonstige = (day.loads['Aufwärmen'] ?? 0) + (day.loads['Schulsport'] ?? 0) + (day.loads['Prävention'] ?? 0);

                  return (
                    <tr key={day.datum} className="border-b border-gray-800/50 hover:bg-gray-900/40">
                      <td className="px-4 py-2.5 text-gray-300 font-mono text-xs">{formatDate(day.datum)}</td>
                      <td className="text-right px-3 py-2.5" style={{ color: day.loads['Team'] ? TE_COLORS['Team'] : '#374151' }}>
                        {day.loads['Team'] ?? 0}
                      </td>
                      <td className="text-right px-3 py-2.5" style={{ color: day.loads['S&C'] ? TE_COLORS['S&C'] : '#374151' }}>
                        {day.loads['S&C'] ?? 0}
                      </td>
                      <td className="text-right px-3 py-2.5" style={{ color: day.loads['Spiel'] ? TE_COLORS['Spiel'] : '#374151' }}>
                        {day.loads['Spiel'] ?? 0}
                      </td>
                      <td className="text-right px-3 py-2.5" style={{ color: day.loads['Indi'] ? TE_COLORS['Indi'] : '#374151' }}>
                        {day.loads['Indi'] ?? 0}
                      </td>
                      <td className="text-right px-3 py-2.5 text-gray-500">{sonstige || 0}</td>
                      <td className="text-right px-4 py-2.5">
                        <span className="font-semibold" style={{ color: zoneColor }}>
                          {day.taeglLoad}
                        </span>
                        {acwrVal != null && (
                          <span className="ml-2 text-xs" style={{ color: zoneColor }}>({acwrVal.toFixed(2)})</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
