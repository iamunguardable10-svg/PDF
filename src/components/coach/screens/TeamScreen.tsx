import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { Activity, CalendarDays, ChevronLeft, Plus, Users2, UserRound } from 'lucide-react';
import { CalendarView } from '../../calendar/CalendarView';
import { SessionDetail } from '../../attendance/SessionDetail';
import { SessionPlanner } from '../../attendance/SessionPlanner';
import { TrainerDashboard } from '../../TrainerDashboard';
import { loadTeamSessionsAsEvents } from '../../../lib/calendarLoaders';
import { loadSessionsByTeam, loadTeamMembers, updateSession } from '../../../lib/attendanceStorage';
import type { CalEvent } from '../../../types/calEvent';
import type { AttendanceSession, AttendanceTeamMember } from '../../../types/attendance';
import type { DepartmentCalendarSession } from '../../../types/organization';
import type { AthleteGroup, ManagedAthlete } from '../../../types/trainerDashboard';
import type { CoachOutletContext } from '../CoachShell';

type MainTab = 'calendar' | 'players' | 'groups' | 'performance';
type PlayersTab = 'roster' | 'profiles' | 'load-profile';
type GroupsTab = 'team-groups' | 'cross-team-groups';
type PerformanceTab = 'load' | 'attendance' | 'analytics';

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
  const { user, teams, roster, groups, coachName, reload, demoMode } = useOutletContext<CoachOutletContext>();

  const team = teams.find(t => t.id === teamId) ?? null;

  const [mainTab,        setMainTab]        = useState<MainTab>('calendar');
  const [playersTab,     setPlayersTab]     = useState<PlayersTab>('roster');
  const [groupsTab,      setGroupsTab]      = useState<GroupsTab>('team-groups');
  const [performanceTab, setPerformanceTab] = useState<PerformanceTab>('load');
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
            <p className="text-xs text-gray-500">Team workspace. Calendar first, then players, groups and performance.</p>
          </div>
          {team.sport && <span className="hidden text-xs text-gray-500 sm:inline">{team.sport}</span>}
        </div>
        {mainTab === 'calendar' && (
          <button
            onClick={() => handleAddEvent(new Date().toISOString().split('T')[0], '10:00')}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-violet-900/40 border border-violet-700/50 hover:bg-violet-800/50 text-violet-300 text-xs font-semibold transition-colors"
          >
            <Plus size={12} /> Session
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MainTabButton active={mainTab === 'calendar'} label="Calendar" helper="Sessions live here" Icon={CalendarDays} onClick={() => setMainTab('calendar')} />
        <MainTabButton active={mainTab === 'players'} label="Players" helper="Team roster" Icon={UserRound} onClick={() => setMainTab('players')} />
        <MainTabButton active={mainTab === 'groups'} label="Groups" helper="Scoped groups" Icon={Users2} onClick={() => setMainTab('groups')} />
        <MainTabButton active={mainTab === 'performance'} label="Performance" helper="Team context" Icon={Activity} onClick={() => setMainTab('performance')} />
      </div>

      <div className="grid gap-2 sm:grid-cols-4">
        <MiniInfo label="Team members" value={loadingMembers ? 'Loading' : String(teamRows.length)} />
        <MiniInfo label="Team groups" value={String(teamGroups.length)} />
        <MiniInfo label="Sessions" value={String(rawSessions.length)} />
        <MiniInfo label="Upcoming" value={String(upcomingSessions.length)} />
      </div>

      {mainTab === 'calendar' && (
        <section className="space-y-3">
          <div className="rounded-2xl border border-gray-800 bg-gray-900/60 px-4 py-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-cyan-300">Team calendar</p>
                <p className="mt-1 text-sm text-gray-400">Create sessions directly in the calendar. Click any session to see who is coming and to open final attendance.</p>
              </div>
              <div className="flex gap-2 text-xs text-gray-500">
                <span>{events.length} calendar items</span>
                <span>{upcomingSessions.length} upcoming</span>
              </div>
            </div>
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

      {mainTab === 'players' && (
        <section className="space-y-3">
          <SubMenu
            items={[
              { key: 'roster', label: 'Roster' },
              { key: 'profiles', label: 'Player profiles' },
              { key: 'load-profile', label: 'Load profiles' },
            ]}
            active={playersTab}
            onChange={key => setPlayersTab(key as PlayersTab)}
          />

          {playersTab === 'roster' && (
            <div className="rounded-2xl border border-gray-800 bg-gray-900/60">
              <div className="border-b border-gray-800 px-4 py-4">
                <p className="text-xs font-black uppercase tracking-wide text-indigo-300">Team roster</p>
                <p className="mt-1 text-sm text-gray-400">This list is scoped to members of {team.name}. Add or remove players through the team membership flow.</p>
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

          {playersTab === 'profiles' && (
            <TeamContextCard
              eyebrow="Player profiles"
              title="Open player detail from the team roster"
              text="Player profiles should start from the selected team's roster. This avoids mixing U18, U16 and cross-team development groups in one flat player list."
            />
          )}

          {playersTab === 'load-profile' && (
            <TeamContextCard
              eyebrow="Load profiles"
              title="Missing load warnings belong on player profiles"
              text="Warnings like present but no load submitted, partial attendance or late arrival belong on the player's team profile. The team graph should stay aggregate and clean."
            />
          )}
        </section>
      )}

      {mainTab === 'groups' && (
        <section className="space-y-3">
          <SubMenu
            items={[
              { key: 'team-groups', label: 'Team groups' },
              { key: 'cross-team-groups', label: 'Cross-team groups' },
            ]}
            active={groupsTab}
            onChange={key => setGroupsTab(key as GroupsTab)}
          />

          {groupsTab === 'team-groups' && (
            <GroupPanel
              title="Team groups"
              text="Groups used by players assigned to this team. Examples: starters, guards, bigs, rehab group inside this team."
              groups={teamGroups}
              empty="No groups are linked to this team's players yet."
            />
          )}

          {groupsTab === 'cross-team-groups' && (
            <GroupPanel
              title="Cross-team groups"
              text="Groups not currently used by this team's assigned players. Examples: return to load, injured, guards development or club-wide load watch."
              groups={crossTeamGroups}
              empty="No cross-team groups available."
            />
          )}
        </section>
      )}

      {mainTab === 'performance' && (
        <section className="space-y-3">
          <SubMenu
            items={[
              { key: 'load', label: 'Load' },
              { key: 'attendance', label: 'Attendance' },
              { key: 'analytics', label: 'Analytics' },
            ]}
            active={performanceTab}
            onChange={key => setPerformanceTab(key as PerformanceTab)}
          />

          {performanceTab === 'load' && (
            <section className="space-y-3">
              <TeamContextCard
                eyebrow="Team load"
                title="Performance is viewed per team"
                text="Team load should be calculated from players assigned to this team and based on real player load inputs such as RPE x duration. Until the embedded dashboard accepts a team filter, the card below is still the coach-level load dashboard."
              />
              <TrainerDashboard user={user} trainerName={coachName} embedded />
            </section>
          )}

          {performanceTab === 'attendance' && (
            <TeamContextCard
              eyebrow="Team attendance"
              title="Attendance starts from a calendar session"
              text="The normal workflow is: open the team calendar, click a session, then review expected players, maybe/no/late reports and final attendance. This keeps attendance scoped to the selected team and session."
            />
          )}

          {performanceTab === 'analytics' && (
            <TeamContextCard
              eyebrow="Team analytics"
              title="Analytics should be team-scoped first"
              text="The intuitive default is the selected team, then optional comparison across teams. This workspace now provides the selected team context for that next analytics pass."
              action="Open analytics fallback"
              onAction={() => navigate('/coach/analytics')}
            />
          )}
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

function SubMenu({ items, active, onChange }: { items: { key: string; label: string }[]; active: string; onChange: (key: string) => void }) {
  return (
    <div className="flex w-fit gap-1 rounded-xl bg-gray-900/60 p-1">
      {items.map(item => (
        <button
          key={item.key}
          onClick={() => onChange(item.key)}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${active === item.key ? 'bg-violet-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
        >
          {item.label}
        </button>
      ))}
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

function TeamContextCard({ eyebrow, title, text, action, onAction }: { eyebrow: string; title: string; text: string; action?: string; onAction?: () => void }) {
  return (
    <section className="rounded-2xl border border-gray-800 bg-gray-900/60 px-4 py-4">
      <p className="text-xs font-black uppercase tracking-wide text-orange-300">{eyebrow}</p>
      <h3 className="mt-1 text-lg font-black text-white">{title}</h3>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">{text}</p>
      {action && onAction && (
        <button onClick={onAction} className="mt-4 rounded-xl border border-gray-700 px-3 py-2 text-xs font-semibold text-gray-300 hover:border-gray-500 hover:text-white">{action}</button>
      )}
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="rounded-xl border border-gray-800 bg-gray-950/50 px-3 py-4 text-center text-xs text-gray-500">{text}</p>;
}
