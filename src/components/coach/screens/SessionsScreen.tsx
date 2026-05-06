import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { CalendarDays, Lock, Plus, ShieldCheck } from 'lucide-react';
import type { CoachOutletContext } from '../CoachShell';
import type { AttendanceSession } from '../../../types/attendance';
import { loadAvailabilityForCoachSessionsAsync } from '../../../lib/availability';
import type { AthleteAvailabilityRecord } from '../../../lib/availability';
import { loadFinalAttendanceForSessionAsync } from '../../../lib/finalAttendance';
import type { CoachFinalAttendanceRecord } from '../../../lib/finalAttendance';
import { canEditSession, isSessionAssignedToCoach, roleLabel } from '../../../lib/rolePermissions';
import { CoachSessionDetailV1 } from '../CoachSessionDetailV1';

type SessionFilter = 'mine' | 'editable' | 'all';
type SessionRow = { session: AttendanceSession; assigned: boolean; editable: boolean };

export function SessionsScreen() {
  const navigate = useNavigate();
  const { user, sessions, teams, roster, groups, coachContext, permissions } = useOutletContext<CoachOutletContext>();
  const [filter, setFilter] = useState<SessionFilter>('mine');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [availabilityRecords, setAvailabilityRecords] = useState<AthleteAvailabilityRecord[]>([]);
  const [finalRecords, setFinalRecords] = useState<CoachFinalAttendanceRecord[]>([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [loadingFinal, setLoadingFinal] = useState(false);
  const today = new Date().toISOString().split('T')[0];

  const upcomingSessions = useMemo(() => sessions
    .filter(session => session.datum >= today)
    .sort((a, b) => `${a.datum}${a.startTime ?? ''}`.localeCompare(`${b.datum}${b.startTime ?? ''}`)), [sessions, today]);

  const sessionRows = useMemo<SessionRow[]>(() => upcomingSessions
    .map(session => {
      const assigned = isSessionAssignedToCoach(session, teams, user.id, coachContext);
      const editable = canEditSession(session, teams, user.id, permissions, coachContext);
      return { session, assigned, editable };
    })
    .filter(row => {
      if (filter === 'mine') return row.assigned;
      if (filter === 'editable') return row.editable;
      return true;
    })
    .sort((a, b) => {
      if (a.assigned !== b.assigned) return a.assigned ? -1 : 1;
      return `${a.session.datum}${a.session.startTime ?? ''}`.localeCompare(`${b.session.datum}${b.session.startTime ?? ''}`);
    })
    .slice(0, 16), [coachContext, filter, permissions, teams, upcomingSessions, user.id]);

  const selectedRow = useMemo(() => sessionRows.find(row => row.session.id === selectedSessionId) ?? sessionRows[0] ?? null, [selectedSessionId, sessionRows]);
  const selectedSession = selectedRow?.session ?? null;

  useEffect(() => {
    const sessionIds = upcomingSessions.map(session => session.id);
    if (sessionIds.length === 0) {
      setAvailabilityRecords([]);
      return;
    }
    let cancelled = false;
    setLoadingAvailability(true);
    loadAvailabilityForCoachSessionsAsync(sessionIds)
      .then(records => { if (!cancelled) setAvailabilityRecords(records); })
      .catch(error => console.warn('[SessionsScreen:availability]', error))
      .finally(() => { if (!cancelled) setLoadingAvailability(false); });
    return () => { cancelled = true; };
  }, [upcomingSessions]);

  useEffect(() => {
    if (!selectedSession) {
      setFinalRecords([]);
      return;
    }
    let cancelled = false;
    setLoadingFinal(true);
    loadFinalAttendanceForSessionAsync(selectedSession.id)
      .then(records => { if (!cancelled) setFinalRecords(records); })
      .catch(error => console.warn('[SessionsScreen:finalAttendance]', error))
      .finally(() => { if (!cancelled) setLoadingFinal(false); });
    return () => { cancelled = true; };
  }, [selectedSession]);

  const selectedAvailability = selectedSession ? availabilityRecords.filter(record => record.sessionId === selectedSession.id) : [];
  const selectedTeam = selectedSession ? teams.find(team => team.id === selectedSession.teamId) ?? null : null;
  const assignedCount = sessionRows.filter(row => row.assigned).length;
  const editableCount = sessionRows.filter(row => row.editable).length;
  const hasUpcomingSessions = upcomingSessions.length > 0;
  const emptyTitle = hasUpcomingSessions ? 'No sessions match this filter' : 'No upcoming sessions yet';
  const emptyText = hasUpcomingSessions
    ? 'Switch to All visible or Editable to find sessions outside your direct assignment.'
    : 'Create the first training block so athletes can see what is coming and only report exceptions.';

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <Header title="Sessions" text="Select one session to see the time-aware coach detail view: attendance first, load context only where it helps." />
        <div className="flex flex-wrap gap-2">
          <FilterButton active={filter === 'mine'} onClick={() => setFilter('mine')}>My sessions</FilterButton>
          <FilterButton active={filter === 'editable'} onClick={() => setFilter('editable')}>Editable</FilterButton>
          <FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>All visible</FilterButton>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <InfoCard label="Role" value={roleLabel(permissions.role)} text="Controls what you can create or edit." />
        <InfoCard label="Assigned" value={String(assignedCount)} text="Sessions directly relevant to you." />
        <InfoCard label="Editable" value={String(editableCount)} text="Sessions you may manage." />
      </section>

      <div className="grid gap-4 xl:grid-cols-[0.82fr_1.18fr]">
        <div className="rounded-2xl border border-gray-800 bg-gray-900/70 p-3">
          <div className="mb-3 flex items-center justify-between gap-3 px-1">
            <div>
              <p className="text-sm font-bold text-white">Session queue</p>
              <p className="text-xs text-gray-500">Default player status is expected until exception.</p>
            </div>
            {permissions.canCreateSessions ? (
              <button className="inline-flex items-center gap-1.5 rounded-xl border border-violet-700 bg-violet-900/30 px-3 py-1.5 text-xs font-bold text-violet-200">
                <Plus size={14} /> New
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs font-bold text-gray-500">
                <Lock size={14} /> View
              </span>
            )}
          </div>

          <div className="space-y-2">
            {sessionRows.length === 0 ? <Empty title={emptyTitle} text={emptyText} canCreate={permissions.canCreateSessions} /> : sessionRows.map(({ session, assigned, editable }) => {
              const team = teams.find(t => t.id === session.teamId);
              const sessionAvailability = availabilityRecords.filter(record => record.sessionId === session.id);
              const isSelected = selectedSession?.id === session.id;
              return (
                <button
                  key={session.id}
                  onClick={() => setSelectedSessionId(session.id)}
                  className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${isSelected ? 'border-sky-500 bg-sky-950/20' : assigned ? 'border-violet-700/70 bg-violet-950/20 hover:border-violet-500' : 'border-gray-700 bg-gray-800/50 hover:border-gray-500'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-semibold text-white">{session.title}</p>
                        {assigned && <Badge tone="violet">Assigned</Badge>}
                        {editable ? <Badge tone="green">Editable</Badge> : <Badge tone="gray">Read only</Badge>}
                      </div>
                      <p className="mt-1 text-xs text-gray-500">{formatDate(session.datum)}{session.startTime ? ` - ${session.startTime}` : ''}{session.location ? ` - ${session.location}` : ''}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-gray-500">
                        <span className="inline-flex items-center gap-1 rounded-lg bg-gray-950/60 px-2 py-1"><CalendarDays size={12} /> {team?.name ?? 'No team assigned'}</span>
                        {session.trainingType && <span className="rounded-lg bg-gray-950/60 px-2 py-1">{session.trainingType}</span>}
                        {editable && <span className="inline-flex items-center gap-1 rounded-lg bg-gray-950/60 px-2 py-1"><ShieldCheck size={12} /> Coach actions</span>}
                      </div>
                    </div>
                    <div className="shrink-0 text-right text-xs text-gray-500">
                      <p className="font-semibold text-gray-300">{sessionAvailability.length}</p>
                      <p>exceptions</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {selectedRow ? (
          <CoachSessionDetailV1
            session={selectedRow.session}
            teamName={selectedTeam?.name ?? 'No team assigned'}
            roster={roster}
            groups={groups}
            availabilityRecords={selectedAvailability}
            finalRecords={finalRecords}
            editable={selectedRow.editable}
            onOpenPlayer={(athleteId) => navigate(`/coach/players?athlete=${encodeURIComponent(athleteId)}`)}
          />
        ) : (
          <section className="rounded-2xl border border-dashed border-gray-800 bg-gray-900/50 p-6 text-sm text-gray-500">
            Select or create a session to open its operational detail view.
          </section>
        )}
      </div>
    </div>
  );
}

function Header({ title, text }: { title: string; text: string }) {
  return <div><p className="text-xs font-semibold uppercase tracking-wider text-violet-300">TeamLoad</p><h2 className="mt-1 text-2xl font-black text-white">{title}</h2><p className="mt-1 text-sm text-gray-400">{text}</p></div>;
}

function Empty({ title, text, canCreate }: { title: string; text: string; canCreate: boolean }) {
  return (
    <div className="rounded-2xl border border-dashed border-violet-800/70 bg-violet-950/15 px-5 py-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-black text-white">{title}</p>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-400">{text}</p>
        </div>
        {canCreate && <button className="inline-flex w-fit items-center gap-1.5 rounded-xl bg-violet-500 px-3 py-2 text-xs font-black text-white"><Plus size={14} /> Plan first session</button>}
      </div>
    </div>
  );
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return <button onClick={onClick} className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition-colors ${active ? 'border-violet-600 bg-violet-900/40 text-violet-200' : 'border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-500 hover:text-white'}`}>{children}</button>;
}

function InfoCard({ label, value, text }: { label: string; value: string; text: string }) {
  return <div className="rounded-xl border border-gray-800 bg-gray-900/70 px-4 py-3"><p className="text-[11px] font-medium uppercase tracking-wider text-gray-500">{label}</p><p className="mt-1 text-xl font-black text-white">{value}</p><p className="mt-1 text-xs text-gray-500">{text}</p></div>;
}

function Badge({ tone, children }: { tone: 'violet' | 'green' | 'gray'; children: ReactNode }) {
  const tones = { violet: 'border-violet-700 bg-violet-900/40 text-violet-200', green: 'border-green-700 bg-green-900/30 text-green-200', gray: 'border-gray-700 bg-gray-900 text-gray-400' };
  return <span className={`rounded-lg border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${tones[tone]}`}>{children}</span>;
}

function formatDate(iso: string) { return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); }
