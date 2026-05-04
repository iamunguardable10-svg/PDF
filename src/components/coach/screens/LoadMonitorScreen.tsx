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
        <p className="mt-1 text-sm text-gray-400">Existing ACWR and performance dashboard embedded as the load monitoring workspace.</p>
      </div>
      <TrainerDashboard user={user} trainerName={coachName} embedded />
    </div>
  );
}
