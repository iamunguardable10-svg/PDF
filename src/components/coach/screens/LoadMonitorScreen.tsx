import { Activity, BarChart3, CheckCircle2, UserRound } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import { TrainerDashboard } from '../../TrainerDashboard';
import type { CoachOutletContext } from '../CoachShell';

export function LoadMonitorScreen() {
  const { user, coachName } = useOutletContext<CoachOutletContext>();

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-orange-300">TeamLoad</p>
        <h2 className="mt-1 text-2xl font-black text-white">Load Monitor</h2>
        <p className="mt-1 text-sm text-gray-400">ACWR and load graphs stay based on player load data. Attendance is context, not the load source.</p>
      </div>

      <section className="grid gap-3 md:grid-cols-3">
        <SourceCard
          icon={Activity}
          title="Load source"
          text="Team and group ACWR should be calculated from athlete load inputs such as RPE x duration, training entries or validated workload data."
          tone="orange"
        />
        <SourceCard
          icon={CheckCircle2}
          title="Attendance role"
          text="Final attendance validates participation context. It can explain absence or partial work, but it should not replace player load data."
          tone="green"
        />
        <SourceCard
          icon={UserRound}
          title="Player-level checks"
          text="Missing-load warnings belong in the player detail flow, where a coach can see if a present athlete forgot to submit load."
          tone="blue"
        />
      </section>

      <section className="rounded-2xl border border-gray-800 bg-gray-900/60 p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-orange-950/50 p-2 text-orange-300">
            <BarChart3 size={18} />
          </div>
          <div>
            <h3 className="text-sm font-black text-white">Team graph rule</h3>
            <p className="mt-1 text-xs leading-5 text-gray-500">
              The team graph below remains an aggregate of available player load data. It should not show per-player missing-load warnings. Those checks are more useful inside the individual player graph/profile.
            </p>
          </div>
        </div>
      </section>

      <TrainerDashboard user={user} trainerName={coachName} embedded />
    </div>
  );
}

function SourceCard({ icon: Icon, title, text, tone }: {
  icon: typeof Activity;
  title: string;
  text: string;
  tone: 'orange' | 'green' | 'blue';
}) {
  const tones = {
    orange: 'border-orange-900/50 bg-orange-950/20 text-orange-300',
    green: 'border-emerald-900/50 bg-emerald-950/20 text-emerald-300',
    blue: 'border-sky-900/50 bg-sky-950/20 text-sky-300',
  };

  return (
    <div className={`rounded-2xl border p-4 ${tones[tone]}`}>
      <div className="flex items-center gap-2">
        <Icon size={16} />
        <h3 className="text-sm font-black text-white">{title}</h3>
      </div>
      <p className="mt-2 text-xs leading-5 text-gray-500">{text}</p>
    </div>
  );
}
