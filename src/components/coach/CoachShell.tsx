import { useState, useEffect, useCallback, useMemo } from 'react';
import type { ElementType } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users2, Building2, Warehouse, ChevronLeft, RefreshCw,
  ClipboardList, CalendarDays, UserRound, Activity, CheckCircle2, BarChart3, Bell, Settings,
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
  Icon: ElementType;
  accent: string;
  accentText: string;
  accentBorder: string;
  requires?: keyof PermissionSet;
}

const NAV_ITEMS: NavItem[] = [
  { path: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard, accent: 'bg-violet-900/40', accentText: 'text-violet-300', accentBorder: 'border-violet-500' },
  { path: 'sessions', label: 'Sessions', Icon: ClipboardList, accent: 'bg-blue-900/40', accentText: 'text-blue-300', accentBorder: 'border-blue-500' },
  { path: 'calendar', label: 'Calendar', Icon: CalendarDays, accent: 'bg-cyan-900/40', accentText: 'text-cyan-300', accentBorder: 'border-cyan-500' },
  { path: 'players', label: 'Players', Icon: UserRound, accent: 'bg-indigo-900/40', accentText: 'text-indigo-300', accentBorder: 'border-indigo-500' },
  { path: 'groups', label: 'Groups', Icon: Users2, accent: 'bg-purple-900/40', accentText: 'text-purple-300', accentBorder: 'border-purple-500' },
  { path: 'teams', label: 'Teams', Icon: Users2, accent: 'bg-sky-900/40', accentText: 'text-sky-300', accentBorder: 'border-sky-500', requires: 'canManageTeams' },
  { path: 'department', label: 'Departments', Icon: Building2, accent: 'bg-emerald-900/40', accentText: 'text-emerald-300', accentBorder: 'border-emerald-500', requires: 'canManageDepartments' },
  { path: 'facilities', label: 'Facilities', Icon: Warehouse, accent: 'bg-teal-900/40', accentText: 'text-teal-300', accentBorder: 'border-teal-500', requires: 'canManageFacilities' },
  { path: 'load-monitor', label: 'Load', Icon: Activity, accent: 'bg-orange-900/40', accentText: 'text-orange-300', accentBorder: 'border-orange-500' },
  { path: 'attendance', label: 'Attendance', Icon: CheckCircle2, accent: 'bg-green-900/40', accentText: 'text-green-300', accentBorder: 'border-green-500', requires: 'canFinalizeAttendance' },
  { path: 'analytics', label: 'Analytics', Icon: BarChart3, accent: 'bg-amber-900/40', accentText: 'text-amber-300', accentBorder: 'border-amber-500', requires: 'canViewAnalytics' },
  { path: 'alerts', label: 'Alerts', Icon: Bell, accent: 'bg-red-900/40', accentText: 'text-red-300', accentBorder: 'border-red-500' },
  { path: 'settings', label: 'Settings', Icon: Settings, accent: 'bg-gray-800/70', accentText: 'text-gray-300', accentBorder: 'border-gray-500' },
];

interface Props {
  user: User;
  trainerName: string;
  onBack: () => void;
}

export function CoachShell({ user, trainerName, onBack }: Props) {
  const navigate = useNavigate();
  const location = useLocation();

  const [org,          setOrg]          = useState<Organization | null>(null);
  const [departments,  setDepartments]  = useState<Department[]>([]);
  const [coachName,    setCoachName]    = useState(trainerName);
  const [coachContext, setCoachContext] = useState<CoachContext | null>(null);
  const [demoMode,     setDemoMode]     = useState(false);

  const [teams,    setTeams]    = useState<AttendanceTeam[]>([]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [loading,  setLoading]  = useState(true);

  const [roster, setRoster] = useState<ManagedAthlete[]>([]);
  const [groups, setGroups] = useState<AthleteGroup[]>([]);

  const permissions = useMemo(() => getCoachPermissions(coachContext), [coachContext]);
  const navItems = useMemo(() => NAV_ITEMS.filter(item => !item.requires || Boolean(permissions[item.requires])), [permissions]);

  const reload = useCallback(async () => {
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
  }, [user.id]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
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
  }, [user.id]);

  async function onCreateDepartment(name: string, sport?: string) {
    if (!org || !permissions.canManageDepartments) return;
    const dept = await createDepartment(org.id, name, sport);
    if (dept) setDepartments(prev => [...prev, dept]);
  }

  async function onDeleteDepartment(deptId: string) {
    if (!permissions.canManageDepartments) return;
    await deleteDepartment(deptId);
    setDepartments(prev => prev.filter(d => d.id !== deptId));
  }

  async function onCreateTeam(name: string, sport: string, color: string) {
    if (!permissions.canManageTeams) return;
    const team = await createTeam(user.id, name, sport, color);
    if (team) setTeams(prev => [...prev, team]);
  }

  async function onDeleteTeam(teamId: string) {
    if (!permissions.canManageTeams) return;
    await deleteTeam(teamId);
    setTeams(prev => prev.filter(t => t.id !== teamId));
  }

  async function onAssignTeam(teamId: string, deptId: string | null) {
    if (!permissions.canManageTeams) return;
    const ok = await updateTeamDepartment(teamId, deptId, org?.id ?? null);
    if (ok) {
      setTeams(prev => prev.map(t =>
        t.id === teamId
          ? { ...t, departmentId: deptId ?? undefined, organizationId: org?.id ?? t.organizationId }
          : t
      ));
    }
  }

  const activeNav = navItems.find(n => location.pathname.includes(`/coach/${n.path}`))
    ?? navItems[0]
    ?? NAV_ITEMS[0];

  const outletCtx: CoachOutletContext = {
    user, org, departments, teams, sessions,
    coachContext, permissions, coachName, loading,
    roster, groups, demoMode, setDemoMode, reload,
    onCreateDepartment, onDeleteDepartment,
    onCreateTeam, onDeleteTeam,
    onAssignTeam,
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <header className="flex-shrink-0 border-b border-gray-800 bg-gray-950/90 backdrop-blur-xl sticky top-0 z-20">
        <div className="flex items-center gap-3 px-4 h-13 py-2.5">
          <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0">
            <ChevronLeft size={14} /> App
          </button>

          <div className="flex items-center gap-2 flex-1">
            <div className="w-7 h-7 bg-gradient-to-br from-violet-500 to-purple-700 rounded-lg flex items-center justify-center text-xs font-black shadow-lg shadow-violet-900/30 flex-shrink-0">TL</div>
            <div className="min-w-0">
              <span className="text-sm font-semibold text-white leading-none">{org?.name ?? 'TeamLoad'}</span>
              <span className="text-[11px] text-gray-500 ml-2 hidden sm:inline">{demoMode ? 'Demo roster active' : `${coachName} · ${roleLabel(permissions.role)}`}</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setDemoMode(!demoMode)}
              title="Toggle demo data"
              className={`text-xs font-semibold px-2.5 py-1 rounded-lg border transition-colors ${demoMode ? 'bg-green-900/40 border-green-700 text-green-300' : 'bg-gray-900 border-gray-700 text-gray-400 hover:text-white hover:border-gray-500'}`}
            >
              Demo {demoMode ? 'on' : 'off'}
            </button>
            <span className={`hidden sm:block text-xs font-medium px-2.5 py-1 rounded-lg ${activeNav.accent} ${activeNav.accentText}`}>{activeNav.label}</span>
            <button onClick={reload} title="Refresh data" className="p-1.5 rounded-lg text-gray-600 hover:text-gray-400 hover:bg-gray-800 transition-colors">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <nav className="hidden sm:flex flex-col w-48 border-r border-gray-800 bg-gray-950 flex-shrink-0 py-3 gap-0.5 overflow-y-auto">
          {navItems.map(item => {
            const isActive = location.pathname.includes(`/coach/${item.path}`);
            return (
              <button
                key={item.path}
                onClick={() => navigate(`/coach/${item.path}`)}
                className={`flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition-colors border-l-2 ${isActive ? `${item.accent} ${item.accentText} ${item.accentBorder}` : 'text-gray-500 hover:text-gray-200 hover:bg-gray-800/40 border-transparent'}`}
              >
                <item.Icon size={15} className="flex-shrink-0" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-4 py-4 pb-28 sm:pb-6 space-y-4">
            <Outlet context={outletCtx} />
          </div>
        </main>
      </div>

      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-20 bg-gray-950/95 backdrop-blur-2xl border-t border-gray-800" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex items-stretch h-[60px] px-1">
          {navItems.filter(item => ['dashboard', 'sessions', 'calendar', 'load-monitor', 'alerts'].includes(item.path)).map(item => {
            const isActive = location.pathname.includes(`/coach/${item.path}`);
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
