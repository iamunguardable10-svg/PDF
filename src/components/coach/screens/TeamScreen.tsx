import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { ChevronLeft, Plus } from 'lucide-react';
import { CalendarView } from '../../calendar/CalendarView';
import { SessionDetail } from '../../attendance/SessionDetail';
import { SessionPlanner } from '../../attendance/SessionPlanner';
import { TrainerDashboard } from '../../TrainerDashboard';
import { loadTeamSessionsAsEvents } from '../../../lib/calendarLoaders';
import { loadSessionsByTeam, updateSession } from '../../../lib/attendanceStorage';
import type { CalEvent } from '../../../types/calEvent';
import type { AttendanceSession } from '../../../types/attendance';
import type { DepartmentCalendarSession } from '../../../types/organization';
import type { CoachOutletContext } from '../CoachShell';

type SubTab = 'kalender' | 'kader';

function weekWindow() {
  const d = new Date();
  const diff = d.getDay() === 0 ? -6 : 1 - d.getDay();
  d.setDate(d.getDate() + diff);
  const from = d.toISOString().split('T')[0];
  const to   = new Date(d.getTime() + 27 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  return { from, to };
}

export function TeamScreen() {
  const { teamId }   = useParams<{ teamId: string }>();
  const navigate     = useNavigate();
  const { user, teams, roster, groups, coachName, reload } = useOutletContext<CoachOutletContext>();

  const team = teams.find(t => t.id === teamId) ?? null;

  const [subTab,      setSubTab]      = useState<SubTab>('kalender');
  const [events,      setEvents]      = useState<CalEvent[]>([]);
  const [rawSessions, setRawSessions] = useState<DepartmentCalendarSession[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [openSession, setOpenSession] = useState<DepartmentCalendarSession | null>(null);
  const [showPlanner, setShowPlanner] = useState(false);
  const [planDatum,   setPlanDatum]   = useState<string | undefined>();
  const [planTime,    setPlanTime]    = useState<string | undefined>();

  const load = useCallback(async () => {
    if (!teamId || !team) { setLoading(false); return; }
    setLoading(true);
    const { from, to } = weekWindow();
    const [evs, raw] = await Promise.all([
      loadTeamSessionsAsEvents(teamId, team.name, from, to),
      loadSessionsByTeam(teamId, from, to),
    ]);
    setEvents(evs);
    setRawSessions(raw);
    setLoading(false);
  }, [teamId, team]);

  useEffect(() => { load(); }, [load]);

  function handleAddEvent(datum: string, time: string) {
    setPlanDatum(datum); setPlanTime(time); setShowPlanner(true);
  }

  async function handleMoveEvent(ev: CalEvent, newDatum: string, newStartTime: string, newEndTime: string) {
    if (!ev.sourceId) return;
    setEvents(prev => prev.map(e => e.id === ev.id ? { ...e, datum: newDatum, startTime: newStartTime, endTime: newEndTime } : e));
    await updateSession(ev.sourceId, { datum: newDatum, startTime: newStartTime, endTime: newEndTime });
    load();
  }

  if (!team) {
    return (
      <div className="text-center py-12 space-y-2">
        <p className="text-gray-500 text-sm">Team nicht gefunden</p>
        <button onClick={() => navigate('/coach/teams')} className="text-xs text-violet-400 hover:text-violet-300">
          Zurück zu Teams
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* Back + title */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/coach/teams')}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          <ChevronLeft size={14} /> Teams
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: team.color }} />
          <h2 className="text-base font-semibold text-white truncate">{team.name}</h2>
          {team.sport && <span className="text-xs text-gray-500">{team.sport}</span>}
        </div>
        {subTab === 'kalender' && (
          <button
            onClick={() => handleAddEvent(new Date().toISOString().split('T')[0], '10:00')}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-violet-900/40 border border-violet-700/50 hover:bg-violet-800/50 text-violet-300 text-xs font-semibold transition-colors"
          >
            <Plus size={12} /> Einheit
          </button>
        )}
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 bg-gray-900/60 rounded-xl p-1 w-fit">
        {(['kalender', 'kader'] as SubTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setSubTab(tab)}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize ${
              subTab === tab
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
            }`}
          >
            {tab === 'kalender' ? 'Kalender' : 'Kader'}
          </button>
        ))}
      </div>

      {/* Kalender view */}
      {subTab === 'kalender' && (
        <>
          <CalendarView
            events={events}
            loading={loading}
            onEventClick={ev => {
              const raw = rawSessions.find(s => s.id === ev.sourceId);
              if (raw) setOpenSession(raw);
            }}
            onAddEvent={handleAddEvent}
            onMoveEvent={handleMoveEvent}
          />

          {openSession && (
            <SessionDetail
              session={openSession as unknown as AttendanceSession}
              trainerId={user.id}
              onClose={() => setOpenSession(null)}
              onDeleted={() => { setOpenSession(null); load(); reload(); }}
            />
          )}

          {showPlanner && (
            <SessionPlanner
              trainerId={user.id}
              teams={[team]}
              membersByTeam={{}}
              roster={roster}
              groups={groups}
              prefillDatum={planDatum}
              prefillTime={planTime}
              onCreated={() => { setShowPlanner(false); load(); reload(); }}
              onClose={() => setShowPlanner(false)}
            />
          )}
        </>
      )}

      {/* Kader view — team-specific performance */}
      {subTab === 'kader' && (
        <TrainerDashboard user={user} trainerName={coachName} embedded />
      )}
    </div>
  );
}
