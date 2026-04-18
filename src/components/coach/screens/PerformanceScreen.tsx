import { useOutletContext } from 'react-router-dom';
import { TrainerDashboard } from '../../TrainerDashboard';
import type { CoachOutletContext } from '../CoachShell';

export function PerformanceScreen() {
  const { user, coachName } = useOutletContext<CoachOutletContext>();
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-white">Kader & Performance</h2>
        <p className="text-xs text-gray-500 mt-0.5">ACWR, Belastungssteuerung und Athletenmonitoring</p>
      </div>
      <TrainerDashboard user={user} trainerName={coachName} embedded />
    </div>
  );
}
