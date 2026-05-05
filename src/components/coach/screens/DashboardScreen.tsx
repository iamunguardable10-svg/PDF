import { useMemo } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import type { ElementType } from 'react';
import { Activity, AlertTriangle, CalendarDays, CheckCircle2, ClipboardList, Clock3, UserRound } from 'lucide-react';
import { JoinRequestsPanel } from '../JoinRequestsPanel';
import type { CoachOutletContext } from '../CoachShell';

const DEMO_PLAYERS = [
  { name: 'Noah K.', status: 'available', risk: 'optimal', note: 'Ready for full practice' },
  { name: 'Elias M.', status: 'available', risk: 'elevated', note: 'ACWR 1.38 - monitor volume' },
  { name: 'Jonas B.', status: 'maybe', risk: 'optimal', note: 'School until 18:00' },
  { name: 'Leo S.', status: 'out', risk: 'high', note: 'Ankle soreness' },
  { name: 'Mika T.', status: 'available', risk: 'under', note: 'Return-to-load block' },
];

export function DashboardScreen() {
  const navigate = useNavigate();
  const { user, org, teams, sessions, loading, reload, coachContext, roster, groups, demoMode, setDemoMode } =
    useOutletContext<CoachOutletContext>();

  const today = todayIso();
  const upcomingSessions = useMemo(() => sessions
    .filter(session => session.datum >= today)
    .sort((a, b) => `${a.datum}${a.startTime ?? ''}`.localeCompare(`${b.datum}${b.startTime ?? ''}`)), [sessions, today]);
  const todaySessions = useMemo(() => upcomingSessions.filter(session => session.datum === today), [today, upcomingSessions]);
  const nextSession = todaySessions[0] ?? upcomingSessions[0] ?? null;
  const nextTeamName = nextSession ? teams.find(team => team.id === nextSession.teamId)?.name ?? 'No team' : 'No team';

  const loadWatchGroupIds = useMemo(() => new Set(groups
    .filter(group => /load|risk|return/i.test(group.name))
    .map(group => group.id)), [groups]);
  const loadWatchPlayers = useMemo(() => roster.filter(player => player.groupIds.some(groupId => loadWatchGroupIds.has(groupId))), [loadWatchGroupIds, roster]);

  const demoAvailable = DEMO_PLAYERS.filter(player => player.status === 'available').length;
  const demoIssues = DEMO_PLAYERS.filter(player => player.status !== 'available').length;
  const demoAtRisk = DEMO_PLAYERS.filter(player => player.risk === 'elevated' || player.risk === 'high').length;
  const demoTodaySessions = 2;

  const actionItems = demoMode
    ? [
        { title: 'Review Leo S. absence', text: 'Marked out with ankle soreness before U18 practice.', tone: 'red' as const, target: '/coach/attendance' },
        { title: 'Adjust Elias M. load', text: 'Elevated ACWR. Consider lower volume or modified small-sided games.', tone: 'amber' as const, target: '/coach/load-monitor' },
        { title: 'Finalize today after practice', text: 'Confirm present, late, partial or absent status after the session.', tone: 'green' as const, target: '/coach/attendance' },
      ]
    : [
        ...(upcomingSessions.length === 0 ? [{ title: 'Plan the next session', text: 'No upcoming sessions are scheduled yet.', tone: 'amber' as const, target: '/coach/sessions' }] : []),
        ...(roster.length === 0 ? [{ title: 'Add athletes to roster', text: 'Availability, attendance and load context need players first.', tone: 'amber' as const, target: '/coach/players' }] : []),
        ...(todaySessions.length > 0 ? [{ title: 'Finalize attendance today', text: `${todaySessions.length} session${todaySessions.length === 1 ? '' : 's'} need coach confirmation after completion.`, tone: 'green' as const, target: '/coach/attendance' }] : []),
        ...(loadWatchPlayers.length > 0 ? [{ title: 'Check load-watch players', text: `${loadWatchPlayers.length} player${loadWatchPlayers.length === 1 ? '' : 's'} are in load/risk/return groups.`, tone: 'red' as const, target: '/coach/load-monitor' }] : []),
      ];

  const visiblePlayerSignals = demoMode
    ? DEMO_PLAYERS
    : loadWatchPlayers.slice(0, 5).map(player => ({
        name: player.name,
        status: 'watch',
        risk: 'elevated',
        note: 'Assigned to load/risk/return group',
      }));

  const emptyPlayerSignal = !demoMode && visiblePlayerSignals.length === 0;

  return (
    <div className="space-y-5">
      {!demoMode && <JoinRequestsPanel trainerId={user.id} onChanged={reload} />}

      <section className="rounded-2xl border border-gray-700 bg-gray-900/80 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-violet-300">TeamLoad Coach OS</p>
            <h2 className="mt-2 text-2xl font-black text-white">Coach Command Center</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-400">
              Start here for daily decisions: what is next, who needs attention, what must be finalized, and where load context affects practice planning.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
              <span className="rounded-full border border-gray-800 bg-gray-950/60 px-2.5 py-1">{org?.name ?? 'TeamLoad workspace'}</span>
              <span className="rounded-full border border-gray-800 bg-gray-950/60 px-2.5 py-1">{coachContext?.role ?? 'coach'}</span>
            </div>
          </div>
          <button
            onClick={() => setDemoMode(!demoMode)}
            className={`w-fit rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${demoMode ? 'border-green-700 bg-green-900/30 text-green-300' : 'border-gray-700 bg-gray-800 text-gray-300 hover:border-violet-500 hover:text-white'}`}
          >
            {demoMode ? 'Demo workspace active' : 'View demo workspace'}
          </button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-4">
        <CommandStat icon={CalendarDays} label="Today" value={loading && !demoMode ? '...' : String(demoMode ? demoTodaySessions : todaySessions.length)} text="Sessions requiring attention." tone="sky" />
        <CommandStat icon={UserRound} label="Available" value={loading && !demoMode ? '...' : String(demoMode ? demoAvailable : roster.length)} text="Default: expected unless exception." tone="emerald" />
        <CommandStat icon={AlertTriangle} label="Issues" value={loading && !demoMode ? '...' : String(demoMode ? demoIssues : actionItems.length)} text="Items that need coach action." tone="amber" />
        <CommandStat icon={Activity} label="Load watch" value={loading && !demoMode ? '...' : String(demoMode ? demoAtRisk : loadWatchPlayers.length)} text="Risk/return context." tone="red" />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-gray-800 bg-gray-900/70 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-sky-300">Next coach decision</p>
              <h3 className="mt-1 text-lg font-black text-white">{nextSession ? nextSession.title : demoMode ? 'U18 Practice - Defense + SSG' : 'No session planned'}</h3>
            </div>
            <button onClick={() => navigate('/coach/sessions')} className="rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-xs font-bold text-gray-300 transition-colors hover:border-sky-600 hover:text-white">
              Sessions
            </button>
          </div>

          {nextSession ? (
            <div className="mt-4 grid gap-2 sm:grid-cols-4">
              <MiniInfo label="Date" value={formatDate(nextSession.datum)} />
              <MiniInfo label="Time" value={nextSession.startTime || 'TBD'} />
              <MiniInfo label="Team" value={nextTeamName} />
              <MiniInfo label="Location" value={nextSession.location || 'TBD'} />
            </div>
          ) : demoMode ? (
            <div className="mt-4 grid gap-2 sm:grid-cols-4">
              <MiniInfo label="Date" value="Today" />
              <MiniInfo label="Time" value="18:30" />
              <MiniInfo label="Team" value="U18 Boys" />
              <MiniInfo label="Location" value="Main Court" />
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-gray-800 bg-gray-950/40 px-4 py-5 text-sm text-gray-500">
              Plan a session first. The dashboard becomes useful once there is an upcoming training, game or recovery block.
            </div>
          )}

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <QuickAction icon={ClipboardList} title="Plan" text="Create or edit sessions." onClick={() => navigate('/coach/sessions')} />
            <QuickAction icon={CheckCircle2} title="Finalize" text="Confirm attendance." onClick={() => navigate('/coach/attendance')} />
            <QuickAction icon={Activity} title="Adjust" text="Check load context." onClick={() => navigate('/coach/load-monitor')} />
          </div>
        </div>

        <div className="rounded-2xl border border-gray-800 bg-gray-900/70 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-amber-300">Coach action queue</p>
          <div className="mt-3 space-y-2">
            {actionItems.length === 0 ? (
              <div className="rounded-xl border border-emerald-800/50 bg-emerald-950/20 px-3 py-4 text-sm text-emerald-100/80">
                No urgent actions. Keep planning sessions and finalize attendance after practice.
              </div>
            ) : actionItems.slice(0, 4).map(item => (
              <button key={item.title} onClick={() => navigate(item.target)} className="w-full rounded-xl border border-gray-800 bg-gray-950/50 px-3 py-3 text-left transition-colors hover:border-violet-700/60">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-white">{item.title}</p>
                    <p className="mt-1 text-xs leading-5 text-gray-500">{item.text}</p>
                  </div>
                  <span className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${dotClass(item.tone)}`} />
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-800 bg-gray-900/70 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-violet-300">Player signals</p>
              <h3 className="mt-1 text-sm font-black text-white">Who needs attention before the next session?</h3>
            </div>
            <button onClick={() => navigate('/coach/players')} className="rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-xs font-bold text-gray-300 transition-colors hover:border-violet-600 hover:text-white">
              Players
            </button>
          </div>

          <div className="mt-3 space-y-2">
            {emptyPlayerSignal ? (
              <div className="rounded-xl border border-gray-800 bg-gray-950/50 px-3 py-4 text-sm text-gray-500">
                No player risk groups detected. Use Groups to mark Return to Load, Load Watch or Risk players.
              </div>
            ) : visiblePlayerSignals.map(player => (
              <div key={player.name} className="flex items-center justify-between gap-3 rounded-xl border border-gray-800 bg-gray-950/50 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{player.name}</p>
                  <p className="truncate text-xs text-gray-500">{player.note}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge tone={riskTone(player.risk)} text={player.risk} />
                  <Badge tone={statusTone(player.status)} text={player.status} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-800 bg-gray-900/70 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-300">Operational loop</p>
              <h3 className="mt-1 text-sm font-black text-white">Use the product in this order.</h3>
            </div>
            <Clock3 size={18} className="text-emerald-300" />
          </div>
          <div className="mt-3 grid gap-2">
            <LoopStep number="1" title="Plan sessions" text="Create the training, game or recovery block and assign a team." />
            <LoopStep number="2" title="Collect exceptions" text="Athletes only report late, maybe or no. Everyone else stays expected." />
            <LoopStep number="3" title="Finalize attendance" text="After the session, the coach owns the final attendance truth." />
            <LoopStep number="4" title="Adjust load" text="Use final participation context to guide future workload decisions." />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-800 bg-gray-900/60 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Workspace health</p>
            <p className="mt-1 text-sm text-gray-300">
              {teams.length} team{teams.length === 1 ? '' : 's'} · {roster.length} player{roster.length === 1 ? '' : 's'} · {groups.length} group{groups.length === 1 ? '' : 's'} · {upcomingSessions.length} upcoming session{upcomingSessions.length === 1 ? '' : 's'}
            </p>
          </div>
          <button onClick={reload} className="w-fit rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-xs font-bold text-gray-300 transition-colors hover:border-gray-500 hover:text-white">
            Refresh workspace
          </button>
        </div>
      </section>
    </div>
  );
}

function CommandStat({ icon: Icon, label, value, text, tone }: { icon: ElementType; label: string; value: string; text: string; tone: 'sky' | 'emerald' | 'amber' | 'red' }) {
  const tones = {
    sky: 'border-sky-800/50 bg-sky-950/20 text-sky-300',
    emerald: 'border-emerald-800/50 bg-emerald-950/20 text-emerald-300',
    amber: 'border-amber-800/50 bg-amber-950/20 text-amber-300',
    red: 'border-red-800/50 bg-red-950/20 text-red-300',
  };
  return (
    <div className={`rounded-2xl border px-4 py-3 ${tones[tone]}`}>
      <div className="flex items-center gap-2">
        <Icon size={16} />
        <p className="text-xs font-bold uppercase tracking-wide opacity-80">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-xs leading-5 text-gray-500">{text}</p>
    </div>
  );
}

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-950/50 px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-600">{label}</p>
      <p className="mt-1 truncate text-xs font-semibold text-gray-300">{value}</p>
    </div>
  );
}

function QuickAction({ icon: Icon, title, text, onClick }: { icon: ElementType; title: string; text: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-xl border border-gray-800 bg-gray-950/50 px-3 py-3 text-left transition-colors hover:border-violet-700/60">
      <Icon size={16} className="text-violet-300" />
      <p className="mt-2 text-sm font-bold text-white">{title}</p>
      <p className="mt-1 text-xs leading-5 text-gray-500">{text}</p>
    </button>
  );
}

function LoopStep({ number, title, text }: { number: string; title: string; text: string }) {
  return (
    <div className="flex gap-3 rounded-xl border border-gray-800 bg-gray-950/50 px-3 py-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-900/40 text-xs font-black text-emerald-300">{number}</span>
      <div>
        <p className="text-sm font-bold text-white">{title}</p>
        <p className="mt-0.5 text-xs leading-5 text-gray-500">{text}</p>
      </div>
    </div>
  );
}

function Badge({ tone, text }: { tone: 'green' | 'amber' | 'red' | 'blue' | 'gray'; text: string }) {
  const tones = {
    green: 'border-green-800 bg-green-950/30 text-green-300',
    amber: 'border-amber-800 bg-amber-950/30 text-amber-300',
    red: 'border-red-800 bg-red-950/30 text-red-300',
    blue: 'border-blue-800 bg-blue-950/30 text-blue-300',
    gray: 'border-gray-800 bg-gray-950/60 text-gray-400',
  };
  return <span className={`rounded-lg border px-2 py-1 text-[10px] font-bold uppercase ${tones[tone]}`}>{text}</span>;
}

function dotClass(tone: 'green' | 'amber' | 'red') {
  if (tone === 'green') return 'bg-green-400';
  if (tone === 'amber') return 'bg-amber-400';
  return 'bg-red-400';
}

function riskTone(risk: string): 'green' | 'amber' | 'red' | 'blue' | 'gray' {
  if (risk === 'high') return 'red';
  if (risk === 'elevated') return 'amber';
  if (risk === 'under') return 'blue';
  if (risk === 'optimal') return 'green';
  return 'gray';
}

function statusTone(status: string): 'green' | 'amber' | 'red' | 'blue' | 'gray' {
  if (status === 'out') return 'red';
  if (status === 'maybe' || status === 'watch') return 'amber';
  if (status === 'available') return 'green';
  return 'gray';
}

function formatDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function todayIso() {
  return new Date().toISOString().split('T')[0];
}
