import { useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { AlertTriangle, CalendarDays, CheckCircle2, UsersRound } from 'lucide-react';
import { JoinRequestsPanel } from '../JoinRequestsPanel';
import type { CoachOutletContext } from '../CoachShell';

export function DashboardScreen() {
  const { user, teams, sessions, loading, reload, roster, groups } = useOutletContext<CoachOutletContext>();

  const today = new Date().toISOString().split('T')[0];
  const upcomingSessions = useMemo(
    () => sessions.filter(s => s.datum >= today).sort((a, b) => `${a.datum}${a.startTime ?? ''}`.localeCompare(`${b.datum}${b.startTime ?? ''}`)),
    [sessions, today],
  );
  const todaySessions = upcomingSessions.filter(s => s.datum === today);
  const focusSessions = todaySessions.length > 0 ? todaySessions : upcomingSessions.slice(0, 1);
  const focusLabel = todaySessions.length > 0 ? 'Today' : 'Next session';

  const expectedPlayers = roster.length;
  const availablePlayers = expectedPlayers;
  const unavailablePlayers = 0;
  const atRiskPlayers = 0;

  const alerts = [
    ...(focusSessions.length === 0 ? ['No upcoming session scheduled.'] : []),
    ...(expectedPlayers === 0 ? ['No players in roster yet. Add players to unlock availability and load insights.'] : []),
    ...(atRiskPlayers > 0 ? [`${atRiskPlayers} players are currently above the risk threshold.`] : []),
  ];

  return (
    <div className="space-y-6">
      <JoinRequestsPanel trainerId={user.id} onChanged={reload} />

      <section className="rounded-3xl bg-slate-950 p-6 text-white shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-300">Coach overview</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight">Ready for {focusLabel.toLowerCase()}?</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              See availability, risk, upcoming sessions and operational alerts in one place.
            </p>
          </div>
          <div className="rounded-2xl bg-white/10 px-4 py-3 text-sm text-slate-200">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Available Players" value={loading ? '...' : availablePlayers} helper="Expected by default" Icon={CheckCircle2} tone="green" />
        <MetricCard label="Unavailable" value={loading ? '...' : unavailablePlayers} helper="Cancelled or excused" Icon={UsersRound} tone="red" />
        <MetricCard label="At Risk" value={loading ? '...' : atRiskPlayers} helper="ACWR risk summary" Icon={AlertTriangle} tone="amber" />
        <MetricCard label="Sessions Today" value={loading ? '...' : todaySessions.length} helper={`${upcomingSessions.length} upcoming total`} Icon={CalendarDays} tone="blue" />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-950">{focusLabel}</h3>
              <p className="text-sm text-slate-500">Main operating block for the coach.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{focusSessions.length} session{focusSessions.length === 1 ? '' : 's'}</span>
          </div>

          <div className="mt-4 space-y-3">
            {focusSessions.length === 0 ? (
              <EmptyState text="No upcoming sessions yet." />
            ) : focusSessions.map(session => (
              <div key={session.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-bold text-slate-950">{session.title}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {formatDate(session.datum)}{session.startTime ? ` - ${session.startTime}` : ''}{session.location ? ` - ${session.location}` : ''}
                    </p>
                  </div>
                  <div className="text-sm font-semibold text-slate-700">
                    {teams.find(t => t.id === session.teamId)?.name ?? 'No team'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold text-slate-950">Availability</h3>
          <p className="text-sm text-slate-500">Default status is attending until a player changes it.</p>
          <div className="mt-5 grid grid-cols-3 gap-3 text-center">
            <SmallStat label="Available" value={availablePlayers} />
            <SmallStat label="Unsure" value={0} />
            <SmallStat label="Out" value={unavailablePlayers} />
          </div>
          <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-green-500" style={{ width: expectedPlayers > 0 ? `${(availablePlayers / expectedPlayers) * 100}%` : '0%' }} />
          </div>
          <p className="mt-3 text-xs text-slate-500">Detailed availability and attendance workflows are prepared as dedicated screens.</p>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <Panel title="Upcoming Sessions" className="xl:col-span-1">
          <div className="space-y-2">
            {upcomingSessions.length === 0 ? <EmptyState text="No sessions planned." /> : upcomingSessions.slice(0, 5).map(session => (
              <div key={session.id} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-950">{session.title}</p>
                  <p className="text-xs text-slate-500">{formatDate(session.datum)}{session.startTime ? ` - ${session.startTime}` : ''}</p>
                </div>
                <span className="rounded-full bg-white px-2 py-1 text-[11px] font-bold text-slate-500 shadow-sm">{teams.find(t => t.id === session.teamId)?.name ?? 'Team'}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Players at Risk">
          <EmptyState text="ACWR risk list will be powered by the Load Monitor data." />
        </Panel>

        <Panel title="Alerts">
          <div className="space-y-2">
            {alerts.length === 0 ? <EmptyState text="No alerts right now." /> : alerts.map(alert => (
              <div key={alert} className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm font-medium text-amber-900">
                {alert}
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-bold text-slate-950">Team structure</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <SmallStat label="Teams" value={teams.length} />
          <SmallStat label="Groups" value={groups.length} />
          <SmallStat label="Players" value={roster.length} />
        </div>
      </section>
    </div>
  );
}

function MetricCard({ label, value, helper, Icon, tone }: { label: string; value: string | number; helper: string; Icon: React.ElementType; tone: 'green' | 'red' | 'amber' | 'blue' }) {
  const tones = {
    green: 'bg-green-50 text-green-700 border-green-100',
    red: 'bg-red-50 text-red-700 border-red-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
  };
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-black text-slate-950">{value}</p>
          <p className="mt-1 text-xs text-slate-500">{helper}</p>
        </div>
        <div className={`rounded-2xl border p-2.5 ${tones[tone]}`}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

function Panel({ title, className = '', children }: { title: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-3xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      <h3 className="text-lg font-bold text-slate-950">{title}</h3>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function SmallStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-4 py-3">
      <p className="text-2xl font-black text-slate-950">{value}</p>
      <p className="text-xs font-semibold text-slate-500">{label}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">{text}</div>;
}

function formatDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
