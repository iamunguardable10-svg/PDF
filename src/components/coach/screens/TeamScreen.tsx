import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { Activity, BarChart3, CalendarDays, CheckCircle2, ChevronLeft, Plus, Users2, UserRound } from 'lucide-react';
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

type MainTab = 'calendar' | 'players' | 'groups' | 'performance';
type PlayersTab = 'roster' | 'profiles' | 'load-profile';
type GroupsTab = 'team-groups' | 'cross-team-groups';
type PerformanceTab = 'load' | 'attendance' | 'analytics';

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

  const [mainTab,        setMainTab]        = useState<MainTab>('calendar');
  const [playersTab,     setPlayersTab]     = useState<PlayersTab>('roster');
  const [groupsTab,      setGroupsTab]      = useState<GroupsTab>('team-groups');
  const [performanceTab, setPerformanceTab] = useState<PerformanceTab>('load');
  const [events,         setEvents]         = useState<CalEvent[]>([]);
  const [rawSessions,    setRawSessions]    = useState<DepartmentCalendarSession[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [openSession,    setOpenSession]    = useState<DepartmentCalendarSession | null>(null);
  const [showPlanner,    setShowPlanner]    = useState(false);
  const [planDatum,      setPlanDatum]      = useState<string | undefined>();
  const [planTime,       setPlanTime]       = useState<string | undefined>();

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

  const teamGroupCount = Math.ceil(groups.length / 2);
  const teamGroups = groups.slice(0, teamGroupCount);
  const crossTeamGroups = groups.slice(teamGroupCount);

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
        <MainTabButton active={mainTab === 'players'} label="Players" helper="Roster submenus" Icon={UserRound} onClick={() => setMainTab('players')} />
        <MainTabButton active={mainTab === 'groups'} label="Groups" helper="Team and cross-team" Icon={Users2} onClick={() => setMainTab('groups')} />
        <MainTabButton active={mainTab === 'performance'} label="Performance" helper="Load, attendance, analytics" Icon={Activity} onClick={() => setMainTab('performance')} />
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
                <p className="mt-1 text-sm text-gray-400">Players belong under the selected team. Exact persisted team membership should be the next data-model pass.</p>
              </div>
              <div className="divide-y divide-gray-800">
                {roster.length > 0 ? roster.map(athlete => (
                  <div key={athlete.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div>
                      <p className="text-sm font-bold text-white">{athlete.name}</p>
                      <p className="text-xs text-gray-500">{athlete.sport || team.sport || 'Athlete'}</p>
                    </div>
                    <span className="rounded-full border border-gray-700 px-2 py-0.5 text-[10px] font-bold text-gray-400">Roster</span>
                  </div>
                )) : <EmptyState text="No athletes loaded for this team yet." />}
              </div>
            </div>
          )}

          {playersTab === 'profiles' && (
            <TeamContextCard
              eyebrow="Player profiles"
              title="Individual player detail lives under the team"
              text="Open an athlete from this team to review availability history, participation context and notes. This should become a player detail route inside the team workspace."
            />
          )}

          {playersTab === 'load-profile' && (
            <TeamContextCard
              eyebrow="Load profiles"
              title="Missing load warnings belong here, not in the team graph"
              text="A player profile is the right place for warnings like present but no load submitted, partial attendance or late arrival. The team graph should stay aggregate and clean."
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
              text="Lineups, position groups and practice groups inside this team."
              groups={teamGroups}
              empty="No team groups yet."
            />
          )}

          {groupsTab === 'cross-team-groups' && (
            <GroupPanel
              title="Cross-team groups"
              text="Return to load, injured, guards development and load-watch groups can include athletes from multiple teams."
              groups={crossTeamGroups}
              empty="No cross-team groups yet."
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
                text="Load and ACWR should be filtered by selected team and based on player load inputs such as RPE x duration or validated workload data. Attendance remains context only."
              />
              <TrainerDashboard user={user} trainerName={coachName} embedded />
            </section>
          )}

          {performanceTab === 'attendance' && (
            <TeamContextCard
              eyebrow="Team attendance"
              title="Attendance starts from a session"
              text="The coach should normally click a calendar session and then see who is expected, who reported maybe/no/late, and who still needs final confirmation."
              action="Open attendance fallback"
              onAction={() => navigate('/coach/attendance')}
            />
          )}

          {performanceTab === 'analytics' && (
            <TeamContextCard
              eyebrow="Team analytics"
              title="Analytics should be team-scoped first"
              text="Club-wide analytics can come later. The intuitive default is selected team, then optional comparison across teams."
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
          roster={roster}
          groups={groups}
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

function GroupPanel({ title, text, groups, empty }: { title: string; text: string; groups: { id: string; name: string; color: string }[]; empty: string }) {
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
