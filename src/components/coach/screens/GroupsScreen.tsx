import { useOutletContext } from 'react-router-dom';
import type { CoachOutletContext } from '../CoachShell';

export function GroupsScreen() {
  const { groups, roster } = useOutletContext<CoachOutletContext>();

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">TeamLoad Coach OS</p>
        <h2 className="text-2xl font-bold text-slate-950">Groups</h2>
        <p className="mt-1 text-sm text-slate-600">Flexible groups for position groups, rehab groups and custom training squads.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {groups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">No groups yet.</div>
        ) : groups.map(group => {
          const members = roster.filter(player => player.groupIds.includes(group.id));
          return (
            <div key={group.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="font-semibold text-slate-950">{group.name}</p>
              <p className="text-sm text-slate-500">{members.length} players</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
