import { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard, Warehouse, Activity,
  ChevronLeft, RefreshCw,
} from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import type { AttendanceTeam, AttendanceSession } from '../../types/attendance';
import type { ManagedAthlete, AthleteGroup } from '../../types/trainerDashboard';
import type { Organization, Department } from '../../types/organization';
import {
  loadTeams,
  loadTrainerSessions,
  updateTeamDepartment,
} from '../../lib/attendanceStorage';
import {
  loadRoster, saveRoster,
} from '../../lib/trainerRoster';
import {
  loadRosterFromSupabase,
} from '../../lib/trainerShare';
import {
  loadMyOrganization,
  createDepartment,
  loadDepartments,
} from '../../lib/organizationStorage';
import { CLOUD_ENABLED } from '../../lib/supabase';
import { AttendanceModule } from '../attendance/AttendanceModule';
import { FacilityCalendar } from '../attendance/FacilityCalendar';
import { HallenManager } from '../attendance/HallenManager';
import { TrainerDashboard } from '../TrainerDashboard';
import { CoachDashboard } from './CoachDashboard';

// ── Types ─────────────────────────────────────────────────────────────────────

export type CoachTab = 'dashboard' | 'teams' | 'hallen' | 'performance';

interface NavItem {
  id:    CoachTab;
  label: string;
  Icon:  React.ElementType;
  accent: string;
  accentText: string;
  accentBorder: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'dashboard', label: 'Dashboard',
    Icon: LayoutDashboard,
    accent: 'bg-gray-800', accentText: 'text-white', accentBorder: 'border-gray-400',
  },
  {
    id: 'hallen', label: 'Hallen',
    Icon: Warehouse,
    accent: 'bg-teal-900/40', accentText: 'text-teal-300', accentBorder: 'border-teal-500',
  },
  {
    id: 'performance', label: 'Performance',
    Icon: Activity,
    accent: 'bg-emerald-900/40', accentText: 'text-emerald-300', accentBorder: 'border-emerald-500',
  },
];

interface Props {
  user: User;
  trainerName: string;
  onBack: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CoachShell({ user, trainerName, onBack }: Props) {

  const [tab, setTab] = useState<CoachTab>('dashboard');

  // Org + departments
  const [org,         setOrg]         = useState<Organization | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);

  // Teams & sessions
  const [teams,    setTeams]    = useState<AttendanceTeam[]>([]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [loading,  setLoading]  = useState(true);

  // Roster
  const [roster, setRoster] = useState<ManagedAthlete[]>([]);
  const [groups, setGroups] = useState<AthleteGroup[]>([]);

  // Hallen Manager modal
  const [showHallenMgr, setShowHallenMgr] = useState(false);

  // ── Load all data ─────────────────────────────────────────────────────────

  const reloadAll = useCallback(async () => {
    setLoading(true);
    const [orgData, ts, ss] = await Promise.all([
      loadMyOrganization(user.id),
      loadTeams(user.id),
      loadTrainerSessions(user.id),
    ]);
    setOrg(orgData);
    setTeams(ts);
    setSessions(ss);

    if (orgData) {
      const depts = await loadDepartments(orgData.id);
      setDepartments(depts);
    }

    setLoading(false);
  }, [user.id]);

  useEffect(() => { reloadAll(); }, [reloadAll]);

  // Roster
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  // ── Dept actions ──────────────────────────────────────────────────────────

  async function handleCreateDepartment(name: string, sport?: string) {
    if (!org) return;
    const dept = await createDepartment(org.id, name, sport);
    if (dept) setDepartments(prev => [...prev, dept]);
  }

  async function handleAssignTeam(teamId: string, deptId: string | null) {
    const ok = await updateTeamDepartment(teamId, deptId, org?.id ?? null);
    if (ok) {
      setTeams(prev => prev.map(t =>
        t.id === teamId ? { ...t, departmentId: deptId, organizationId: org?.id ?? t.organizationId } : t
      ));
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const activeNav = NAV_ITEMS.find(n => n.id === tab)!;

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">

      {/* Top bar */}
      <header className="flex-shrink-0 border-b border-gray-800 bg-gray-950/90 backdrop-blur-xl sticky top-0 z-20">
        <div className="flex items-center gap-3 px-4 h-13 py-2.5">
          <button onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0">
            <ChevronLeft size={14} />
            App
          </button>

          <div className="flex items-center gap-2 flex-1">
            <div className="w-7 h-7 bg-gradient-to-br from-violet-500 to-purple-700 rounded-lg flex items-center justify-center text-sm shadow-lg shadow-violet-900/30 flex-shrink-0">
              🏟
            </div>
            <div className="min-w-0">
              <span className="text-sm font-semibold text-white leading-none">
                {org?.name ?? 'Club OS'}
              </span>
              <span className="text-[11px] text-gray-500 ml-2 hidden sm:inline">{trainerName}</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span className={`hidden sm:block text-xs font-medium px-2.5 py-1 rounded-lg ${activeNav.accent} ${activeNav.accentText}`}>
              {activeNav.label}
            </span>
            <button onClick={reloadAll}
              title="Daten neu laden"
              className="p-1.5 rounded-lg text-gray-600 hover:text-gray-400 hover:bg-gray-800 transition-colors">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 min-h-0">

        {/* Sidebar — desktop */}
        <nav className="hidden sm:flex flex-col w-44 border-r border-gray-800 bg-gray-950 flex-shrink-0 py-3 gap-0.5">
          {NAV_ITEMS.map(item => {
            const isActive = tab === item.id;
            return (
              <button key={item.id} onClick={() => setTab(item.id)}
                className={`flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition-colors border-l-2 ${
                  isActive
                    ? `${item.accent} ${item.accentText} ${item.accentBorder}`
                    : 'text-gray-500 hover:text-gray-200 hover:bg-gray-800/40 border-transparent'
                }`}>
                <item.Icon size={15} className="flex-shrink-0" />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-4 py-4 pb-28 sm:pb-6 space-y-4">

            {/* Dashboard */}
            {tab === 'dashboard' && (
              <CoachDashboard
                trainerId={user.id}
                org={org}
                departments={departments}
                sessions={sessions}
                teams={teams}
                roster={roster}
                groups={groups}
                loading={loading}
                onGoToTeams={() => setTab('teams')}
                onGoToHallen={() => setTab('hallen')}
                onReload={reloadAll}
                onCreateDepartment={handleCreateDepartment}
                onAssignTeam={handleAssignTeam}
              />
            )}

            {/* Teams */}
            {tab === 'teams' && (
              <AttendanceModule
                trainerId={user.id}
                trainerName={trainerName}
                roster={roster}
                groups={groups}
              />
            )}

            {/* Hallen */}
            {tab === 'hallen' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h2 className="text-base font-semibold text-white">Hallenkalender</h2>
                    <p className="text-xs text-gray-500 mt-0.5">Buchungen, Konflikte und Sperrzeiten</p>
                  </div>
                  {org && (
                    <button
                      onClick={() => setShowHallenMgr(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-900/30 border border-teal-800/50 hover:bg-teal-800/40 text-teal-300 text-xs font-medium transition-colors"
                    >
                      <Warehouse size={12} /> Hallen verwalten
                    </button>
                  )}
                </div>

                {org ? (
                  <FacilityCalendar organizationId={org.id} teams={teams} />
                ) : (
                  <EmptyState
                    icon="⬡"
                    title="Kein Verein"
                    body="Lege zuerst einen Verein an, um Hallen zu verwalten."
                  />
                )}

                {showHallenMgr && org && (
                  <HallenManager
                    organizationId={org.id}
                    onClose={() => setShowHallenMgr(false)}
                    onChanged={reloadAll}
                  />
                )}
              </div>
            )}

            {/* Performance */}
            {tab === 'performance' && (
              <div className="space-y-3">
                <div>
                  <h2 className="text-base font-semibold text-white">Kader & Performance</h2>
                  <p className="text-xs text-gray-500 mt-0.5">ACWR, Belastungssteuerung und Athletenmonitoring</p>
                </div>
                <TrainerDashboard user={user} trainerName={trainerName} embedded />
              </div>
            )}

          </div>
        </main>
      </div>

      {/* Bottom nav — mobile */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-20 bg-gray-950/95 backdrop-blur-2xl border-t border-gray-800"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex items-stretch h-[60px] px-1">
          {NAV_ITEMS.map(item => {
            const isActive = tab === item.id;
            return (
              <button key={item.id} onClick={() => setTab(item.id)}
                className="relative flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors">
                {isActive && (
                  <span className="absolute inset-x-1 top-1.5 bottom-1.5 rounded-xl bg-gray-800/80" />
                )}
                <item.Icon
                  size={18}
                  className={`relative transition-colors ${isActive ? item.accentText : 'text-gray-600'}`}
                />
                <span className={`relative text-[9px] font-semibold tracking-wide transition-colors ${
                  isActive ? item.accentText : 'text-gray-600'
                }`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

// ── EmptyState ────────────────────────────────────────────────────────────────

function EmptyState({ icon, title, body, action }: {
  icon: string; title: string; body: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="text-center py-12 space-y-3">
      <div className="text-4xl text-gray-700">{icon}</div>
      <div>
        <p className="text-gray-400 text-sm font-medium">{title}</p>
        <p className="text-gray-600 text-xs mt-1 max-w-sm mx-auto">{body}</p>
      </div>
      {action && (
        <button onClick={action.onClick}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-xl transition-colors">
          {action.label}
        </button>
      )}
    </div>
  );
}
