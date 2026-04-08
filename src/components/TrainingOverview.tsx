import { useMemo, useState } from 'react';
import type { Session, PlannedSession } from '../types/acwr';

import { TRAINING_UNITS, TE_COLORS, TE_EMOJI } from '../types/acwr';
import { WeekCalendar } from './WeekCalendar';

interface Props {
  sessions: Session[];
  plannedSessions: PlannedSession[];
  onConfirmPlanned?: (id: string, rpe: number, dauer: number) => void;
  onUpdatePlanned?: (id: string, updates: Partial<PlannedSession>) => void;
  onDismissPlanned?: (id: string) => void;
  onAddPlanned?: (sessions: PlannedSession[]) => void;
  onAddSessionDirect?: (session: Session) => void;
}

function isoWeekStart(offset = 0): string {
  const d = new Date();
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1 + offset * 7);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
}

export function TrainingOverview({
  sessions, plannedSessions,
  onConfirmPlanned, onUpdatePlanned, onDismissPlanned, onAddPlanned, onAddSessionDirect,
}: Props) {
  const [view, setView] = useState<'kalender' | 'woche' | 'verlauf'>('kalender');

  const today = new Date().toISOString().split('T')[0];

  // Build weekly buckets (last 5 weeks)
  const weeks = useMemo(() => {
    return Array.from({ length: 5 }, (_, i) => {
      const start = isoWeekStart(-4 + i);
      const end = (() => {
        const d = new Date(start);
        d.setDate(d.getDate() + 6);
        return d.toISOString().split('T')[0];
      })();
      const wSessions = sessions.filter(s => s.datum >= start && s.datum <= end);
      const totalTL = wSessions.reduce((s, x) => s + x.tl, 0);
      const byTE: Partial<Record<string, number>> = {};
      for (const s of wSessions) byTE[s.te] = (byTE[s.te] ?? 0) + 1;
      const label = i === 4 ? 'Diese W.' : i === 3 ? 'Letzte W.' : `KW${new Date(start).getWeek()}`;
      return { start, end, sessions: wSessions, totalTL, byTE, label, isCurrent: i === 4 };
    });
  }, [sessions]);

  const thisWeek = weeks[4];
  const lastWeek = weeks[3];
  const loadDiff = lastWeek.totalTL > 0
    ? Math.round(((thisWeek.totalTL - lastWeek.totalTL) / lastWeek.totalTL) * 100)
    : 0;

  // Upcoming planned sessions (not confirmed, from today)
  const upcoming = useMemo(() =>
    plannedSessions
      .filter(s => !s.confirmed && s.datum >= today)
      .sort((a, b) => a.datum.localeCompare(b.datum))
      .slice(0, 10),
  [plannedSessions, today]);

  // Recent confirmed sessions (last 14 days)
  const cutoff14 = (() => { const d = new Date(); d.setDate(d.getDate() - 14); return d.toISOString().split('T')[0]; })();
  const recent = useMemo(() =>
    sessions
      .filter(s => s.datum >= cutoff14)
      .sort((a, b) => b.datum.localeCompare(a.datum)),
  [sessions, cutoff14]);

  const maxTL = Math.max(...weeks.map(w => w.totalTL), 1);

  function fmtDate(d: string) {
    const [y, m, day] = d.split('-');
    return `${day}.${m}.${y.slice(2)}`;
  }

  function fmtWeekday(d: string) {
    return new Date(d).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'numeric' });
  }

  return (
    <div className="bg-gray-900/50 rounded-3xl p-6 border border-gray-800 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="text-2xl">🗓️</span>
        <div>
          <h2 className="text-lg font-semibold text-white">Trainingsübersicht</h2>
          <p className="text-sm text-gray-400">{sessions.length} Einheiten gesamt</p>
        </div>
        <div className="ml-auto flex gap-1 bg-gray-900 rounded-xl p-1 border border-gray-800">
          {([['kalender', 'Kalender'], ['woche', 'Woche'], ['verlauf', 'Verlauf']] as const).map(([v, label]) => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${view === v ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {view === 'kalender' && (
        <WeekCalendar
          sessions={sessions}
          plannedSessions={plannedSessions}
          onConfirm={onConfirmPlanned}
          onUpdate={onUpdatePlanned}
          onDismiss={onDismissPlanned}
          onAddPlanned={onAddPlanned}
          onAddSessionDirect={onAddSessionDirect}
        />
      )}

      {view === 'woche' && (
        <>
          {/* This week summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-gray-900 rounded-2xl p-3 border border-gray-800 text-center">
              <div className="text-2xl font-bold text-violet-400">{thisWeek.sessions.length}</div>
              <div className="text-xs text-gray-500 mt-0.5">Einheiten</div>
            </div>
            <div className="bg-gray-900 rounded-2xl p-3 border border-gray-800 text-center">
              <div className="text-2xl font-bold text-orange-400">{thisWeek.totalTL}</div>
              <div className="text-xs text-gray-500 mt-0.5">Training Load</div>
            </div>
            <div className="bg-gray-900 rounded-2xl p-3 border border-gray-800 text-center">
              <div className={`text-2xl font-bold ${loadDiff >= 0 ? 'text-green-400' : 'text-blue-400'}`}>
                {loadDiff >= 0 ? '+' : ''}{loadDiff}%
              </div>
              <div className="text-xs text-gray-500 mt-0.5">vs. Vorwoche</div>
            </div>
            <div className="bg-gray-900 rounded-2xl p-3 border border-gray-800 text-center">
              <div className="text-2xl font-bold text-cyan-400">{upcoming.length}</div>
              <div className="text-xs text-gray-500 mt-0.5">Geplant</div>
            </div>
          </div>

          {/* TE Type breakdown this week */}
          {thisWeek.sessions.length > 0 && (
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-3">Diese Woche nach TE-Typ</div>
              <div className="flex flex-wrap gap-2">
                {TRAINING_UNITS.map(te => {
                  const count = thisWeek.sessions.filter(s => s.te === te).length;
                  if (count === 0) return null;
                  const load = thisWeek.sessions.filter(s => s.te === te).reduce((s, x) => s + x.tl, 0);
                  return (
                    <div key={te} className="flex items-center gap-2 bg-gray-900 rounded-xl px-3 py-2 border border-gray-800">
                      <span>{TE_EMOJI[te]}</span>
                      <div>
                        <span className="text-sm font-semibold text-white">{count}× {te}</span>
                        <span className="text-xs text-gray-500 ml-2">{load} AU</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Weekly load bar chart (5 weeks) */}
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-3">Load letzte 5 Wochen</div>
            <div className="flex items-end gap-2 h-24">
              {weeks.map(w => (
                <div key={w.start} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex flex-col justify-end" style={{ height: '72px' }}>
                    <div
                      className={`w-full rounded-t-lg transition-all ${w.isCurrent ? 'bg-violet-500' : 'bg-gray-700'}`}
                      style={{ height: `${Math.max(4, (w.totalTL / maxTL) * 72)}px` }}
                    />
                  </div>
                  <div className="text-xs text-gray-600 text-center leading-tight">{w.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming sessions */}
          {upcoming.length > 0 && (
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-3">Geplante Einheiten</div>
              <div className="space-y-1.5">
                {upcoming.map(s => (
                  <div key={s.id} className="flex items-center gap-3 bg-gray-900 rounded-xl px-4 py-2.5 border border-gray-800">
                    <span className="text-base">{TE_EMOJI[s.te]}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-white">{s.te}</span>
                      {s.uhrzeit && <span className="text-xs text-gray-500 ml-2">🕐 {s.uhrzeit}</span>}
                      {s.notiz && <span className="text-xs text-gray-600 ml-2 truncate">{s.notiz}</span>}
                    </div>
                    <span className="text-xs text-gray-500 shrink-0">{fmtWeekday(s.datum)}</span>
                    {s.geschaetzteDauer && (
                      <span className="text-xs text-gray-600 shrink-0">{s.geschaetzteDauer}min</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {view === 'verlauf' && (
        <div className="space-y-3">
          {/* All-time TE distribution */}
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-3">Gesamt nach TE-Typ</div>
            <div className="space-y-2">
              {TRAINING_UNITS.map(te => {
                const count = sessions.filter(s => s.te === te).length;
                const pct = sessions.length > 0 ? (count / sessions.length) * 100 : 0;
                if (count === 0) return null;
                return (
                  <div key={te} className="flex items-center gap-3">
                    <span className="w-5 text-base">{TE_EMOJI[te]}</span>
                    <span className="text-sm text-gray-400 w-24">{te}</span>
                    <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: TE_COLORS[te] }} />
                    </div>
                    <span className="text-xs text-gray-500 w-12 text-right">{count}× ({Math.round(pct)}%)</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent sessions list */}
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-3">Letzte 14 Tage</div>
            {recent.length === 0 ? (
              <p className="text-sm text-gray-600 text-center py-4">Keine Sessions in den letzten 14 Tagen</p>
            ) : (
              <div className="space-y-1.5">
                {recent.map(s => (
                  <div key={s.id} className="flex items-center gap-3 bg-gray-900 rounded-xl px-4 py-2.5 border border-gray-800">
                    <span className="text-base">{TE_EMOJI[s.te]}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-white">{s.te}</span>
                    </div>
                    <span className="text-xs text-gray-500">{fmtDate(s.datum)}</span>
                    <div className="flex items-center gap-2 text-xs shrink-0">
                      <span className={`font-medium ${s.rpe <= 3 ? 'text-green-400' : s.rpe <= 6 ? 'text-yellow-400' : 'text-red-400'}`}>
                        RPE {s.rpe}
                      </span>
                      <span className="text-gray-600">{s.dauer}min</span>
                      <span className="text-orange-400 font-semibold">{s.tl} AU</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Polyfill for getWeek
declare global {
  interface Date { getWeek(): number; }
}
Date.prototype.getWeek = function () {
  const d = new Date(Date.UTC(this.getFullYear(), this.getMonth(), this.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
};
