/**
 * Unified Athlete Calendar — Untis-style week view.
 * Shows team sessions, athlete availability and personal training entries
 * together in a single time-based week grid.
 */
import { useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw, Dumbbell } from 'lucide-react';
import {
  loadMySessions,
  submitAthleteOverride,
  clearAthleteOverride,
  submitAthleteRPE,
} from '../../lib/attendanceStorage';
import {
  getAvailabilityForSession,
  loadAvailabilityForSessions,
  saveAvailability,
  clearAvailability,
  type AthleteAvailabilityRecord,
  type AthleteAvailabilityStatus,
} from '../../lib/availability';
import { AvailabilityControls } from './AvailabilityControls';
import type { AttendanceSession, AttendanceOverrideStatus } from '../../types/attendance';
import type { Session as PersonalSession, PlannedSession } from '../../types/acwr';

const HOUR_PX = 52;
const START_H = 6;
const END_H = 23;
const TOTAL_H = END_H - START_H;

const TYPE_COLORS: Record<string, string> = {
  Training: '#7c3aed',
  Spiel: '#e11d48',
  Wettkampf: '#ea580c',
  'S&C': '#059669',
  Taktik: '#2563eb',
  Videoanalyse: '#0284c7',
  Regeneration: '#0d9488',
  Sonstiges: '#6b7280',
};

function isoToMonday(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const m = new Date(d);
  m.setDate(m.getDate() + diff);
  m.setHours(0, 0, 0, 0);
  return m;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
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

function availabilityToRsvp(record: AthleteAvailabilityRecord | null): 'yes' | 'late' | 'maybe' | 'no' {
  if (!record || record.status === 'expected') return 'yes';
  return record.status;
}

function toLegacyOverrideStatus(status: AthleteAvailabilityStatus): AttendanceOverrideStatus | null {
  if (status === 'expected') return null;
  return status;
}

interface TeamSessionRow extends AttendanceSession {
  rsvp: 'yes' | 'late' | 'maybe' | 'no';
  availability: AthleteAvailabilityRecord | null;
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

interface Props {
  userId: string;
  personalSessions?: PersonalSession[];
  plannedSessions?: PlannedSession[];
}

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
    return `${weekStart.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })} - ${end.toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  })();

  const reload = useCallback(async () => {
    setLoading(true);
    const raw = await loadMySessions(userId);
    const availabilityBySession = loadAvailabilityForSessions(raw.map(s => s.id), userId);
    setTeamSessions(raw.map(s => {
      const availability = availabilityBySession[s.id] ?? null;
      return { ...s, availability, rsvp: availabilityToRsvp(availability), rpe: null };
    }));
    setLoading(false);
  }, [userId]);

  useEffect(() => { reload(); }, [reload]);

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
      blocks.push({ kind: 'planned', datum: s.datum, startTime: start, endTime: endStr, title: s.te, durationMin: dur });
    }

    return blocks;
  }

  const personalBlocks = personalToBlocks().filter(b => weekISOs.has(b.datum));

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

  async function handleAvailability(session: TeamSessionRow, input: { status: AthleteAvailabilityStatus; reason?: string; lateMinutes?: number }) {
    if (saving === session.id) return;
    setSaving(session.id);

    const legacyStatus = toLegacyOverrideStatus(input.status);
    if (legacyStatus === null) {
      clearAvailability(session.id, userId);
      await clearAthleteOverride(session.id, userId);
    } else {
      saveAvailability({ sessionId: session.id, athleteUserId: userId, ...input });
      await submitAthleteOverride(session.id, userId, legacyStatus);
    }

    const availability = getAvailabilityForSession(session.id, userId);
    const rsvp = availabilityToRsvp(availability);
    setTeamSessions(prev => prev.map(s => s.id === session.id ? { ...s, availability, rsvp } : s));
    setOpenBlock(prev => {
      if (prev?.kind === 'team' && prev.session.id === session.id) {
        return { kind: 'team', session: { ...prev.session, availability, rsvp } };
      }
      return prev;
    });
    setSaving(null);
  }

  async function handleRPE(session: TeamSessionRow, rpe: number, duration: number) {
    const ok = await submitAthleteRPE(session.id, userId, rpe, duration);
    if (ok) setTeamSessions(prev => prev.map(s => s.id === session.id ? { ...s, rpe } : s));
  }

  const hourLabels = Array.from({ length: TOTAL_H }, (_, i) => START_H + i);

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-gray-800 bg-gray-900">
      <div className="flex flex-col gap-2 border-b border-gray-800 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <div className="flex items-center justify-between gap-2 sm:justify-start">
          <div className="flex items-center gap-1">
            <button onClick={() => setWeekStart(d => addDays(d, -7))} className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"><ChevronLeft size={16} /></button>
            <button onClick={() => setWeekStart(d => addDays(d, 7))} className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"><ChevronRight size={16} /></button>
          </div>
          <p className="text-sm font-semibold text-white sm:hidden">{weekLabel}</p>
        </div>
        <p className="hidden text-sm font-medium text-white sm:block">{weekLabel}</p>
        <div className="flex items-center justify-between gap-2 sm:justify-end">
          <button onClick={() => setWeekStart(isoToMonday(new Date()))} className="min-h-9 rounded-lg px-3 py-1 text-xs font-semibold text-violet-400 transition-colors hover:bg-gray-800 hover:text-violet-300">Heute</button>
          <button onClick={reload} className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-gray-800 hover:text-gray-400"><RefreshCw size={13} className={loading ? 'animate-spin' : ''} /></button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[720px]">
          <div className="grid border-b border-gray-800" style={{ gridTemplateColumns: '36px repeat(7, 1fr)' }}>
            <div />
            {weekDays.map((d, i) => {
              const iso = toISO(d);
              const isToday = iso === today;
              return (
                <div key={i} className={`border-l border-gray-800 py-2 text-center text-xs font-medium ${isToday ? 'text-violet-300' : 'text-gray-500'}`}>
                  <div>{d.toLocaleDateString('de-DE', { weekday: 'short' })}</div>
                  <div className={`mx-auto mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${isToday ? 'bg-violet-600 text-white' : 'text-gray-300'}`}>{d.getDate()}</div>
                </div>
              );
            })}
          </div>

          <div className="max-h-[62vh] overflow-y-auto sm:max-h-[500px]">
            <div className="relative grid select-none" style={{ gridTemplateColumns: '36px repeat(7, 1fr)', height: `${TOTAL_H * HOUR_PX}px` }}>
              {hourLabels.map(h => (
                <div key={h} className="contents">
                  <div className="pointer-events-none absolute left-0 w-[34px] pr-1.5 text-right text-[10px] text-gray-700" style={{ top: `${(h - START_H) * HOUR_PX - 6}px` }}>{h}:00</div>
                  <div className="pointer-events-none absolute left-9 right-0 border-t border-gray-800" style={{ top: `${(h - START_H) * HOUR_PX}px` }} />
                  <div className="pointer-events-none absolute left-9 right-0 border-t border-dashed border-gray-900" style={{ top: `${(h - START_H) * HOUR_PX + HOUR_PX / 2}px` }} />
                </div>
              ))}

              {weekDays.map((d, colIdx) => {
                const iso = toISO(d);
                const isToday = iso === today;
                const dayTeam = teamByDay.get(iso) ?? [];
                const dayPersonal = personalByDay.get(iso) ?? [];

                return (
                  <div key={iso} className={`relative border-l border-gray-800 ${isToday ? 'bg-violet-950/10' : ''}`} style={{ gridColumn: colIdx + 2, height: `${TOTAL_H * HOUR_PX}px` }}>
                    {isToday && (() => {
                      const now = new Date();
                      const mins = now.getHours() * 60 + now.getMinutes();
                      if (mins < START_H * 60 || mins > END_H * 60) return null;
                      return <div className="pointer-events-none absolute left-0 right-0 z-10 border-t-2 border-violet-500" style={{ top: `${minToPx(mins)}px` }}><div className="-ml-0.5 -mt-0.5 h-1.5 w-1.5 rounded-full bg-violet-500" /></div>;
                    })()}

                    {dayTeam.map(s => {
                      const startMin = s.startTime ? timeToMin(s.startTime) : START_H * 60 + 60;
                      const dur = durationMin(s);
                      const top = minToPx(startMin);
                      const height = Math.max(24, (dur / 60) * HOUR_PX);
                      const color = TYPE_COLORS[s.trainingType ?? ''] ?? '#6b7280';
                      const isPast = iso < today;
                      return (
                        <button key={s.id} onClick={() => setOpenBlock({ kind: 'team', session: s })} className={`absolute left-0.5 right-0.5 z-20 overflow-hidden rounded-md text-left transition-all hover:brightness-110 ${isPast ? 'opacity-60' : ''}`} style={{ top: `${top}px`, height: `${height}px`, backgroundColor: color + '22', borderLeft: `3px solid ${color}` }}>
                          <div className="flex h-full flex-col justify-start overflow-hidden px-1 py-0.5">
                            <p className="truncate text-[10px] font-semibold leading-tight" style={{ color }}>{s.title}</p>
                            {height >= 36 && <p className="text-[9px] leading-tight text-gray-400">{s.startTime}{s.endTime ? `-${s.endTime}` : ''}</p>}
                            {height >= 50 && s.rsvp !== 'yes' && (
                              <p className="text-[9px] leading-tight" style={{ color: s.rsvp === 'no' ? '#f87171' : '#fbbf24' }}>
                                {s.rsvp === 'no' ? 'Absage' : s.rsvp === 'late' ? `${s.availability?.lateMinutes ?? 0} Min. spaeter` : 'Unsicher'}
                              </p>
                            )}
                            {height >= 50 && isPast && s.rpe && <p className="text-[9px] leading-tight text-emerald-400">RPE {s.rpe}</p>}
                          </div>
                        </button>
                      );
                    })}

                    {dayPersonal.map((b, bi) => {
                      const startMin = timeToMin(b.startTime);
                      const endMin = timeToMin(b.endTime);
                      const top = minToPx(startMin);
                      const height = Math.max(20, ((endMin - startMin) / 60) * HOUR_PX);
                      return (
                        <button key={bi} onClick={() => setOpenBlock({ kind: 'personal', block: b })} className="absolute left-0.5 right-0.5 z-10 overflow-hidden rounded-md text-left opacity-70 transition-all hover:brightness-110" style={{ top: `${top}px`, height: `${height}px`, backgroundColor: '#1f2937', borderLeft: `3px solid ${b.kind === 'planned' ? '#4b5563' : '#374151'}` }}>
                          <div className="h-full overflow-hidden px-1 py-0.5">
                            <p className="truncate text-[10px] leading-tight text-gray-400">{b.title}</p>
                            {height >= 36 && b.rpe && <p className="text-[9px] text-gray-500">RPE {b.rpe}</p>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 border-t border-gray-800 px-4 py-2 text-[10px] text-gray-600">
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded bg-violet-500/30 border-l-2 border-violet-500" />Team</span>
        <span className="flex items-center gap-1"><Dumbbell size={10} />Eigenes Training</span>
        <span className="sm:hidden">Horizontal scroll</span>
      </div>

      {openBlock && <SessionOverlay block={openBlock} today={today} userId={userId} saving={saving} onAvailability={handleAvailability} onRPE={handleRPE} onClose={() => setOpenBlock(null)} />}
    </div>
  );
}

function SessionOverlay({ block, today, userId, saving, onAvailability, onRPE, onClose }: {
  block: CalBlock;
  today: string;
  userId: string;
  saving: string | null;
  onAvailability: (s: TeamSessionRow, input: { status: AthleteAvailabilityStatus; reason?: string; lateMinutes?: number }) => Promise<void> | void;
  onRPE: (s: TeamSessionRow, rpe: number, duration: number) => Promise<void> | void;
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
          {b.startTime && <p className="text-xs text-gray-400">{b.startTime}-{b.endTime}</p>}
          {b.rpe && <p className="text-xs">RPE: <span className="font-semibold text-violet-400">{b.rpe}</span></p>}
          {b.durationMin && <p className="text-xs">{b.durationMin} Min.</p>}
          <p className="pt-1 text-xs text-gray-600">{b.kind === 'planned' ? 'Geplante Einheit' : 'Persoenliches Training'}</p>
        </div>
      </Overlay>
    );
  }

  const s = block.session;
  const isPast = s.datum < today;
  const isSaving = saving === s.id;
  const dateLabel = new Date(s.datum + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
  const color = TYPE_COLORS[s.trainingType ?? ''] ?? '#6b7280';

  return (
    <Overlay onClose={onClose} title={s.title} color={color}>
      <div className="space-y-3">
        <div className="space-y-0.5 text-xs text-gray-400">
          <p>{dateLabel}</p>
          {s.startTime && <p>{s.startTime}{s.endTime ? `-${s.endTime}` : ''}</p>}
          {s.location && <p>{s.location}</p>}
        </div>
        {s.coachNote && <p className="rounded-xl bg-gray-800 px-3 py-2 text-xs italic text-gray-500">{s.coachNote}</p>}
        {s.trainingType && <span className="rounded-full bg-gray-800 px-2 py-0.5 text-[10px] text-gray-400">{s.trainingType}</span>}

        {!isPast && <AvailabilityControls sessionId={s.id} athleteUserId={userId} value={s.availability} saving={isSaving} onSubmit={input => onAvailability(s, input)} />}

        {isPast && (
          <div>
            {s.rpe ? (
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500">RPE eingetragen: <span className="font-semibold text-emerald-400">{s.rpe}</span></p>
                <button onClick={() => setShowRPEForm(true)} className="text-xs text-gray-600 transition-colors hover:text-gray-400">Aendern</button>
              </div>
            ) : (
              <button onClick={() => setShowRPEForm(true)} className="w-full rounded-xl border border-violet-800/50 bg-violet-900/30 py-2 text-xs font-medium text-violet-300 transition-colors hover:bg-violet-800/40">RPE eintragen</button>
            )}

            {showRPEForm && (
              <div className="mt-2 space-y-3 rounded-xl bg-gray-800 p-3">
                <div>
                  <p className="mb-1.5 text-xs text-gray-400">Belastungsempfinden (1-10): <span className="font-semibold text-white">{rpeValue}</span></p>
                  <input type="range" min={1} max={10} value={rpeValue} onChange={e => setRpeValue(+e.target.value)} className="w-full accent-violet-500" />
                  <div className="mt-0.5 flex justify-between text-[10px] text-gray-600"><span>1 Sehr leicht</span><span>10 Maximal</span></div>
                </div>
                <div>
                  <p className="mb-1 text-xs text-gray-400">Dauer (Min.): <span className="font-semibold text-white">{durValue}</span></p>
                  <input type="number" min={1} max={360} value={durValue} onChange={e => setDurValue(+e.target.value)} className="h-10 w-full rounded-lg border border-gray-700 bg-gray-900 px-2 text-sm text-white outline-none focus:border-violet-500" />
                </div>
                <div className="flex gap-2">
                  <button onClick={async () => { setSubmittingRPE(true); await onRPE(s, rpeValue, durValue); setSubmittingRPE(false); setShowRPEForm(false); }} disabled={submittingRPE} className="flex-1 rounded-xl bg-violet-600 py-2 text-xs font-medium text-white transition-colors hover:bg-violet-500 disabled:opacity-40">{submittingRPE ? 'Speichern...' : 'Speichern'}</button>
                  <button onClick={() => setShowRPEForm(false)} className="rounded-xl bg-gray-700 px-3 py-2 text-xs text-gray-300 transition-colors hover:bg-gray-600">Abbrechen</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Overlay>
  );
}

function Overlay({ title, color, onClose, children }: { title: string; color?: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[86vh] w-full flex-col rounded-t-2xl border border-gray-800 bg-gray-900 sm:max-w-md sm:rounded-2xl">
        <div className="flex flex-shrink-0 items-center justify-between border-b border-gray-800 px-4 pb-3 pt-4">
          <h2 className="truncate text-base font-semibold text-white" style={color ? { color } : undefined}>{title}</h2>
          <button onClick={onClose} className="ml-2 flex h-9 w-9 items-center justify-center rounded-lg text-xl leading-none text-gray-500 hover:bg-gray-800 hover:text-white">x</button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  );
}
