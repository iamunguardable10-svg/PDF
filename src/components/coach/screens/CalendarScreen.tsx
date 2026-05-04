import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { CalendarView } from '../../calendar/CalendarView';
import type { CoachOutletContext } from '../CoachShell';
import type { CalEvent } from '../../../types/calEvent';
import type { AttendanceSession, AttendanceTeam } from '../../../types/attendance';
import { canEditSession, isSessionAssignedToCoach, roleLabel } from '../../../lib/rolePermissions';

type FilterMode = 'mine' | 'editable' | 'team' | 'department' | 'all';

export function CalendarScreen() {
  const { user, sessions, teams, departments, loading, coachContext, permissions } = useOutletContext<CoachOutletContext>();
  const [filter, setFilter] = useState<FilterMode>('mine');

  const sessionRows = useMemo(() => {
    return sessions.map(session => ({
      session,
      assigned: isSessionAssignedToCoach(session, teams, user.id, coachContext),
      editable: canEditSession(session, teams, user.id, permissions, coachContext),
    }));
  }, [coachContext, permissions, sessions, teams, user.id]);

  const assignedSessions = useMemo(
    () => sessionRows.filter(row => row.assigned).map(row => row.session),
    [sessionRows]
  );

  const visibleRows = useMemo(() => {
    if (filter === 'mine') return sessionRows.filter(row => row.assigned);
    if (filter === 'editable') return sessionRows.filter(row => row.editable);
    if (filter === 'team') return sessionRows.filter(row => {
      const team = teams.find(t => t.id === row.session.teamId);
      return row.assigned || row.session.trainerId === user.id || team?.trainerId === user.id;
    });
    if (filter === 'department') {
      const myTeamDepartmentIds = new Set(
        teams.filter(team => team.trainerId === user.id && team.departmentId).map(team => team.departmentId)
      );
      return sessionRows.filter(row => row.session.departmentId && myTeamDepartmentIds.has(row.session.departmentId));
    }
    return sessionRows;
  }, [filter, sessionRows, teams, user.id]);

  const events = useMemo(
    () => visibleRows.map(row => toCalendarEvent(row.session, teams, row.assigned, row.editable)),
    [teams, visibleRows]
  );

  const today = new Date().toISOString().split('T')[0];
  const nextAssigned = assignedSessions
    .filter(session => session.datum >= today)
    .sort((a, b) => `${a.datum}${a.startTime ?? ''}`.localeCompare(`${b.datum}${b.startTime ?? ''}`))[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">TeamLoad</p>
          <h2 className="mt-1 text-2xl font-black text-white">Calendar</h2>
          <p className="mt-1 text-sm text-gray-400">
            Coach planning calendar for {roleLabel(permissions.role)}. Assigned and editable sessions are prioritized.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <FilterButton active={filter === 'mine'} onClick={() => setFilter('mine')}>My sessions</FilterButton>
          <FilterButton active={filter === 'editable'} onClick={() => setFilter('editable')}>Editable</FilterButton>
          <FilterButton active={filter === 'team'} onClick={() => setFilter('team')}>My teams</FilterButton>
          <FilterButton active={filter === 'department'} onClick={() => setFilter('department')}>Department</FilterButton>
          <FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>All</FilterButton>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Assigned" value={String(sessionRows.filter(row => row.assigned).length)} text="Sessions directly assigned to you." tone="violet" />
        <SummaryCard label="Editable" value={String(sessionRows.filter(row => row.editable).length)} text="Sessions your role may manage." tone="cyan" />
        <SummaryCard label="Departments" value={String(departments.length)} text="Department context available." tone="emerald" />
      </section>

      {nextAssigned && (
        <section className="rounded-2xl border border-violet-700/60 bg-violet-950/20 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-300">Your next assigned session</p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-black text-white">{nextAssigned.title}</h3>
              <p className="text-sm text-gray-400">
                {formatDate(nextAssigned.datum)}{nextAssigned.startTime ? ` - ${nextAssigned.startTime}` : ''}
                {nextAssigned.location ? ` - ${nextAssigned.location}` : ''}
              </p>
            </div>
            <span className="self-start rounded-xl border border-violet-700 bg-violet-900/40 px-3 py-1.5 text-xs font-bold text-violet-200">
              Assigned to you
            </span>
          </div>
        </section>
      )}

      <CalendarView events={events} loading={loading} />

      {events.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-700 bg-gray-800/30 px-4 py-5 text-sm text-gray-500">
          No sessions match this filter yet.
        </div>
      )}
    </div>
  );
}

function toCalendarEvent(session: AttendanceSession, teams: AttendanceTeam[], isAssigned: boolean, isEditable: boolean): CalEvent {
  const team = teams.find(item => item.id === session.teamId);
  const color = isAssigned ? '#a78bfa' : isEditable ? '#22d3ee' : team?.color ?? '#64748b';
  return {
    id: session.id,
    sourceId: session.id,
    kind: 'session',
    title: isAssigned ? `★ ${session.title}` : session.title,
    datum: session.datum,
    startTime: session.startTime ?? '18:00',
    endTime: session.endTime ?? fallbackEndTime(session.startTime ?? '18:00'),
    color,
    bgColor: isAssigned ? '#4c1d9533' : isEditable ? '#164e6333' : `${color}22`,
    teamId: session.teamId,
    teamName: team?.name,
    departmentId: session.departmentId ?? team?.departmentId,
    trainingType: session.trainingType || undefined,
    coachName: isAssigned ? 'Assigned to you' : isEditable ? 'Editable' : undefined,
  };
}

function fallbackEndTime(startTime: string) {
  const [hour, minute] = startTime.split(':').map(Number);
  const endHour = Math.min(23, (hour || 18) + 1);
  return `${String(endHour).padStart(2, '0')}:${String(minute || 0).padStart(2, '0')}`;
}

function formatDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition-colors ${
        active
          ? 'border-cyan-600 bg-cyan-900/40 text-cyan-200'
          : 'border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-500 hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

function SummaryCard({ label, value, text, tone }: { label: string; value: string; text: string; tone: 'violet' | 'cyan' | 'emerald' }) {
  const tones = {
    violet: 'border-violet-800/50 bg-violet-950/20 text-violet-300',
    cyan: 'border-cyan-800/50 bg-cyan-950/20 text-cyan-300',
    emerald: 'border-emerald-800/50 bg-emerald-950/20 text-emerald-300',
  };
  return (
    <div className={`rounded-xl border px-4 py-3 ${tones[tone]}`}>
      <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{text}</p>
    </div>
  );
}
