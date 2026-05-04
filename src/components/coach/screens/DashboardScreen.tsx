import { useOutletContext } from 'react-router-dom';
import { JoinRequestsPanel } from '../JoinRequestsPanel';
import type { CoachOutletContext } from '../CoachShell';

const DEMO_SESSIONS = [
  { id: 'demo-1', title: 'U18 Practice - Defense + SSG', datum: todayIso(), startTime: '18:30', teamName: 'U18 Boys', location: 'Main Court' },
  { id: 'demo-2', title: 'U16 Strength Primer', datum: todayIso(), startTime: '17:15', teamName: 'U16 Boys', location: 'Weight Room' },
  { id: 'demo-3', title: 'Shooting Workout', datum: offsetIso(1), startTime: '16:45', teamName: 'Guards Group', location: 'Court 2' },
];

const DEMO_PLAYERS = [
  { name: 'Noah K.', status: 'available', risk: 'optimal', note: 'Ready' },
  { name: 'Elias M.', status: 'available', risk: 'elevated', note: 'ACWR 1.38' },
  { name: 'Jonas B.', status: 'maybe', risk: 'optimal', note: 'School until 18:00' },
  { name: 'Leo S.', status: 'out', risk: 'high', note: 'Ankle soreness' },
  { name: 'Mika T.', status: 'available', risk: 'under', note: 'Return to load' },
];

export function DashboardScreen() {
  const { user, org, departments, teams, sessions, loading, reload, coachContext, roster, groups, demoMode, setDemoMode } =
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

  const demoAvailable = DEMO_PLAYERS.filter(p => p.status === 'available').length;
  const demoUnsure = DEMO_PLAYERS.filter(p => p.status === 'maybe').length;
  const demoOut = DEMO_PLAYERS.filter(p => p.status === 'out').length;
  const demoAtRisk = DEMO_PLAYERS.filter(p => p.risk === 'elevated' || p.risk === 'high').length;

  const visibleSessions = demoMode ? DEMO_SESSIONS : focusSessions.map(s => ({
    id: s.id,
    title: s.title,
    datum: s.datum,
    startTime: s.startTime,
    teamName: teams.find(t => t.id === s.teamId)?.name ?? 'No team',
    location: s.location,
  }));

  const alerts = demoMode
    ? ['Leo S. marked out: ankle soreness.', 'Elias M. is above elevated ACWR range.', 'U18 Boys availability below ideal threshold.']
    : [
        ...(upcomingSessions.length === 0 ? ['No upcoming sessions planned.'] : []),
        ...(roster.length === 0 ? ['No players in roster yet.'] : []),
      ];

  return (
    <div className="space-y-5">
      {!demoMode && <JoinRequestsPanel trainerId={user.id} onChanged={reload} />}

      <section className="rounded-2xl border border-gray-700 bg-gray-900/80 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-violet-300">TeamLoad Coach OS</p>
            <h2 className="mt-2 text-2xl font-black text-white">Coach Operations Dashboard</h2>
            <p className="mt-2 text-sm text-gray-400">
              Daily overview for sessions, availability, team structure and load risk.
            </p>
          </div>
          <button
            onClick={() => setDemoMode(!demoMode)}
            className={`self-start rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${demoMode ? 'border-green-700 bg-green-900/30 text-green-300' : 'border-gray-700 bg-gray-800 text-gray-300 hover:border-violet-500 hover:text-white'}`}
          >
            {demoMode ? 'Demo data on' : 'Show demo data'}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-cyan-800/50 bg-cyan-950/20 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-cyan-300">Product readiness</p>
            <h3 className="mt-1 text-sm font-bold text-white">Demo is ready for inspection. Shared team sync is the next production gate.</h3>
            <p className="mt-1 text-xs leading-5 text-cyan-100/70">
              Sessions and core coach flows are usable, but availability and final attendance still need Supabase persistence before TeamLoad can be trusted across coach and athlete devices.
            </p>
          </div>
          <span className="w-fit rounded-full border border-cyan-700 bg-cyan-900/40 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-cyan-200">Next: cloud sync</span>
        </div>
      </section>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Available" value={loading && !demoMode ? '...' : String(demoMode ? demoAvailable : roster.length)} sub="players" color="emerald" />
        <Stat label="Unsure / Out" value={loading && !demoMode ? '...' : String(demoMode ? demoUnsure + demoOut : 0)} sub="availability" color="amber" />
        <Stat label="At Risk" value={loading && !demoMode ? '...' : String(demoMode ? demoAtRisk : 0)} sub="load" color="violet" />
        <Stat label={demoMode ? 'Today' : 'This Week'} value={loading && !demoMode ? '...' : String(demoMode ? DEMO_SESSIONS.filter(s => s.datum === today).length : weekCount)} sub="sessions" color="sky" />
      </div>

      {org && !demoMode && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-800/60 border border-gray-700/50">
          <div className="w-9 h-9 bg-gradient-to-br from-violet-600 to-purple-800 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0">TL</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{org.name}</p>
            {org.sport && <p className="text-xs text-gray-500">{org.sport}</p>}
          </div>
          {coachContext && <span className="text-[11px] px-2 py-0.5 rounded-full bg-violet-900/50 text-violet-300 border border-violet-800/50 flex-shrink-0">{roleLabel[coachContext.role] ?? coachContext.role}</span>}
        </div>
      )}

      {demoMode && (
        <section className="rounded-2xl border border-gray-700 bg-gray-900/70 p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h3 className="text-sm font-bold text-white">Today availability</h3>
              <p className="text-xs text-gray-500">Realistic preview of a coach daily check.</p>
            </div>
            <span className="rounded-lg bg-green-900/30 px-2 py-1 text-xs font-bold text-green-300">{demoAvailable}/{DEMO_PLAYERS.length} available</span>
          </div>
          <div className="space-y-2">
            {DEMO_PLAYERS.map(player => (
              <div key={player.name} className="flex items-center justify-between gap-3 rounded-xl bg-gray-800/50 px-3 py-2">
                <div>
                  <p className="text-sm font-semibold text-white">{player.name}</p>
                  <p className="text-xs text-gray-500">{player.note}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={player.risk === 'high' ? 'red' : player.risk === 'elevated' ? 'amber' : player.risk === 'under' ? 'blue' : 'green'} text={player.risk} />
                  <Badge tone={player.status === 'out' ? 'red' : player.status === 'maybe' ? 'amber' : 'green'} text={player.status} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-3 sm:grid-cols-3">
        <MiniCard label="Available" value={demoMode ? `${demoAvailable}/${DEMO_PLAYERS.length}` : 'Default'} text="Players are assumed available unless they cancel or mark unsure." />
        <MiniCard label="Risk" value={demoMode ? `${demoAtRisk} players` : 'ACWR'} text="Risk summary comes from the Load Monitor workspace." />
        <MiniCard label="Actions" value={String(alerts.length)} text="No-show, low availability and repeated absence alerts." />
      </section>

      <section>
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
          {demoMode || todaySessions.length > 0 ? 'Today' : 'Next sessions'}
        </p>
        <div className="space-y-1.5">
          {visibleSessions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-700 bg-gray-800/30 px-4 py-5 text-sm text-gray-500">No upcoming sessions planned.</div>
          ) : visibleSessions.map(s => (
            <div key={s.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-gray-800/50 border border-gray-700/40">
              <div className="flex-shrink-0 text-center w-10">
                <p className="text-[10px] text-gray-500">{new Date(s.datum + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' })}</p>
                <p className="text-xs text-gray-400 font-medium">{new Date(s.datum + 'T12:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}</p>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{s.title}</p>
                <p className="text-[11px] text-gray-500">{s.teamName}{s.startTime ? ` - ${s.startTime}` : ''}{s.location ? ` - ${s.location}` : ''}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <MiniCard label="Teams" value={String(demoMode ? 3 : teams.length)} text="Team workspaces remain available." />
        <MiniCard label="Departments" value={String(demoMode ? 2 : departments.length)} text="Department planning remains available." />
        <MiniCard label="Groups" value={String(demoMode ? 5 : groups.length)} text="Custom groups are prepared." />
      </section>

      {alerts.length > 0 && (
        <section className="rounded-2xl border border-gray-700 bg-gray-900/70 p-4">
          <h3 className="text-sm font-bold text-white mb-3">Alerts</h3>
          <div className="space-y-2">
            {alerts.map(alert => <div key={alert} className="rounded-xl border border-amber-800/50 bg-amber-950/20 px-3 py-2 text-sm text-amber-200">{alert}</div>)}
          </div>
        </section>
      )}
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

function Badge({ tone, text }: { tone: 'green' | 'amber' | 'red' | 'blue'; text: string }) {
  const tones = {
    green: 'border-green-800 bg-green-950/30 text-green-300',
    amber: 'border-amber-800 bg-amber-950/30 text-amber-300',
    red: 'border-red-800 bg-red-950/30 text-red-300',
    blue: 'border-blue-800 bg-blue-950/30 text-blue-300',
  };
  return <span className={`rounded-lg border px-2 py-1 text-[10px] font-bold uppercase ${tones[tone]}`}>{text}</span>;
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

function todayIso() {
  return new Date().toISOString().split('T')[0];
}

function offsetIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}
