import { useState } from 'react';
import type { PlannedSession, TrainingUnit } from '../types/acwr';
import { TE_EMOJI, TE_COLORS } from '../types/acwr';

interface Props {
  planned: PlannedSession[];
  onConfirm: (id: string, rpe: number, dauer: number) => void;
  onScheduleReminder: (id: string) => void;
  onDismiss: (id: string) => void;
}

function RPEInput({
  value, onChange,
}: { value: number; onChange: (v: number) => void }) {
  const color = value <= 3 ? '#4ade80' : value <= 6 ? '#facc15' : '#f87171';
  const labels = ['', 'Sehr leicht', 'Leicht', 'Moderat', 'Etwas schwer',
    'Schwer', 'Schwer+', 'Sehr schwer', 'Sehr schwer+', 'Maximal fast', 'Maximal'];
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">RPE</span>
        <span className="font-bold text-lg" style={{ color }}>{value}</span>
      </div>
      <input
        type="range" min={1} max={10} step={1} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-violet-500"
      />
      <div className="text-xs text-center" style={{ color }}>{labels[value]}</div>
    </div>
  );
}

function SessionCard({
  session, onConfirm, onScheduleReminder, onDismiss,
}: {
  session: PlannedSession;
  onConfirm: (rpe: number, dauer: number) => void;
  onScheduleReminder: () => void;
  onDismiss: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isSpiel = session.te === 'Spiel';
  const [rpe, setRpe] = useState(isSpiel ? 10 : 7);
  const [dauer, setDauer] = useState(session.geschaetzteDauer ?? 90);

  const today = new Date().toISOString().split('T')[0];
  const isToday = session.datum === today;
  const isPast  = session.datum < today;
  const emoji   = TE_EMOJI[session.te] ?? '💪';
  const color   = TE_COLORS[session.te as TrainingUnit];

  const dateLabel = isToday ? 'Heute'
    : isPast ? new Date(session.datum).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })
    : new Date(session.datum).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });

  return (
    <div className={`rounded-2xl border overflow-hidden transition-all ${
      isPast ? 'border-orange-800/60 bg-orange-900/10'
      : isToday ? 'border-violet-700/60 bg-violet-900/10'
      : 'border-gray-800 bg-gray-900/50'
    }`}>
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="text-xl">{emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-white text-sm">{session.te}</span>
            {isToday && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-violet-900/50 text-violet-300 border border-violet-700/50">
                Heute
              </span>
            )}
            {isPast && !session.confirmed && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-orange-900/50 text-orange-300 border border-orange-700/50">
                Nachtragen
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            {dateLabel}
            {session.uhrzeit && ` · ${session.uhrzeit}`}
            {session.geschaetzteDauer && ` · ~${session.geschaetzteDauer} Min`}
            {session.notiz && ` · ${session.notiz}`}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!isPast && !isToday && !session.reminderScheduled && (
            <button
              onClick={onScheduleReminder}
              title="Erinnerung setzen"
              className="text-xs px-2 py-1 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
            >
              🔔
            </button>
          )}
          {session.reminderScheduled && (
            <span className="text-xs text-green-400" title="Erinnerung aktiv">🔔✓</span>
          )}
          {(isPast || isToday) && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
              style={{ backgroundColor: color + '33', color }}
            >
              {expanded ? 'Schließen' : 'Eintragen'}
            </button>
          )}
        </div>
      </div>

      {/* Eintragen-Formular — nur für vergangene und heutige Sessions */}
      {expanded && (isPast || isToday) && (
        <div className="border-t border-gray-800 px-4 py-4 space-y-4">
          {isSpiel ? (
            <div className="flex items-center gap-3 bg-red-900/20 border border-red-800/40 rounded-xl px-3 py-2.5">
              <span className="text-xs text-gray-400">RPE Spiel:</span>
              <span className="font-black text-red-400 text-lg">10</span>
              <span className="text-xs text-gray-500">— maximale Wettkampfbelastung</span>
            </div>
          ) : (
            <RPEInput value={rpe} onChange={setRpe} />
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-gray-500">Tatsächliche Dauer (Min)</span>
              <span className="font-semibold text-white">{dauer} Min</span>
            </div>
            <input
              type="range" min={5} max={180} step={5} value={dauer}
              onChange={e => setDauer(Number(e.target.value))}
              className="w-full accent-violet-500"
            />
            <div className="flex justify-between text-xs text-gray-600 mt-0.5">
              <span>5</span><span>60</span><span>120</span><span>180 Min</span>
            </div>
          </div>

          <div className="bg-gray-900 rounded-xl p-3 flex justify-between items-center">
            <span className="text-sm text-gray-400">Trainingsload</span>
            <span className="font-bold text-orange-400 text-lg">{rpe * dauer} AU</span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => onConfirm(rpe, dauer)}
              className="flex-1 py-2.5 rounded-xl font-semibold text-sm bg-green-700 hover:bg-green-600 text-white transition-colors"
            >
              ✓ Speichern
            </button>
            <button
              onClick={onDismiss}
              className="px-3 py-2.5 rounded-xl text-sm text-gray-500 hover:text-gray-300 border border-gray-700 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function PendingSessions({ planned, onConfirm, onScheduleReminder, onDismiss }: Props) {
  const pending = planned
    .filter(s => !s.confirmed)
    .sort((a, b) => a.datum.localeCompare(b.datum));

  const today = new Date().toISOString().split('T')[0];
  const overdue  = pending.filter(s => s.datum < today);
  const todayS   = pending.filter(s => s.datum === today);
  const upcoming = pending.filter(s => s.datum > today);

  if (pending.length === 0) return null;

  return (
    <div className="bg-gray-900/50 rounded-3xl border border-gray-800 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-white text-sm">
          Ausstehende Einträge
        </h3>
        <span className="text-xs bg-orange-900/40 text-orange-300 border border-orange-800/50 px-2 py-0.5 rounded-full">
          {pending.length} offen
        </span>
      </div>

      {overdue.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-orange-400 font-medium uppercase tracking-wide">Nachtragen</div>
          {overdue.map(s => (
            <SessionCard key={s.id} session={s}
              onConfirm={(rpe, dauer) => onConfirm(s.id, rpe, dauer)}
              onScheduleReminder={() => onScheduleReminder(s.id)}
              onDismiss={() => onDismiss(s.id)}
            />
          ))}
        </div>
      )}

      {todayS.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-violet-400 font-medium uppercase tracking-wide">Heute</div>
          {todayS.map(s => (
            <SessionCard key={s.id} session={s}
              onConfirm={(rpe, dauer) => onConfirm(s.id, rpe, dauer)}
              onScheduleReminder={() => onScheduleReminder(s.id)}
              onDismiss={() => onDismiss(s.id)}
            />
          ))}
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">Kommende Woche</div>
          {upcoming.map(s => (
            <SessionCard key={s.id} session={s}
              onConfirm={(rpe, dauer) => onConfirm(s.id, rpe, dauer)}
              onScheduleReminder={() => onScheduleReminder(s.id)}
              onDismiss={() => onDismiss(s.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
