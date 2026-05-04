import { useOutletContext } from 'react-router-dom';
import { TrainerDashboard } from '../../TrainerDashboard';
import type { CoachOutletContext } from '../CoachShell';

export function LoadMonitorScreen() {
  const { user, coachName } = useOutletContext<CoachOutletContext>();

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Performance</p>
        <h2 className="text-2xl font-bold text-slate-950">Load Monitor</h2>
        <p className="mt-1 text-sm text-slate-600">ACWR, acute load, chronic load and player risk monitoring.</p>
      </div>
      <TrainerDashboard user={user} trainerName={coachName} embedded />
    </div>
  );
}
