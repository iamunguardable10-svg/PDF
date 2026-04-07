import { useMemo, useState, useEffect, useRef } from 'react';
import type { Session, PlannedSession, TrainingUnit } from '../types/acwr';
import { TE_COLORS, TE_EMOJI, TRAINING_UNITS } from '../types/acwr';

interface Props {
  sessions: Session[];
  plannedSessions: PlannedSession[];
  onConfirm?: (id: string, rpe: number, dauer: number) => void;
  onUpdate?: (id: string, updates: Partial<PlannedSession>) => void;
  onDismiss?: (id: string) => void;
  onAddPlanned?: (sessions: PlannedSession[]) => void;
}

const WEEKDAYS_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

const TE_SHORT: Record<string, string> = {
  Team: 'Team', 'S&C': 'S&C', Spiel: 'Spiel',
  Aufwärmen: 'Warm.', Indi: 'Indi',
  Schulsport: 'Schule', Prävention: 'Präv.',
};

const RPE_LABELS = [
  '', 'Sehr leicht', 'Leicht', 'Moderat', 'Etwas schwer',
  'Schwer', 'Schwer+', 'Sehr schwer', 'Sehr schwer+', 'Maximal fast', 'Maximal',
];

const DEFAULT_DURATIONS: Record<string, number> = {
  Team:       120,
  'S&C':       60,
  Spiel:       90,  // sport-dependent — 90 as neutral default
  Aufwärmen:   60,
  Indi:        60,
  Schulsport:  75,
  Prävention:  30,
};

function getWeekStart(offsetWeeks = 0): Date {
  const d = new Date();
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1 + offsetWeeks * 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toISO(d: Date): string {
  return d.toISOString().split('T')[0];
}

function getISOWeek(d: Date): number {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  return Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function shiftDate(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00');
  d.setDate(d.getDate() + days);
  return toISO(d);
}

function fmtWeekday(iso: string): string {
  return new Date(iso + 'T00:00').toLocaleDateString('de-DE', {
    weekday: 'short', day: '2-digit', month: '2-digit',
  });
}

interface DayEntry {
  kind: 'done' | 'planned' | 'overdue';
  id: string;
  te: string;
  uhrzeit?: string;
  dauer?: number;
  rpe?: number;
  tl?: number;
  session?: PlannedSession;
}

// ─── Create Session Modal ─────────────────────────────────────────────────────

function CreateSessionModal({
  datum, onClose, onAdd,
}: {
  datum: string;
  onClose: () => void;
  onAdd: (s: PlannedSession) => void;
}) {
  const [te, setTe]       = useState<TrainingUnit>('Team');
  const [time, setTime]   = useState('');
  const [dauer, setDauer] = useState(DEFAULT_DURATIONS['Team']);
  const [note, setNote]   = useState('');

  function handleTeChange(unit: TrainingUnit) {
    setTe(unit);
    setDauer(DEFAULT_DURATIONS[unit] ?? 60);
  }

  const color = TE_COLORS[te];
  const emoji = TE_EMOJI[te];

  function handleCreate() {
    onAdd({
      id: `planned-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      datum,
      te,
      uhrzeit: time || undefined,
      geschaetzteDauer: dauer,
      notiz: note || undefined,
      reminderScheduled: false,
      confirmed: false,
    });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm bg-gray-900 rounded-3xl border border-gray-700 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 pt-5 pb-3 flex items-center gap-3 border-b border-gray-800">
          <div className="flex-1">
            <div className="text-sm font-bold text-white">Neue Einheit</div>
            <div className="text-xs text-gray-400">
              {new Date(datum + 'T00:00').toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-xl text-gray-500 hover:text-white hover:bg-gray-800 transition-colors text-sm">
            ✕
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* TE-Typ Auswahl */}
          <div>
            <div className="text-xs text-gray-500 mb-2">Typ</div>
            <div className="grid grid-cols-4 gap-1.5">
              {TRAINING_UNITS.map(unit => {
                const selected = te === unit;
                return (
                  <button
                    key={unit}
                    onClick={() => handleTeChange(unit)}
                    className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl border text-xs font-medium transition-all ${
                      selected ? 'border-transparent text-white' : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'
                    }`}
                    style={selected ? { backgroundColor: TE_COLORS[unit] + '44', borderColor: TE_COLORS[unit] } : {}}
                  >
                    <span className="text-base leading-none">{TE_EMOJI[unit]}</span>
                    <span className="leading-tight truncate w-full text-center" style={{ fontSize: '9px' }}>
                      {unit === 'Aufwärmen' ? 'Warm.' : unit === 'Schulsport' ? 'Schule' : unit === 'Prävention' ? 'Präv.' : unit}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Vorschau */}
          <div className="flex items-center gap-3 p-3 rounded-2xl border border-gray-800"
            style={{ backgroundColor: color + '11' }}>
            <div className="text-2xl">{emoji}</div>
            <div>
              <div className="text-sm font-semibold text-white">{te}</div>
              <div className="text-xs text-gray-500">
                {time ? `${time} Uhr · ` : ''}{dauer} Min
              </div>
            </div>
          </div>

          {/* Uhrzeit + Dauer */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1.5">Uhrzeit (optional)</label>
              <input type="time" value={time} onChange={e => setTime(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1.5">Dauer: {dauer} Min</label>
              <input type="range" min={15} max={180} step={15} value={dauer}
                onChange={e => setDauer(Number(e.target.value))}
                className="w-full mt-2 accent-violet-500" />
            </div>
          </div>

          {/* Notiz */}
          <div>
            <label className="text-xs text-gray-500 block mb-1.5">Notiz (optional)</label>
            <input type="text" value={note} onChange={e => setNote(e.target.value)}
              placeholder="z.B. Halle 2, Vollzug..."
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500" />
          </div>

          <button
            onClick={handleCreate}
            className="w-full py-2.5 rounded-2xl font-semibold text-sm text-white transition-colors"
            style={{ backgroundColor: color }}
          >
            {emoji} Einheit planen
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Session Detail Modal ──────────────────────────────────────────────────────

function SessionModal({
  session, onClose, onConfirm, onUpdate, onDismiss, initialTab,
}: {
  session: PlannedSession;
  onClose: () => void;
  onConfirm?: (id: string, rpe: number, dauer: number) => void;
  onUpdate?: (id: string, updates: Partial<PlannedSession>) => void;
  onDismiss?: (id: string) => void;
  initialTab?: 'confirm' | 'edit';
}) {
  const today   = new Date().toISOString().split('T')[0];
  const isPast  = session.datum < today;
  const isToday = session.datum === today;

  const [rpe, setRpe]     = useState(7);
  const [dauer, setDauer] = useState(session.geschaetzteDauer ?? 90);
  const [time, setTime]   = useState(session.uhrzeit ?? '');
  const [note, setNote]   = useState(session.notiz ?? '');
  const isFuture = !isPast && !isToday;
  const [tab, setTab]     = useState<'confirm' | 'edit'>(
    initialTab ?? (isFuture ? 'edit' : 'confirm')
  );
  const [saved, setSaved] = useState(false);

  const color    = TE_COLORS[session.te as keyof typeof TE_COLORS] ?? '#6b7280';
  const emoji    = TE_EMOJI[session.te as keyof typeof TE_EMOJI] ?? '💪';
  const rpeColor = rpe <= 3 ? '#4ade80' : rpe <= 6 ? '#facc15' : '#f87171';

  function handleDateShift(days: number) {
    onUpdate?.(session.id, { datum: shiftDate(session.datum, days) });
  }

  function handleSaveEdit() {
    onUpdate?.(session.id, { uhrzeit: time || undefined, notiz: note || undefined });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  function handleConfirm() {
    onConfirm?.(session.id, rpe, dauer);
    onClose();
  }

  function handleDismiss() {
    onDismiss?.(session.id);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm bg-gray-900 rounded-3xl border border-gray-700 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 pt-5 pb-3 flex items-center gap-3"
          style={{ borderBottom: `2px solid ${color}40` }}>
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl shrink-0"
            style={{ backgroundColor: color + '33' }}>
            {emoji}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-white text-sm">{session.te}</div>
            <div className="text-xs text-gray-400">
              {fmtWeekday(session.datum)}
              {session.uhrzeit && ` · ${session.uhrzeit}`}
              {session.geschaetzteDauer && ` · ~${session.geschaetzteDauer} Min`}
            </div>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-xl text-gray-500 hover:text-white hover:bg-gray-800 transition-colors text-sm shrink-0">
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-5 pt-3 gap-1">
          {/* Eintragen nur für heute / vergangene Sessions */}
          {!isFuture && (
            <button onClick={() => setTab('confirm')}
              className={`flex-1 py-1.5 rounded-xl text-xs font-medium transition-all ${
                tab === 'confirm' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'
              }`}>
              ✓ Eintragen
            </button>
          )}
          <button onClick={() => setTab('edit')}
            className={`flex-1 py-1.5 rounded-xl text-xs font-medium transition-all ${
              tab === 'edit' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'
            }`}>
            ✏ Bearbeiten
          </button>
          {isFuture && (
            <div className="flex items-center px-2 text-xs text-gray-600 italic">
              Noch nicht beendet
            </div>
          )}
        </div>

        <div className="px-5 pb-5 pt-3 space-y-4">
          {/* Eintragen */}
          {tab === 'confirm' && (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">RPE (empfundene Belastung)</span>
                  <span className="font-bold text-lg" style={{ color: rpeColor }}>{rpe}</span>
                </div>
                <input type="range" min={1} max={10} step={1} value={rpe}
                  onChange={e => setRpe(Number(e.target.value))}
                  className="w-full accent-violet-500" />
                <div className="text-xs text-center font-medium" style={{ color: rpeColor }}>
                  {RPE_LABELS[rpe]}
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Tatsächliche Dauer</span>
                  <span className="font-semibold text-white text-sm">{dauer} Min</span>
                </div>
                <input type="range" min={5} max={180} step={5} value={dauer}
                  onChange={e => setDauer(Number(e.target.value))}
                  className="w-full accent-violet-500" />
                <div className="flex justify-between text-xs text-gray-600">
                  <span>5</span><span>60</span><span>120</span><span>180 Min</span>
                </div>
              </div>
              <div className="bg-gray-800 rounded-2xl p-3 flex justify-between items-center">
                <span className="text-sm text-gray-400">Training Load</span>
                <span className="font-bold text-orange-400 text-lg">{rpe * dauer} AU</span>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={handleConfirm}
                  className="flex-1 py-2.5 rounded-2xl font-semibold text-sm bg-green-700 hover:bg-green-600 text-white transition-colors">
                  ✓ Speichern
                </button>
                <button onClick={handleDismiss}
                  className="px-4 py-2.5 rounded-2xl text-sm text-gray-500 hover:text-gray-300 border border-gray-700 hover:border-gray-500 transition-colors">
                  Löschen
                </button>
              </div>
            </>
          )}

          {/* Bearbeiten */}
          {tab === 'edit' && (
            <>
              <div>
                <label className="text-xs text-gray-500 block mb-1.5">Uhrzeit</label>
                <input
                  type="time"
                  value={time}
                  onChange={e => setTime(e.target.value)}
                  autoFocus={initialTab === 'edit'}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                />
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-2">Datum verschieben</div>
                <div className="grid grid-cols-4 gap-1.5">
                  {([-7, -1, +1, +7] as const).map(d => (
                    <button key={d} onClick={() => handleDateShift(d)}
                      className="py-2 rounded-xl border border-gray-700 text-xs font-semibold text-gray-300 hover:text-white hover:border-gray-500 hover:bg-gray-800 transition-colors">
                      {d > 0 ? `+${d}d` : `${d}d`}
                    </button>
                  ))}
                </div>
                <div className="mt-2 text-center text-xs text-gray-500">
                  → {fmtWeekday(session.datum)}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1.5">Notiz</label>
                <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                  placeholder="z.B. Hallenboden, Vollzug..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500 resize-none" />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={handleSaveEdit}
                  className={`flex-1 py-2.5 rounded-2xl font-semibold text-sm transition-all ${
                    saved ? 'bg-green-800 text-green-300' : 'bg-violet-600 hover:bg-violet-500 text-white'
                  }`}>
                  {saved ? '✓ Gespeichert' : 'Speichern'}
                </button>
                <button onClick={handleDismiss}
                  className="px-4 py-2.5 rounded-2xl text-sm text-gray-500 hover:text-red-400 border border-gray-700 hover:border-red-800 transition-colors">
                  Löschen
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Haupt-Komponente ──────────────────────────────────────────────────────────

export function WeekCalendar({ sessions, plannedSessions, onConfirm, onUpdate, onDismiss, onAddPlanned }: Props) {
  const [weekOffset, setWeekOffset]           = useState(0);
  const [selectedSession, setSelectedSession] = useState<PlannedSession | null>(null);
  const [createForDay, setCreateForDay]       = useState<string | null>(null);
  const [draggingId, setDraggingId]           = useState<string | null>(null);
  const [dragOverDay, setDragOverDay]         = useState<string | null>(null);
  const [droppedId, setDroppedId]             = useState<string | null>(null);
  const [dropInitialTab, setDropInitialTab]   = useState<'confirm' | 'edit'>('edit');
  const dragHappened = useRef(false); // verhindert Modal-Öffnung nach Drag
  const today = new Date().toISOString().split('T')[0];

  const weekDays = useMemo<string[]>(() => {
    const start = getWeekStart(weekOffset);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return toISO(d);
    });
  }, [weekOffset]);

  const weekStart = weekDays[0];
  const weekEnd   = weekDays[6];

  const weekLabel = useMemo(() => {
    const s = new Date(weekStart);
    const e = new Date(weekEnd);
    const kw = getISOWeek(s);
    return `KW ${kw}  ·  ${s.getDate()}.${s.getMonth() + 1} – ${e.getDate()}.${e.getMonth() + 1}.${e.getFullYear()}`;
  }, [weekStart, weekEnd]);

  const isCurrentWeek = weekOffset === 0;
  const isFutureWeek  = weekStart > today;

  // Modal aktuell halten wenn Session von außen verändert wird
  useEffect(() => {
    if (!selectedSession) return;
    const updated = plannedSessions.find(s => s.id === selectedSession.id);
    if (updated && updated !== selectedSession) setSelectedSession(updated);
  }, [plannedSessions, selectedSession]);

  // Nach Drop: Modal mit edit-Tab öffnen sobald die Session aktualisiert ist
  useEffect(() => {
    if (!droppedId) return;
    const session = plannedSessions.find(s => s.id === droppedId);
    if (session) {
      setDroppedId(null);
      setSelectedSession(session);
      setDropInitialTab('edit');
    }
  }, [plannedSessions, droppedId]);

  // ── Drag & Drop Handler ──────────────────────────────────────────────────────

  function handleDragStart(e: React.DragEvent, session: PlannedSession) {
    dragHappened.current = true;
    setDraggingId(session.id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('sessionId', session.id);
    // Eigene Ghost-Darstellung (optional – ohne setzt Browser Standard)
  }

  function handleDragEnd() {
    setDraggingId(null);
    setDragOverDay(null);
    // Kurze Verzögerung damit onClick nicht feuert
    setTimeout(() => { dragHappened.current = false; }, 50);
  }

  function handleDayDragOver(e: React.DragEvent, iso: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverDay !== iso) setDragOverDay(iso);
  }

  function handleDayDragLeave(e: React.DragEvent, iso: string) {
    // Nur leeren wenn wir wirklich die Zelle verlassen (nicht in Kind-Elemente)
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverDay(d => d === iso ? null : d);
    }
  }

  function handleDrop(e: React.DragEvent, targetDay: string) {
    e.preventDefault();
    const id = e.dataTransfer.getData('sessionId');
    if (!id) return;
    const session = plannedSessions.find(s => s.id === id);
    if (!session) return;
    setDraggingId(null);
    setDragOverDay(null);
    if (session.datum === targetDay) return;
    onUpdate?.(id, { datum: targetDay });
    // Modal öffnen mit Uhrzeit-Tab damit man gleich die Zeit anpassen kann
    setDroppedId(id);
  }

  // ── Einträge nach Tag ────────────────────────────────────────────────────────

  const entriesByDay = useMemo(() => {
    const map = new Map<string, DayEntry[]>();
    for (const iso of weekDays) map.set(iso, []);

    for (const s of sessions) {
      if (s.datum >= weekStart && s.datum <= weekEnd) {
        map.get(s.datum)?.push({ kind: 'done', id: s.id, te: s.te, dauer: s.dauer, rpe: s.rpe, tl: s.tl });
      }
    }

    for (const ps of plannedSessions) {
      if (ps.confirmed) continue;
      if (ps.datum >= weekStart && ps.datum <= weekEnd) {
        map.get(ps.datum)?.push({
          kind: ps.datum < today ? 'overdue' : 'planned',
          id: ps.id, te: ps.te, uhrzeit: ps.uhrzeit,
          dauer: ps.geschaetzteDauer, session: ps,
        });
      }
    }

    for (const [, entries] of map) {
      entries.sort((a, b) => (a.uhrzeit ?? '99:99').localeCompare(b.uhrzeit ?? '99:99'));
    }
    return map;
  }, [sessions, plannedSessions, weekDays, weekStart, weekEnd, today]);

  const weekStats = useMemo(() => {
    const done    = sessions.filter(s => s.datum >= weekStart && s.datum <= weekEnd);
    const planned = plannedSessions.filter(s => !s.confirmed && s.datum >= weekStart && s.datum <= weekEnd);
    return { doneCount: done.length, plannedCount: planned.length, totalTL: done.reduce((s, x) => s + x.tl, 0) };
  }, [sessions, plannedSessions, weekStart, weekEnd]);

  // Fokus-Label pro Tag (loading / recovery / normal / rest)
  const focusByDay = useMemo<Map<string, 'loading' | 'recovery' | 'normal' | 'rest'>>(() => {
    const map = new Map<string, 'loading' | 'recovery' | 'normal' | 'rest'>();
    const hasSpiel = (date: string) =>
      sessions.some(s => s.datum === date && s.te === 'Spiel') ||
      plannedSessions.some(s => s.datum === date && s.te === 'Spiel');
    const hasAny = (date: string) =>
      sessions.some(s => s.datum === date) ||
      plannedSessions.some(s => !s.confirmed && s.datum === date);
    for (const iso of weekDays) {
      const prevDate = new Date(iso);
      prevDate.setDate(prevDate.getDate() - 1);
      const prev = prevDate.toISOString().split('T')[0];
      if (hasSpiel(iso)) map.set(iso, 'loading');
      else if (hasSpiel(prev)) map.set(iso, 'recovery');
      else if (hasAny(iso)) map.set(iso, 'normal');
      else map.set(iso, 'rest');
    }
    return map;
  }, [sessions, plannedSessions, weekDays]);

  return (
    <>
      <div className="space-y-3">
        {/* Navigation */}
        <div className="flex items-center gap-3">
          <button onClick={() => setWeekOffset(o => o - 1)}
            className="w-8 h-8 flex items-center justify-center rounded-xl border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 transition-colors font-bold shrink-0">
            ‹
          </button>
          <div className="flex-1 text-center">
            <div className="text-xs font-semibold text-white tracking-wide">{weekLabel}</div>
            <div className={`text-xs mt-0.5 ${isCurrentWeek ? 'text-violet-400' : isFutureWeek ? 'text-blue-400' : 'text-gray-500'}`}>
              {isCurrentWeek ? 'Aktuelle Woche'
                : weekOffset === 1 ? 'Nächste Woche'
                : weekOffset === -1 ? 'Letzte Woche'
                : weekOffset > 1 ? `+${weekOffset} Wochen` : `${weekOffset} Wochen`}
            </div>
          </div>
          <button onClick={() => setWeekOffset(o => o + 1)}
            className="w-8 h-8 flex items-center justify-center rounded-xl border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 transition-colors font-bold shrink-0">
            ›
          </button>
          {weekOffset !== 0 && (
            <button onClick={() => setWeekOffset(0)}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-violet-700/60 text-violet-300 hover:bg-violet-900/30 transition-colors shrink-0">
              Heute
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="flex gap-2">
          {[
            { label: 'Absolviert', value: weekStats.doneCount,   color: 'text-violet-400' },
            { label: 'Geplant',    value: weekStats.plannedCount, color: 'text-blue-400' },
            { label: 'AU Load',    value: weekStats.totalTL,      color: 'text-orange-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex-1 bg-gray-900/60 rounded-xl px-3 py-2 border border-gray-800 text-center">
              <div className={`text-sm font-bold ${color}`}>{value}</div>
              <div className="text-xs text-gray-600 leading-tight">{label}</div>
            </div>
          ))}
        </div>

        {/* Kalender-Grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Kopfzeile */}
          {weekDays.map((iso, idx) => {
            const isToday = iso === today;
            const d = new Date(iso + 'T00:00');
            const focus = focusByDay.get(iso) ?? 'rest';
            const focusBadge: Record<string, { label: string; color: string }> = {
              loading:  { label: 'Spiel',   color: '#f87171' },
              recovery: { label: 'Recov.',  color: '#34d399' },
              normal:   { label: 'Train.',  color: '#818cf8' },
              rest:     { label: 'Ruhe',    color: '#4b5563' },
            };
            const badge = focusBadge[focus];
            return (
              <div key={iso} className={`text-center py-1.5 px-0.5 rounded-t-xl ${isToday ? 'bg-violet-600/25' : 'bg-gray-900/60'}`}>
                <div className={`text-xs font-bold tracking-wide ${isToday ? 'text-violet-300' : 'text-gray-400'}`}>
                  {WEEKDAYS_SHORT[idx]}
                </div>
                <div className={`text-xs leading-tight ${isToday ? 'text-violet-400 font-semibold' : 'text-gray-600'}`}>
                  {d.getDate()}.{d.getMonth() + 1}
                </div>
                <div className="mt-1 text-center" style={{ fontSize: '8px', color: badge.color, fontWeight: 600, letterSpacing: '0.02em', opacity: focus === 'rest' ? 0.4 : 0.85 }}>
                  {badge.label}
                </div>
              </div>
            );
          })}

          {/* Tageszellen */}
          {weekDays.map((iso) => {
            const isToday    = iso === today;
            const isPast     = iso < today;
            const isDragOver = dragOverDay === iso && draggingId !== null;
            const entries    = entriesByDay.get(iso) ?? [];

            return (
              <div
                key={iso}
                onDragOver={e => handleDayDragOver(e, iso)}
                onDragLeave={e => handleDayDragLeave(e, iso)}
                onDrop={e => handleDrop(e, iso)}
                className={`min-h-[80px] rounded-b-xl p-1 flex flex-col gap-0.5 transition-colors ${
                  isDragOver
                    ? 'bg-violet-600/25 border-2 border-violet-500 border-dashed'
                    : isToday
                    ? 'bg-violet-600/10 border border-violet-700/40'
                    : isPast
                    ? 'bg-gray-900/25 border border-gray-800/40'
                    : 'bg-gray-900/50 border border-gray-800'
                }`}
              >
                {/* Drop-Hint wenn Drag aktiv */}
                {isDragOver && (
                  <div className="flex-1 flex items-center justify-center">
                    <span className="text-violet-400 text-xs">↓</span>
                  </div>
                )}

                {/* Leere Zelle: + Button zum Erstellen */}
                {!isDragOver && entries.length === 0 && (
                  <button
                    onClick={() => onAddPlanned && setCreateForDay(iso)}
                    className={`flex-1 flex items-center justify-center rounded-lg transition-colors group ${
                      onAddPlanned ? 'hover:bg-gray-700/30 cursor-pointer' : 'cursor-default'
                    }`}
                    title={onAddPlanned ? 'Neue Einheit planen' : undefined}
                  >
                    <span className={`text-xs transition-colors ${
                      onAddPlanned ? 'text-gray-700 group-hover:text-gray-400' : 'text-gray-800'
                    }`}>
                      {onAddPlanned ? '+' : '–'}
                    </span>
                  </button>
                )}

                {/* Zelle mit Einträgen: kleiner + Button oben rechts */}
                {!isDragOver && entries.length > 0 && onAddPlanned && (
                  <button
                    onClick={() => setCreateForDay(iso)}
                    className="self-end text-gray-700 hover:text-gray-400 transition-colors leading-none"
                    title="Weitere Einheit planen"
                    style={{ fontSize: '10px' }}
                  >
                    +
                  </button>
                )}

                {entries.map(entry => (
                  <SessionBlock
                    key={entry.id}
                    entry={entry}
                    isDragging={draggingId === entry.id}
                    onDragStart={entry.session ? (e) => handleDragStart(e, entry.session!) : undefined}
                    onDragEnd={entry.session ? handleDragEnd : undefined}
                    onClick={entry.session ? () => {
                      if (!dragHappened.current) setSelectedSession(entry.session!);
                    } : undefined}
                  />
                ))}
              </div>
            );
          })}
        </div>

        {/* Legende */}
        <div className="flex flex-wrap gap-3 pt-1">
          <LegendItem color="#4ade80" solid label="Absolviert" />
          <LegendItem color="#60a5fa" dashed label="Geplant – tippen oder ziehen" />
          <LegendItem color="#fb923c" dashed label="Nachzutragen" />
        </div>
      </div>

      {/* Session Modal */}
      {selectedSession && (
        <SessionModal
          session={selectedSession}
          onClose={() => { setSelectedSession(null); setDropInitialTab('edit'); }}
          onConfirm={onConfirm}
          onUpdate={onUpdate}
          onDismiss={onDismiss}
          initialTab={dropInitialTab}
        />
      )}

      {/* Create Modal */}
      {createForDay && onAddPlanned && (
        <CreateSessionModal
          datum={createForDay}
          onClose={() => setCreateForDay(null)}
          onAdd={s => { onAddPlanned([s]); setCreateForDay(null); }}
        />
      )}
    </>
  );
}

// ─── Session Block ─────────────────────────────────────────────────────────────

function SessionBlock({
  entry, isDragging, onDragStart, onDragEnd, onClick,
}: {
  entry: DayEntry;
  isDragging?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  onClick?: () => void;
}) {
  const color     = TE_COLORS[entry.te as keyof typeof TE_COLORS] ?? '#6b7280';
  const emoji     = TE_EMOJI[entry.te as keyof typeof TE_EMOJI] ?? '💪';
  const short     = TE_SHORT[entry.te] ?? entry.te;
  const isDone    = entry.kind === 'done';
  const isOverdue = entry.kind === 'overdue';
  const draggable = !isDone && !!onDragStart;

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      onKeyDown={onClick ? e => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={`rounded-lg px-1 py-1 relative overflow-hidden transition-all select-none ${
        draggable ? 'cursor-grab active:cursor-grabbing' : onClick ? 'cursor-pointer' : ''
      } ${
        isDragging ? 'opacity-30 scale-95' : 'hover:brightness-110'
      } ${
        isDone       ? 'border-l-2'
        : isOverdue  ? 'border border-orange-600/60 bg-orange-900/20'
                     : 'border border-dashed'
      }`}
      style={
        isDone
          ? { borderLeftColor: color, backgroundColor: color + '22' }
          : !isOverdue
          ? { borderColor: color + '90', backgroundColor: color + '11' }
          : undefined
      }
    >
      <div className="text-center" style={{ fontSize: '13px', lineHeight: '1.2' }}>{emoji}</div>
      <div className="text-center font-semibold leading-tight truncate"
        style={{ fontSize: '8px', color: isDone ? color : isOverdue ? '#fb923c' : color }}>
        {short}
      </div>
      {entry.uhrzeit && !isDone && (
        <div className="text-center text-gray-500 leading-tight" style={{ fontSize: '8px' }}>
          {entry.uhrzeit}
        </div>
      )}
      {isDone && entry.dauer && (
        <div className="text-center text-gray-500 leading-tight" style={{ fontSize: '8px' }}>
          {entry.dauer}′
        </div>
      )}
    </div>
  );
}

// ─── Legende ──────────────────────────────────────────────────────────────────

function LegendItem({ color, solid, dashed, label }: {
  color: string; solid?: boolean; dashed?: boolean; label: string;
}) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-gray-500">
      <span className={`w-4 h-3 rounded inline-block shrink-0 ${dashed ? 'border border-dashed' : 'border-l-2'}`}
        style={solid || dashed
          ? { borderColor: color, backgroundColor: color + '22' }
          : { borderLeftColor: color, backgroundColor: color + '22' }
        } />
      {label}
    </span>
  );
}
