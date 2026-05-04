import { useOutletContext } from 'react-router-dom';
import { JoinRequestsPanel } from '../JoinRequestsPanel';
import type { CoachOutletContext } from '../CoachShell';

export function DashboardScreen() {
  const { user, org, departments, teams, sessions, loading, reload, coachContext, roster, groups } =
    useOutletContext<CoachOutletContext>();

  const today = new Date().toISOString().split('T')[0];
  const weekStart = (() => {
    const d = new Date();
    const diff = d.getDay() === 0 ? -6 : 1 - d.getDay();
    d.setDate(d.getDate() + diff);
    return d.toISOString().split('T')[0];
  })();
  const weekEnd = (() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 6);
    return d.toISOString().split('T')[0];
  })();

  const todaySessions = sessions.filter(s => s.datum === today);
  const upcomingSessions = sessions
    .filter(s => s.datum >= today)
    .sort((a, b) => `${a.datum}${a.startTime ?? ''}`.localeCompare(`${b.datum}${b.startTime ?? ''}`));
  const weekCount = sessions.filter(s => s.datum >= weekStart && s.datum <= weekEnd).length;
  const focusSessions = todaySessions.length > 0 ? todaySessions : upcomingSessions.slice(0, 2);

  const roleLabel: Record<string, string> = {
    org_admin: 'Admin',
    head_coach: 'Head Coach',
    assistant_coach: 'Assistant Coach',
  };

  const alerts = [
    ...(upcomingSessions.length === 0 ? ['No upcoming sessions planned.'] : []),
    ...(roster.length === 0 ? ['No players in roster yet.'] : []),
  ];

  return (
    <div className="space-y-5">
      <JoinRequestsPanel trainerId={user.id} onChanged={reload} />

      <section className="rounded-2xl border border-gray-700 bg-gray-900/80 p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-violet-300">TeamLoad Coach OS</p>
        <h2 className="mt-2 text-2xl font-black text-white">Coach Operations Dashboard</h2>
        <p className="mt-2 text-sm text-gray-400">
          Daily overview for sessions, availability, team structure and load risk.
        </p>
      </section>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Sessions Today" value={loading ? '...' : String(todaySessions.length)} sub="today" color="violet" />
        <Stat label="This Week" value={loading ? '...' : String(weekCount)} sub="sessions" color="sky" />
        <Stat label="Teams" value={loading ? '...' : String(teams.length)} sub="active" color="emerald" />
        <Stat label="Players" value={loading ? '...' : String(roster.length)} sub="roster" color="amber" />
      </div>

      {org && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-800/60 border border-gray-700/50">
          <div className="w-9 h-9 bg-gradient-to-br from-violet-600 to-purple-800 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0">
            TL
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{org.name}</p>
            {org.sport && <p className="text-xs text-gray-500">{org.sport}</p>}
          </div>
          {coachContext && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-violet-900/50 text-violet-300 border border-violet-800/50 flex-shrink-0">
              {roleLabel[coachContext.role] ?? coachContext.role}
            </span>
          )}
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-3">
        <MiniCard label="Available" value="Default" text="Players are assumed available unless they cancel or mark unsure." />
        <MiniCard label="Risk" value="ACWR" text="Risk summary comes from the Load Monitor workspace." />
        <MiniCard label="Actions" value={String(alerts.length)} text="No-show, low availability and repeated absence alerts come next." />
      </section>

      <section>
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
          {todaySessions.length > 0 ? 'Today' : 'Next sessions'}
        </p>
        <div className="space-y-1.5">
          {focusSessions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-700 bg-gray-800/30 px-4 py-5 text-sm text-gray-500">
              No upcoming sessions planned.
            </div>
          ) : focusSessions.map(s => (
            <div key={s.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-gray-800/50 border border-gray-700/40">
              <div className="flex-shrink-0 text-center w-10">
                <p className="text-[10px] text-gray-500">
                  {new Date(s.datum + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' })}
                </p>
                <p className="text-xs text-gray-400 font-medium">
                  {new Date(s.datum + 'T12:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                </p>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{s.title}</p>
                <p className="text-[11px] text-gray-500">
                  {teams.find(t => t.id === s.teamId)?.name ?? 'No team'}
                  {s.startTime ? ` - ${s.startTime}` : ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <MiniCard label="Teams" value={String(teams.length)} text="Team workspaces remain available." />
        <MiniCard label="Departments" value={String(departments.length)} text="Department planning remains available." />
        <MiniCard label="Groups" value={String(groups.length)} text="Custom groups are prepared." />
      </section>
    </div>
  );
}

function MiniCard({ label, value, text }: { label: string; value: string; text: string }) {
  return (
    <div className="rounded-xl border border-gray-700/60 bg-gray-800/40 px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-white">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{text}</p>
    </div>
  );
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  const cls: Record<string, string> = {
    violet: 'text-violet-400 bg-violet-900/20 border-violet-800/40',
    sky: 'text-sky-400 bg-sky-900/20 border-sky-800/40',
    emerald: 'text-emerald-400 bg-emerald-900/20 border-emerald-800/40',
    amber: 'text-amber-400 bg-amber-900/20 border-amber-800/40',
  };
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${cls[color] ?? cls.violet}`}>
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className="text-2xl font-bold leading-tight">{value}</p>
      <p className="text-[11px] text-gray-600">{sub}</p>
    </div>
  );
}
