import { useState } from 'react';
import type { AttendanceTeam, AttendanceSession } from '../../types/attendance';
import type { AttendanceTeamMember } from '../../types/attendance';
import type { ManagedAthlete, AthleteGroup } from '../../types/trainerDashboard';
import { WeekCalendar } from '../attendance/WeekCalendar';
import { SessionDetail } from '../attendance/SessionDetail';
import { SessionPlanner } from '../attendance/SessionPlanner';

// ── Types ─────────────────────────────────────────────────────────────────────

type CoachTab = 'dashboard' | 'teams' | 'abteilung' | 'hallen' | 'performance';

interface Props {
  trainerId: string;
  sessions: AttendanceSession[];
  teams: AttendanceTeam[];
  roster: ManagedAthlete[];
  groups: AthleteGroup[];
  loading: boolean;
  onGoToTab: (tab: CoachTab) => void;
  onReload: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CoachDashboard({
  trainerId,
  sessions,
  teams,
  roster,
  groups,
  loading,
  onGoToTab,
  onReload,
}: Props) {
  const [openSession, setOpenSession]           = useState<AttendanceSession | null>(null);
  const [showPlanner, setShowPlanner]           = useState(false);
  const [plannerDatum, setPlannerDatum]         = useState<string | undefined>();
  const [plannerTime, setPlannerTime]           = useState<string | undefined>();

  const today = new Date().toISOString().split('T')[0];

  // ── Derived stats ──────────────────────────────────────────────────────────
  const weekStart = (() => {
    const d = new Date();
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d.toISOString().split('T')[0];
  })();
  const weekEnd = (() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 6);
    return d.toISOString().split('T')[0];
  })();

  const todaySessions   = sessions.filter(s => s.datum === today);
  const weekSessions    = sessions.filter(s => s.datum >= weekStart && s.datum <= weekEnd);
  const upcomingSoon    = sessions
    .filter(s => s.datum >= today)
    .sort((a, b) => a.datum.localeCompare(b.datum))
    .slice(0, 5);

  // ── Quick-link cards ───────────────────────────────────────────────────────
  const hasAbteilung = teams.some(t => t.departmentId);
  const hasHallen    = teams.some(t => t.organizationId);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Heute" value={loading ? '…' : String(todaySessions.length)} sub="Einheiten" color="violet" />
        <StatCard label="Diese Woche" value={loading ? '…' : String(weekSessions.length)} sub="Einheiten" color="sky" />
        <StatCard label="Teams" value={loading ? '…' : String(teams.length)} sub="aktiv" color="emerald" />
      </div>

      {/* Quick-links to other sections */}
      <div className="flex flex-wrap gap-2">
        {hasAbteilung && (
          <button onClick={() => onGoToTab('abteilung')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-900/30 border border-violet-800/50 hover:bg-violet-800/40 text-violet-300 text-xs font-medium rounded-lg transition-colors">
            <span className="text-sm">◫</span> Abteilung
          </button>
        )}
        <button onClick={() => onGoToTab('teams')}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-900/30 border border-violet-800/50 hover:bg-violet-800/40 text-violet-300 text-xs font-medium rounded-lg transition-colors">
          <span className="text-sm">◈</span> Teams
        </button>
        {hasHallen && (
          <button onClick={() => onGoToTab('hallen')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-900/30 border border-teal-800/50 hover:bg-teal-800/40 text-teal-300 text-xs font-medium rounded-lg transition-colors">
            <span className="text-sm">⬡</span> Hallen
          </button>
        )}
        <button onClick={() => onGoToTab('performance')}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-900/30 border border-emerald-800/50 hover:bg-emerald-800/40 text-emerald-300 text-xs font-medium rounded-lg transition-colors">
          <span className="text-sm">◎</span> Performance
        </button>
      </div>

      {/* Week calendar — Untis style; shows all sessions across all teams */}
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

      {/* Upcoming sessions compact list */}
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
                    isToday
                      ? 'bg-violet-950/30 border-violet-800/50'
                      : 'bg-gray-800/60 border-gray-700/50'
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
                  {s.trainingType && (
                    <TypeDot type={s.trainingType} />
                  )}
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
          <button onClick={() => onGoToTab('teams')}
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
  return (
    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${TYPE_DOTS[type] ?? TYPE_DOTS.Sonstiges}`} />
  );
}
