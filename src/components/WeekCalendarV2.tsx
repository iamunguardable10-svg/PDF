import { useEffect, useMemo, useState } from 'react';
import type { PlannedSession, Session, TrainingUnit } from '../types/acwr';
import { TE_COLORS, TE_EMOJI, TRAINING_UNITS } from '../types/acwr';

interface Props {
  sessions: Session[];
  plannedSessions: PlannedSession[];
  onConfirm?: (id: string, rpe: number, dauer: number) => void;
  onUpdate?: (id: string, updates: Partial<PlannedSession>) => void;
  onDismiss?: (id: string) => void;
  onAddPlanned?: (sessions: PlannedSession[]) => void;
  onAddSessionDirect?: (session: Session) => void;
  onDeleteSession?: (id: string) => void;
  onEditSession?: (id: string, rpe: number, dauer: number) => void;
  jumpToDate?: string;
  sport?: string;
}

interface CalendarEntry {
  id: string;
  kind: 'done' | 'planned' | 'overdue';
  datum: string;
  te: TrainingUnit;
  time?: string;
  duration?: number;
  rpe?: number;
  load?: number;
  planned?: PlannedSession;
  done?: Session;
}

const DEFAULT_DURATIONS: Record<TrainingUnit, number> = {
  Team: 120,
  'S&C': 60,
  Spiel: 90,
  Aufwärmen: 60,
  Indi: 60,
  Schulsport: 75,
  Prävention: 30,
};

const RPE_LABELS = [
  '', 'Sehr leicht', 'Leicht', 'Moderat', 'Etwas schwer',
  'Schwer', 'Schwer+', 'Sehr schwer', 'Sehr schwer+', 'Maximal fast', 'Maximal',
];

function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getWeekStart(date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('de-DE', {
    weekday: 'short', day: '2-digit', month: '2-digit',
  });
}

function safeTrainingUnit(value: string): TrainingUnit {
  return TRAINING_UNITS.includes(value as TrainingUnit) ? value as TrainingUnit : 'Team';
}

function isTimeInPastToday(dateIso: string, time?: string): boolean {
  const today = toISO(new Date());
  if (dateIso !== today || !time) return false;
  const [h, m] = time.split(':').map(Number);
  const end = new Date();
  end.setHours(h || 0, m || 0, 0, 0);
  return end.getTime() < Date.now();
}

function getRpeColor(rpe: number): string {
  if (rpe <= 3) return '#4ade80';
  if (rpe <= 6) return '#facc15';
  return '#f87171';
}

function getEntryVisual(entry: CalendarEntry, color: string) {
  if (entry.kind === 'done') {
    return {
      className: 'shadow-sm',
      style: {
        borderColor: `${color}aa`,
        backgroundColor: `${color}2f`,
        boxShadow: `inset 0 0 0 1px ${color}22`,
      },
      badge: null,
    };
  }

  if (entry.kind === 'overdue') {
    return {
      className: 'shadow-lg ring-1 ring-offset-0',
      style: {
        borderColor: color,
        backgroundColor: `${color}42`,
        boxShadow: `0 0 18px ${color}33, inset 0 0 0 1px ${color}44`,
      },
      badge: 'offen',
    };
  }

  return {
    className: 'opacity-75 hover:opacity-100 border-dashed',
    style: {
      borderColor: `${color}6f`,
      backgroundColor: `${color}16`,
      boxShadow: 'none',
    },
    badge: 'geplant',
  };
}

function CreateSessionModal({
  datum,
  onClose,
  onAddPlanned,
  onAddSessionDirect,
}: {
  datum: string;
  onClose: () => void;
  onAddPlanned?: (sessions: PlannedSession[]) => void;
  onAddSessionDirect?: (session: Session) => void;
}) {
  const today = toISO(new Date());
  const isPast = datum < today;
  const isToday = datum === today;
  const [te, setTe] = useState<TrainingUnit>('Team');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState(DEFAULT_DURATIONS.Team);
  const [note, setNote] = useState('');
  const [directEntry, setDirectEntry] = useState(isPast);
  const [rpe, setRpe] = useState(7);

  const color = TE_COLORS[te];
  const emoji = TE_EMOJI[te];
  const canDirectEntry = isPast || isToday;
  const effectiveRpe = te === 'Spiel' ? 10 : rpe;
  const directRecommended = isPast || isTimeInPastToday(datum, time);

  function handleTypeChange(next: TrainingUnit) {
    setTe(next);
    setDuration(DEFAULT_DURATIONS[next] ?? 60);
  }

  function addPlanned() {
    onAddPlanned?.([{
      id: `planned-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      datum,
      te,
      uhrzeit: time || undefined,
      geschaetzteDauer: duration,
      notiz: note || undefined,
      reminderScheduled: false,
      confirmed: false,
    }]);
  }

  function addDirect() {
    onAddSessionDirect?.({
      id: `direct-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: '',
      datum,
      te,
      rpe: effectiveRpe,
      dauer: duration,
      tl: effectiveRpe * duration,
    });
  }

  function handleSubmit() {
    if (canDirectEntry && directEntry && onAddSessionDirect) addDirect();
    else addPlanned();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm" onClick={e => { if (e.currentTarget === e.target) onClose(); }}>
      <div className="max-h-[84dvh] w-full max-w-sm overflow-y-auto rounded-3xl border border-gray-700 bg-gray-900 shadow-2xl">
        <div className="flex items-center gap-3 border-b border-gray-800 px-5 pb-3 pt-5">
          <div className="flex-1">
            <div className="text-sm font-black text-white">Neue Einheit</div>
            <div className="text-xs text-gray-400">{fmtDate(datum)}</div>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-xl text-gray-500 transition-colors hover:bg-gray-800 hover:text-white">×</button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <div className="mb-2 text-xs text-gray-500">Typ</div>
            <div className="grid grid-cols-4 gap-1.5">
              {TRAINING_UNITS.map(unit => {
                const selected = unit === te;
                return (
                  <button
                    key={unit}
                    type="button"
                    onClick={() => handleTypeChange(unit)}
                    className={`rounded-xl border px-1 py-2 text-xs font-semibold transition-all ${selected ? 'text-white' : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'}`}
                    style={selected ? { borderColor: TE_COLORS[unit], backgroundColor: `${TE_COLORS[unit]}44` } : undefined}
                  >
                    <div className="text-base leading-none">{TE_EMOJI[unit]}</div>
                    <div className="mt-1 truncate text-[9px]">{unit}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-800 p-3" style={{ backgroundColor: `${color}12` }}>
            <div className="flex items-center gap-3">
              <div className="text-2xl">{emoji}</div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-white">{te}</div>
                <div className="text-xs text-gray-500">{time ? `${time} Uhr · ` : ''}{duration} Min{directEntry && canDirectEntry ? ` · RPE ${effectiveRpe}` : ''}</div>
              </div>
              {directEntry && canDirectEntry && <div className="text-right text-xs font-black text-orange-400">{effectiveRpe * duration} AU</div>}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-gray-500">Uhrzeit optional</label>
            <input type="time" value={time} onChange={e => setTime(e.target.value)} className="w-full rounded-xl border border-gray-700 bg-gray-800 px-3 py-2.5 text-sm text-white outline-none [color-scheme:dark] focus:border-violet-500" />
            {isToday && time && directRecommended && !directEntry && (
              <p className="mt-1.5 text-xs text-amber-400">Diese Uhrzeit liegt bereits hinter dir. Du kannst die Einheit direkt eintragen.</p>
            )}
          </div>

          {canDirectEntry && (
            <div className="rounded-2xl border border-gray-800 bg-gray-950/40 p-3">
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => setDirectEntry(v => !v)}
                  className={`mt-0.5 h-6 w-11 rounded-full p-0.5 transition-colors ${directEntry ? 'bg-violet-600' : 'bg-gray-700'}`}
                  aria-pressed={directEntry}
                >
                  <span className={`block h-5 w-5 rounded-full bg-white transition-transform ${directEntry ? 'translate-x-5' : ''}`} />
                </button>
                <div className="flex-1">
                  <div className="text-xs font-bold text-white">Direkt als absolviert eintragen</div>
                  <p className="mt-0.5 text-xs leading-5 text-gray-500">Auslassen, wenn du nur planen willst. Aktivieren, wenn die heutige Einheit schon vorbei ist und du RPE eintragen willst.</p>
                </div>
              </div>
            </div>
          )}

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs text-gray-500">Dauer</label>
              <span className="text-xs font-bold text-white">{duration} Min</span>
            </div>
            <input type="range" min={15} max={180} step={5} value={duration} onChange={e => setDuration(Number(e.target.value))} className="w-full accent-violet-500" />
          </div>

          {directEntry && canDirectEntry && te !== 'Spiel' && (
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-xs text-gray-500">RPE</label>
                <span className="text-lg font-black" style={{ color: getRpeColor(rpe) }}>{rpe}</span>
              </div>
              <input type="range" min={1} max={10} step={1} value={rpe} onChange={e => setRpe(Number(e.target.value))} className="w-full accent-violet-500" />
              <div className="mt-1 text-center text-xs font-semibold" style={{ color: getRpeColor(rpe) }}>{RPE_LABELS[rpe]}</div>
            </div>
          )}

          {directEntry && canDirectEntry && te === 'Spiel' && (
            <div className="rounded-xl border border-red-800/40 bg-red-900/20 px-3 py-2.5 text-xs text-gray-400">
              Spiel wird automatisch mit <span className="font-black text-red-400">RPE 10</span> eingetragen.
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs text-gray-500">Notiz optional</label>
            <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="z.B. Shooting, Halle 2, Beine schwer..." className="w-full rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-violet-500" />
          </div>

          <button onClick={handleSubmit} className="w-full rounded-2xl py-2.5 text-sm font-black text-white transition-opacity hover:opacity-90" style={{ backgroundColor: color }}>
            {directEntry && canDirectEntry ? `${emoji} Einheit eintragen` : `${emoji} Einheit planen`}
          </button>
        </div>
      </div>
    </div>
  );
}

function PlannedSessionModal({ session, onClose, onConfirm, onUpdate, onDismiss }: {
  session: PlannedSession;
  onClose: () => void;
  onConfirm?: (id: string, rpe: number, dauer: number) => void;
  onUpdate?: (id: string, updates: Partial<PlannedSession>) => void;
  onDismiss?: (id: string) => void;
}) {
  const today = toISO(new Date());
  const isFuture = session.datum > today;
  const [tab, setTab] = useState<'confirm' | 'edit'>(isFuture ? 'edit' : 'confirm');
  const [rpe, setRpe] = useState(session.rpe ?? 7);
  const [duration, setDuration] = useState(session.actualDauer ?? session.geschaetzteDauer ?? DEFAULT_DURATIONS[session.te]);
  const [time, setTime] = useState(session.uhrzeit ?? '');
  const [note, setNote] = useState(session.notiz ?? '');
  const color = TE_COLORS[session.te];

  function saveEdit() {
    onUpdate?.(session.id, { uhrzeit: time || undefined, notiz: note || undefined, geschaetzteDauer: duration });
    onClose();
  }

  function confirm() {
    onConfirm?.(session.id, session.te === 'Spiel' ? 10 : rpe, duration);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm" onClick={e => { if (e.currentTarget === e.target) onClose(); }}>
      <div className="max-h-[84dvh] w-full max-w-sm overflow-y-auto rounded-3xl border border-gray-700 bg-gray-900 shadow-2xl">
        <div className="flex items-center gap-3 px-5 pb-3 pt-5" style={{ borderBottom: `2px solid ${color}40` }}>
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl text-xl" style={{ backgroundColor: `${color}33` }}>{TE_EMOJI[session.te]}</div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-black text-white">{session.te}</div>
            <div className="text-xs text-gray-400">{fmtDate(session.datum)}{session.uhrzeit ? ` · ${session.uhrzeit}` : ''}</div>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-xl text-gray-500 hover:bg-gray-800 hover:text-white">×</button>
        </div>
        <div className="flex gap-1 px-5 pt-3">
          {!isFuture && <button onClick={() => setTab('confirm')} className={`flex-1 rounded-xl py-1.5 text-xs font-bold ${tab === 'confirm' ? 'bg-gray-800 text-white' : 'text-gray-500'}`}>✓ Eintragen</button>}
          <button onClick={() => setTab('edit')} className={`flex-1 rounded-xl py-1.5 text-xs font-bold ${tab === 'edit' ? 'bg-gray-800 text-white' : 'text-gray-500'}`}>✏ Bearbeiten</button>
        </div>
        <div className="space-y-4 px-5 pb-5 pt-4">
          {tab === 'confirm' && !isFuture && (
            <>
              {session.te !== 'Spiel' && <div>
                <div className="mb-1 flex items-center justify-between"><span className="text-xs text-gray-500">RPE</span><span className="text-lg font-black" style={{ color: getRpeColor(rpe) }}>{rpe}</span></div>
                <input type="range" min={1} max={10} step={1} value={rpe} onChange={e => setRpe(Number(e.target.value))} className="w-full accent-violet-500" />
              </div>}
              {session.te === 'Spiel' && <div className="rounded-xl border border-red-800/40 bg-red-900/20 px-3 py-2 text-xs text-gray-400">Spiel wird mit <span className="font-black text-red-400">RPE 10</span> gespeichert.</div>}
              <div>
                <div className="mb-1 flex items-center justify-between"><span className="text-xs text-gray-500">Tatsächliche Dauer</span><span className="text-xs font-bold text-white">{duration} Min</span></div>
                <input type="range" min={5} max={180} step={5} value={duration} onChange={e => setDuration(Number(e.target.value))} className="w-full accent-violet-500" />
              </div>
              <div className="rounded-2xl bg-gray-800 p-3 text-sm text-gray-400">Training Load <span className="float-right font-black text-orange-400">{(session.te === 'Spiel' ? 10 : rpe) * duration} AU</span></div>
              <button onClick={confirm} className="w-full rounded-2xl bg-green-700 py-2.5 text-sm font-black text-white hover:bg-green-600">Speichern</button>
            </>
          )}
          {tab === 'edit' && (
            <>
              <div><label className="mb-1.5 block text-xs text-gray-500">Uhrzeit</label><input type="time" value={time} onChange={e => setTime(e.target.value)} className="w-full rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none [color-scheme:dark] focus:border-violet-500" /></div>
              <div><label className="mb-1.5 block text-xs text-gray-500">Geplante Dauer</label><input type="range" min={15} max={180} step={5} value={duration} onChange={e => setDuration(Number(e.target.value))} className="w-full accent-violet-500" /><div className="mt-1 text-right text-xs font-bold text-white">{duration} Min</div></div>
              <div><label className="mb-1.5 block text-xs text-gray-500">Notiz</label><textarea value={note} onChange={e => setNote(e.target.value)} rows={2} className="w-full resize-none rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:border-violet-500" /></div>
              <div className="flex gap-2"><button onClick={saveEdit} className="flex-1 rounded-2xl bg-violet-600 py-2.5 text-sm font-black text-white hover:bg-violet-500">Speichern</button><button onClick={() => { onDismiss?.(session.id); onClose(); }} className="rounded-2xl border border-gray-700 px-4 py-2.5 text-sm text-gray-500 hover:border-red-800 hover:text-red-400">Löschen</button></div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function DoneSessionModal({ session, onClose, onDelete, onEdit }: {
  session: Session;
  onClose: () => void;
  onDelete?: (id: string) => void;
  onEdit?: (id: string, rpe: number, dauer: number) => void;
}) {
  const [rpe, setRpe] = useState(session.rpe);
  const [duration, setDuration] = useState(session.dauer);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const color = TE_COLORS[session.te];
  const dirty = rpe !== session.rpe || duration !== session.dauer;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm" onClick={e => { if (e.currentTarget === e.target) onClose(); }}>
      <div className="w-full max-w-sm rounded-3xl border border-gray-700 bg-gray-900 shadow-2xl">
        <div className="flex items-center gap-3 px-5 pb-3 pt-5" style={{ borderBottom: `2px solid ${color}40` }}>
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl text-xl" style={{ backgroundColor: `${color}33` }}>{TE_EMOJI[session.te]}</div>
          <div className="min-w-0 flex-1"><div className="text-sm font-black text-white">{session.te}</div><div className="text-xs text-gray-400">{fmtDate(session.datum)} · {session.dauer} Min · RPE {session.rpe}</div></div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-xl text-gray-500 hover:bg-gray-800 hover:text-white">×</button>
        </div>
        <div className="space-y-4 px-5 pb-5 pt-4">
          <div><div className="mb-1 flex items-center justify-between"><span className="text-xs text-gray-500">RPE</span><span className="text-lg font-black" style={{ color: getRpeColor(rpe) }}>{rpe}</span></div><input type="range" min={1} max={10} step={1} value={rpe} onChange={e => setRpe(Number(e.target.value))} className="w-full accent-violet-500" /></div>
          <div><div className="mb-1 flex items-center justify-between"><span className="text-xs text-gray-500">Dauer</span><span className="text-xs font-bold text-white">{duration} Min</span></div><input type="range" min={5} max={180} step={5} value={duration} onChange={e => setDuration(Number(e.target.value))} className="w-full accent-violet-500" /></div>
          <div className="rounded-2xl bg-gray-800 p-3 text-sm text-gray-400">Training Load <span className="float-right font-black text-orange-400">{rpe * duration} AU</span></div>
          <div className="flex gap-2"><button disabled={!dirty} onClick={() => { onEdit?.(session.id, rpe, duration); onClose(); }} className="flex-1 rounded-2xl bg-violet-600 py-2.5 text-sm font-black text-white disabled:opacity-40">Änderungen speichern</button><button onClick={() => confirmDelete ? (onDelete?.(session.id), onClose()) : setConfirmDelete(true)} className="rounded-2xl border border-gray-700 px-4 py-2.5 text-sm text-gray-500 hover:border-red-800 hover:text-red-400">{confirmDelete ? 'Sicher?' : 'Löschen'}</button></div>
        </div>
      </div>
    </div>
  );
}

export function WeekCalendarV2({ sessions, plannedSessions, onConfirm, onUpdate, onDismiss, onAddPlanned, onAddSessionDirect, onDeleteSession, onEditSession, jumpToDate }: Props) {
  const [weekStart, setWeekStart] = useState(() => getWeekStart());
  const [createDate, setCreateDate] = useState<string | null>(null);
  const [plannedOpen, setPlannedOpen] = useState<PlannedSession | null>(null);
  const [doneOpen, setDoneOpen] = useState<Session | null>(null);
  const today = toISO(new Date());

  useEffect(() => {
    if (!jumpToDate) return;
    setWeekStart(getWeekStart(new Date(jumpToDate.slice(0, 10) + 'T00:00:00')));
  }, [jumpToDate]);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekStart, i);
    return { date: d, iso: toISO(d) };
  }), [weekStart]);

  const entriesByDay = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    for (const day of days) map.set(day.iso, []);
    for (const session of sessions) {
      if (!map.has(session.datum)) continue;
      map.get(session.datum)?.push({ id: session.id, kind: 'done', datum: session.datum, te: session.te, duration: session.dauer, rpe: session.rpe, load: session.tl, done: session });
    }
    for (const planned of plannedSessions.filter(s => !s.confirmed)) {
      if (!map.has(planned.datum)) continue;
      map.get(planned.datum)?.push({ id: planned.id, kind: planned.datum < today ? 'overdue' : 'planned', datum: planned.datum, te: safeTrainingUnit(planned.te), time: planned.uhrzeit, duration: planned.geschaetzteDauer, planned });
    }
    for (const values of map.values()) values.sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99'));
    return map;
  }, [days, sessions, plannedSessions, today]);

  const labelEnd = addDays(weekStart, 6);
  const openCount = plannedSessions.filter(session => !session.confirmed && session.datum < today).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => setWeekStart(d => addDays(d, -7))} className="rounded-xl border border-gray-800 px-3 py-2 text-sm text-gray-400 hover:text-white">←</button>
        <div className="text-center"><div className="text-sm font-bold text-white">{weekStart.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} – {labelEnd.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}</div><button onClick={() => setWeekStart(getWeekStart())} className="text-xs font-bold text-violet-400">Heute</button></div>
        <button onClick={() => setWeekStart(d => addDays(d, 7))} className="rounded-xl border border-gray-800 px-3 py-2 text-sm text-gray-400 hover:text-white">→</button>
      </div>

      {openCount > 0 && (
        <div className="rounded-2xl border border-amber-800/40 bg-amber-950/20 px-3 py-2 text-xs text-amber-200">
          <span className="font-black">{openCount} offene {openCount === 1 ? 'Einheit' : 'Einheiten'}</span>
          <span className="ml-1 text-amber-300/70">im Kalender kräftig hervorgehoben.</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-7">
        {days.map(day => {
          const entries = entriesByDay.get(day.iso) ?? [];
          const isToday = day.iso === today;
          return (
            <div key={day.iso} className={`min-h-[138px] rounded-2xl border p-2 ${isToday ? 'border-violet-700/60 bg-violet-950/20' : 'border-gray-800 bg-gray-950/40'}`}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <div><div className={`text-xs font-black ${isToday ? 'text-violet-300' : 'text-gray-400'}`}>{fmtDate(day.iso)}</div></div>
                <button onClick={() => setCreateDate(day.iso)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-800 text-sm font-black text-gray-300 hover:bg-violet-700 hover:text-white">+</button>
              </div>
              <div className="space-y-1.5">
                {entries.length === 0 && <div className="rounded-xl border border-dashed border-gray-800 px-2 py-4 text-center text-xs text-gray-700">frei</div>}
                {entries.map(entry => {
                  const color = TE_COLORS[entry.te];
                  const visual = getEntryVisual(entry, color);
                  return (
                    <button
                      key={`${entry.kind}-${entry.id}`}
                      onClick={() => entry.kind === 'done' && entry.done ? setDoneOpen(entry.done) : entry.planned ? setPlannedOpen(entry.planned) : undefined}
                      className={`relative w-full rounded-xl border px-2 py-2 text-left transition hover:brightness-110 ${visual.className}`}
                      style={visual.style}
                    >
                      {visual.badge && (
                        <span className={`absolute right-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide ${entry.kind === 'overdue' ? 'bg-amber-300 text-gray-950' : 'bg-gray-950/70 text-gray-400'}`}>
                          {visual.badge}
                        </span>
                      )}
                      <div className="flex items-center gap-2 pr-10"><span>{TE_EMOJI[entry.te]}</span><span className="truncate text-xs font-black text-white">{entry.te}</span></div>
                      <div className={`mt-0.5 text-[11px] ${entry.kind === 'planned' ? 'text-gray-500' : 'text-gray-300'}`}>{entry.time ? `${entry.time} · ` : ''}{entry.duration ? `${entry.duration} Min` : entry.kind === 'done' ? '' : 'geplant'}</div>
                      {entry.kind === 'done' && <div className="mt-0.5 text-[11px] font-bold text-orange-400">RPE {entry.rpe} · {entry.load} AU</div>}
                      {entry.kind === 'overdue' && <div className="mt-0.5 text-[11px] font-black text-amber-200">Eintragen offen</div>}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {createDate && <CreateSessionModal datum={createDate} onClose={() => setCreateDate(null)} onAddPlanned={(items) => onAddPlanned?.(items)} onAddSessionDirect={onAddSessionDirect} />}
      {plannedOpen && <PlannedSessionModal session={plannedOpen} onClose={() => setPlannedOpen(null)} onConfirm={onConfirm} onUpdate={onUpdate} onDismiss={onDismiss} />}
      {doneOpen && <DoneSessionModal session={doneOpen} onClose={() => setDoneOpen(null)} onDelete={onDeleteSession} onEdit={onEditSession} />}
    </div>
  );
}
