import { useOutletContext } from 'react-router-dom';
import type { CoachOutletContext } from '../CoachShell';

export function PlayersScreen() {
  const { roster } = useOutletContext<CoachOutletContext>();

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">TeamLoad Coach OS</p>
        <h2 className="text-2xl font-bold text-slate-950">Players</h2>
        <p className="mt-1 text-sm text-slate-600">Roster overview prepared for availability and load monitoring.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {roster.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">No players yet.</div>
        ) : roster.map(player => (
          <div key={player.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="font-semibold text-slate-950">{player.name}</p>
            <p className="text-sm text-slate-500">{player.sport || 'Athlete'}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
