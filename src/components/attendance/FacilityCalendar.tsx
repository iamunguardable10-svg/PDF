import { useState, useEffect, useCallback } from 'react';
import type { AttendanceTeam } from '../../types/attendance';
import {
  loadFacilitiesWithUnits,
  loadBookingsByFacility,
} from '../../lib/organizationStorage';
import type { FacilityWithUnits, FacilityBookingEntry } from '../../lib/organizationStorage';

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
  return prefix + d.toLocaleDateString('de-DE', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  organizationId: string;
  /** All teams of this org — used for team-name lookup */
  teams: AttendanceTeam[];
}

// ── Component ─────────────────────────────────────────────────────────────────

export function FacilityCalendar({ organizationId, teams }: Props) {
  const [facilities,      setFacilities]      = useState<FacilityWithUnits[]>([]);
  const [selectedUnitId,  setSelectedUnitId]  = useState<string>('');
  const [weekStart,       setWeekStart]        = useState(() => isoToMonday(new Date()));
  const [bookings,        setBookings]         = useState<FacilityBookingEntry[]>([]);
  const [loadingFacs,     setLoadingFacs]      = useState(true);
  const [loadingBookings, setLoadingBookings]  = useState(false);

  // ── Load facilities once on mount ──────────────────────────────────────────
  useEffect(() => {
    setLoadingFacs(true);
    loadFacilitiesWithUnits(organizationId).then(facs => {
      setFacilities(facs);
      // Auto-select the first unit so the calendar isn't blank by default
      const firstUnit = facs[0]?.units[0]?.id ?? '';
      setSelectedUnitId(firstUnit);
      setLoadingFacs(false);
    });
  }, [organizationId]);

  // ── Load bookings when unit or week changes ────────────────────────────────
  const from = toISO(weekStart);
  const to   = toISO(addDays(weekStart, 6));

  const loadBookings = useCallback(async () => {
    if (!selectedUnitId) { setBookings([]); return; }
    setLoadingBookings(true);
    const bs = await loadBookingsByFacility(selectedUnitId, from, to);
    setBookings(bs);
    setLoadingBookings(false);
  }, [selectedUnitId, from, to]);

  useEffect(() => { loadBookings(); }, [loadBookings]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const teamById  = Object.fromEntries(teams.map(t => [t.id, t]));
  const todayISO  = toISO(new Date());
  const weekDays  = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Selected unit & facility metadata for the header
  let selectedUnitName  = '';
  let selectedFacName   = '';
  let selectedCapacity: number | null = null;
  for (const fac of facilities) {
    for (const u of fac.units) {
      if (u.id === selectedUnitId) {
        selectedUnitName  = u.name;
        selectedFacName   = fac.name;
        selectedCapacity  = u.capacity;
      }
    }
  }

  const weekLabel = (() => {
    const end = addDays(weekStart, 6);
    const ms  = weekStart.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
    const me  = end.toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${ms} – ${me}`;
  })();

  const isLoading = loadingFacs || loadingBookings;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">

      {/* Facility / Unit picker */}
      {loadingFacs ? (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="w-3.5 h-3.5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          Hallen werden geladen…
        </div>
      ) : facilities.length === 0 ? (
        <p className="text-xs text-gray-600">
          Keine Facilities in dieser Organisation gefunden.
          Prüfe, ob <code>organization_id</code> auf den Teams gesetzt ist.
        </p>
      ) : (
        <div className="space-y-2">
          <label className="text-xs text-gray-400">Halle / Platz auswählen</label>
          <select
            value={selectedUnitId}
            onChange={e => setSelectedUnitId(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-violet-500">
            <option value="">— Bitte wählen —</option>
            {facilities.map(f => (
              <optgroup key={f.id} label={f.name + (f.address ? ` · ${f.address}` : '')}>
                {f.units.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name}{u.capacity != null ? ` (max. ${u.capacity})` : ''}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      )}

      {/* Unit info pill */}
      {selectedUnitId && selectedUnitName && (
        <div className="flex items-center gap-2 text-xs text-teal-400">
          <span className="text-[11px]">⬡</span>
          <span className="font-medium">{selectedFacName}</span>
          <span className="text-gray-600">·</span>
          <span>{selectedUnitName}</span>
          {selectedCapacity != null && (
            <span className="text-gray-600">· max. {selectedCapacity} Plätze</span>
          )}
        </div>
      )}

      {/* Week navigation */}
      {selectedUnitId && (
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
          {isLoading && (
            <span className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
          )}
        </div>
      )}

      {/* Agenda list */}
      {selectedUnitId && weekDays.map(day => {
        const iso = toISO(day);
        const dayBookings = bookings.filter(b => b.datum === iso);
        if (dayBookings.length === 0) return null;
        const isToday = iso === todayISO;

        return (
          <div key={iso}>
            {/* Day header */}
            <p className={`text-xs font-medium px-1 mb-1.5 ${isToday ? 'text-violet-400' : 'text-gray-500'}`}>
              {formatDayLabel(day, todayISO)}
            </p>

            <div className="space-y-1.5">
              {dayBookings.map(b => {
                const team      = b.teamId ? (teamById[b.teamId] ?? null) : null;
                const typeColor = TYPE_COLORS[b.trainingType] ?? TYPE_COLORS['Sonstiges'];

                return (
                  <div key={b.sessionId}
                    className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 space-y-1.5">

                    {/* Title row */}
                    <div className="flex items-start gap-2">
                      {/* Time — sourced from starts_at/ends_at via local conversion */}
                      <span className="text-xs text-gray-500 tabular-nums flex-shrink-0 pt-0.5 w-[5rem]">
                        {b.startTime}–{b.endTime}
                      </span>
                      <span className="text-sm text-white font-medium flex-1 leading-snug">
                        {b.title}
                      </span>
                      {b.trainingType && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 leading-none ${typeColor}`}>
                          {b.trainingType}
                        </span>
                      )}
                    </div>

                    {/* Meta row */}
                    <div className="flex items-center gap-3 flex-wrap text-xs text-gray-500 pl-[5rem]">
                      {/* Team name */}
                      {team && (
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-violet-500 flex-shrink-0" />
                          {team.name}
                        </span>
                      )}
                      {/* Coach — trainerId shown as placeholder until profiles lookup exists.
                          Replace with resolved display name once profiles table is wired up. */}
                      {b.trainerId && (
                        <span className="flex items-center gap-1 text-gray-600">
                          <span>👤</span>
                          <span className="font-mono text-[10px]">{b.trainerId.slice(0, 8)}…</span>
                        </span>
                      )}
                      {/* Old location as fallback */}
                      {b.location && (
                        <span>{b.location}</span>
                      )}
                    </div>

                    {/* Coach note */}
                    {b.coachNote && (
                      <p className="text-xs text-gray-600 italic pl-[5rem] leading-snug">
                        {b.coachNote}
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
      {selectedUnitId && !isLoading && bookings.length === 0 && (
        <div className="text-center py-10 space-y-1">
          <p className="text-gray-600 text-sm">Keine Buchungen in dieser Woche</p>
          <p className="text-gray-700 text-xs">
            Sessions müssen über den Session-Planner mit dieser Facility Unit
            gebucht worden sein
          </p>
        </div>
      )}

      {/* No unit selected */}
      {!selectedUnitId && !loadingFacs && facilities.length > 0 && (
        <p className="text-center text-gray-600 text-sm py-6">
          Wähle eine Halle oder einen Platz aus
        </p>
      )}
    </div>
  );
}
