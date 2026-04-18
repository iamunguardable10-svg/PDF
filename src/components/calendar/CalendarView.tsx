/**
 * CalendarView — unified time-grid for coach screens.
 * Accepts CalEvent[] and renders a week-based time grid.
 * Used for team, department, and any session-based context.
 *
 * For facility booking/blackout views, FacilityCalendar handles
 * the specialised agenda-list rendering with conflict detection.
 */
import { useState, useEffect, useRef } from 'react';
import type { CalEvent } from '../../types/calEvent';

// ── Constants ─────────────────────────────────────────────────────────────────

const HOUR_PX = 56;
const START_H = 6;
const END_H   = 23;
const TOTAL_H = END_H - START_H;

// ── Helpers ───────────────────────────────────────────────────────────────────

function isoToMonday(d: Date): Date {
  const day  = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const m    = new Date(d);
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

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

function minutesToPx(minutes: number): number {
  return ((minutes - START_H * 60) / 60) * HOUR_PX;
}

function pxToMinutes(px: number): number {
  return Math.round(((px / HOUR_PX) * 60 + START_H * 60) / 15) * 15;
}

function minutesToTime(m: number): string {
  const clamped = Math.max(START_H * 60, Math.min((END_H - 1) * 60, m));
  return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`;
}

function eventTopPx(ev: CalEvent): number {
  return minutesToPx(timeToMinutes(ev.startTime));
}

function eventHeightPx(ev: CalEvent): number {
  const dur = Math.max(30, timeToMinutes(ev.endTime) - timeToMinutes(ev.startTime));
  return (dur / 60) * HOUR_PX;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  events: CalEvent[];
  loading?: boolean;
  onEventClick?: (ev: CalEvent) => void;
  onAddEvent?:   (datum: string, time: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CalendarView({ events, loading, onEventClick, onAddEvent }: Props) {
  const [weekStart, setWeekStart] = useState(() => isoToMonday(new Date()));
  const scrollRef = useRef<HTMLDivElement>(null);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const todayISO = toISO(new Date());

  const weekLabel = (() => {
    const end = addDays(weekStart, 6);
    const ms  = weekStart.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
    const me  = end.toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${ms} – ${me}`;
  })();

  // Auto-scroll to earliest event or 08:00
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const weekISOs = new Set(weekDays.map(toISO));
    const weekEvents = events.filter(e => weekISOs.has(e.datum) && e.startTime);
    const earliest = weekEvents.reduce<number | null>((min, e) => {
      const m = timeToMinutes(e.startTime);
      return min === null || m < min ? m : min;
    }, null);
    el.scrollTop = minutesToPx(earliest != null ? Math.max(START_H * 60, earliest - 30) : 8 * 60);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  // Group events by day
  const byDay = new Map<string, CalEvent[]>();
  for (const ev of events) {
    const list = byDay.get(ev.datum) ?? [];
    list.push(ev);
    byDay.set(ev.datum, list);
  }

  function handleColumnClick(e: React.MouseEvent, iso: string) {
    if (!onAddEvent) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const mins = pxToMinutes(e.clientY - rect.top);
    onAddEvent(iso, minutesToTime(mins));
  }

  const hourLabels = Array.from({ length: TOTAL_H }, (_, i) => START_H + i);

  // Collect unique teams for legend
  const teamLegend = (() => {
    const seen = new Map<string, string>();
    for (const ev of events) {
      if (ev.teamId && ev.teamName && ev.bgColor) {
        if (!seen.has(ev.teamId)) seen.set(ev.teamId, ev.teamName);
      }
    }
    return [...seen.entries()];
  })();

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden flex flex-col">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setWeekStart(d => addDays(d, -7))}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors text-lg"
          >‹</button>
          <button
            onClick={() => setWeekStart(d => addDays(d, 7))}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors text-lg"
          >›</button>
        </div>
        <div className="flex items-center gap-2">
          {loading && (
            <span className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          )}
          <p className="text-sm font-medium text-white">{weekLabel}</p>
        </div>
        <button
          onClick={() => setWeekStart(isoToMonday(new Date()))}
          className="text-xs text-violet-400 hover:text-violet-300 px-2 py-1 rounded-lg hover:bg-gray-800 transition-colors"
        >
          Heute
        </button>
      </div>

      {/* Day header row */}
      <div
        className="grid border-b border-gray-800 flex-shrink-0"
        style={{ gridTemplateColumns: '40px repeat(7, 1fr)' }}
      >
        <div />
        {weekDays.map((d, i) => {
          const iso     = toISO(d);
          const isToday = iso === todayISO;
          return (
            <div
              key={i}
              className={`text-center py-2 text-xs font-medium border-l border-gray-800 ${isToday ? 'text-violet-300' : 'text-gray-500'}`}
            >
              <div>{d.toLocaleDateString('de-DE', { weekday: 'short' })}</div>
              <div className={`w-6 h-6 mx-auto mt-0.5 flex items-center justify-center rounded-full text-xs font-bold ${
                isToday ? 'bg-violet-600 text-white' : 'text-gray-300'
              }`}>{d.getDate()}</div>
            </div>
          );
        })}
      </div>

      {/* Scrollable time-grid */}
      <div ref={scrollRef} className="overflow-y-auto flex-1" style={{ maxHeight: 'min(520px, 60vh)' }}>
        <div
          className="relative grid select-none"
          style={{ gridTemplateColumns: '40px repeat(7, 1fr)', height: `${TOTAL_H * HOUR_PX}px` }}
        >
          {/* Hour labels + grid lines */}
          {hourLabels.map(h => (
            <div key={h} className="contents">
              <div
                className="text-right pr-2 text-xs text-gray-600 leading-none pointer-events-none"
                style={{ position: 'absolute', top: `${(h - START_H) * HOUR_PX - 6}px`, left: 0, width: 36 }}
              >
                {h}:00
              </div>
              <div
                className="pointer-events-none"
                style={{ position: 'absolute', left: 40, right: 0, top: `${(h - START_H) * HOUR_PX}px`, borderTop: h === START_H ? 'none' : '1px solid #1f2937' }}
              />
              <div
                className="pointer-events-none"
                style={{ position: 'absolute', left: 40, right: 0, top: `${(h - START_H) * HOUR_PX + HOUR_PX / 2}px`, borderTop: '1px dashed #111827' }}
              />
            </div>
          ))}

          {/* Day columns */}
          {weekDays.map((d, colIdx) => {
            const iso      = toISO(d);
            const isToday  = iso === todayISO;
            const dayEvs   = byDay.get(iso) ?? [];

            return (
              <div
                key={iso}
                className={`relative border-l border-gray-800 ${onAddEvent ? 'cursor-crosshair' : ''} ${isToday ? 'bg-violet-950/10' : ''}`}
                style={{ gridColumn: colIdx + 2, gridRow: '1', height: `${TOTAL_H * HOUR_PX}px` }}
                onClick={e => handleColumnClick(e, iso)}
              >
                {/* Current time indicator */}
                {isToday && (() => {
                  const now  = new Date();
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

                {/* Event blocks */}
                {dayEvs.map(ev => {
                  const top    = eventTopPx(ev);
                  const height = eventHeightPx(ev);
                  return (
                    <div
                      key={ev.id}
                      className="absolute left-1 right-1 rounded-lg overflow-hidden z-20 cursor-pointer hover:brightness-110 transition-all"
                      style={{
                        top:             `${top}px`,
                        height:          `${Math.max(20, height)}px`,
                        backgroundColor: ev.bgColor ?? (ev.color + '22'),
                        borderLeft:      `3px solid ${ev.color}`,
                      }}
                      onClick={e => { e.stopPropagation(); onEventClick?.(ev); }}
                    >
                      <div className="px-1 py-0.5 h-full flex flex-col justify-start overflow-hidden">
                        <p
                          className="text-[10px] sm:text-xs font-semibold leading-tight truncate"
                          style={{ color: ev.color }}
                        >
                          {ev.title}
                        </p>
                        {height >= 36 && (
                          <p className="text-[9px] sm:text-[10px] text-gray-400 leading-tight truncate">
                            {ev.startTime}–{ev.endTime}
                          </p>
                        )}
                        {height >= 52 && ev.teamName && (
                          <p className="text-[9px] leading-tight truncate text-gray-500">
                            {ev.teamName}
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
      {teamLegend.length > 1 && (
        <div className="flex flex-wrap gap-3 px-4 py-2.5 border-t border-gray-800 flex-shrink-0">
          {teamLegend.map(([, name]) => {
            const ev = events.find(e => e.teamName === name);
            return (
              <div key={name} className="flex items-center gap-1.5 text-xs text-gray-400">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: ev?.bgColor?.slice(0, 7) ?? '#7c3aed' }} />
                {name}
              </div>
            );
          })}
          {onAddEvent && (
            <p className="text-xs text-gray-600 ml-auto">Klick zum Erstellen</p>
          )}
        </div>
      )}
    </div>
  );
}
