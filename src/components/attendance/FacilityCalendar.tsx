import { useState, useEffect, useCallback, useMemo } from 'react';
import type { AttendanceTeam } from '../../types/attendance';
import {
  loadFacilitiesWithUnits,
  loadBookingsByFacility,
  loadBlackoutsByFacility,
  loadCoachNamesBulk,
} from '../../lib/organizationStorage';
import type {
  FacilityWithUnits,
  FacilityBookingEntry,
  FacilityBlackout,
} from '../../lib/organizationStorage';
import { BlackoutManager } from './BlackoutManager';

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

/**
 * Detect booking conflicts for a single facility unit.
 * Two bookings conflict when their [starts_at, ends_at) intervals overlap.
 * Returns a Set of sessionIds that are involved in at least one conflict.
 */
function detectConflicts(bookings: FacilityBookingEntry[]): Set<string> {
  const conflicting = new Set<string>();
  for (let i = 0; i < bookings.length; i++) {
    for (let j = i + 1; j < bookings.length; j++) {
      const a = bookings[i];
      const b = bookings[j];
      // Overlap condition: A starts before B ends AND A ends after B starts
      if (a.startsAt < b.endsAt && a.endsAt > b.startsAt) {
        conflicting.add(a.sessionId);
        conflicting.add(b.sessionId);
      }
    }
  }
  return conflicting;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type DayEntry =
  | { kind: 'booking';  startTime: string; data: FacilityBookingEntry }
  | { kind: 'blackout'; startTime: string; data: FacilityBlackout };

interface Props {
  organizationId: string;
  teams: AttendanceTeam[];
}

// ── Component ─────────────────────────────────────────────────────────────────

export function FacilityCalendar({ organizationId, teams }: Props) {
  const [facilities,      setFacilities]      = useState<FacilityWithUnits[]>([]);
  const [selectedUnitId,  setSelectedUnitId]  = useState<string>('');
  const [weekStart,       setWeekStart]        = useState(() => isoToMonday(new Date()));
  const [bookings,        setBookings]         = useState<FacilityBookingEntry[]>([]);
  const [blackouts,       setBlackouts]        = useState<FacilityBlackout[]>([]);
  const [coachNames,      setCoachNames]       = useState<Record<string, string>>({});
  const [loadingFacs,     setLoadingFacs]      = useState(true);
  const [loadingData,     setLoadingData]      = useState(false);
  const [showBlackoutMgr, setShowBlackoutMgr]  = useState(false);

  // ── Load facilities once ───────────────────────────────────────────────────
  useEffect(() => {
    setLoadingFacs(true);
    loadFacilitiesWithUnits(organizationId).then(facs => {
      setFacilities(facs);
      const firstUnit = facs[0]?.units[0]?.id ?? '';
      setSelectedUnitId(firstUnit);
      setLoadingFacs(false);
    });
  }, [organizationId]);

  // ── Load bookings + blackouts + coach names when unit or week changes ───────
  const from = toISO(weekStart);
  const to   = toISO(addDays(weekStart, 6));

  // Derive facilityId for the selected unit (needed for blackout query)
  const selectedFacilityId = useMemo(() => {
    for (const fac of facilities) {
      if (fac.units.some(u => u.id === selectedUnitId)) return fac.id;
    }
    return null;
  }, [facilities, selectedUnitId]);

  const loadData = useCallback(async () => {
    if (!selectedUnitId || !selectedFacilityId) {
      setBookings([]); setBlackouts([]); setCoachNames({});
      return;
    }
    setLoadingData(true);

    const [bs, bls] = await Promise.all([
      loadBookingsByFacility(selectedUnitId, from, to),
      loadBlackoutsByFacility(selectedFacilityId, selectedUnitId, from, to),
    ]);

    setBookings(bs);
    setBlackouts(bls);

    // Resolve coach display names from profiles (trainer_id = auth user id)
    const trainerIds = [...new Set(bs.map(b => b.trainerId).filter(Boolean) as string[])];
    const names = await loadCoachNamesBulk(trainerIds);
    setCoachNames(names);

    setLoadingData(false);
  }, [selectedUnitId, selectedFacilityId, from, to]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Conflict detection (pure, client-side) ─────────────────────────────────
  const conflictingIds = useMemo(() => detectConflicts(bookings), [bookings]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const teamById = Object.fromEntries(teams.map(t => [t.id, t]));
  const todayISO = toISO(new Date());
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Selected unit metadata
  let selUnitName   = '';
  let selFacName    = '';
  let selCapacity: number | null = null;
  for (const fac of facilities) {
    for (const u of fac.units) {
      if (u.id === selectedUnitId) {
        selUnitName  = u.name;
        selFacName   = fac.name;
        selCapacity  = u.capacity;
      }
    }
  }

  const weekLabel = (() => {
    const end = addDays(weekStart, 6);
    const ms  = weekStart.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
    const me  = end.toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${ms} – ${me}`;
  })();

  const conflictCount = conflictingIds.size;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">

      {/* Facility / unit picker */}
      {loadingFacs ? (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="w-3.5 h-3.5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          Hallen werden geladen…
        </div>
      ) : facilities.length === 0 ? (
        <p className="text-xs text-gray-600">
          Keine Facilities in dieser Organisation.
          Prüfe ob <code>organization_id</code> auf den Teams gesetzt ist.
        </p>
      ) : (
        <>
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
        </>
      )}

      {/* Unit info + conflict summary badge + blackout manager button */}
      {selectedUnitId && selUnitName && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-teal-400 flex items-center gap-1.5">
            <span className="text-[11px]">⬡</span>
            <span className="font-medium">{selFacName}</span>
            <span className="text-gray-600">·</span>
            {selUnitName}
            {selCapacity != null && (
              <span className="text-gray-600">· max. {selCapacity}</span>
            )}
          </span>
          {/* Conflict badge */}
          {conflictCount > 0 && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-900/60 text-red-300 border border-red-800/50">
              ⚠ {conflictCount} Konflikt{conflictCount > 1 ? 'e' : ''}
            </span>
          )}
          {/* Blackout manager trigger */}
          <button
            onClick={() => setShowBlackoutMgr(true)}
            className="ml-auto text-[11px] px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-400 hover:text-red-300 transition-colors">
            Sperrzeiten verwalten
          </button>
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
          {loadingData && (
            <span className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
          )}
        </div>
      )}

      {/* Agenda: bookings + blackouts interleaved per day */}
      {selectedUnitId && weekDays.map(day => {
        const iso = toISO(day);

        // Merge and sort bookings + blackouts for this day
        const dayEntries: DayEntry[] = [
          ...bookings
            .filter(b => b.datum === iso)
            .map(b => ({ kind: 'booking' as const, startTime: b.startTime, data: b })),
          ...blackouts
            .filter(bl => bl.datum === iso)
            .map(bl => ({ kind: 'blackout' as const, startTime: bl.startTime, data: bl })),
        ].sort((a, b) => a.startTime.localeCompare(b.startTime));

        if (dayEntries.length === 0) return null;
        const isToday = iso === todayISO;

        return (
          <div key={iso}>
            <p className={`text-xs font-medium px-1 mb-1.5 ${isToday ? 'text-violet-400' : 'text-gray-500'}`}>
              {formatDayLabel(day, todayISO)}
            </p>

            <div className="space-y-1.5">
              {dayEntries.map(entry => {

                // ── Blackout card ────────────────────────────────────────────
                if (entry.kind === 'blackout') {
                  const bl = entry.data;
                  return (
                    <div key={`bl-${bl.id}`}
                      className="bg-red-950/40 border border-red-800/60 rounded-xl px-3 py-2.5 space-y-1">
                      <div className="flex items-start gap-2">
                        <span className="text-xs text-red-500 tabular-nums flex-shrink-0 pt-0.5 w-[5rem]">
                          {bl.startTime}–{bl.endTime}
                        </span>
                        <span className="text-sm text-red-300 font-medium flex-1 leading-snug">
                          {bl.title}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0 bg-red-900/70 text-red-300 border border-red-700/50">
                          GESPERRT
                        </span>
                      </div>
                      {(bl.reason || bl.facilityUnitId === null) && (
                        <div className="flex items-center gap-2 text-xs text-red-600 pl-[5rem] flex-wrap">
                          {bl.facilityUnitId === null && (
                            <span className="italic">Gesamte Anlage betroffen</span>
                          )}
                          {bl.reason && <span>{bl.reason}</span>}
                        </div>
                      )}
                    </div>
                  );
                }

                // ── Booking card ─────────────────────────────────────────────
                const b = entry.data;
                const isConflict = conflictingIds.has(b.sessionId);
                const team       = b.teamId ? (teamById[b.teamId] ?? null) : null;
                const typeColor  = TYPE_COLORS[b.trainingType] ?? TYPE_COLORS['Sonstiges'];
                // Coach name: resolved from profiles, fallback to truncated UUID
                const coachName  = b.trainerId
                  ? (coachNames[b.trainerId] ?? `${b.trainerId.slice(0, 8)}…`)
                  : null;

                return (
                  <div key={`bk-${b.sessionId}`}
                    className={`rounded-xl px-3 py-2.5 space-y-1.5 border transition-colors ${
                      isConflict
                        ? 'bg-red-950/20 border-red-700/70'          // conflict highlight
                        : 'bg-gray-800 border-gray-700'              // normal
                    }`}>

                    {/* Title row */}
                    <div className="flex items-start gap-2">
                      <span className="text-xs text-gray-500 tabular-nums flex-shrink-0 pt-0.5 w-[5rem]">
                        {b.startTime}–{b.endTime}
                      </span>
                      <span className={`text-sm font-medium flex-1 leading-snug ${isConflict ? 'text-red-200' : 'text-white'}`}>
                        {b.title}
                      </span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {isConflict && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-red-900/70 text-red-300 border border-red-700/50">
                            ⚠ Konflikt
                          </span>
                        )}
                        {b.trainingType && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium leading-none ${typeColor}`}>
                            {b.trainingType}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Meta row: team · coach · location fallback */}
                    {(team || coachName || b.location) && (
                      <div className="flex items-center gap-3 flex-wrap text-xs text-gray-500 pl-[5rem]">
                        {team && (
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-violet-500 flex-shrink-0" />
                            {team.name}
                          </span>
                        )}
                        {coachName && (
                          <span className="flex items-center gap-1 text-gray-400">
                            <span className="text-gray-600">👤</span>
                            {coachName}
                          </span>
                        )}
                        {/* Old location string — intentional fallback, not removed */}
                        {b.location && !team && (
                          <span>{b.location}</span>
                        )}
                      </div>
                    )}

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
      {selectedUnitId && !loadingData && bookings.length === 0 && blackouts.length === 0 && (
        <div className="text-center py-10 space-y-1">
          <p className="text-gray-600 text-sm">Keine Buchungen oder Sperrzeiten in dieser Woche</p>
          <p className="text-gray-700 text-xs">
            Sessions müssen mit dieser Facility Unit gebucht worden sein
          </p>
        </div>
      )}

      {/* No unit selected */}
      {!selectedUnitId && !loadingFacs && facilities.length > 0 && (
        <p className="text-center text-gray-600 text-sm py-6">
          Wähle eine Halle oder einen Platz aus
        </p>
      )}

      {/* Blackout manager modal */}
      {showBlackoutMgr && (
        <BlackoutManager
          facilities={facilities}
          initialFacilityId={selectedFacilityId ?? undefined}
          initialUnitId={selectedUnitId || undefined}
          onClose={() => setShowBlackoutMgr(false)}
          onChanged={() => { loadData(); }}
        />
      )}
    </div>
  );
}
