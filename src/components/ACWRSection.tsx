import { useMemo, useState, useEffect, useRef } from 'react';
import type { Session, PlannedSession, DayLoad } from '../types/acwr';
import { TE_COLORS } from '../types/acwr';
import { calculateACWR, aggregateDailyLoads, getCurrentACWR, getACWRZoneLabel } from '../lib/acwrCalculations';
import {
  requestNotificationPermission, getNotificationPermission,
  scheduleSessionReminder, cancelReminder, sendTestNotification,
} from '../lib/notifications';
import { ACWRChart } from './ACWRChart';
import { SessionForm } from './SessionForm';
import { TrainerPlanUpload } from './TrainerPlanUpload';
import { PendingSessions } from './PendingSessions';

interface Props {
  sessions: Session[];
  plannedSessions: PlannedSession[];
  onAddSession: (s: Session) => void;
  onAddPlanned: (sessions: PlannedSession[]) => void;
  onConfirmPlanned: (id: string, rpe: number, dauer: number) => void;
  onUpdatePlanned: (id: string, updates: Partial<PlannedSession>) => void;
  onDismissPlanned: (id: string) => void;
  playerName: string;
}

function StatCard({ label, value, unit, color }: {
  label: string; value: string | number; unit?: string; color: string;
}) {
  return (
    <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 text-center">
      <div className={`text-2xl font-bold ${color}`}>
        {value}{unit && <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>}
      </div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}

export function ACWRSection({
  sessions, plannedSessions, onAddSession, onAddPlanned,
  onConfirmPlanned, onUpdatePlanned, onDismissPlanned, playerName,
}: Props) {
  const [showForm, setShowForm] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const notifPerm = getNotificationPermission();

  // Reminder-Timeouts: id → timeoutId
  const reminderTimeouts = useRef<Map<string, number>>(new Map());

  const acwrData   = useMemo(() => calculateACWR(sessions), [sessions]);
  const dailyLoads = useMemo(() => aggregateDailyLoads(sessions), [sessions]);
  const current    = useMemo(() => getCurrentACWR(acwrData), [acwrData]);
  const acwr       = current?.acwr ?? null;
  const zone       = acwr !== null ? getACWRZoneLabel(acwr) : null;

  const last7Days = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    return sessions.filter(s => new Date(s.datum) >= cutoff);
  }, [sessions]);
  const weeklyLoad = last7Days.reduce((sum, s) => sum + s.tl, 0);

  // Pending sessions mit Erinnerung aktivieren wenn Permission vorhanden
  useEffect(() => {
    if (notifPerm !== 'granted') return;
    for (const ps of plannedSessions) {
      if (!ps.confirmed && ps.reminderScheduled && !reminderTimeouts.current.has(ps.id)) {
        const tid = scheduleSessionReminder(ps, (id) => {
          // Hebt die Sektion hervor (z.B. via State)
          console.log('Reminder clicked for', id);
        });
        if (tid !== null) reminderTimeouts.current.set(ps.id, tid);
      }
    }
    return () => {};
  }, [plannedSessions, notifPerm]);

  const handleRequestNotifications = async () => {
    const granted = await requestNotificationPermission();
    if (granted) sendTestNotification();
  };

  const handleScheduleReminder = (id: string) => {
    const ps = plannedSessions.find(s => s.id === id);
    if (!ps) return;
    if (notifPerm !== 'granted') {
      requestNotificationPermission().then(granted => {
        if (!granted) return;
        const tid = scheduleSessionReminder(ps, () => {});
        if (tid !== null) reminderTimeouts.current.set(id, tid);
        onUpdatePlanned(id, { reminderScheduled: true });
      });
    } else {
      const tid = scheduleSessionReminder(ps, () => {});
      if (tid !== null) reminderTimeouts.current.set(id, tid);
      onUpdatePlanned(id, { reminderScheduled: true });
    }
  };

  const handleDismiss = (id: string) => {
    const tid = reminderTimeouts.current.get(id);
    if (tid !== undefined) { cancelReminder(tid); reminderTimeouts.current.delete(id); }
    onDismissPlanned(id);
  };

  function formatDate(datum: string) {
    const [y, m, d] = datum.split('-');
    return `${d}.${m}.${y.slice(2)}`;
  }

  const recentDays: DayLoad[] = [...dailyLoads]
    .sort((a, b) => b.datum.localeCompare(a.datum))
    .slice(0, 14);

  const pendingCount = plannedSessions.filter(s => !s.confirmed).length;

  return (
    <div className="space-y-4">

      {/* Trainer-Plan Import */}
      <TrainerPlanUpload onSessionsAdded={onAddPlanned} />

      {/* Ausstehende Sessions */}
      {pendingCount > 0 && (
        <PendingSessions
          planned={plannedSessions}
          onConfirm={onConfirmPlanned}
          onScheduleReminder={handleScheduleReminder}
          onDismiss={handleDismiss}
        />
      )}

      {/* ACWR Status */}
      <div className="bg-gray-900/50 rounded-3xl p-6 border border-gray-800">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📊</span>
            <div>
              <h2 className="text-lg font-semibold text-white">ACWR · {playerName}</h2>
              <p className="text-sm text-gray-400">Acute:Chronic Workload Ratio</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Benachrichtigungs-Button */}
            {notifPerm !== 'granted' && notifPerm !== 'unsupported' && (
              <button
                onClick={handleRequestNotifications}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors flex items-center gap-1.5"
              >
                🔔 Erinnerungen aktivieren
              </button>
            )}
            {notifPerm === 'granted' && (
              <span className="text-xs text-green-400 flex items-center gap-1">🔔✓ Aktiv</span>
            )}
            <button
              onClick={() => setShowForm(f => !f)}
              className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
            >
              {showForm ? '✕' : '+ Manuell'}
            </button>
          </div>
        </div>

        {/* Manuelles Formular */}
        {showForm && (
          <div className="mb-5 p-4 bg-gray-900 rounded-2xl border border-gray-700">
            <SessionForm playerName={playerName} onAdd={s => { onAddSession(s); setShowForm(false); }} />
          </div>
        )}

        {/* Kennzahlen */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <StatCard
            label="Aktueller ACWR"
            value={acwr !== null ? acwr.toFixed(2) : '—'}
            color={acwr === null ? 'text-gray-500' : acwr < 0.8 ? 'text-blue-400' : acwr <= 1.3 ? 'text-green-400' : 'text-red-400'}
          />
          <StatCard label="Acute Load (7d Ø)" value={current?.acuteLoad ?? '—'} unit="AU" color="text-blue-400" />
          <StatCard label="Chronic Load (28d Ø)" value={current?.chronicLoad ?? '—'} unit="AU" color="text-amber-400" />
          <StatCard label="Load diese Woche" value={weeklyLoad} unit="AU" color="text-green-400" />
        </div>

        {/* Ampel */}
        {acwr !== null && zone && (
          <div className={`rounded-2xl p-4 border flex items-center gap-4 ${zone.bg} border-gray-700 mb-5`}>
            <div className="text-4xl font-black" style={{ color: zone.color }}>{acwr.toFixed(2)}</div>
            <div>
              <div className="font-bold text-white">{zone.label}</div>
              <div className="text-sm text-gray-400">
                {acwr < 0.8 && 'Zu wenig Belastung – Verletzungsrisiko durch Unterbelastung.'}
                {acwr >= 0.8 && acwr <= 1.3 && 'Optimale Zone – gute Balance zwischen Belastung und Erholung.'}
                {acwr > 1.3 && 'Achtung! Überbelastung – erhöhtes Verletzungsrisiko.'}
              </div>
            </div>
            <div className="ml-auto flex gap-1 items-end h-8 shrink-0">
              {[0.4, 0.6, 0.8, 1.0, 1.2, 1.3, 1.5].map((v, i) => (
                <div key={i} className="w-3 rounded-sm"
                  style={{
                    height: `${20 + i * 6}px`,
                    backgroundColor: v <= acwr ? zone.color : '#374151',
                  }} />
              ))}
            </div>
          </div>
        )}

        {sessions.length === 0 && (
          <div className="text-center py-8 text-gray-600">
            <div className="text-3xl mb-2">📋</div>
            <p className="text-sm">Noch keine Sessions – Trainer-Plan importieren oder manuell eintragen.</p>
          </div>
        )}

        {/* Legende */}
        <div className="flex gap-4 text-xs">
          {[['#60a5fa','Low Risk <0.8'], ['#4ade80','Optimal 0.8–1.3'], ['#f87171','High Risk >1.3']].map(([c, l]) => (
            <span key={l} className="flex items-center gap-1.5" style={{ color: c }}>
              <span className="w-3 h-1 rounded inline-block" style={{ backgroundColor: c }} />{l}
            </span>
          ))}
        </div>
      </div>

      {/* Chart */}
      {sessions.length > 0 && (
        <div className="bg-gray-900/50 rounded-3xl p-6 border border-gray-800">
          <h3 className="text-sm font-semibold text-white mb-4">ACWR Verlauf (letzte 60 Tage)</h3>
          <ACWRChart data={acwrData} />
        </div>
      )}

      {/* Session-Log */}
      {recentDays.length > 0 && (
        <div className="bg-gray-900/50 rounded-3xl border border-gray-800 overflow-hidden">
          <button
            onClick={() => setShowLog(l => !l)}
            className="w-full flex items-center justify-between p-5 hover:bg-gray-900/30 transition-colors"
          >
            <h3 className="text-sm font-semibold text-white">Tagesprotokolle (letzte 14 Tage)</h3>
            <span className="text-gray-500 text-sm">{showLog ? '▲' : '▼'}</span>
          </button>
          {showLog && (
            <div className="border-t border-gray-800 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    {['Datum','Team','S&C','Spiel','Indi','Sonstige','Tagesl.'].map(h => (
                      <th key={h} className={`py-2.5 text-xs text-gray-500 font-medium ${h === 'Datum' ? 'text-left px-4' : 'text-right px-3'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentDays.map(day => {
                    const acwrPt = acwrData.find(d => d.datum === day.datum);
                    const av = acwrPt?.acwr;
                    const zc = av == null ? '#6b7280' : av < 0.8 ? '#60a5fa' : av <= 1.3 ? '#4ade80' : '#f87171';
                    const sonstige = (day.loads['Aufwärmen']??0)+(day.loads['Schulsport']??0)+(day.loads['Prävention']??0);
                    return (
                      <tr key={day.datum} className="border-b border-gray-800/50 hover:bg-gray-900/40">
                        <td className="px-4 py-2.5 text-gray-300 font-mono text-xs">{formatDate(day.datum)}</td>
                        {(['Team','S&C','Spiel','Indi'] as const).map(te => (
                          <td key={te} className="text-right px-3 py-2.5 text-xs"
                            style={{ color: day.loads[te] ? TE_COLORS[te] : '#374151' }}>
                            {day.loads[te] ?? 0}
                          </td>
                        ))}
                        <td className="text-right px-3 py-2.5 text-xs text-gray-500">{sonstige}</td>
                        <td className="text-right px-4 py-2.5">
                          <span className="font-semibold text-xs" style={{ color: zc }}>{day.taeglLoad}</span>
                          {av != null && <span className="ml-1 text-xs" style={{ color: zc }}>({av.toFixed(2)})</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
