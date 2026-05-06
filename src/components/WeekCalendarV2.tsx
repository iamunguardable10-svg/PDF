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

type EntryKind = 'done' | 'planned' | 'live' | 'needs_input' | 'overdue';

interface CalendarEntry {
  id: string;
  kind: EntryKind;
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
  return new Date(`${iso}T00:00:00`).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

function safeTrainingUnit(value: string): TrainingUnit {
  return TRAINING_UNITS.includes(value as TrainingUnit) ? value as TrainingUnit : 'Team';
}

function getRpeColor(rpe: number): string {
  if (rpe <= 3) return '#4ade80';
  if (rpe <= 6) return '#facc15';
  return '#f87171';
}

function getPlannedKind(session: PlannedSession, today: string): EntryKind {
  if (session.datum < today) return 'overdue';
  if (session.datum > today) return 'planned';
  if (!session.uhrzeit) return 'planned';

  const [hours, minutes] = session.uhrzeit.split(':').map(Number);
  const start = new Date();
  start.setHours(hours || 0, minutes || 0, 0, 0);
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + (session.geschaetzteDauer ?? DEFAULT_DURATIONS[safeTrainingUnit(session.te)] ?? 60));
  const now = new Date();

  if (now >= start && now <= end) return 'live';
  if (now > end) return 'needs_input';
  return 'planned';
}

function getEntryVisual(entry: CalendarEntry, color: string) {
  if (entry.kind === 'done') {
    return {
      badge: null,
      hint: 'gespeichert',
      badgeClass: '',
      className: 'shadow-sm',
      style: {
        borderColor: `${color}aa`,
        backgroundColor: `${color}2f`,
        boxShadow: `inset 0 0 0 1px ${color}22`,
      },
    };
  }

  if (entry.kind === 'live') {
    return {
      badge: 'live',
      hint: 'läuft jetzt',
      badgeClass: 'bg-emerald-300 text-gray-950',
      className: 'shadow-lg ring-1 ring-emerald-300/30',
      style: {
        borderColor: color,
        backgroundColor: `${color}45`,
        boxShadow: `0 0 18px ${color}33, inset 0 0 0 1px ${color}55`,
      },
    };
  }

  if (entry.kind === 'needs_input') {
    return {
      badge: 'rpe offen',
      hint: 'Eintragen offen',
      badgeClass: 'bg-amber-300 text-gray-950',
      className: 'shadow-lg ring-1 ring-amber-300/30',
      style: {
        borderColor: color,
        backgroundColor: `${color}4d`,
        boxShadow: `0 0 18px ${color}38, inset 0 0 0 1px ${color}55`,
      },
    };
  }

  if (entry.kind === 'overdue') {
    return {
      badge: 'überfällig',
      hint: 'Eintragen offen',
      badgeClass: 'bg-amber-300 text-gray-950',
      className: 'shadow-lg ring-1 ring-amber-300/30',
      style: {
        borderColor: color,
        backgroundColor: `${color}42`,
        boxShadow: `0 0 18px ${color}33, inset 0 0 0 1px ${color}44`,
      },
    };
  }

  return {
    badge: 'geplant',
    hint: 'geplant',
    badgeClass: 'bg-gray-950/70 text-gray-400',
    className: 'opacity-75 hover:opacity-100 border-dashed',
    style: {
      borderColor: `${color}6f`,
      backgroundColor: `${color}16`,
      boxShadow: 'none',
    },
  };
}

function CreateSessionModal({ datum, onClose, onAddPlanned, onAddSessionDirect }: {
  datum: string;
  onClose: () => void;
  onAddPlanned?: (sessions: PlannedSession[]) => void;
  onAddSessionDirect?: (session: Session) => void;
}) {
  const today = toISO(new Date());
  const [te, setTe] = useState<TrainingUnit>('Team');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState(DEFAULT_DURATIONS.Team);
  const [directEntry, setDirectEntry] = useState(datum < today);
  const [rpe, setRpe] = useState(7);
  const color = TE_COLORS[te];
  const canDirectEntry = datum <= today;
  const effectiveRpe = te === 'Spiel' ? 10 : rpe;

  function submit() {
    if (canDirectEntry && directEntry && onAddSessionDirect) {
      onAddSessionDirect({ id: `direct-${Date.now()}`, name: '', datum, te, rpe: effectiveRpe, dauer: duration, tl: effectiveRpe * duration });
    } else {
      onAddPlanned?.([{ id: `planned-${Date.now()}`, datum, te, uhrzeit: time || undefined, geschaetzteDauer: duration, reminderScheduled: false, confirmed: false }]);
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm" onClick={e => { if (e.currentTarget === e.target) onClose(); }}>
      <div className="w-full max-w-sm rounded-3xl border border-gray-700 bg-gray-900 p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div><p className="text-sm font-black text-white">Neue Einheit</p><p className="text-xs text-gray-500">{fmtDate(datum)}</p></div>
          <button onClick={onClose} className="rounded-xl px-3 py-1 text-gray-500 hover:bg-gray-800 hover:text-white">×</button>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {TRAINING_UNITS.map(unit => <button key={unit} onClick={() => { setTe(unit); setDuration(DEFAULT_DURATIONS[unit]); }} className={`rounded-xl border px-1 py-2 text-xs ${unit === te ? 'text-white' : 'border-gray-700 text-gray-400'}`} style={unit === te ? { borderColor: TE_COLORS[unit], backgroundColor: `${TE_COLORS[unit]}44` } : undefined}>{TE_EMOJI[unit]}<div className="truncate text-[9px]">{unit}</div></button>)}
        </div>
        <div className="mt-4 rounded-2xl border border-gray-800 p-3" style={{ backgroundColor: `${color}12` }}>
          <p className="text-sm font-black text-white">{TE_EMOJI[te]} {te}</p>
          <p className="text-xs text-gray-500">{duration} Min{directEntry && canDirectEntry ? ` · RPE ${effectiveRpe}` : ''}</p>
        </div>
        <label className="mt-4 block text-xs text-gray-500">Uhrzeit optional</label>
        <input value={time} onChange={e => setTime(e.target.value)} type="time" className="mt-1 w-full rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-white [color-scheme:dark]" />
        {canDirectEntry && <button onClick={() => setDirectEntry(v => !v)} className={`mt-3 w-full rounded-xl border px-3 py-2 text-left text-xs ${directEntry ? 'border-violet-600 bg-violet-950/40 text-violet-100' : 'border-gray-700 bg-gray-800 text-gray-400'}`}>{directEntry ? '✓ Direkt als absolviert eintragen' : 'Nur planen'}</button>}
        <div className="mt-4 flex items-center justify-between"><span className="text-xs text-gray-500">Dauer</span><span className="text-xs font-bold text-white">{duration} Min</span></div>
        <input type="range" min={15} max={180} step={5} value={duration} onChange={e => setDuration(Number(e.target.value))} className="w-full accent-violet-500" />
        {directEntry && canDirectEntry && te !== 'Spiel' && <><div className="mt-3 flex items-center justify-between"><span className="text-xs text-gray-500">RPE</span><span className="text-lg font-black" style={{ color: getRpeColor(rpe) }}>{rpe}</span></div><input type="range" min={1} max={10} step={1} value={rpe} onChange={e => setRpe(Number(e.target.value))} className="w-full accent-violet-500" /></>}
        <button onClick={submit} className="mt-4 w-full rounded-2xl py-2.5 text-sm font-black text-white" style={{ backgroundColor: color }}>{directEntry && canDirectEntry ? 'Einheit eintragen' : 'Einheit planen'}</button>
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
  const [rpe, setRpe] = useState(session.rpe ?? 7);
  const [duration, setDuration] = useState(session.actualDauer ?? session.geschaetzteDauer ?? DEFAULT_DURATIONS[session.te]);
  const canConfirm = session.datum <= toISO(new Date());
  const effectiveRpe = session.te === 'Spiel' ? 10 : rpe;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm" onClick={e => { if (e.currentTarget === e.target) onClose(); }}>
      <div className="w-full max-w-sm rounded-3xl border border-gray-700 bg-gray-900 p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between"><div><p className="text-sm font-black text-white">{TE_EMOJI[session.te]} {session.te}</p><p className="text-xs text-gray-500">{fmtDate(session.datum)}{session.uhrzeit ? ` · ${session.uhrzeit}` : ''}</p></div><button onClick={onClose} className="rounded-xl px-3 py-1 text-gray-500 hover:bg-gray-800 hover:text-white">×</button></div>
        {canConfirm ? <>
          {session.te !== 'Spiel' && <><div className="flex items-center justify-between"><span className="text-xs text-gray-500">RPE</span><span className="text-lg font-black" style={{ color: getRpeColor(rpe) }}>{rpe}</span></div><input type="range" min={1} max={10} step={1} value={rpe} onChange={e => setRpe(Number(e.target.value))} className="w-full accent-violet-500" /></>}
          <div className="mt-3 flex items-center justify-between"><span className="text-xs text-gray-500">Dauer</span><span className="text-xs font-bold text-white">{duration} Min</span></div><input type="range" min={5} max={180} step={5} value={duration} onChange={e => setDuration(Number(e.target.value))} className="w-full accent-violet-500" />
          <div className="mt-3 rounded-2xl bg-gray-800 p-3 text-sm text-gray-400">Training Load <span className="float-right font-black text-orange-400">{effectiveRpe * duration} AU</span></div>
          <button onClick={() => { onConfirm?.(session.id, effectiveRpe, duration); onClose(); }} className="mt-4 w-full rounded-2xl bg-green-700 py-2.5 text-sm font-black text-white">Speichern</button>
        </> : <>
          <p className="rounded-2xl border border-gray-800 bg-gray-950/40 p-3 text-xs text-gray-400">Diese Einheit ist geplant. Du kannst Uhrzeit und geplante Dauer anpassen.</p>
          <button onClick={() => { onUpdate?.(session.id, { geschaetzteDauer: duration }); onClose(); }} className="mt-4 w-full rounded-2xl bg-violet-600 py-2.5 text-sm font-black text-white">Plan speichern</button>
        </>}
        <button onClick={() => { onDismiss?.(session.id); onClose(); }} className="mt-2 w-full rounded-2xl border border-gray-700 py-2.5 text-sm text-gray-500 hover:border-red-800 hover:text-red-400">Löschen</button>
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
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm" onClick={e => { if (e.currentTarget === e.target) onClose(); }}>
      <div className="w-full max-w-sm rounded-3xl border border-gray-700 bg-gray-900 p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between"><div><p className="text-sm font-black text-white">{TE_EMOJI[session.te]} {session.te}</p><p className="text-xs text-gray-500">{fmtDate(session.datum)} · RPE {session.rpe} · {session.tl} AU</p></div><button onClick={onClose} className="rounded-xl px-3 py-1 text-gray-500 hover:bg-gray-800 hover:text-white">×</button></div>
        <div className="flex items-center justify-between"><span className="text-xs text-gray-500">RPE</span><span className="text-lg font-black" style={{ color: getRpeColor(rpe) }}>{rpe}</span></div><input type="range" min={1} max={10} step={1} value={rpe} onChange={e => setRpe(Number(e.target.value))} className="w-full accent-violet-500" />
        <div className="mt-3 flex items-center justify-between"><span className="text-xs text-gray-500">Dauer</span><span className="text-xs font-bold text-white">{duration} Min</span></div><input type="range" min={5} max={180} step={5} value={duration} onChange={e => setDuration(Number(e.target.value))} className="w-full accent-violet-500" />
        <button onClick={() => { onEdit?.(session.id, rpe, duration); onClose(); }} className="mt-4 w-full rounded-2xl bg-violet-600 py-2.5 text-sm font-black text-white">Änderungen speichern</button>
        <button onClick={() => { onDelete?.(session.id); onClose(); }} className="mt-2 w-full rounded-2xl border border-gray-700 py-2.5 text-sm text-gray-500 hover:border-red-800 hover:text-red-400">Löschen</button>
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
    setWeekStart(getWeekStart(new Date(`${jumpToDate.slice(0, 10)}T00:00:00`)));
  }, [jumpToDate]);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => ({ iso: toISO(addDays(weekStart, i)) })), [weekStart]);

  const entriesByDay = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    for (const day of days) map.set(day.iso, []);
    for (const session of sessions) {
      if (!map.has(session.datum)) continue;
      map.get(session.datum)?.push({ id: session.id, kind: 'done', datum: session.datum, te: session.te, duration: session.dauer, rpe: session.rpe, load: session.tl, done: session });
    }
    for (const planned of plannedSessions.filter(s => !s.confirmed)) {
      if (!map.has(planned.datum)) continue;
      const te = safeTrainingUnit(planned.te);
      map.get(planned.datum)?.push({ id: planned.id, kind: getPlannedKind(planned, today), datum: planned.datum, te, time: planned.uhrzeit, duration: planned.geschaetzteDauer, planned });
    }
    for (const values of map.values()) values.sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99'));
    return map;
  }, [days, sessions, plannedSessions, today]);

  const labelEnd = addDays(weekStart, 6);
  const activeCount = plannedSessions.filter(session => !session.confirmed && ['live', 'needs_input', 'overdue'].includes(getPlannedKind(session, today))).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => setWeekStart(d => addDays(d, -7))} className="rounded-xl border border-gray-800 px-3 py-2 text-sm text-gray-400 hover:text-white">←</button>
        <div className="text-center"><div className="text-sm font-bold text-white">{weekStart.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} – {labelEnd.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}</div><button onClick={() => setWeekStart(getWeekStart())} className="text-xs font-bold text-violet-400">Heute</button></div>
        <button onClick={() => setWeekStart(d => addDays(d, 7))} className="rounded-xl border border-gray-800 px-3 py-2 text-sm text-gray-400 hover:text-white">→</button>
      </div>

      {activeCount > 0 && <div className="rounded-2xl border border-amber-800/40 bg-amber-950/20 px-3 py-2 text-xs text-amber-200"><span className="font-black">{activeCount} aktive/offene {activeCount === 1 ? 'Einheit' : 'Einheiten'}</span><span className="ml-1 text-amber-300/70">direkt im Kalender markiert.</span></div>}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-7">
        {days.map(day => {
          const entries = entriesByDay.get(day.iso) ?? [];
          const isToday = day.iso === today;
          return (
            <div key={day.iso} className={`min-h-[138px] rounded-2xl border p-2 ${isToday ? 'border-violet-700/60 bg-violet-950/20' : 'border-gray-800 bg-gray-950/40'}`}>
              <div className="mb-2 flex items-center justify-between gap-2"><div className={`text-xs font-black ${isToday ? 'text-violet-300' : 'text-gray-400'}`}>{fmtDate(day.iso)}</div><button onClick={() => setCreateDate(day.iso)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-800 text-sm font-black text-gray-300 hover:bg-violet-700 hover:text-white">+</button></div>
              <div className="space-y-1.5">
                {entries.length === 0 && <div className="rounded-xl border border-dashed border-gray-800 px-2 py-4 text-center text-xs text-gray-700">frei</div>}
                {entries.map(entry => {
                  const color = TE_COLORS[entry.te];
                  const visual = getEntryVisual(entry, color);
                  return (
                    <button key={`${entry.kind}-${entry.id}`} onClick={() => entry.kind === 'done' && entry.done ? setDoneOpen(entry.done) : entry.planned ? setPlannedOpen(entry.planned) : undefined} className={`relative w-full rounded-xl border px-2 py-2 text-left transition hover:brightness-110 ${visual.className}`} style={visual.style}>
                      {visual.badge && <span className={`absolute right-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide ${visual.badgeClass}`}>{visual.badge}</span>}
                      <div className="flex items-center gap-2 pr-14"><span>{TE_EMOJI[entry.te]}</span><span className="truncate text-xs font-black text-white">{entry.te}</span></div>
                      <div className={`mt-0.5 text-[11px] ${entry.kind === 'planned' ? 'text-gray-500' : 'text-gray-300'}`}>{entry.time ? `${entry.time} · ` : ''}{entry.duration ? `${entry.duration} Min` : visual.hint}</div>
                      {entry.kind === 'done' && <div className="mt-0.5 text-[11px] font-bold text-orange-400">RPE {entry.rpe} · {entry.load} AU</div>}
                      {entry.kind !== 'done' && entry.kind !== 'planned' && <div className="mt-0.5 text-[11px] font-black text-amber-200">{visual.hint}</div>}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {createDate && <CreateSessionModal datum={createDate} onClose={() => setCreateDate(null)} onAddPlanned={items => onAddPlanned?.(items)} onAddSessionDirect={onAddSessionDirect} />}
      {plannedOpen && <PlannedSessionModal session={plannedOpen} onClose={() => setPlannedOpen(null)} onConfirm={onConfirm} onUpdate={onUpdate} onDismiss={onDismiss} />}
      {doneOpen && <DoneSessionModal session={doneOpen} onClose={() => setDoneOpen(null)} onDelete={onDeleteSession} onEdit={onEditSession} />}
    </div>
  );
}
