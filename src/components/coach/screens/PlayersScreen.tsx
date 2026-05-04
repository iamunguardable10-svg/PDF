import { useOutletContext } from 'react-router-dom';
import type { CoachOutletContext } from '../CoachShell';

export function PlayersScreen() {
  const { roster } = useOutletContext<CoachOutletContext>();

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-indigo-300">TeamLoad</p>
        <h2 className="mt-1 text-2xl font-black text-white">Players</h2>
        <p className="mt-1 text-sm text-gray-400">Roster overview for availability, attendance and load monitoring.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {roster.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-700 bg-gray-800/30 px-4 py-5 text-sm text-gray-500">No players yet.</div>
        ) : roster.map(player => (
          <div key={player.id} className="rounded-xl border border-gray-700 bg-gray-800/50 px-4 py-3">
            <p className="font-semibold text-white">{player.name}</p>
            <p className="text-xs text-gray-500">{player.sport || 'Athlete'}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
