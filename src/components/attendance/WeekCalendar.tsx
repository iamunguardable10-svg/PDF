import { useState, useRef, useCallback, useEffect } from 'react';
import type { AttendanceSession, AttendanceTeam } from '../../types/attendance';
import { updateSession } from '../../lib/attendanceStorage';

// ── Constants ─────────────────────────────────────────────────────────────────

const HOUR_PX  = 64;   // px per hour
const START_H  = 6;    // 06:00
const END_H    = 23;   // 23:00
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

const TEAM_BG_COLORS = [
  '#7c3aed', '#0284c7', '#059669', '#e11d48', '#d97706',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function isoToMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toISO(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

function minutesToTime(m: number): string {
  const clamped = Math.max(START_H * 60, Math.min((END_H - 1) * 60, m));
  return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`;
}

function minutesToPx(minutes: number): number {
  return ((minutes - START_H * 60) / 60) * HOUR_PX;
}

function pxToMinutes(px: number): number {
  return Math.round(((px / HOUR_PX) * 60 + START_H * 60) / 15) * 15;
}

function sessionTopPx(session: AttendanceSession): number {
  const start = session.startTime ? timeToMinutes(session.startTime) : START_H * 60 + 60;
  return minutesToPx(start);
}

function sessionHeightPx(session: AttendanceSession): number {
  const start = session.startTime ? timeToMinutes(session.startTime) : START_H * 60 + 60;
  const end   = session.endTime   ? timeToMinutes(session.endTime)   : start + 90;
  const dur   = Math.max(30, end - start);
  return (dur / 60) * HOUR_PX;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  sessions: AttendanceSession[];
  teams: AttendanceTeam[];
  isMock?: boolean;
  onSessionClick: (s: AttendanceSession) => void;
  onAddSession: (datum: string, time?: string) => void;
  onSessionsChanged: () => void;
}

interface DragState {
  sessionId: string;
  startY: number;
  origStartMin: number;
  origEndMin: number;
  currentOffsetPx: number;
}

// ── Team color lookup ──────────────────────────────────────────────────────────

function teamColor(team: AttendanceTeam | undefined, teams: AttendanceTeam[]): string {
  if (!team) return TEAM_BG_COLORS[0];
  const idx = teams.findIndex(t => t.id === team.id);
  return TEAM_BG_COLORS[idx % TEAM_BG_COLORS.length];
}

// ── Component ─────────────────────────────────────────────────────────────────

export function WeekCalendar({ sessions, teams, isMock, onSessionClick, onAddSession, onSessionsChanged }: Props) {
  const [weekStart, setWeekStart] = useState(() => isoToMonday(new Date()));
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [dragOffsets, setDragOffsets] = useState<Record<string, number>>({});
  const gridRef = useRef<HTMLDivElement>(null);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const todayISO = toISO(new Date());

  function prevWeek() { setWeekStart(d => addDays(d, -7)); }
  function nextWeek() { setWeekStart(d => addDays(d, 7)); }
  function goToday()  { setWeekStart(isoToMonday(new Date())); }

  const weekLabel = (() => {
    const end = addDays(weekStart, 6);
    const ms = weekStart.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
    const me = end.toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${ms} – ${me}`;
  })();

  // sessions grouped by day
  const byDay = new Map<string, AttendanceSession[]>();
  for (const s of sessions) {
    const list = byDay.get(s.datum) ?? [];
    list.push(s);
    byDay.set(s.datum, list);
  }

  // ── Drag handlers ──────────────────────────────────────────────────────────

  const onPointerDown = useCallback((e: React.PointerEvent, session: AttendanceSession) => {
    if (isMock) return;
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const startMin = session.startTime ? timeToMinutes(session.startTime) : START_H * 60 + 60;
    const endMin   = session.endTime   ? timeToMinutes(session.endTime)   : startMin + 90;
    setDragging({ sessionId: session.id, startY: e.clientY, origStartMin: startMin, origEndMin: endMin, currentOffsetPx: 0 });
    setDragOffsets({ [session.id]: 0 });
  }, [isMock]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    const dy = e.clientY - dragging.startY;
    const snapped = Math.round(dy / (HOUR_PX / 4)) * (HOUR_PX / 4); // snap to 15min
    setDragging(prev => prev ? { ...prev, currentOffsetPx: snapped } : prev);
    setDragOffsets({ [dragging.sessionId]: snapped });
  }, [dragging]);

  const onPointerUp = useCallback(async (e: React.PointerEvent) => {
    if (!dragging) return;
    const dy = e.clientY - dragging.startY;
    const deltaMin = Math.round((dy / HOUR_PX) * 60 / 15) * 15;
    const newStartMin = dragging.origStartMin + deltaMin;
    const newEndMin   = dragging.origEndMin   + deltaMin;
    setDragging(null);
    setDragOffsets({});
    if (deltaMin !== 0 && !isMock) {
      await updateSession(dragging.sessionId, {
        startTime: minutesToTime(newStartMin),
        endTime:   minutesToTime(newEndMin),
      });
      onSessionsChanged();
    }
  }, [dragging, isMock, onSessionsChanged]);

  // Cancel drag on pointer up outside
  useEffect(() => {
    function cancel() { setDragging(null); setDragOffsets({}); }
    window.addEventListener('pointercancel', cancel);
    return () => window.removeEventListener('pointercancel', cancel);
  }, []);

  // ── Hour labels ────────────────────────────────────────────────────────────

  const hourLabels = Array.from({ length: TOTAL_H }, (_, i) => START_H + i);

  // ── Click on day column to add session ─────────────────────────────────────

  function handleColumnClick(e: React.MouseEvent, iso: string) {
    if (dragging) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const relY  = e.clientY - rect.top;
    const mins  = pxToMinutes(relY);
    const time  = minutesToTime(mins);
    onAddSession(iso, time);
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-1">
          <button onClick={prevWeek} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors text-lg">‹</button>
          <button onClick={nextWeek} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors text-lg">›</button>
        </div>
        <p className="text-sm font-medium text-white">{weekLabel}</p>
        <button onClick={goToday} className="text-xs text-violet-400 hover:text-violet-300 px-2 py-1 rounded-lg hover:bg-gray-800 transition-colors">
          Heute
        </button>
      </div>

      {/* Day header row */}
      <div className="grid border-b border-gray-800 flex-shrink-0" style={{ gridTemplateColumns: '40px repeat(7, 1fr)' }}>
        <div /> {/* hour label spacer */}
        {weekDays.map((d, i) => {
          const iso = toISO(d);
          const isToday = iso === todayISO;
          const dayName = d.toLocaleDateString('de-DE', { weekday: 'short' });
          const dayNum  = d.getDate();
          return (
            <div key={i} className={`text-center py-2 text-xs font-medium border-l border-gray-800 ${isToday ? 'text-violet-300' : 'text-gray-500'}`}>
              <div>{dayName}</div>
              <div className={`w-6 h-6 mx-auto mt-0.5 flex items-center justify-center rounded-full text-xs font-bold ${
                isToday ? 'bg-violet-600 text-white' : 'text-gray-300'
              }`}>{dayNum}</div>
            </div>
          );
        })}
      </div>

      {/* Scrollable grid */}
      <div className="overflow-y-auto flex-1" style={{ maxHeight: '520px' }}>
        <div
          ref={gridRef}
          className="relative grid select-none"
          style={{ gridTemplateColumns: '40px repeat(7, 1fr)', height: `${TOTAL_H * HOUR_PX}px` }}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          {/* Hour labels + horizontal grid lines */}
          {hourLabels.map(h => (
            <div key={h} className="contents">
              <div
                className="text-right pr-2 text-xs text-gray-600 leading-none flex-shrink-0 pointer-events-none"
                style={{ position: 'absolute', top: `${(h - START_H) * HOUR_PX - 6}px`, left: 0, width: 36 }}
              >
                {h}:00
              </div>
              {/* horizontal line across all 7 columns */}
              <div
                className="pointer-events-none"
                style={{
                  position: 'absolute', left: 40, right: 0,
                  top: `${(h - START_H) * HOUR_PX}px`,
                  borderTop: h === START_H ? 'none' : '1px solid #1f2937',
                }}
              />
              {/* half-hour line */}
              <div
                className="pointer-events-none"
                style={{
                  position: 'absolute', left: 40, right: 0,
                  top: `${(h - START_H) * HOUR_PX + HOUR_PX / 2}px`,
                  borderTop: '1px dashed #111827',
                }}
              />
            </div>
          ))}

          {/* Day columns */}
          {weekDays.map((d, colIdx) => {
            const iso     = toISO(d);
            const isToday = iso === todayISO;
            const daySessions = byDay.get(iso) ?? [];

            return (
              <div
                key={iso}
                className={`relative border-l border-gray-800 cursor-crosshair ${isToday ? 'bg-violet-950/10' : ''}`}
                style={{ gridColumn: colIdx + 2, gridRow: '1', height: `${TOTAL_H * HOUR_PX}px` }}
                onClick={e => handleColumnClick(e, iso)}
              >
                {/* Today line */}
                {isToday && (() => {
                  const now = new Date();
                  const mins = now.getHours() * 60 + now.getMinutes();
                  if (mins < START_H * 60 || mins > END_H * 60) return null;
                  return (
                    <div
                      className="absolute left-0 right-0 border-t-2 border-violet-500 z-10 pointer-events-none"
                      style={{ top: `${minutesToPx(mins)}px` }}
                    >
                      <div className="w-2 h-2 rounded-full bg-violet-500 -mt-1 -ml-1" />
                    </div>
                  );
                })()}

                {/* Sessions */}
                {daySessions.map(s => {
                  const team      = teams.find(t => t.id === s.teamId);
                  const color     = teamColor(team, teams);
                  const typeColor = TYPE_COLORS[s.trainingType ?? ''] ?? '#6b7280';
                  const top    = sessionTopPx(s) + (dragOffsets[s.id] ?? 0);
                  const height = sessionHeightPx(s);
                  const isDragging = dragging?.sessionId === s.id;

                  return (
                    <div
                      key={s.id}
                      className={`absolute left-1 right-1 rounded-lg overflow-hidden cursor-grab active:cursor-grabbing z-20 transition-shadow ${
                        isDragging ? 'shadow-2xl shadow-black/60 opacity-90 ring-2 ring-violet-400' : 'hover:brightness-110'
                      }`}
                      style={{ top: `${top}px`, height: `${Math.max(24, height)}px`, backgroundColor: color + '22', borderLeft: `3px solid ${typeColor}` }}
                      onPointerDown={e => onPointerDown(e, s)}
                      onClick={e => {
                        e.stopPropagation();
                        if (!isDragging) onSessionClick(s);
                      }}
                    >
                      <div className="px-1.5 py-1 h-full flex flex-col justify-start overflow-hidden">
                        <p className="text-xs font-semibold leading-tight truncate" style={{ color: typeColor }}>
                          {s.title}
                        </p>
                        {height >= 40 && (
                          <p className="text-xs text-gray-400 leading-tight truncate">
                            {s.startTime}{s.endTime ? `–${s.endTime}` : ''}
                          </p>
                        )}
                        {height >= 56 && team && (
                          <p className="text-xs leading-tight truncate" style={{ color: color }}>
                            {team.name}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      {teams.length > 0 && (
        <div className="flex flex-wrap gap-3 px-4 py-2.5 border-t border-gray-800 flex-shrink-0">
          {teams.map((t, i) => (
            <div key={t.id} className="flex items-center gap-1.5 text-xs text-gray-400">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: TEAM_BG_COLORS[i % TEAM_BG_COLORS.length] }} />
              {t.name}
            </div>
          ))}
          {!isMock && (
            <p className="text-xs text-gray-600 ml-auto">Einheit ziehen zum Verschieben</p>
          )}
        </div>
      )}
    </div>
  );
}
