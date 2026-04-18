import { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { CalendarView } from '../../calendar/CalendarView';
import { SessionDetail } from '../../attendance/SessionDetail';
import { SessionPlanner } from '../../attendance/SessionPlanner';
import { loadDeptSessionsAsEvents } from '../../../lib/calendarLoaders';
import { loadSessionsByDepartment } from '../../../lib/attendanceStorage';
import type { CalEvent } from '../../../types/calEvent';
import type { AttendanceSession } from '../../../types/attendance';
import type { DepartmentCalendarSession } from '../../../types/organization';
import type { CoachOutletContext } from '../CoachShell';

function loadWindow() {
  const d = new Date();
  const diff = d.getDay() === 0 ? -6 : 1 - d.getDay();
  d.setDate(d.getDate() + diff);
  const from = d.toISOString().split('T')[0];
  const to   = new Date(d.getTime() + 27 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  return { from, to };
}

export function DepartmentScreen() {
  const { user, departments, teams, roster, groups, coachContext, reload } =
    useOutletContext<CoachOutletContext>();

  // For non-admins, only show their assigned depts
  const visibleDepts = coachContext?.role === 'org_admin'
    ? departments
    : departments.filter(d => coachContext?.deptIds.includes(d.id));

  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [events,          setEvents]          = useState<CalEvent[]>([]);
  const [rawSessions,     setRawSessions]     = useState<DepartmentCalendarSession[]>([]);
  const [loading,         setLoading]         = useState(false);
  const [openSession,     setOpenSession]     = useState<DepartmentCalendarSession | null>(null);
  const [showPlanner,     setShowPlanner]      = useState(false);
  const [planDatum,       setPlanDatum]        = useState<string | undefined>();
  const [planTime,        setPlanTime]         = useState<string | undefined>();

  const selectedDept = departments.find(d => d.id === selectedDeptId) ?? null;
  const deptTeams    = teams.filter(t => t.departmentId === selectedDeptId);
  const teamNameMap  = Object.fromEntries(teams.map(t => [t.id, t.name]));

  const loadEvents = useCallback(async () => {
    if (!selectedDeptId) { setEvents([]); return; }
    setLoading(true);
    const { from, to } = loadWindow();
    const [evs, raw] = await Promise.all([
      loadDeptSessionsAsEvents(selectedDeptId, teamNameMap, from, to),
      loadSessionsByDepartment(selectedDeptId, from, to),
    ]);
    setEvents(evs);
    setRawSessions(raw);
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDeptId]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  function handleAddEvent(datum: string, time: string) {
    setPlanDatum(datum);
    setPlanTime(time);
    setShowPlanner(true);
  }

  if (visibleDepts.length === 0) {
    return (
      <div className="text-center py-12 space-y-1">
        <p className="text-sm text-gray-500">Keine Abteilungen</p>
        <p className="text-xs text-gray-600">Lege Abteilungen im Verein-Bereich an.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-white">Abteilungskalender</h2>
        {selectedDeptId && (
          <button
            onClick={() => handleAddEvent(new Date().toISOString().split('T')[0], '10:00')}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-violet-900/40 border border-violet-700/50 hover:bg-violet-800/50 text-violet-300 text-xs font-semibold transition-colors"
          >
            <Plus size={12} /> Einheit
          </button>
        )}
      </div>

      {/* Department picker */}
      <div className="flex flex-wrap gap-1.5">
        {visibleDepts.map(d => (
          <button
            key={d.id}
            onClick={() => setSelectedDeptId(d.id === selectedDeptId ? '' : d.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors border ${
              selectedDeptId === d.id
                ? 'bg-violet-700 border-violet-500 text-white'
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600'
            }`}
          >
            {d.name}
            <span className="ml-1 text-[10px] opacity-60">
              ({teams.filter(t => t.departmentId === d.id).length})
            </span>
          </button>
        ))}
      </div>

      {selectedDept ? (
        <>
          <p className="text-xs text-gray-500">
            {selectedDept.name}
            {selectedDept.sport && ` · ${selectedDept.sport}`}
            {' — '}{deptTeams.length} Teams
          </p>
          <CalendarView
            events={events}
            loading={loading}
            onEventClick={ev => {
              const raw = rawSessions.find(s => s.id === ev.sourceId);
              if (raw) setOpenSession(raw);
            }}
            onAddEvent={handleAddEvent}
          />
        </>
      ) : (
        <p className="text-xs text-gray-600 py-4 text-center">Abteilung auswählen</p>
      )}

      {/* Session detail modal */}
      {openSession && (
        <SessionDetail
          session={openSession as unknown as AttendanceSession}
          trainerId={user.id}
          onClose={() => setOpenSession(null)}
          onDeleted={() => { setOpenSession(null); loadEvents(); reload(); }}
        />
      )}

      {/* Session planner — dept context: trainer picks team */}
      {showPlanner && (
        <SessionPlanner
          trainerId={user.id}
          teams={deptTeams.length > 0 ? deptTeams : teams}
          membersByTeam={{}}
          roster={roster}
          groups={groups}
          prefillDatum={planDatum}
          prefillTime={planTime}
          onCreated={() => { setShowPlanner(false); loadEvents(); reload(); }}
          onClose={() => setShowPlanner(false)}
        />
      )}
    </div>
  );
}
