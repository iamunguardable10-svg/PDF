import { useOutletContext } from 'react-router-dom';
import type { CoachOutletContext } from '../CoachShell';

export function SettingsScreen() {
  const { org, coachContext } = useOutletContext<CoachOutletContext>();

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-300">TeamLoad</p>
        <h2 className="mt-1 text-2xl font-black text-white">Settings</h2>
        <p className="mt-1 text-sm text-gray-400">Club, role and workflow configuration.</p>
      </div>
      <div className="rounded-xl border border-gray-700 bg-gray-800/50 px-4 py-4">
        <p className="text-sm font-semibold text-white">{org?.name ?? 'No organization loaded'}</p>
        <p className="mt-1 text-xs text-gray-500">Current role: {coachContext?.role ?? 'Coach'}</p>
      </div>
    </div>
  );
}
