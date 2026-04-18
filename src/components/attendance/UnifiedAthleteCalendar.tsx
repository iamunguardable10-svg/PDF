/**
 * Unified Athlete Calendar — Untis-style week view.
 * Shows team sessions (with RSVP + RPE entry) and personal training entries
 * together in a single time-based week grid.
 */
import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw, Check, X, HelpCircle, Timer, Dumbbell } from 'lucide-react';
import {
  loadMySessions,
  submitAthleteOverride,
  clearAthleteOverride,
  submitAthleteRPE,
} from '../../lib/attendanceStorage';
import type { AttendanceSession } from '../../types/attendance';
import type { Session as PersonalSession, PlannedSession } from '../../types/acwr';

// ── Constants ─────────────────────────────────────────────────────────────────

const HOUR_PX  = 52;
const START_H  = 6;
const END_H    = 23;
const TOTAL_H  = END_H - START_H;

const TYPE_COLORS: Record<string, string> = {
  Training:     '#7c3aed',
  Spiel:        '#e11d48',
  Wettkampf:    '#ea580c',
  'S&C':        '#059669',
  Taktik:       '#2563eb',
  Videoanalyse: '#0284c7',
  Regeneration: '#0d9488',
  Sonstiges:    '#6b7280',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function isoToMonday(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const m = new Date(d);
  m.setDate(m.getDate() + diff);
  m.setHours(0, 0, 0, 0);
  return m;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function timeToMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

function minToPx(min: number): number {
  return ((min - START_H * 60) / 60) * HOUR_PX;
}

function durationMin(s: AttendanceSession): number {
  if (s.startTime && s.endTime) return timeToMin(s.endTime) - timeToMin(s.startTime);
  return 90;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type RSVP = 'yes' | 'late' | 'maybe' | 'no';

interface TeamSessionRow extends AttendanceSession {
  rsvp: RSVP;
  rpe?: number | null;
}

interface PersonalBlock {
  kind: 'personal' | 'planned';
  datum: string;
  startTime: string;
  endTime: string;
  title: string;
  rpe?: number;
  durationMin?: number;
}

type CalBlock = { kind: 'team'; session: TeamSessionRow } | { kind: 'personal'; block: PersonalBlock };

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  userId: string;
  personalSessions?: PersonalSession[];
  plannedSessions?: PlannedSession[];
}

// ── Component ─────────────────────────────────────────────────────────────────

export function UnifiedAthleteCalendar({ userId, personalSessions = [], plannedSessions = [] }: Props) {
  const [weekStart, setWeekStart] = useState(() => isoToMonday(new Date()));
  const [teamSessions, setTeamSessions] = useState<TeamSessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [openBlock, setOpenBlock] = useState<CalBlock | null>(null);

  const today = toISO(new Date());
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekISOs = new Set(weekDays.map(toISO));

  const weekLabel = (() => {
    const end = addDays(weekStart, 6);
    return `${weekStart.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  })();

  // ── Load team sessions ────────────────────────────────────────────────────

  const reload = useCallback(async () => {
    setLoading(true);
    const raw = await loadMySessions(userId);
    setTeamSessions(raw.map(s => ({ ...s, rsvp: 'yes' as RSVP, rpe: null })));
    setLoading(false);
  }, [userId]);

  useEffect(() => { reload(); }, [reload]);

  // ── Convert personal sessions to blocks ──────────────────────────────────

  function personalToBlocks(): PersonalBlock[] {
    const blocks: PersonalBlock[] = [];

    for (const s of personalSessions) {
      const dur = s.dauer ?? 60;
      blocks.push({
        kind: 'personal',
        datum: s.datum,
        startTime: '09:00',
        endTime: `${String(9 + Math.floor(dur / 60)).padStart(2, '0')}:${String(dur % 60).padStart(2, '0')}`,
        title: s.te,
        rpe: s.rpe ?? undefined,
        durationMin: dur,
      });
    }

    for (const s of plannedSessions) {
      if (s.confirmed) continue;
      const dur = s.geschaetzteDauer ?? 60;
      const start = s.uhrzeit ?? '09:00';
      const [sh, sm] = start.split(':').map(Number);
      const endMin = sh * 60 + sm + dur;
      const endStr = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
      blocks.push({
        kind: 'planned',
        datum: s.datum,
        startTime: start,
        endTime: endStr,
        title: s.te,
        durationMin: dur,
      });
    }

    return blocks;
  }

  const personalBlocks = personalToBlocks().filter(b => weekISOs.has(b.datum));

  // ── Build a map of blocks per day ─────────────────────────────────────────

  const teamByDay = new Map<string, TeamSessionRow[]>();
  for (const s of teamSessions.filter(s => weekISOs.has(s.datum))) {
    const list = teamByDay.get(s.datum) ?? [];
    list.push(s);
    teamByDay.set(s.datum, list);
  }

  const personalByDay = new Map<string, PersonalBlock[]>();
  for (const b of personalBlocks) {
    const list = personalByDay.get(b.datum) ?? [];
    list.push(b);
    personalByDay.set(b.datum, list);
  }

  // ── RSVP handler ──────────────────────────────────────────────────────────

  async function handleRSVP(session: TeamSessionRow, rsvp: RSVP) {
    if (saving === session.id) return;
    setSaving(session.id);
    if (rsvp === 'yes') await clearAthleteOverride(session.id, userId);
    else await submitAthleteOverride(session.id, userId, rsvp);
    setTeamSessions(prev => prev.map(s => s.id === session.id ? { ...s, rsvp } : s));
    setSaving(null);
    // Update open block if it's the same session
    setOpenBlock(prev => {
      if (prev?.kind === 'team' && prev.session.id === session.id) {
        return { kind: 'team', session: { ...prev.session, rsvp } };
      }
      return prev;
    });
  }

  // ── RPE handler ───────────────────────────────────────────────────────────

  async function handleRPE(session: TeamSessionRow, rpe: number, duration: number) {
    const ok = await submitAthleteRPE(session.id, userId, rpe, duration);
    if (ok) {
      setTeamSessions(prev => prev.map(s => s.id === session.id ? { ...s, rpe } : s));
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const hourLabels = Array.from({ length: TOTAL_H }, (_, i) => START_H + i);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden flex flex-col">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-1">
          <button onClick={() => setWeekStart(d => addDays(d, -7))}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => setWeekStart(d => addDays(d, 7))}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>
        <p className="text-sm font-medium text-white">{weekLabel}</p>
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekStart(isoToMonday(new Date()))}
            className="text-xs text-violet-400 hover:text-violet-300 px-2 py-1 rounded-lg hover:bg-gray-800 transition-colors">
            Heute
          </button>
          <button onClick={reload}
            className="p-1.5 rounded-lg text-gray-600 hover:text-gray-400 hover:bg-gray-800 transition-colors">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Day header */}
      <div className="grid border-b border-gray-800 flex-shrink-0"
        style={{ gridTemplateColumns: '36px repeat(7, 1fr)' }}>
        <div />
        {weekDays.map((d, i) => {
          const iso = toISO(d);
          const isToday = iso === today;
          return (
            <div key={i} className={`text-center py-2 text-xs font-medium border-l border-gray-800 ${isToday ? 'text-violet-300' : 'text-gray-500'}`}>
              <div>{d.toLocaleDateString('de-DE', { weekday: 'short' })}</div>
              <div className={`w-6 h-6 mx-auto mt-0.5 flex items-center justify-center rounded-full text-xs font-bold ${isToday ? 'bg-violet-600 text-white' : 'text-gray-300'}`}>
                {d.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Scrollable grid */}
      <div className="overflow-y-auto flex-1" style={{ maxHeight: 'min(500px, 60vh)' }}>
        <div className="relative grid select-none"
          style={{ gridTemplateColumns: '36px repeat(7, 1fr)', height: `${TOTAL_H * HOUR_PX}px` }}>

          {/* Hour labels + grid lines */}
          {hourLabels.map(h => (
            <div key={h} className="contents">
              <div className="text-right pr-1.5 text-[10px] text-gray-700 pointer-events-none"
                style={{ position: 'absolute', top: `${(h - START_H) * HOUR_PX - 6}px`, left: 0, width: 34 }}>
                {h}:00
              </div>
              <div className="pointer-events-none"
                style={{ position: 'absolute', left: 36, right: 0, top: `${(h - START_H) * HOUR_PX}px`, borderTop: '1px solid #1f2937' }} />
              <div className="pointer-events-none"
                style={{ position: 'absolute', left: 36, right: 0, top: `${(h - START_H) * HOUR_PX + HOUR_PX / 2}px`, borderTop: '1px dashed #111827' }} />
            </div>
          ))}

          {/* Day columns */}
          {weekDays.map((d, colIdx) => {
            const iso = toISO(d);
            const isToday = iso === today;
            const dayTeam     = teamByDay.get(iso) ?? [];
            const dayPersonal = personalByDay.get(iso) ?? [];

            return (
              <div key={iso}
                className={`relative border-l border-gray-800 ${isToday ? 'bg-violet-950/10' : ''}`}
                style={{ gridColumn: colIdx + 2, height: `${TOTAL_H * HOUR_PX}px` }}>

                {/* Today line */}
                {isToday && (() => {
                  const now = new Date();
                  const mins = now.getHours() * 60 + now.getMinutes();
                  if (mins < START_H * 60 || mins > END_H * 60) return null;
                  return (
                    <div className="absolute left-0 right-0 border-t-2 border-violet-500 z-10 pointer-events-none"
                      style={{ top: `${minToPx(mins)}px` }}>
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-500 -mt-0.5 -ml-0.5" />
                    </div>
                  );
                })()}

                {/* Team sessions */}
                {dayTeam.map(s => {
                  const startMin = s.startTime ? timeToMin(s.startTime) : START_H * 60 + 60;
                  const dur = durationMin(s);
                  const top    = minToPx(startMin);
                  const height = Math.max(24, (dur / 60) * HOUR_PX);
                  const color  = TYPE_COLORS[s.trainingType ?? ''] ?? '#6b7280';
                  const isPast = iso < today;

                  return (
                    <button key={s.id}
                      onClick={() => setOpenBlock({ kind: 'team', session: s })}
                      className={`absolute left-0.5 right-0.5 rounded-md overflow-hidden z-20 text-left hover:brightness-110 transition-all ${isPast ? 'opacity-60' : ''}`}
                      style={{
                        top: `${top}px`,
                        height: `${height}px`,
                        backgroundColor: color + '22',
                        borderLeft: `3px solid ${color}`,
                      }}
                    >
                      <div className="px-1 py-0.5 h-full flex flex-col justify-start overflow-hidden">
                        <p className="text-[10px] font-semibold truncate leading-tight" style={{ color }}>
                          {s.title}
                        </p>
                        {height >= 36 && (
                          <p className="text-[9px] text-gray-400 leading-tight">
                            {s.startTime}{s.endTime ? `–${s.endTime}` : ''}
                          </p>
                        )}
                        {height >= 50 && s.rsvp !== 'yes' && (
                          <p className="text-[9px] leading-tight" style={{ color: s.rsvp === 'no' ? '#f87171' : '#fbbf24' }}>
                            {s.rsvp === 'no' ? 'Absage' : s.rsvp === 'late' ? 'Verspätet' : 'Unsicher'}
                          </p>
                        )}
                        {height >= 50 && isPast && s.rpe && (
                          <p className="text-[9px] text-emerald-400 leading-tight">RPE {s.rpe}</p>
                        )}
                      </div>
                    </button>
                  );
                })}

                {/* Personal sessions */}
                {dayPersonal.map((b, bi) => {
                  const startMin = timeToMin(b.startTime);
                  const endMin   = timeToMin(b.endTime);
                  const top    = minToPx(startMin);
                  const height = Math.max(20, ((endMin - startMin) / 60) * HOUR_PX);

                  return (
                    <button key={bi}
                      onClick={() => setOpenBlock({ kind: 'personal', block: b })}
                      className="absolute left-0.5 right-0.5 rounded-md overflow-hidden z-10 text-left hover:brightness-110 transition-all opacity-70"
                      style={{
                        top: `${top}px`,
                        height: `${height}px`,
                        backgroundColor: '#1f2937',
                        borderLeft: `3px solid ${b.kind === 'planned' ? '#4b5563' : '#374151'}`,
                      }}
                    >
                      <div className="px-1 py-0.5 h-full overflow-hidden">
                        <p className="text-[10px] text-gray-400 truncate leading-tight">{b.title}</p>
                        {height >= 36 && b.rpe && (
                          <p className="text-[9px] text-gray-500">RPE {b.rpe}</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2 border-t border-gray-800 text-[10px] text-gray-600 flex-shrink-0">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-violet-500/30 border-l-2 border-violet-500 inline-block" />Team</span>
        <span className="flex items-center gap-1"><Dumbbell size={10} />Eigenes Training</span>
      </div>

      {/* Session detail overlay */}
      {openBlock && (
        <SessionOverlay
          block={openBlock}
          today={today}
          saving={saving}
          onRSVP={handleRSVP}
          onRPE={handleRPE}
          onClose={() => setOpenBlock(null)}
        />
      )}
    </div>
  );
}

// ── Session Detail Overlay ────────────────────────────────────────────────────

function SessionOverlay({
  block, today, saving, onRSVP, onRPE, onClose,
}: {
  block: CalBlock;
  today: string;
  saving: string | null;
  onRSVP: (s: TeamSessionRow, r: RSVP) => void;
  onRPE: (s: TeamSessionRow, rpe: number, duration: number) => void;
  onClose: () => void;
}) {
  const [rpeValue, setRpeValue] = useState(7);
  const [durValue, setDurValue] = useState(90);
  const [showRPEForm, setShowRPEForm] = useState(false);
  const [submittingRPE, setSubmittingRPE] = useState(false);

  if (block.kind === 'personal') {
    const b = block.block;
    return (
      <Overlay onClose={onClose} title={b.title}>
        <div className="space-y-2 text-sm text-gray-300">
          <p className="text-xs text-gray-500">{new Date(b.datum + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          {b.startTime && <p className="text-xs text-gray-400">{b.startTime}–{b.endTime}</p>}
          {b.rpe && <p className="text-xs">RPE: <span className="text-violet-400 font-semibold">{b.rpe}</span></p>}
          {b.durationMin && <p className="text-xs">{b.durationMin} Min.</p>}
          <p className="text-xs text-gray-600 pt-1">{b.kind === 'planned' ? 'Geplante Einheit' : 'Persönliches Training'}</p>
        </div>
      </Overlay>
    );
  }

  const s = block.session;
  const isPast = s.datum < today;
  const isSaving = saving === s.id;
  const dateLabel = new Date(s.datum + 'T12:00:00').toLocaleDateString('de-DE', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
  const color = TYPE_COLORS[s.trainingType ?? ''] ?? '#6b7280';

  return (
    <Overlay onClose={onClose} title={s.title} color={color}>
      <div className="space-y-3">
        <div className="text-xs text-gray-400 space-y-0.5">
          <p>{dateLabel}</p>
          {s.startTime && <p>{s.startTime}{s.endTime ? `–${s.endTime}` : ''}</p>}
          {s.location && <p>{s.location}</p>}
        </div>
        {s.coachNote && (
          <p className="text-xs text-gray-500 italic bg-gray-800 rounded-xl px-3 py-2">"{s.coachNote}"</p>
        )}
        {s.trainingType && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">{s.trainingType}</span>
        )}

        {/* RSVP — upcoming sessions */}
        {!isPast && (
          <div>
            <p className="text-[11px] text-gray-500 mb-1.5">Zusagen?</p>
            <div className="flex gap-1.5 flex-wrap">
              <RsvpBtn active={s.rsvp === 'yes'}   loading={isSaving} onClick={() => onRSVP(s, 'yes')}
                icon={<Check size={11} />}        label="Komme"      cls="bg-emerald-700/60 text-emerald-200 border-emerald-600/50" />
              <RsvpBtn active={s.rsvp === 'late'}  loading={isSaving} onClick={() => onRSVP(s, 'late')}
                icon={<Timer size={11} />}         label="Verspätet"  cls="bg-amber-700/60 text-amber-200 border-amber-600/50" />
              <RsvpBtn active={s.rsvp === 'maybe'} loading={isSaving} onClick={() => onRSVP(s, 'maybe')}
                icon={<HelpCircle size={11} />}    label="Unsicher"   cls="bg-gray-700/60 text-gray-200 border-gray-600/50" />
              <RsvpBtn active={s.rsvp === 'no'}    loading={isSaving} onClick={() => onRSVP(s, 'no')}
                icon={<X size={11} />}             label="Absage"     cls="bg-rose-700/60 text-rose-200 border-rose-600/50" />
            </div>
          </div>
        )}

        {/* RPE — past sessions */}
        {isPast && (
          <div>
            {s.rpe ? (
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500">RPE eingetragen: <span className="text-emerald-400 font-semibold">{s.rpe}</span></p>
                <button onClick={() => setShowRPEForm(true)} className="text-xs text-gray-600 hover:text-gray-400 transition-colors">Ändern</button>
              </div>
            ) : (
              <button onClick={() => setShowRPEForm(true)}
                className="w-full py-2 rounded-xl bg-violet-900/30 border border-violet-800/50 text-violet-300 text-xs font-medium hover:bg-violet-800/40 transition-colors">
                RPE eintragen
              </button>
            )}

            {showRPEForm && (
              <div className="mt-2 space-y-3 bg-gray-800 rounded-xl p-3">
                <div>
                  <p className="text-xs text-gray-400 mb-1.5">Belastungsempfinden (1–10): <span className="text-white font-semibold">{rpeValue}</span></p>
                  <input type="range" min={1} max={10} value={rpeValue} onChange={e => setRpeValue(+e.target.value)}
                    className="w-full accent-violet-500" />
                  <div className="flex justify-between text-[10px] text-gray-600 mt-0.5">
                    <span>1 Sehr leicht</span><span>10 Maximal</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Dauer (Min.): <span className="text-white font-semibold">{durValue}</span></p>
                  <input type="number" min={1} max={360} value={durValue} onChange={e => setDurValue(+e.target.value)}
                    className="w-full h-8 px-2 rounded-lg bg-gray-900 border border-gray-700 text-sm text-white outline-none focus:border-violet-500" />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      setSubmittingRPE(true);
                      await onRPE(s, rpeValue, durValue);
                      setSubmittingRPE(false);
                      setShowRPEForm(false);
                    }}
                    disabled={submittingRPE}
                    className="flex-1 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-xs rounded-xl font-medium transition-colors">
                    {submittingRPE ? 'Speichern…' : 'Speichern'}
                  </button>
                  <button onClick={() => setShowRPEForm(false)}
                    className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded-xl transition-colors">
                    Abbrechen
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Overlay>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Overlay({ title, color, onClose, children }: {
  title: string; color?: string; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-800 flex-shrink-0">
          <h2 className="text-base font-semibold text-white truncate" style={color ? { color } : undefined}>
            {title}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none ml-2">×</button>
        </div>
        <div className="overflow-y-auto flex-1 px-4 py-3">{children}</div>
      </div>
    </div>
  );
}

function RsvpBtn({ active, loading, onClick, icon, label, cls }: {
  active: boolean; loading: boolean; onClick: () => void;
  icon: React.ReactNode; label: string; cls: string;
}) {
  return (
    <button onClick={onClick} disabled={loading}
      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-[11px] font-medium transition-all disabled:opacity-50 ${
        active ? cls : 'bg-gray-800/60 border-gray-700/40 text-gray-500 hover:text-gray-300 hover:border-gray-600'
      }`}>
      {icon}{label}
    </button>
  );
}
