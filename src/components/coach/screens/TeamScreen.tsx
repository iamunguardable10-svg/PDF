import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { CalendarDays, ChevronLeft, Plus, Users2, UserRound } from 'lucide-react';
import { CalendarView } from '../../calendar/CalendarView';
import { SessionDetail } from '../../attendance/SessionDetail';
import { SessionPlanner } from '../../attendance/SessionPlanner';
import { loadTeamSessionsAsEvents } from '../../../lib/calendarLoaders';
import { loadSessionsByTeam, loadTeamMembers, updateSession } from '../../../lib/attendanceStorage';
import type { CalEvent } from '../../../types/calEvent';
import type { AttendanceSession, AttendanceTeamMember } from '../../../types/attendance';
import type { DepartmentCalendarSession } from '../../../types/organization';
import type { AthleteGroup, ManagedAthlete } from '../../../types/trainerDashboard';
import type { CoachOutletContext } from '../CoachShell';

type MainTab = 'calendar' | 'roster' | 'groups';

type TeamMemberRow = {
  key: string;
  name: string;
  sport: string;
  source: 'roster' | 'team-member';
  athlete?: ManagedAthlete;
  member?: AttendanceTeamMember;
};

function weekWindow() {
  const d = new Date();
  const diff = d.getDay() === 0 ? -6 : 1 - d.getDay();
  d.setDate(d.getDate() + diff);
  const from = d.toISOString().split('T')[0];
  const to   = new Date(d.getTime() + 27 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  return { from, to };
}

function athleteMatchesMember(athlete: ManagedAthlete, member: AttendanceTeamMember): boolean {
  return Boolean(member.athleteRosterId && member.athleteRosterId === athlete.id);
}

function buildTeamRows(roster: ManagedAthlete[], members: AttendanceTeamMember[], demoMode: boolean, fallbackSport: string): TeamMemberRow[] {
  if (demoMode && members.length === 0) {
    return roster.map(athlete => ({
      key: athlete.id,
      name: athlete.name,
      sport: athlete.sport || fallbackSport || 'Athlete',
      source: 'roster',
      athlete,
    }));
  }

  const rows: TeamMemberRow[] = [];
  const matchedMemberIds = new Set<string>();

  for (const athlete of roster) {
    const member = members.find(item => athleteMatchesMember(athlete, item));
    if (!member) continue;
    matchedMemberIds.add(member.id);
    rows.push({
      key: athlete.id,
      name: athlete.name,
      sport: athlete.sport || member.sport || fallbackSport || 'Athlete',
      source: 'roster',
      athlete,
      member,
    });
  }

  for (const member of members) {
    if (matchedMemberIds.has(member.id)) continue;
    rows.push({
      key: member.id,
      name: member.name,
      sport: member.sport || fallbackSport || 'Athlete',
      source: 'team-member',
      member,
    });
  }

  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

export function TeamScreen() {
  const { teamId }   = useParams<{ teamId: string }>();
  const navigate     = useNavigate();
  const { user, teams, roster, groups, reload, demoMode } = useOutletContext<CoachOutletContext>();

  const team = teams.find(t => t.id === teamId) ?? null;

  const [mainTab,        setMainTab]        = useState<MainTab>('calendar');
  const [teamMembers,    setTeamMembers]    = useState<AttendanceTeamMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [events,         setEvents]         = useState<CalEvent[]>([]);
  const [rawSessions,    setRawSessions]    = useState<DepartmentCalendarSession[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [openSession,    setOpenSession]    = useState<DepartmentCalendarSession | null>(null);
  const [showPlanner,    setShowPlanner]    = useState(false);
  const [planDatum,      setPlanDatum]      = useState<string | undefined>();
  const [planTime,       setPlanTime]       = useState<string | undefined>();

  const teamRows = useMemo(() => buildTeamRows(roster, teamMembers, demoMode, team?.sport ?? ''), [demoMode, roster, team?.sport, teamMembers]);
  const teamRoster = useMemo(() => teamRows.map(row => row.athlete).filter((athlete): athlete is ManagedAthlete => Boolean(athlete)), [teamRows]);
  const teamGroupIds = useMemo(() => new Set(teamRoster.flatMap(athlete => athlete.groupIds)), [teamRoster]);
  const teamGroups = useMemo(() => groups.filter(group => teamGroupIds.has(group.id)), [groups, teamGroupIds]);
  const crossTeamGroups = useMemo(() => groups.filter(group => !teamGroupIds.has(group.id)), [groups, teamGroupIds]);
  const plannerRoster = demoMode ? roster : teamRoster;
  const plannerGroups = teamGroups.length > 0 ? teamGroups : groups.filter(group => plannerRoster.some(athlete => athlete.groupIds.includes(group.id)));

  const upcomingSessions = useMemo(() => rawSessions
    .filter(session => session.datum >= new Date().toISOString().split('T')[0])
    .sort((a, b) => `${a.datum} ${a.startTime ?? ''}`.localeCompare(`${b.datum} ${b.startTime ?? ''}`)), [rawSessions]);
  const nextSession = upcomingSessions[0] ?? null;

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

  useEffect(() => {
    let cancelled = false;
    if (!teamId || demoMode) {
      setTeamMembers([]);
      setLoadingMembers(false);
      return;
    }

    setLoadingMembers(true);
    loadTeamMembers(teamId).then(members => {
      if (cancelled) return;
      setTeamMembers(members);
      setLoadingMembers(false);
    });

    return () => { cancelled = true; };
  }, [demoMode, teamId]);

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
        <p className="text-gray-500 text-sm">Team not found</p>
        <button onClick={() => navigate('/coach/teams')} className="text-xs text-violet-400 hover:text-violet-300">
          Back to teams
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/coach/teams')}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          <ChevronLeft size={14} /> Teams
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: team.color }} />
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-white truncate">{team.name}</h2>
            <p className="text-xs text-gray-500">Open a session to see who comes, review exceptions and confirm attendance.</p>
          </div>
          {team.sport && <span className="hidden text-xs text-gray-500 sm:inline">{team.sport}</span>}
        </div>
        <button
          onClick={() => handleAddEvent(new Date().toISOString().split('T')[0], '10:00')}
          className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-violet-900/40 border border-violet-700/50 hover:bg-violet-800/50 text-violet-300 text-xs font-semibold transition-colors"
        >
          <Plus size={12} /> Session
        </button>
      </div>

      <CoachFlowCard
        nextSession={nextSession}
        onOpenNext={() => nextSession && setOpenSession(nextSession)}
        onCreate={() => handleAddEvent(new Date().toISOString().split('T')[0], '10:00')}
      />

      <div className="grid grid-cols-3 gap-2">
        <MainTabButton active={mainTab === 'calendar'} label="Calendar" helper="Plan and click sessions" Icon={CalendarDays} onClick={() => setMainTab('calendar')} />
        <MainTabButton active={mainTab === 'roster'} label="Roster" helper="Assigned players" Icon={UserRound} onClick={() => setMainTab('roster')} />
        <MainTabButton active={mainTab === 'groups'} label="Groups" helper="Team and cross-team" Icon={Users2} onClick={() => setMainTab('groups')} />
      </div>

      {mainTab === 'calendar' && (
        <section className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <MiniInfo label="Sessions" value={String(rawSessions.length)} />
            <MiniInfo label="Upcoming" value={String(upcomingSessions.length)} />
            <MiniInfo label="Team members" value={loadingMembers ? 'Loading' : String(teamRows.length)} />
          </div>

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
        </section>
      )}

      {mainTab === 'roster' && (
        <div className="rounded-2xl border border-gray-800 bg-gray-900/60">
          <div className="border-b border-gray-800 px-4 py-4">
            <p className="text-xs font-black uppercase tracking-wide text-indigo-300">Team roster</p>
            <p className="mt-1 text-sm text-gray-400">Only players assigned to {team.name}. These are the players used when creating sessions from this team calendar.</p>
          </div>
          <div className="divide-y divide-gray-800">
            {loadingMembers ? (
              <EmptyState text="Loading team members..." />
            ) : teamRows.length > 0 ? teamRows.map(row => (
              <div key={row.key} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-sm font-bold text-white">{row.name}</p>
                  <p className="text-xs text-gray-500">{row.sport}</p>
                </div>
                <span className="rounded-full border border-gray-700 px-2 py-0.5 text-[10px] font-bold text-gray-400">
                  {row.source === 'roster' ? 'Roster linked' : 'Team member'}
                </span>
              </div>
            )) : <EmptyState text="No players assigned to this team yet." />}
          </div>
        </div>
      )}

      {mainTab === 'groups' && (
        <section className="grid gap-3 lg:grid-cols-2">
          <GroupPanel
            title="Team groups"
            text="Groups used by players assigned to this team."
            groups={teamGroups}
            empty="No groups are linked to this team's players yet."
          />
          <GroupPanel
            title="Cross-team groups"
            text="Other coach groups that are not tied to this team's current roster."
            groups={crossTeamGroups}
            empty="No cross-team groups available."
          />
        </section>
      )}

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
          roster={plannerRoster}
          groups={plannerGroups}
          prefillDatum={planDatum}
          prefillTime={planTime}
          onCreated={() => { setShowPlanner(false); load(); reload(); }}
          onClose={() => setShowPlanner(false)}
        />
      )}
    </div>
  );
}

function CoachFlowCard({ nextSession, onOpenNext, onCreate }: { nextSession: DepartmentCalendarSession | null; onOpenNext: () => void; onCreate: () => void }) {
  return (
    <section className="rounded-2xl border border-sky-900/50 bg-sky-950/20 px-4 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-sky-300">Coach flow</p>
          <h3 className="mt-1 text-lg font-black text-white">Plan session. Click session. Review who comes.</h3>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-400">Attendance is not a separate place to hunt for. It starts from the session in this team calendar.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {nextSession && (
            <button onClick={onOpenNext} className="rounded-xl bg-sky-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-sky-500">
              Open next session
            </button>
          )}
          <button onClick={onCreate} className="rounded-xl border border-gray-700 px-3 py-2 text-xs font-semibold text-gray-300 transition-colors hover:border-gray-500 hover:text-white">
            Create session
          </button>
        </div>
      </div>
    </section>
  );
}

function MainTabButton({ active, label, helper, Icon, onClick }: { active: boolean; label: string; helper: string; Icon: typeof CalendarDays; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl border px-3 py-3 text-left transition-colors ${active ? 'border-violet-500 bg-violet-950/30 text-white' : 'border-gray-800 bg-gray-900/50 text-gray-400 hover:border-gray-600 hover:text-white'}`}
    >
      <Icon size={16} />
      <span className="mt-2 block text-xs font-black">{label}</span>
      <span className="mt-0.5 block text-[10px] leading-4 text-gray-500">{helper}</span>
    </button>
  );
}

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-600">{label}</p>
      <p className="mt-1 truncate text-xs font-semibold text-gray-300">{value}</p>
    </div>
  );
}

function GroupPanel({ title, text, groups, empty }: { title: string; text: string; groups: AthleteGroup[]; empty: string }) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900/60 px-4 py-4">
      <p className="text-xs font-black uppercase tracking-wide text-purple-300">{title}</p>
      <p className="mt-1 text-xs leading-5 text-gray-500">{text}</p>
      <div className="mt-4 space-y-2">
        {groups.length > 0 ? groups.map(group => (
          <div key={group.id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-800 bg-gray-950/50 px-3 py-2">
            <span className="text-sm font-semibold text-white">{group.name}</span>
            <span className="rounded-full border border-gray-700 px-2 py-0.5 text-[10px] font-bold text-gray-500">{group.color}</span>
          </div>
        )) : <EmptyState text={empty} />}
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="rounded-xl border border-gray-800 bg-gray-950/50 px-3 py-4 text-center text-xs text-gray-500">{text}</p>;
}
