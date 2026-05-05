import { useState, useEffect, useCallback, useMemo } from 'react';
import type { ElementType } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users2, Warehouse, ChevronLeft, RefreshCw,
  Activity, Bell, Settings,
} from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import type { AttendanceTeam, AttendanceSession } from '../../types/attendance';
import type { ManagedAthlete, AthleteGroup } from '../../types/trainerDashboard';
import type { Organization, Department } from '../../types/organization';
import type { CoachContext } from '../../lib/coachRole';
import type { PermissionSet } from '../../lib/rolePermissions';
import { getCoachPermissions, roleLabel } from '../../lib/rolePermissions';
import {
  loadTrainerSessions,
  loadTeamsForCoach,
  createTeam,
  deleteTeam,
  updateTeamDepartment,
} from '../../lib/attendanceStorage';
import { loadRoster, saveRoster } from '../../lib/trainerRoster';
import { loadRosterFromSupabase } from '../../lib/trainerShare';
import {
  loadMyOrganization,
  createDepartment,
  deleteDepartment,
  loadDepartments,
} from '../../lib/organizationStorage';
import { loadMyCoachContext } from '../../lib/coachRole';
import { supabase, CLOUD_ENABLED } from '../../lib/supabase';

export interface CoachOutletContext {
  user: User;
  org: Organization | null;
  departments: Department[];
  teams: AttendanceTeam[];
  sessions: AttendanceSession[];
  coachContext: CoachContext | null;
  permissions: PermissionSet;
  coachName: string;
  loading: boolean;
  roster: ManagedAthlete[];
  groups: AthleteGroup[];
  demoMode: boolean;
  setDemoMode: (value: boolean) => void;
  reload: () => void;
  onCreateDepartment: (name: string, sport?: string) => Promise<void>;
  onDeleteDepartment: (deptId: string) => Promise<void>;
  onCreateTeam:       (name: string, sport: string, color: string) => Promise<void>;
  onDeleteTeam:       (teamId: string) => Promise<void>;
  onAssignTeam:       (teamId: string, deptId: string | null) => Promise<void>;
}

interface NavItem {
  path: string;
  label: string;
  helper: string;
  Icon: ElementType;
  accent: string;
  accentText: string;
  accentBorder: string;
  requires?: keyof PermissionSet;
}

interface NavSection {
  title: string;
  description: string;
  paths: string[];
}

const NAV_ITEMS: NavItem[] = [
  { path: 'dashboard', label: 'Home', helper: 'Today and open decisions', Icon: LayoutDashboard, accent: 'bg-violet-900/40', accentText: 'text-violet-300', accentBorder: 'border-violet-500' },
  { path: 'teams', label: 'Teams', helper: 'Calendar, roster, groups', Icon: Users2, accent: 'bg-sky-900/40', accentText: 'text-sky-300', accentBorder: 'border-sky-500', requires: 'canManageTeams' },
  { path: 'load-monitor', label: 'Load', helper: 'ACWR and load signals', Icon: Activity, accent: 'bg-orange-900/40', accentText: 'text-orange-300', accentBorder: 'border-orange-500' },
  { path: 'alerts', label: 'Alerts', helper: 'Issues to review', Icon: Bell, accent: 'bg-red-900/40', accentText: 'text-red-300', accentBorder: 'border-red-500' },
  { path: 'facilities', label: 'Facilities', helper: 'Courts and rooms', Icon: Warehouse, accent: 'bg-teal-900/40', accentText: 'text-teal-300', accentBorder: 'border-teal-500', requires: 'canManageFacilities' },
  { path: 'settings', label: 'Settings', helper: 'Workflow and admin', Icon: Settings, accent: 'bg-gray-800/70', accentText: 'text-gray-300', accentBorder: 'border-gray-500' },
];

const ROUTE_ALIASES: Record<string, string> = {
  sessions: 'teams',
  calendar: 'teams',
  players: 'teams',
  groups: 'teams',
  attendance: 'teams',
  analytics: 'load-monitor',
};

const NAV_SECTIONS: NavSection[] = [
  { title: 'Coach workflow', description: 'Start with today, then work inside a team', paths: ['dashboard', 'teams', 'load-monitor', 'alerts'] },
  { title: 'Operations', description: 'Resources and preferences', paths: ['facilities', 'settings'] },
];

const MOBILE_PRIMARY_NAV = ['dashboard', 'teams', 'load-monitor', 'alerts', 'settings'];

interface Props {
  user: User;
  trainerName: string;
  onBack: () => void;
  initialDemoMode?: boolean;
  lockDemoMode?: boolean;
}

export function CoachShell({ user, trainerName, onBack, initialDemoMode = false, lockDemoMode = false }: Props) {
  const navigate = useNavigate();
  const location = useLocation();

  const [org,          setOrg]          = useState<Organization | null>(null);
  const [departments,  setDepartments]  = useState<Department[]>([]);
  const [coachName,    setCoachName]    = useState(trainerName);
  const [coachContext, setCoachContext] = useState<CoachContext | null>(null);
  const [demoMode,     setDemoModeState] = useState(initialDemoMode);

  const [teams,    setTeams]    = useState<AttendanceTeam[]>([]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [loading,  setLoading]  = useState(!initialDemoMode);

  const [roster, setRoster] = useState<ManagedAthlete[]>([]);
  const [groups, setGroups] = useState<AthleteGroup[]>([]);

  const permissions = useMemo(() => getCoachPermissions(coachContext), [coachContext]);
  const navItems = useMemo(() => NAV_ITEMS.filter(item => !item.requires || Boolean(permissions[item.requires])), [permissions]);
  const navItemsByPath = useMemo(() => new Map(navItems.map(item => [item.path, item])), [navItems]);
  const navSections = useMemo(() => NAV_SECTIONS
    .map(section => ({
      ...section,
      items: section.paths.map(path => navItemsByPath.get(path)).filter((item): item is NavItem => Boolean(item)),
    }))
    .filter(section => section.items.length > 0), [navItemsByPath]);
  const mobileNavItems = useMemo(() => navItems.filter(item => MOBILE_PRIMARY_NAV.includes(item.path)), [navItems]);
  const demoData = useMemo(() => buildCoachDemoData(user.id), [user.id]);

  const activeOrg = demoMode ? demoData.org : org;
  const activeDepartments = demoMode ? demoData.departments : departments;
  const activeTeams = demoMode ? demoData.teams : teams;
  const activeSessions = demoMode ? demoData.sessions : sessions;
  const activeRoster = demoMode ? demoData.roster : roster;
  const activeGroups = demoMode ? demoData.groups : groups;

  const setDemoMode = useCallback((value: boolean) => {
    if (lockDemoMode) {
      setDemoModeState(true);
      return;
    }
    setDemoModeState(value);
  }, [lockDemoMode]);

  const reload = useCallback(async () => {
    if (lockDemoMode) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [ctx, orgData, ss, profileRow] = await Promise.all([
      loadMyCoachContext(user.id),
      loadMyOrganization(user.id),
      loadTrainerSessions(user.id),
      supabase.from('profiles').select('name').eq('id', user.id).maybeSingle(),
    ]);

    setCoachContext(ctx);
    setOrg(orgData ?? ctx?.org ?? null);
    setSessions(ss);

    const profileName = (profileRow.data as { name?: string } | null)?.name;
    if (profileName) setCoachName(profileName);

    const ts = await loadTeamsForCoach(user.id);
    setTeams(ts);

    const resolvedOrg = orgData ?? ctx?.org ?? null;
    if (resolvedOrg) {
      const depts = await loadDepartments(resolvedOrg.id);
      setDepartments(depts);
      if (!orgData && ctx?.org) setOrg(ctx.org);
    }

    setLoading(false);
  }, [lockDemoMode, user.id]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    if (lockDemoMode) return;
    const saved = loadRoster();
    setRoster(saved.athletes);
    setGroups(saved.groups);
    if (!CLOUD_ENABLED) return;
    loadRosterFromSupabase(user.id).then(({ athletes, groups: grps }) => {
      if (athletes.length > 0 || grps.length > 0) {
        const mapped = {
          athletes: athletes.map(a => ({
            id: a.id, token: a.token, name: a.name, sport: a.sport,
            groupIds: a.group_ids ?? [],
            addedAt:  a.added_at  ?? '',
          })),
          groups: grps.map(g => ({ id: g.id, name: g.name, color: g.color })),
        };
        setRoster(mapped.athletes);
        setGroups(mapped.groups);
        saveRoster(mapped);
      }
    });
  }, [lockDemoMode, user.id]);

  async function onCreateDepartment(name: string, sport?: string) {
    if (demoMode || !org || !permissions.canManageDepartments) return;
    const dept = await createDepartment(org.id, name, sport);
    if (dept) setDepartments(prev => [...prev, dept]);
  }

  async function onDeleteDepartment(deptId: string) {
    if (demoMode || !permissions.canManageDepartments) return;
    await deleteDepartment(deptId);
    setDepartments(prev => prev.filter(d => d.id !== deptId));
  }

  async function onCreateTeam(name: string, sport: string, color: string) {
    if (demoMode || !permissions.canManageTeams) return;
    const team = await createTeam(user.id, name, sport, color);
    if (team) setTeams(prev => [...prev, team]);
  }

  async function onDeleteTeam(teamId: string) {
    if (demoMode || !permissions.canManageTeams) return;
    await deleteTeam(teamId);
    setTeams(prev => prev.filter(t => t.id !== teamId));
  }

  async function onAssignTeam(teamId: string, deptId: string | null) {
    if (demoMode || !permissions.canManageTeams) return;
    const ok = await updateTeamDepartment(teamId, deptId, org?.id ?? null);
    if (ok) {
      setTeams(prev => prev.map(t =>
        t.id === teamId
          ? { ...t, departmentId: deptId ?? undefined, organizationId: org?.id ?? t.organizationId }
          : t
      ));
    }
  }

  const pathSegment = location.pathname.split('/coach/')[1]?.split('/')[0] ?? 'dashboard';
  const activePath = ROUTE_ALIASES[pathSegment] ?? pathSegment;
  const activeNav = navItems.find(n => n.path === activePath)
    ?? navItems[0]
    ?? NAV_ITEMS[0];
  const activeSection = navSections.find(section => section.items.some(item => item.path === activeNav.path)) ?? navSections[0];

  const outletCtx: CoachOutletContext = {
    user, org: activeOrg, departments: activeDepartments, teams: activeTeams, sessions: activeSessions,
    coachContext, permissions, coachName, loading: demoMode ? false : loading,
    roster: activeRoster, groups: activeGroups, demoMode, setDemoMode, reload,
    onCreateDepartment, onDeleteDepartment,
    onCreateTeam, onDeleteTeam,
    onAssignTeam,
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <header className="flex-shrink-0 border-b border-gray-800 bg-gray-950/90 backdrop-blur-xl sticky top-0 z-20">
        <div className="flex items-center gap-3 px-3 sm:px-4 h-13 py-2.5">
          <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0">
            <ChevronLeft size={14} /> App
          </button>

          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-7 h-7 bg-gradient-to-br from-violet-500 to-purple-700 rounded-lg flex items-center justify-center text-xs font-black shadow-lg shadow-violet-900/30 flex-shrink-0">TL</div>
            <div className="min-w-0">
              <span className="block truncate text-sm font-semibold text-white leading-none">{activeOrg?.name ?? 'TeamLoad'}</span>
              <span className="hidden text-[11px] text-gray-500 sm:inline">{demoMode ? `Demo club - ${roleLabel(permissions.role)}` : `${coachName} - ${roleLabel(permissions.role)}`}</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setDemoMode(!demoMode)}
              disabled={lockDemoMode}
              title={lockDemoMode ? 'Demo preview is locked for local demo mode' : 'Toggle demo data'}
              className={`text-xs font-semibold px-2.5 py-1 rounded-lg border transition-colors ${demoMode ? 'bg-green-900/40 border-green-700 text-green-300' : 'bg-gray-900 border-gray-700 text-gray-400 hover:text-white hover:border-gray-500'} ${lockDemoMode ? 'cursor-not-allowed opacity-80' : ''}`}
            >
              Demo {demoMode ? 'on' : 'off'}
            </button>
            <span className={`hidden sm:block text-xs font-medium px-2.5 py-1 rounded-lg ${activeNav.accent} ${activeNav.accentText}`}>{activeSection?.title ?? 'Coach'} / {activeNav.label}</span>
            <button onClick={reload} title="Refresh data" className="p-1.5 rounded-lg text-gray-600 hover:text-gray-400 hover:bg-gray-800 transition-colors">
              <RefreshCw size={13} className={loading && !demoMode ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <nav className="hidden sm:flex flex-col w-60 border-r border-gray-800 bg-gray-950 flex-shrink-0 py-3 overflow-y-auto">
          <div className="px-3 pb-3">
            <button
              onClick={() => navigate('/coach/teams')}
              className="w-full rounded-2xl border border-sky-900/40 bg-sky-950/20 px-3 py-3 text-left transition-colors hover:border-sky-700/70"
            >
              <p className="text-xs font-black uppercase tracking-wide text-sky-300">Lowest-friction path</p>
              <p className="mt-1 text-[11px] leading-4 text-gray-500">Team, then calendar session, then attendance. No separate attendance hunt.</p>
            </button>
          </div>

          <div className="space-y-3 px-2 pb-4">
            {navSections.map(section => (
              <div key={section.title}>
                <div className="px-2 pb-1.5">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-600">{section.title}</p>
                  <p className="mt-0.5 text-[10px] text-gray-700">{section.description}</p>
                </div>
                <div className="space-y-0.5">
                  {section.items.map(item => {
                    const isActive = activeNav.path === item.path;
                    return (
                      <button
                        key={item.path}
                        onClick={() => navigate(`/coach/${item.path}`)}
                        className={`flex w-full items-center gap-2.5 rounded-xl border-l-2 px-3 py-2 text-left transition-colors ${isActive ? `${item.accent} ${item.accentText} ${item.accentBorder}` : 'border-transparent text-gray-500 hover:bg-gray-800/40 hover:text-gray-200'}`}
                      >
                        <item.Icon size={15} className="flex-shrink-0" />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold leading-4">{item.label}</span>
                          <span className="block truncate text-[10px] leading-4 opacity-70">{item.helper}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </nav>

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-3 py-3 pb-28 sm:px-4 sm:py-4 sm:pb-6 space-y-4">
            <Outlet context={outletCtx} />
          </div>
        </main>
      </div>

      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-20 bg-gray-950/95 backdrop-blur-2xl border-t border-gray-800" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex items-stretch h-[64px] px-1">
          {mobileNavItems.map(item => {
            const isActive = activeNav.path === item.path;
            return (
              <button key={item.path} onClick={() => navigate(`/coach/${item.path}`)} className="relative flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors">
                {isActive && <span className="absolute inset-x-1 top-1.5 bottom-1.5 rounded-xl bg-gray-800/80" />}
                <item.Icon size={18} className={`relative transition-colors ${isActive ? item.accentText : 'text-gray-600'}`} />
                <span className={`relative text-[9px] font-semibold tracking-wide transition-colors ${isActive ? item.accentText : 'text-gray-600'}`}>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function buildCoachDemoData(userId: string): {
  org: Organization;
  departments: Department[];
  teams: AttendanceTeam[];
  sessions: AttendanceSession[];
  roster: ManagedAthlete[];
  groups: AthleteGroup[];
} {
  const createdAt = new Date().toISOString();
  const org: Organization = {
    id: 'demo-org',
    name: 'TeamLoad Demo Club',
    slug: 'teamload-demo-club',
    sport: 'Basketball',
    createdAt,
  };
  const departments: Department[] = [
    { id: 'demo-dept-performance', organizationId: org.id, name: 'Performance Program', sport: 'Basketball', createdAt },
    { id: 'demo-dept-youth', organizationId: org.id, name: 'Youth Academy', sport: 'Basketball', createdAt },
  ];
  const teams: AttendanceTeam[] = [
    team('demo-team-u18', userId, 'U18 Boys', '#8b5cf6', departments[0].id, org.id, createdAt),
    team('demo-team-u16', userId, 'U16 Boys', '#06b6d4', departments[1].id, org.id, createdAt),
    team('demo-team-guards', 'demo-assistant-coach', 'Guards Group', '#22c55e', departments[0].id, org.id, createdAt),
    team('demo-team-bigmen', 'demo-assistant-coach', 'Bigs Development', '#f97316', departments[0].id, org.id, createdAt),
  ];
  const sessions: AttendanceSession[] = [
    session('demo-session-1', userId, 'U18 Practice - Defensive Shell + SSG', 0, '18:30', '20:00', 'Main Court', teams[0].id, departments[0].id, org.id, 'Training', 'Coach focus: closeouts, help-side rotations, 4v4 small-sided games.'),
    session('demo-session-2', userId, 'U16 Strength Primer', 0, '17:15', '18:00', 'Weight Room', teams[1].id, departments[1].id, org.id, 'S&C', 'Primer before court work. Low volume, high intent.'),
    session('demo-session-3', 'demo-assistant-coach', 'Guards Shooting Workout', 1, '16:45', '18:00', 'Court 2', teams[2].id, departments[0].id, org.id, 'Training', 'Catch-and-shoot, advantage reads, late-clock decisions.'),
    session('demo-session-4', userId, 'U18 Video + Scout', 1, '19:00', '20:00', 'Video Room', teams[0].id, departments[0].id, org.id, 'Videoanalyse', 'Opponent scout and transition defense clips.'),
    session('demo-session-5', 'demo-assistant-coach', 'Bigs Finishing Unit', 2, '18:00', '19:15', 'Court 1', teams[3].id, departments[0].id, org.id, 'Training', 'Rim finishing, seals, short-roll reads.'),
    session('demo-session-6', userId, 'U16 League Game', 3, '14:00', '16:00', 'Arena A', teams[1].id, departments[1].id, org.id, 'Spiel', 'Availability lock 24h before tip-off.'),
    session('demo-session-7', userId, 'Regeneration + Mobility', 4, '17:30', '18:15', 'Recovery Room', teams[0].id, departments[0].id, org.id, 'Regeneration', 'Low load session for elevated ACWR players.'),
  ];
  const groups: AthleteGroup[] = [
    { id: 'demo-group-starters', name: 'Starters', color: 'violet' },
    { id: 'demo-group-guards', name: 'Guards', color: 'sky' },
    { id: 'demo-group-return', name: 'Return to Load', color: 'emerald' },
    { id: 'demo-group-risk', name: 'Load Watch', color: 'amber' },
  ];
  const roster: ManagedAthlete[] = [
    athlete('demo-athlete-noah', 'Noah K.', ['demo-group-starters', 'demo-group-guards'], createdAt),
    athlete('demo-athlete-elias', 'Elias M.', ['demo-group-starters', 'demo-group-risk'], createdAt),
    athlete('demo-athlete-jonas', 'Jonas B.', ['demo-group-guards'], createdAt),
    athlete('demo-athlete-leo', 'Leo S.', ['demo-group-risk', 'demo-group-return'], createdAt),
    athlete('demo-athlete-mika', 'Mika T.', ['demo-group-return'], createdAt),
    athlete('demo-athlete-amin', 'Amin R.', ['demo-group-starters'], createdAt),
    athlete('demo-athlete-finn', 'Finn L.', ['demo-group-guards'], createdAt),
    athlete('demo-athlete-tom', 'Tom W.', ['demo-group-risk'], createdAt),
  ];

  return { org, departments, teams, sessions, roster, groups };
}

function team(id: string, trainerId: string, name: string, color: string, departmentId: string, organizationId: string, createdAt: string): AttendanceTeam {
  return {
    id,
    trainerId,
    name,
    sport: 'Basketball',
    color,
    inviteToken: null,
    inviteActive: true,
    createdAt,
    departmentId,
    organizationId,
  };
}

function session(
  id: string,
  trainerId: string,
  title: string,
  dayOffset: number,
  startTime: string,
  endTime: string,
  location: string,
  teamId: string,
  departmentId: string,
  organizationId: string,
  trainingType: AttendanceSession['trainingType'],
  coachNote: string,
): AttendanceSession {
  return {
    id,
    trainerId,
    title,
    description: coachNote,
    datum: offsetIso(dayOffset),
    startTime,
    endTime,
    location,
    radiusM: 75,
    teamId,
    departmentId,
    organizationId,
    trainingType,
    coachNote,
    createdAt: new Date().toISOString(),
  };
}

function athlete(id: string, name: string, groupIds: string[], addedAt: string): ManagedAthlete {
  return {
    id,
    name,
    sport: 'Basketball',
    token: `demo-${id}`,
    groupIds,
    addedAt,
  };
}

function offsetIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}
