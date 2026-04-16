import { useState, useEffect, useCallback } from 'react';
import type { AttendanceTeam } from '../../types/attendance';
import type { DepartmentCalendarSession } from '../../types/organization';
import { loadSessionsByDepartment, loadFacilityInfoBulk } from '../../lib/attendanceStorage';

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  Training:     'bg-violet-900/50 text-violet-300',
  Spiel:        'bg-rose-900/50 text-rose-300',
  Wettkampf:    'bg-orange-900/50 text-orange-300',
  'S&C':        'bg-emerald-900/50 text-emerald-300',
  Taktik:       'bg-blue-900/50 text-blue-300',
  Videoanalyse: 'bg-sky-900/50 text-sky-300',
  Regeneration: 'bg-teal-900/50 text-teal-300',
  Sonstiges:    'bg-gray-800 text-gray-400',
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
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDayLabel(d: Date, todayISO: string): string {
  const iso = toISO(d);
  const prefix = iso === todayISO ? 'Heute — ' : '';
  return prefix + d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface FacilityInfo { facilityName: string; unitName: string }

interface Props {
  departmentId: string;
  departmentName?: string;
  /** All teams of this department — used for team-name lookup */
  teams: AttendanceTeam[];
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DepartmentCalendar({ departmentId, departmentName, teams }: Props) {
  const [weekStart, setWeekStart] = useState(() => isoToMonday(new Date()));
  const [sessions, setSessions]   = useState<DepartmentCalendarSession[]>([]);
  const [facilityMap, setFacilityMap] = useState<Record<string, FacilityInfo>>({});
  const [loading, setLoading]     = useState(false);

  const from = toISO(weekStart);
  const to   = toISO(addDays(weekStart, 6));

  const load = useCallback(async () => {
    setLoading(true);
    setSessions([]);
    setFacilityMap({});
    const ss = await loadSessionsByDepartment(departmentId, from, to);
    setSessions(ss);
    if (ss.length > 0) {
      const fm = await loadFacilityInfoBulk(ss.map(s => s.id));
      setFacilityMap(fm);
    }
    setLoading(false);
  }, [departmentId, from, to]);

  useEffect(() => { load(); }, [load]);

  // ── Derived ─────────────────────────────────────────────────────────────────

  const teamById = Object.fromEntries(teams.map(t => [t.id, t]));
  const todayISO = toISO(new Date());
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const weekLabel = (() => {
    const end = addDays(weekStart, 6);
    const ms  = weekStart.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
    const me  = end.toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${ms} – ${me}`;
  })();

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      {/* Header */}
      {departmentName && (
        <p className="text-xs text-gray-500">
          Abteilung: <span className="text-gray-300">{departmentName}</span>
        </p>
      )}

      {/* Week navigation */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setWeekStart(d => addDays(d, -7))}
          className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors text-base leading-none">
          ‹
        </button>
        <button
          onClick={() => setWeekStart(isoToMonday(new Date()))}
          className="px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors text-xs">
          Heute
        </button>
        <button
          onClick={() => setWeekStart(d => addDays(d, 7))}
          className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors text-base leading-none">
          ›
        </button>
        <span className="text-sm text-gray-300 font-medium flex-1 text-center">{weekLabel}</span>
        {loading && (
          <span className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
        )}
      </div>

      {/* Agenda list — one group per day */}
      {weekDays.map(day => {
        const iso = toISO(day);
        const daySessions = sessions.filter(s => s.datum === iso);
        if (daySessions.length === 0) return null;
        const isToday = iso === todayISO;

        return (
          <div key={iso}>
            {/* Day header */}
            <p className={`text-xs font-medium px-1 mb-1.5 ${isToday ? 'text-violet-400' : 'text-gray-500'}`}>
              {formatDayLabel(day, todayISO)}
            </p>

            {/* Session cards */}
            <div className="space-y-1.5">
              {daySessions.map(s => {
                const team     = s.teamId ? (teamById[s.teamId] ?? null) : null;
                const facility = facilityMap[s.id] ?? null;
                const typeColor = TYPE_COLORS[s.trainingType] ?? TYPE_COLORS['Sonstiges'];

                return (
                  <div key={s.id}
                    className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 space-y-1.5">

                    {/* Title row */}
                    <div className="flex items-start gap-2">
                      {/* Time range — uses starts_at-derived values, falls back to legacy */}
                      <span className="text-xs text-gray-500 tabular-nums flex-shrink-0 pt-0.5 w-[5rem]">
                        {s.startTime ?? '??:??'}
                        {s.endTime ? `–${s.endTime}` : ''}
                      </span>
                      <span className="text-sm text-white font-medium flex-1 leading-snug">
                        {s.title}
                      </span>
                      {s.trainingType && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 leading-none ${typeColor}`}>
                          {s.trainingType}
                        </span>
                      )}
                    </div>

                    {/* Meta row: team name · facility · location fallback */}
                    {(team || facility || s.location) && (
                      <div className="flex items-center gap-3 flex-wrap text-xs text-gray-500 pl-[5rem]">
                        {team && (
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-violet-500 flex-shrink-0" />
                            {team.name}
                          </span>
                        )}
                        {facility ? (
                          <span className="flex items-center gap-1 text-teal-500">
                            <span className="text-[10px]">⬡</span>
                            {facility.facilityName
                              ? `${facility.facilityName} · ${facility.unitName}`
                              : facility.unitName}
                          </span>
                        ) : s.location ? (
                          // Old location field fallback — kept intentionally
                          <span>{s.location}</span>
                        ) : null}
                      </div>
                    )}

                    {/* Coach note — shown when set */}
                    {s.coachNote && (
                      <p className="text-xs text-gray-600 italic pl-[5rem] leading-snug">
                        {s.coachNote}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Empty state */}
      {!loading && sessions.length === 0 && (
        <div className="text-center py-10 space-y-1">
          <p className="text-gray-600 text-sm">Keine Einheiten in dieser Woche</p>
          <p className="text-gray-700 text-xs">
            Einheiten müssen <code className="text-gray-600">department_id</code> und{' '}
            <code className="text-gray-600">starts_at</code> gesetzt haben
          </p>
        </div>
      )}
    </div>
  );
}
