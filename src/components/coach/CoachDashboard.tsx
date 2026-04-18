import { useState } from 'react';
import { Plus, ChevronRight, ChevronLeft, Users, Check, X, Loader2 } from 'lucide-react';
import { JoinRequestsPanel } from './JoinRequestsPanel';
import type { AttendanceTeam, AttendanceSession, AttendanceTeamMember } from '../../types/attendance';
import type { ManagedAthlete, AthleteGroup } from '../../types/trainerDashboard';
import type { Organization, Department } from '../../types/organization';
import { WeekCalendar } from '../attendance/WeekCalendar';
import { SessionDetail } from '../attendance/SessionDetail';
import { SessionPlanner } from '../attendance/SessionPlanner';
import { DepartmentCalendar } from '../attendance/DepartmentCalendar';

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  trainerId: string;
  org: Organization | null;
  departments: Department[];
  sessions: AttendanceSession[];
  teams: AttendanceTeam[];
  roster: ManagedAthlete[];
  groups: AthleteGroup[];
  loading: boolean;
  onGoToTeams: () => void;
  onGoToHallen: () => void;
  onReload: () => void;
  onCreateDepartment: (name: string, sport?: string) => Promise<void>;
  onAssignTeam: (teamId: string, deptId: string | null) => Promise<void>;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CoachDashboard({
  trainerId,
  org,
  departments,
  sessions,
  teams,
  roster,
  groups,
  loading,
  onGoToTeams,
  onGoToHallen,
  onReload,
  onCreateDepartment,
  onAssignTeam,
}: Props) {

  // Drill-down state: null = top-level dept list, string = inside a dept
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);

  // Session modals
  const [openSession, setOpenSession] = useState<AttendanceSession | null>(null);
  const [showPlanner, setShowPlanner] = useState(false);
  const [plannerDatum, setPlannerDatum] = useState<string | undefined>();
  const [plannerTime,  setPlannerTime]  = useState<string | undefined>();

  // New dept form
  const [showNewDept, setShowNewDept] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [savingDept,  setSavingDept]  = useState(false);

  // Team assignment
  const [assigningTeam, setAssigningTeam] = useState<string | null>(null);

  // ── Derived ────────────────────────────────────────────────────────────────

  const today = new Date().toISOString().split('T')[0];

  const weekStart = (() => {
    const d = new Date();
    const diff = d.getDay() === 0 ? -6 : 1 - d.getDay();
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d.toISOString().split('T')[0];
  })();
  const weekEnd = (() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 6);
    return d.toISOString().split('T')[0];
  })();

  const todaySessions = sessions.filter(s => s.datum === today);
  const weekSessions  = sessions.filter(s => s.datum >= weekStart && s.datum <= weekEnd);
  const upcomingSoon  = sessions
    .filter(s => s.datum >= today)
    .sort((a, b) => a.datum.localeCompare(b.datum))
    .slice(0, 5);

  const selectedDept = departments.find(d => d.id === selectedDeptId) ?? null;
  const deptTeams    = (deptId: string) => teams.filter(t => t.departmentId === deptId);
  const unassigned   = teams.filter(t => !t.departmentId);

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function handleCreateDept() {
    const name = newDeptName.trim();
    if (!name) return;
    setSavingDept(true);
    await onCreateDepartment(name);
    setSavingDept(false);
    setNewDeptName('');
    setShowNewDept(false);
  }

  async function handleAssignTeam(teamId: string, deptId: string | null) {
    setAssigningTeam(teamId);
    await onAssignTeam(teamId, deptId);
    setAssigningTeam(null);
  }

  // ── Dept detail view ──────────────────────────────────────────────────────

  if (selectedDept) {
    const dt = deptTeams(selectedDept.id);
    const availableToAdd = teams.filter(t => t.departmentId !== selectedDept.id);

    return (
      <div className="space-y-4">
        {/* Back + header */}
        <div className="flex items-center gap-3">
          <button onClick={() => setSelectedDeptId(null)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors">
            <ChevronLeft size={14} /> Übersicht
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-white truncate">{selectedDept.name}</h2>
            {selectedDept.sport && (
              <p className="text-[11px] text-gray-500">{selectedDept.sport}</p>
            )}
          </div>
        </div>

        {/* Teams in this dept */}
        <section>
          <p className="text-xs text-gray-500 mb-2">Teams in dieser Abteilung ({dt.length})</p>
          <div className="space-y-2">
            {dt.map(t => (
              <div key={t.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-800/60 border border-gray-700/50">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium truncate">{t.name}</p>
                  <p className="text-[11px] text-gray-500">{t.sport}</p>
                </div>
                <button
                  onClick={() => handleAssignTeam(t.id, null)}
                  disabled={assigningTeam === t.id}
                  className="text-[11px] text-gray-600 hover:text-rose-400 transition-colors px-2 py-1 rounded-lg hover:bg-rose-900/20"
                >
                  {assigningTeam === t.id ? <Loader2 size={12} className="animate-spin" /> : <X size={13} />}
                </button>
              </div>
            ))}

            {dt.length === 0 && (
              <p className="text-xs text-gray-600 py-3 text-center">Noch keine Teams in dieser Abteilung</p>
            )}
          </div>

          {/* Assign a team */}
          {availableToAdd.length > 0 && (
            <div className="mt-3">
              <p className="text-[11px] text-gray-600 mb-1.5">Team zuordnen:</p>
              <div className="flex flex-wrap gap-1.5">
                {availableToAdd.map(t => (
                  <button key={t.id}
                    onClick={() => handleAssignTeam(t.id, selectedDept.id)}
                    disabled={assigningTeam === t.id}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs text-gray-300 border border-gray-700 transition-colors disabled:opacity-50"
                  >
                    {assigningTeam === t.id
                      ? <Loader2 size={10} className="animate-spin" />
                      : <Check size={10} className="text-violet-400" />
                    }
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Dept calendar */}
        <section>
          <p className="text-xs text-gray-500 mb-2">Abteilungskalender</p>
          <DepartmentCalendar departmentId={selectedDept.id} teams={teams} />
        </section>

        {/* Session modals */}
        {openSession && (
          <SessionDetail
            session={openSession}
            trainerId={trainerId}
            onClose={() => setOpenSession(null)}
            onDeleted={() => { setOpenSession(null); onReload(); }}
          />
        )}
      </div>
    );
  }

  // ── Top-level dashboard ───────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Join requests */}
      <JoinRequestsPanel trainerId={trainerId} onChanged={onReload} />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Heute"       value={loading ? '…' : String(todaySessions.length)} sub="Einheiten" color="violet" />
        <StatCard label="Diese Woche" value={loading ? '…' : String(weekSessions.length)}  sub="Einheiten" color="sky"    />
        <StatCard label="Teams"       value={loading ? '…' : String(teams.length)}         sub="aktiv"     color="emerald"/>
      </div>

      {/* Quick links */}
      <div className="flex flex-wrap gap-2">
        <button onClick={onGoToTeams}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-900/30 border border-violet-800/50 hover:bg-violet-800/40 text-violet-300 text-xs font-medium rounded-lg transition-colors">
          <Users size={12} /> Alle Teams
        </button>
        <button onClick={onGoToHallen}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-900/30 border border-teal-800/50 hover:bg-teal-800/40 text-teal-300 text-xs font-medium rounded-lg transition-colors">
          <span className="text-sm leading-none">⬡</span> Hallen
        </button>
      </div>

      {/* ── Abteilungen ─────────────────────────────────────────────────────── */}
      {org && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Abteilungen</p>
            <button
              onClick={() => setShowNewDept(true)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-violet-900/30 hover:bg-violet-800/40 border border-violet-800/50 text-violet-300 text-xs font-medium transition-colors"
            >
              <Plus size={12} /> Neue Abteilung
            </button>
          </div>

          {/* New dept form */}
          {showNewDept && (
            <div className="mb-3 flex items-center gap-2">
              <input
                autoFocus
                value={newDeptName}
                onChange={e => setNewDeptName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreateDept(); if (e.key === 'Escape') setShowNewDept(false); }}
                placeholder="Name der Abteilung"
                className="flex-1 h-9 px-3 rounded-xl bg-gray-900 border border-violet-700 text-sm text-white placeholder-gray-600 focus:outline-none"
              />
              <button
                onClick={handleCreateDept}
                disabled={savingDept || !newDeptName.trim()}
                className="h-9 px-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-medium transition-colors flex items-center gap-1"
              >
                {savingDept ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              </button>
              <button onClick={() => { setShowNewDept(false); setNewDeptName(''); }}
                className="h-9 px-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-400 text-sm transition-colors">
                <X size={13} />
              </button>
            </div>
          )}

          {/* Dept cards */}
          {departments.length === 0 && !showNewDept ? (
            <div className="text-center py-6 border border-dashed border-gray-800 rounded-xl">
              <p className="text-xs text-gray-600">Noch keine Abteilungen</p>
              <button onClick={() => setShowNewDept(true)}
                className="mt-2 text-xs text-violet-400 hover:text-violet-300 transition-colors">
                + Erste Abteilung anlegen
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {departments.map(dept => {
                const dt = deptTeams(dept.id);
                const deptSessions = sessions.filter(s =>
                  dt.some(t => t.id === s.teamId) && s.datum >= today
                );
                return (
                  <button key={dept.id}
                    onClick={() => setSelectedDeptId(dept.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-800/60 border border-gray-700/50 hover:border-violet-700/60 hover:bg-violet-950/20 transition-all text-left group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white group-hover:text-violet-200 transition-colors truncate">
                        {dept.name}
                      </p>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {dt.length} {dt.length === 1 ? 'Team' : 'Teams'}
                        {deptSessions.length > 0 && ` · ${deptSessions.length} kommende Einheiten`}
                      </p>
                    </div>
                    <ChevronRight size={15} className="text-gray-600 group-hover:text-violet-400 flex-shrink-0 transition-colors" />
                  </button>
                );
              })}
            </div>
          )}

          {/* Unassigned teams */}
          {unassigned.length > 0 && (
            <div className="mt-3">
              <p className="text-[11px] text-gray-600 mb-1.5">Ohne Abteilung ({unassigned.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {unassigned.map(t => (
                  <div key={t.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-800/50 border border-gray-700/50 text-xs text-gray-400">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
                    {t.name}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Week calendar */}
      <div>
        <p className="text-xs text-gray-500 mb-2 px-0.5">Wochenübersicht — alle Teams</p>
        {loading ? (
          <div className="flex items-center gap-2 py-8 text-xs text-gray-600">
            <span className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            Einheiten werden geladen…
          </div>
        ) : (
          <WeekCalendar
            sessions={sessions}
            teams={teams}
            sessionStats={{}}
            onSessionClick={s => setOpenSession(s)}
            onAddSession={(datum, time) => {
              setPlannerDatum(datum);
              setPlannerTime(time);
              setShowPlanner(true);
            }}
            onSessionsChanged={onReload}
          />
        )}
      </div>

      {/* Upcoming sessions */}
      {upcomingSoon.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-2 px-0.5">Nächste Einheiten</p>
          <div className="space-y-1.5">
            {upcomingSoon.map(s => {
              const team = teams.find(t => t.id === s.teamId);
              const isToday = s.datum === today;
              return (
                <button key={s.id} onClick={() => setOpenSession(s)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors hover:border-violet-600/60 ${
                    isToday ? 'bg-violet-950/30 border-violet-800/50' : 'bg-gray-800/60 border-gray-700/50'
                  }`}>
                  <div className="flex-shrink-0 text-center w-10">
                    <p className={`text-[11px] font-medium ${isToday ? 'text-violet-400' : 'text-gray-500'}`}>
                      {isToday ? 'Heute' : new Date(s.datum + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'short' })}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(s.datum + 'T12:00:00').toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">{s.title}</p>
                    <p className="text-[11px] text-gray-500">
                      {s.startTime && `${s.startTime}${s.endTime ? `–${s.endTime}` : ''} · `}
                      {team?.name ?? (s.location || '—')}
                    </p>
                  </div>
                  {s.trainingType && <TypeDot type={s.trainingType} />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && sessions.length === 0 && (
        <div className="text-center py-12 space-y-2">
          <p className="text-gray-500 text-sm">Noch keine Einheiten geplant</p>
          <button onClick={onGoToTeams}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm rounded-xl transition-colors">
            Teams & Sessions →
          </button>
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
          onCreated={onReload}
          onClose={() => { setShowPlanner(false); setPlannerDatum(undefined); setPlannerTime(undefined); }}
        />
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  const accent: Record<string, string> = {
    violet: 'text-violet-400 bg-violet-900/20 border-violet-800/40',
    sky:    'text-sky-400 bg-sky-900/20 border-sky-800/40',
    emerald:'text-emerald-400 bg-emerald-900/20 border-emerald-800/40',
  };
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${accent[color] ?? accent.violet}`}>
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className="text-2xl font-bold leading-tight">{value}</p>
      <p className="text-[11px] text-gray-600">{sub}</p>
    </div>
  );
}

const TYPE_DOTS: Record<string, string> = {
  Training: 'bg-violet-500', Spiel: 'bg-rose-500', Wettkampf: 'bg-orange-500',
  'S&C': 'bg-emerald-500', Taktik: 'bg-blue-500', Videoanalyse: 'bg-sky-500',
  Regeneration: 'bg-teal-500', Sonstiges: 'bg-gray-500',
};

function TypeDot({ type }: { type: string }) {
  return <span className={`w-2 h-2 rounded-full flex-shrink-0 ${TYPE_DOTS[type] ?? TYPE_DOTS.Sonstiges}`} />;
}
