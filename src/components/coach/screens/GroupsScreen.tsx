import { useMemo } from 'react';
import { Activity, AlertTriangle, Target, Users2 } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import type { CoachOutletContext } from '../CoachShell';

const GROUP_GUIDE = [
  {
    title: 'Role groups',
    text: 'Guards, bigs, starters or bench units for practice design.',
  },
  {
    title: 'Load groups',
    text: 'Return-to-load, load watch or restricted players for daily decisions.',
  },
  {
    title: 'Session groups',
    text: 'Use groups to plan who needs a specific drill, block or modified workload.',
  },
];

export function GroupsScreen() {
  const { groups, roster, sessions } = useOutletContext<CoachOutletContext>();

  const groupRows = useMemo(() => groups.map(group => {
    const members = roster.filter(player => player.groupIds.includes(group.id));
    const lower = group.name.toLowerCase();
    const purpose = lower.includes('load') || lower.includes('risk') || lower.includes('return')
      ? 'Load management'
      : lower.includes('guard') || lower.includes('big') || lower.includes('starter')
        ? 'Practice planning'
        : 'Coach-defined squad';
    const tone = lower.includes('risk') || lower.includes('load')
      ? 'amber'
      : lower.includes('return')
        ? 'emerald'
        : 'violet';
    return { group, members, purpose, tone };
  }), [groups, roster]);

  const assignedPlayers = new Set(groupRows.flatMap(row => row.members.map(player => player.id)));
  const unassignedCount = roster.filter(player => !assignedPlayers.has(player.id)).length;
  const activeGroupCount = groupRows.filter(row => row.members.length > 0).length;
  const upcomingCount = sessions.filter(session => session.datum >= new Date().toISOString().split('T')[0]).length;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-purple-300">Roster organization</p>
        <h2 className="mt-1 text-2xl font-black text-white">Groups</h2>
        <p className="mt-1 max-w-2xl text-sm text-gray-400">
          Groups are not teams. They are flexible coaching squads used for positions, return-to-load, risk watchlists and drill-specific planning.
        </p>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <SummaryCard icon={Users2} label="Active groups" value={`${activeGroupCount}/${groups.length}`} text="Groups with at least one player." tone="violet" />
        <SummaryCard icon={Target} label="Unassigned" value={String(unassignedCount)} text="Players not assigned to any group yet." tone="gray" />
        <SummaryCard icon={Activity} label="Upcoming context" value={String(upcomingCount)} text="Sessions that can use groups for planning." tone="cyan" />
      </section>

      <section className="rounded-2xl border border-gray-800 bg-gray-900/50 p-4">
        <div className="grid gap-3 md:grid-cols-3">
          {GROUP_GUIDE.map(item => (
            <div key={item.title} className="rounded-xl border border-gray-800 bg-gray-950/50 px-3 py-3">
              <p className="text-sm font-bold text-white">{item.title}</p>
              <p className="mt-1 text-xs leading-5 text-gray-500">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      {groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-700 bg-gray-800/30 px-4 py-8 text-center">
          <p className="text-sm font-semibold text-white">No groups yet</p>
          <p className="mt-1 text-xs text-gray-500">Create groups from the roster workflow to separate positions, return-to-load athletes or drill squads.</p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {groupRows.map(row => (
            <GroupCard key={row.group.id} {...row} />
          ))}
        </div>
      )}
    </div>
  );
}

function GroupCard({
  group,
  members,
  purpose,
  tone,
}: {
  group: { id: string; name: string; color: string };
  members: { id: string; name: string; sport?: string }[];
  purpose: string;
  tone: 'violet' | 'amber' | 'emerald';
}) {
  const tones = {
    violet: 'border-violet-800/50 bg-violet-950/20 text-violet-200',
    amber: 'border-amber-800/50 bg-amber-950/20 text-amber-200',
    emerald: 'border-emerald-800/50 bg-emerald-950/20 text-emerald-200',
  };

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: group.color }} />
            <h3 className="truncate text-base font-black text-white">{group.name}</h3>
          </div>
          <p className="mt-1 text-xs text-gray-500">{purpose}</p>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold ${tones[tone]}`}>{members.length} players</span>
      </div>

      <div className="mt-4 space-y-2">
        {members.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-800 bg-gray-950/40 px-3 py-3 text-xs text-gray-500">
            No players assigned. This group will not affect planning until athletes are added.
          </div>
        ) : members.map(member => (
          <div key={member.id} className="flex items-center justify-between rounded-xl border border-gray-800 bg-gray-950/50 px-3 py-2">
            <span className="text-sm font-semibold text-white">{member.name}</span>
            <span className="text-xs text-gray-500">{member.sport || 'Athlete'}</span>
          </div>
        ))}
      </div>

      {tone === 'amber' && (
        <div className="mt-3 flex gap-2 rounded-xl border border-amber-900/50 bg-amber-950/20 px-3 py-2 text-xs leading-5 text-amber-100/70">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-300" />
          Use this group as a coach reminder before assigning high-load players to intense sessions.
        </div>
      )}
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, text, tone }: { icon: typeof Users2; label: string; value: string; text: string; tone: 'violet' | 'gray' | 'cyan' }) {
  const tones = {
    violet: 'border-violet-800/50 bg-violet-950/20 text-violet-300',
    gray: 'border-gray-800 bg-gray-900/60 text-gray-300',
    cyan: 'border-cyan-800/50 bg-cyan-950/20 text-cyan-300',
  };
  return (
    <div className={`rounded-2xl border px-4 py-3 ${tones[tone]}`}>
      <div className="flex items-center gap-2">
        <Icon size={16} />
        <p className="text-xs font-bold uppercase tracking-wide opacity-80">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-xs leading-5 text-gray-500">{text}</p>
    </div>
  );
}
