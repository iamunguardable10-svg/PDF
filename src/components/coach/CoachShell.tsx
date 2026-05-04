import { useState, useEffect, useCallback } from 'react';
import type { ElementType } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, CalendarDays, ClipboardList, UserRound, Users2,
  Activity, CheckCircle2, BarChart3, Bell, Settings, Building2,
  Warehouse, ChevronLeft, RefreshCw,
} from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import type { AttendanceTeam, AttendanceSession } from '../../types/attendance';
import type { ManagedAthlete, AthleteGroup } from '../../types/trainerDashboard';
import type { Organization, Department } from '../../types/organization';
import type { CoachContext } from '../../lib/coachRole';
import { loadTrainerSessions, loadTeamsForCoach, createTeam, deleteTeam, updateTeamDepartment } from '../../lib/attendanceStorage';
import { loadRoster, saveRoster } from '../../lib/trainerRoster';
import { loadRosterFromSupabase } from '../../lib/trainerShare';
import { loadMyOrganization, createDepartment, deleteDepartment, loadDepartments } from '../../lib/organizationStorage';
import { loadMyCoachContext } from '../../lib/coachRole';
import { supabase, CLOUD_ENABLED } from '../../lib/supabase';

export interface CoachOutletContext {
  user: User;
  org: Organization | null;
  departments: Department[];
  teams: AttendanceTeam[];
  sessions: AttendanceSession[];
  coachContext: CoachContext | null;
  coachName: string;
  loading: boolean;
  roster: ManagedAthlete[];
  groups: AthleteGroup[];
  reload: () => void;
  onCreateDepartment: (name: string, sport?: string) => Promise<void>;
  onDeleteDepartment: (deptId: string) => Promise<void>;
  onCreateTeam: (name: string, sport: string, color: string) => Promise<void>;
  onDeleteTeam: (teamId: string) => Promise<void>;
  onAssignTeam: (teamId: string, deptId: string | null) => Promise<void>;
}

interface NavItem {
  path: string;
  label: string;
  Icon: ElementType;
  section: 'operate' | 'manage' | 'monitor' | 'system';
}

const NAV_ITEMS: NavItem[] = [
  { path: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard, section: 'operate' },
  { path: 'sessions', label: 'Sessions', Icon: ClipboardList, section: 'operate' },
  { path: 'calendar', label: 'Calendar', Icon: CalendarDays, section: 'operate' },
  { path: 'players', label: 'Players', Icon: UserRound, section: 'manage' },
  { path: 'groups', label: 'Groups', Icon: Users2, section: 'manage' },
  { path: 'teams', label: 'Teams', Icon: Users2, section: 'manage' },
  { path: 'department', label: 'Departments', Icon: Building2, section: 'manage' },
  { path: 'facilities', label: 'Facilities', Icon: Warehouse, section: 'manage' },
  { path: 'load-monitor', label: 'Load Monitor', Icon: Activity, section: 'monitor' },
  { path: 'attendance', label: 'Attendance', Icon: CheckCircle2, section: 'monitor' },
  { path: 'analytics', label: 'Analytics', Icon: BarChart3, section: 'monitor' },
  { path: 'alerts', label: 'Alerts', Icon: Bell, section: 'monitor' },
  { path: 'settings', label: 'Settings', Icon: Settings, section: 'system' },
];

const SECTION_LABELS: Record<NavItem['section'], string> = {
  operate: 'Operate', manage: 'Manage', monitor: 'Monitor', system: 'System',
};

interface Props {
  user: User;
  trainerName: string;
  onBack: () => void;
}

export function CoachShell({ user, trainerName, onBack }: Props) {
  const navigate = useNavigate();
  const location = useLocation();

  const [org, setOrg] = useState<Organization | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [coachName, setCoachName] = useState(trainerName);
  const [coachContext, setCoachContext] = useState<CoachContext | null>(null);
  const [teams, setTeams] = useState<AttendanceTeam[]>([]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [roster, setRoster] = useState<ManagedAthlete[]>([]);
  const [groups, setGroups] = useState<AthleteGroup[]>([]);

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
            groupIds: a.group_ids ?? [], addedAt: a.added_at ?? '',
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
    if (!org) return;
    const dept = await createDepartment(org.id, name, sport);
    if (dept) setDepartments(prev => [...prev, dept]);
  }

  async function onDeleteDepartment(deptId: string) {
    await deleteDepartment(deptId);
    setDepartments(prev => prev.filter(d => d.id !== deptId));
  }

  async function onCreateTeam(name: string, sport: string, color: string) {
    const team = await createTeam(user.id, name, sport, color);
    if (team) setTeams(prev => [...prev, team]);
  }

  async function onDeleteTeam(teamId: string) {
    await deleteTeam(teamId);
    setTeams(prev => prev.filter(t => t.id !== teamId));
  }

  async function onAssignTeam(teamId: string, deptId: string | null) {
    const ok = await updateTeamDepartment(teamId, deptId, org?.id ?? null);
    if (ok) {
      setTeams(prev => prev.map(t => t.id === teamId
        ? { ...t, departmentId: deptId ?? undefined, organizationId: org?.id ?? t.organizationId }
        : t
      ));
    }
  }

  const activeNav = NAV_ITEMS.find(n => location.pathname.includes(`/coach/${n.path}`)) ?? NAV_ITEMS[0];
  const grouped = NAV_ITEMS.reduce<Record<NavItem['section'], NavItem[]>>((acc, item) => {
    acc[item.section].push(item);
    return acc;
  }, { operate: [], manage: [], monitor: [], system: [] });

  const outletCtx: CoachOutletContext = {
    user, org, departments, teams, sessions, coachContext, coachName, loading,
    roster, groups, reload, onCreateDepartment, onDeleteDepartment, onCreateTeam,
    onDeleteTeam, onAssignTeam,
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950 flex">
      <aside className="hidden lg:flex w-64 flex-col bg-slate-950 text-white">
        <div className="px-5 py-5 border-b border-white/10">
          <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white mb-4">
            <ChevronLeft size={14} /> Switch role
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center font-black">TL</div>
            <div className="min-w-0">
              <p className="font-bold">TeamLoad</p>
              <p className="text-xs text-slate-400 truncate">{org?.name ?? 'Coach OS'}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {(Object.keys(grouped) as NavItem['section'][]).map(section => (
            <div key={section}>
              <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{SECTION_LABELS[section]}</p>
              <div className="space-y-1">
                {grouped[section].map(item => {
                  const active = location.pathname.includes(`/coach/${item.path}`);
                  return (
                    <button
                      key={item.path}
                      onClick={() => navigate(`/coach/${item.path}`)}
                      className={`w-full flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition-all ${active ? 'bg-white text-slate-950' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
                    >
                      <item.Icon size={18} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10">
          <p className="text-sm font-semibold truncate">{coachName}</p>
          <p className="text-xs text-slate-400">{coachContext?.role ?? 'Coach'}</p>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 bg-white/85 backdrop-blur-xl border-b border-slate-200">
          <div className="flex items-center gap-3 px-4 sm:px-6 h-16">
            <div className="lg:hidden w-9 h-9 rounded-2xl bg-slate-950 text-white flex items-center justify-center text-xs font-black">TL</div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{activeNav.label}</p>
              <h1 className="text-lg font-bold truncate">{org?.name ?? 'TeamLoad Coach OS'}</h1>
            </div>
            <button onClick={reload} className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold">
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-28 lg:pb-8">
            <Outlet context={outletCtx} />
          </div>
        </main>
      </div>

      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-2xl border-t border-slate-200 shadow-2xl" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="grid grid-cols-5 h-[68px] px-1">
          {NAV_ITEMS.filter(i => ['dashboard', 'sessions', 'calendar', 'load-monitor', 'alerts'].includes(i.path)).map(item => {
            const active = location.pathname.includes(`/coach/${item.path}`);
            return (
              <button key={item.path} onClick={() => navigate(`/coach/${item.path}`)} className="flex flex-col items-center justify-center gap-1">
                <item.Icon size={20} className={active ? 'text-blue-600' : 'text-slate-400'} />
                <span className={`text-[10px] font-bold ${active ? 'text-blue-600' : 'text-slate-400'}`}>{item.label.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
