import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { AttendanceSession, AttendanceTeam, AttendanceTeamMember } from '../../types/attendance';
import type { ManagedAthlete, AthleteGroup } from '../../types/trainerDashboard';
import type { Organization, Department } from '../../types/organization';
import type { CoachContext } from '../../lib/coachRole';
import { WeekCalendar } from '../attendance/WeekCalendar';
import { DepartmentCalendar } from '../attendance/DepartmentCalendar';
import { FacilityCalendar } from '../attendance/FacilityCalendar';
import { SessionDetail } from '../attendance/SessionDetail';
import { SessionPlanner } from '../attendance/SessionPlanner';

// ── Types ─────────────────────────────────────────────────────────────────────

type CalView = 'alle' | 'abteilung' | 'team' | 'hallen';

interface Props {
  trainerId: string;
  org: Organization | null;
  departments: Department[];
  sessions: AttendanceSession[];
  teams: AttendanceTeam[];
  roster: ManagedAthlete[];
  groups: AthleteGroup[];
  loading: boolean;
  coachContext: CoachContext | null;
  onReload: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function KalenderTab({
  trainerId, org, departments, sessions, teams, roster, groups, loading, coachContext, onReload,
}: Props) {

  const [view,            setView]            = useState<CalView>('alle');
  const [selectedDeptId,  setSelectedDeptId]  = useState<string>('');
  const [selectedTeamId,  setSelectedTeamId]  = useState<string>('');
  const [openSession,     setOpenSession]      = useState<AttendanceSession | null>(null);
  const [showPlanner,     setShowPlanner]      = useState(false);
  const [plannerDatum,    setPlannerDatum]     = useState<string | undefined>();
  const [plannerTime,     setPlannerTime]      = useState<string | undefined>();

  // ── Derived ────────────────────────────────────────────────────────────────

  // Non-admin coaches only see sessions for teams they own or were assigned to
  const visibleTeamIds: Set<string> | null = (() => {
    if (!coachContext || coachContext.role === 'org_admin') return null;
    return new Set([...coachContext.ownTeamIds, ...coachContext.assignedTeamIds]);
  })();

  const visibleSessions = visibleTeamIds
    ? sessions.filter(s => s.teamId && visibleTeamIds.has(s.teamId))
    : sessions;

  const filteredByTeam = selectedTeamId
    ? visibleSessions.filter(s => s.teamId === selectedTeamId)
    : visibleSessions;

  const selectedDept = departments.find(d => d.id === selectedDeptId);
  const selectedTeam = teams.find(t => t.id === selectedTeamId);

  const deptTeams = (deptId: string) => teams.filter(t => t.departmentId === deptId);

  // ── Session planner helpers ────────────────────────────────────────────────

  function openNewSession(datum: string, time?: string) {
    setPlannerDatum(datum);
    setPlannerTime(time);
    setShowPlanner(true);
  }

  function closePlanner() {
    setShowPlanner(false);
    setPlannerDatum(undefined);
    setPlannerTime(undefined);
  }

  // ── View switcher ──────────────────────────────────────────────────────────

  const SUB_TABS: { id: CalView; label: string }[] = [
    { id: 'alle',       label: 'Alle' },
    { id: 'abteilung',  label: 'Abteilung' },
    { id: 'team',       label: 'Team' },
    { id: 'hallen',     label: 'Hallen' },
  ];

  return (
    <div className="space-y-4">

      {/* Sub-tab chips */}
      <div className="flex items-center gap-1 flex-wrap">
        {SUB_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setView(t.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              view === t.id
                ? 'bg-violet-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}

        {/* Add session button (not on hallen view) */}
        {view !== 'hallen' && (
          <button
            onClick={() => openNewSession(new Date().toISOString().split('T')[0])}
            className="ml-auto flex items-center gap-1 px-3 py-1.5 rounded-full bg-violet-900/40 border border-violet-700/50 hover:bg-violet-800/50 text-violet-300 text-xs font-semibold transition-colors"
          >
            <Plus size={12} /> Einheit
          </button>
        )}
      </div>

      {/* ── Alle: full week overview ─────────────────────────────────────────── */}
      {view === 'alle' && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">Alle Teams — Wochenübersicht</p>
          {loading ? (
            <Spinner />
          ) : (
            <WeekCalendar
              sessions={visibleSessions}
              teams={teams}
              sessionStats={{}}
              onSessionClick={setOpenSession}
              onAddSession={openNewSession}
              onSessionsChanged={onReload}
            />
          )}
        </div>
      )}

      {/* ── Abteilung ────────────────────────────────────────────────────────── */}
      {view === 'abteilung' && (
        <div className="space-y-3">
          {departments.length === 0 ? (
            <EmptyDepts />
          ) : (
            <>
              {/* Dept selector */}
              <div className="flex flex-wrap gap-1.5">
                {departments.map(d => (
                  <button
                    key={d.id}
                    onClick={() => setSelectedDeptId(d.id === selectedDeptId ? '' : d.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors border ${
                      selectedDeptId === d.id
                        ? 'bg-violet-700 border-violet-500 text-white'
                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600'
                    }`}
                  >
                    {d.name}
                    <span className="ml-1 text-[10px] opacity-60">
                      ({deptTeams(d.id).length})
                    </span>
                  </button>
                ))}
              </div>

              {selectedDept ? (
                <>
                  <p className="text-xs text-gray-500">
                    {selectedDept.name}
                    {selectedDept.sport && ` · ${selectedDept.sport}`}
                    {' — '}{deptTeams(selectedDept.id).length} Teams
                  </p>
                  <DepartmentCalendar
                    departmentId={selectedDept.id}
                    departmentName={selectedDept.name}
                    teams={deptTeams(selectedDept.id)}
                  />
                </>
              ) : (
                <p className="text-xs text-gray-600 py-4 text-center">
                  Abteilung auswählen
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Team ─────────────────────────────────────────────────────────────── */}
      {view === 'team' && (
        <div className="space-y-3">
          {teams.length === 0 ? (
            <p className="text-xs text-gray-600 py-6 text-center">Noch keine Teams</p>
          ) : (
            <>
              {/* Team selector */}
              <div className="flex flex-wrap gap-1.5">
                {teams.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTeamId(t.id === selectedTeamId ? '' : t.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors border ${
                      selectedTeamId === t.id
                        ? 'bg-gray-700 border-gray-500 text-white'
                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
                    {t.name}
                  </button>
                ))}
              </div>

              {selectedTeam ? (
                <>
                  <p className="text-xs text-gray-500">
                    {selectedTeam.name}
                    {selectedTeam.sport && ` · ${selectedTeam.sport}`}
                    {' — '}{filteredByTeam.length} Einheiten
                  </p>
                  {loading ? (
                    <Spinner />
                  ) : (
                    <WeekCalendar
                      sessions={filteredByTeam}
                      teams={[selectedTeam]}
                      sessionStats={{}}
                      onSessionClick={setOpenSession}
                      onAddSession={openNewSession}
                      onSessionsChanged={onReload}
                    />
                  )}
                </>
              ) : (
                <p className="text-xs text-gray-600 py-4 text-center">Team auswählen</p>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Hallen ───────────────────────────────────────────────────────────── */}
      {view === 'hallen' && (
        <div className="space-y-3">
          {org ? (
            <FacilityCalendar organizationId={org.id} teams={teams} />
          ) : (
            <div className="text-center py-12 space-y-2">
              <p className="text-2xl text-gray-700">⬡</p>
              <p className="text-sm text-gray-500">Kein Verein</p>
              <p className="text-xs text-gray-600">Lege zuerst einen Verein an, um Hallen zu verwalten.</p>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {openSession && (
        <SessionDetail
          session={openSession}
          trainerId={trainerId}
          onClose={() => setOpenSession(null)}
          onDeleted={() => { setOpenSession(null); onReload(); }}
        />
      )}
      {showPlanner && (
        <SessionPlanner
          trainerId={trainerId}
          teams={teams}
          membersByTeam={{} as Record<string, AttendanceTeamMember[]>}
          roster={roster}
          groups={groups}
          prefillDatum={plannerDatum}
          prefillTime={plannerTime}
          onCreated={() => { onReload(); closePlanner(); }}
          onClose={closePlanner}
        />
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex items-center gap-2 py-8 text-xs text-gray-600">
      <span className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      Wird geladen…
    </div>
  );
}

function EmptyDepts() {
  return (
    <div className="text-center py-10 space-y-1">
      <p className="text-sm text-gray-500">Keine Abteilungen</p>
      <p className="text-xs text-gray-600">Erstelle Abteilungen im Verein-Tab.</p>
    </div>
  );
}
