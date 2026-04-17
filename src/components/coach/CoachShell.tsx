import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  LayoutDashboard, Users, Building2, Warehouse, Activity,
  ChevronLeft, RefreshCw,
} from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import type { AttendanceTeam, AttendanceSession } from '../../types/attendance';
import type { ManagedAthlete, AthleteGroup } from '../../types/trainerDashboard';
import {
  loadTeams,
  loadTrainerSessions,
} from '../../lib/attendanceStorage';
import {
  loadRoster, saveRoster,
} from '../../lib/trainerRoster';
import {
  loadRosterFromSupabase,
} from '../../lib/trainerShare';
import { CLOUD_ENABLED } from '../../lib/supabase';
import { AttendanceModule } from '../attendance/AttendanceModule';
import { DepartmentCalendar } from '../attendance/DepartmentCalendar';
import { FacilityCalendar } from '../attendance/FacilityCalendar';
import { TrainerDashboard } from '../TrainerDashboard';
import { CoachDashboard } from './CoachDashboard';

// ── Types ─────────────────────────────────────────────────────────────────────

export type CoachTab = 'dashboard' | 'teams' | 'abteilung' | 'hallen' | 'performance';

interface NavItem {
  id:    CoachTab;
  label: string;
  Icon:  React.ElementType;
  accent: string;          // active bg class
  accentText: string;      // active text class
  accentBorder: string;    // left border class (sidebar)
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'dashboard', label: 'Dashboard',
    Icon: LayoutDashboard,
    accent: 'bg-gray-800', accentText: 'text-white', accentBorder: 'border-gray-400',
  },
  {
    id: 'teams', label: 'Teams',
    Icon: Users,
    accent: 'bg-violet-900/40', accentText: 'text-violet-300', accentBorder: 'border-violet-500',
  },
  {
    id: 'abteilung', label: 'Abteilung',
    Icon: Building2,
    accent: 'bg-violet-900/40', accentText: 'text-violet-300', accentBorder: 'border-violet-400',
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
  /** Navigate back to the athlete app */
  onBack: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CoachShell({ user, trainerName, onBack }: Props) {

  // ── Navigation ─────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<CoachTab>('dashboard');

  // ── Data: teams & sessions (shared across Dashboard / Abteilung / Hallen) ──
  const [teams,    setTeams]    = useState<AttendanceTeam[]>([]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [loading,  setLoading]  = useState(true);

  // ── Data: roster (for SessionPlanner in Dashboard and Teams) ───────────────
  const [roster, setRoster] = useState<ManagedAthlete[]>([]);
  const [groups, setGroups] = useState<AthleteGroup[]>([]);

  // ── Dept / org picker state ────────────────────────────────────────────────
  const [activeDeptId, setActiveDeptId] = useState<string | null>(null);
  const [activeOrgId,  setActiveOrgId]  = useState<string | null>(null);

  // ── Initial data load ──────────────────────────────────────────────────────

  const reloadTeamsAndSessions = useCallback(async () => {
    setLoading(true);
    const [ts, ss] = await Promise.all([
      loadTeams(user.id),
      loadTrainerSessions(user.id),
    ]);
    setTeams(ts);
    setSessions(ss);
    setLoading(false);
  }, [user.id]);

  useEffect(() => { reloadTeamsAndSessions(); }, [reloadTeamsAndSessions]);

  // Roster: localStorage first, then Supabase
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

  // ── Derived dept / org lists ───────────────────────────────────────────────

  const availableDepts = useMemo(
    () => [...new Set(teams.map(t => t.departmentId).filter((id): id is string => !!id))],
    [teams],
  );
  const availableOrgs = useMemo(
    () => [...new Set(teams.map(t => t.organizationId).filter((id): id is string => !!id))],
    [teams],
  );

  const effectiveDeptId = activeDeptId ?? availableDepts[0] ?? null;
  const effectiveOrgId  = activeOrgId  ?? availableOrgs[0]  ?? null;

  // ── Dept switcher helper ───────────────────────────────────────────────────

  function DeptPicker() {
    if (availableDepts.length <= 1) return null;
    return (
      <div className="flex gap-1 flex-wrap">
        {availableDepts.map((id, idx) => (
          <button key={id} onClick={() => setActiveDeptId(id)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
              id === effectiveDeptId ? 'bg-violet-700 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-200'
            }`}>
            Abteilung {idx + 1}
          </button>
        ))}
      </div>
    );
  }

  function OrgPicker() {
    if (availableOrgs.length <= 1) return null;
    return (
      <div className="flex gap-1 flex-wrap">
        {availableOrgs.map((id, idx) => (
          <button key={id} onClick={() => setActiveOrgId(id)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
              id === effectiveOrgId ? 'bg-teal-700 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-200'
            }`}>
            Organisation {idx + 1}
          </button>
        ))}
      </div>
    );
  }

  // ── Active nav item styling ────────────────────────────────────────────────

  const activeNav = NAV_ITEMS.find(n => n.id === tab)!;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <header className="flex-shrink-0 border-b border-gray-800 bg-gray-950/90 backdrop-blur-xl sticky top-0 z-20">
        <div className="flex items-center gap-3 px-4 h-13 py-2.5">
          {/* Back to athlete app */}
          <button onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0">
            <ChevronLeft size={14} />
            App
          </button>

          {/* Logo / name */}
          <div className="flex items-center gap-2 flex-1">
            <div className="w-7 h-7 bg-gradient-to-br from-violet-500 to-purple-700 rounded-lg flex items-center justify-center text-sm shadow-lg shadow-violet-900/30 flex-shrink-0">
              🏟
            </div>
            <div className="min-w-0">
              <span className="text-sm font-semibold text-white leading-none">Club OS</span>
              <span className="text-[11px] text-gray-500 ml-2 hidden sm:inline">{trainerName}</span>
            </div>
          </div>

          {/* Active section label (mobile — replaces tabs) */}
          <div className="flex items-center gap-1.5">
            <span className={`hidden sm:block text-xs font-medium px-2.5 py-1 rounded-lg ${activeNav.accent} ${activeNav.accentText}`}>
              {activeNav.label}
            </span>
            <button onClick={reloadTeamsAndSessions}
              title="Daten neu laden"
              className="p-1.5 rounded-lg text-gray-600 hover:text-gray-400 hover:bg-gray-800 transition-colors">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </header>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* Sidebar navigation — desktop only ─────────────────────────────── */}
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

        {/* Main content ───────────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-4 py-4 pb-28 sm:pb-6 space-y-4">

            {/* ── Dashboard ──────────────────────────────────────────────── */}
            {tab === 'dashboard' && (
              <CoachDashboard
                trainerId={user.id}
                sessions={sessions}
                teams={teams}
                roster={roster}
                groups={groups}
                loading={loading}
                onGoToTab={setTab}
                onReload={reloadTeamsAndSessions}
              />
            )}

            {/* ── Teams ──────────────────────────────────────────────────── */}
            {tab === 'teams' && (
              <AttendanceModule
                trainerId={user.id}
                trainerName={trainerName}
                roster={roster}
                groups={groups}
              />
            )}

            {/* ── Abteilung ──────────────────────────────────────────────── */}
            {tab === 'abteilung' && (
              <div className="space-y-3">
                {/* Section header */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h2 className="text-base font-semibold text-white">Abteilungskalender</h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Alle Einheiten deiner Abteilung im Überblick
                    </p>
                  </div>
                  <DeptPicker />
                </div>

                {effectiveDeptId ? (
                  <DepartmentCalendar
                    departmentId={effectiveDeptId}
                    teams={teams}
                  />
                ) : (
                  <EmptyState
                    icon="◫"
                    title="Keine Abteilungsdaten"
                    body="Verknüpfe ein Team mit einer Abteilung (department_id), damit hier Einheiten aller Teams deiner Abteilung erscheinen."
                    action={{ label: 'Teams verwalten →', onClick: () => setTab('teams') }}
                  />
                )}
              </div>
            )}

            {/* ── Hallen ─────────────────────────────────────────────────── */}
            {tab === 'hallen' && (
              <div className="space-y-3">
                {/* Section header */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h2 className="text-base font-semibold text-white">Hallenkalender</h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Buchungen, Konflikte und Sperrzeiten je Bereich
                    </p>
                  </div>
                  <OrgPicker />
                </div>

                {effectiveOrgId ? (
                  <FacilityCalendar
                    organizationId={effectiveOrgId}
                    teams={teams}
                  />
                ) : (
                  <EmptyState
                    icon="⬡"
                    title="Keine Hallendaten"
                    body="Verknüpfe ein Team mit einer Organisation (organization_id) und lege Facilities an, damit hier Buchungen und Sperrzeiten erscheinen."
                    action={{ label: 'Teams verwalten →', onClick: () => setTab('teams') }}
                  />
                )}
              </div>
            )}

            {/* ── Performance ────────────────────────────────────────────── */}
            {tab === 'performance' && (
              <div className="space-y-3">
                <div>
                  <h2 className="text-base font-semibold text-white">Kader & Performance</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    ACWR, Belastungssteuerung und Athletenmonitoring
                  </p>
                </div>
                {/* Embed existing TrainerDashboard in embedded mode — kader/gruppen/übersicht tabs only */}
                <TrainerDashboard
                  user={user}
                  trainerName={trainerName}
                  embedded
                />
              </div>
            )}

          </div>
        </main>
      </div>

      {/* ── Bottom navigation — mobile only ─────────────────────────────────── */}
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

// ── EmptyState helper ─────────────────────────────────────────────────────────

function EmptyState({
  icon, title, body, action,
}: {
  icon: string;
  title: string;
  body: string;
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
