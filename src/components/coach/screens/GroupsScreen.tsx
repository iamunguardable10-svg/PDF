import { useOutletContext } from 'react-router-dom';
import type { CoachOutletContext } from '../CoachShell';

export function GroupsScreen() {
  const { groups, roster } = useOutletContext<CoachOutletContext>();

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-purple-300">TeamLoad</p>
        <h2 className="mt-1 text-2xl font-black text-white">Groups</h2>
        <p className="mt-1 text-sm text-gray-400">Custom squads for positions, rehab groups and training focus groups.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {groups.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-700 bg-gray-800/30 px-4 py-5 text-sm text-gray-500">No groups yet.</div>
        ) : groups.map(group => {
          const members = roster.filter(player => player.groupIds.includes(group.id));
          return (
            <div key={group.id} className="rounded-xl border border-gray-700 bg-gray-800/50 px-4 py-3">
              <p className="font-semibold text-white">{group.name}</p>
              <p className="text-xs text-gray-500">{members.length} players</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
