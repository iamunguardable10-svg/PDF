import { Activity, CalendarDays, Layers3, UserRound } from 'lucide-react';
import type { ElementType } from 'react';
import { useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { CoachOutletContext } from '../CoachShell';

export function PlayersScreen() {
  const { roster, groups, sessions } = useOutletContext<CoachOutletContext>();

  const today = new Date().toISOString().split('T')[0];
  const upcomingSessions = sessions.filter(session => session.datum >= today).length;
  const groupedPlayers = useMemo(() => roster.filter(player => player.groupIds.length > 0), [roster]);
  const groupNameById = useMemo(() => new Map(groups.map(group => [group.id, group.name])), [groups]);
  const loadWatchGroupIds = useMemo(() => new Set(groups
    .filter(group => /load|risk|return/i.test(group.name))
    .map(group => group.id)), [groups]);
  const loadWatchPlayers = useMemo(() => roster.filter(player => player.groupIds.some(id => loadWatchGroupIds.has(id))), [roster, loadWatchGroupIds]);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-indigo-300">Roster base</p>
        <h2 className="mt-1 text-2xl font-black text-white">Players</h2>
        <p className="mt-1 max-w-2xl text-sm text-gray-400">
          Players are the individual athlete layer. Teams decide where sessions happen; groups organize coaching focus; players carry attendance and load context.
        </p>
      </div>

      <section className="grid gap-3 sm:grid-cols-4">
        <SummaryCard icon={UserRound} label="Roster" value={String(roster.length)} text="Athletes available to assign and monitor." tone="indigo" />
        <SummaryCard icon={Layers3} label="Grouped" value={String(groupedPlayers.length)} text="Players assigned to at least one group." tone="violet" />
        <SummaryCard icon={Activity} label="Load watch" value={String(loadWatchPlayers.length)} text="Players in risk/load/return groups." tone="amber" />
        <SummaryCard icon={CalendarDays} label="Sessions" value={String(upcomingSessions)} text="Upcoming context for attendance." tone="cyan" />
      </section>

      {roster.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-700 bg-gray-800/30 px-4 py-8 text-center">
          <p className="text-sm font-semibold text-white">No players yet</p>
          <p className="mt-1 text-xs text-gray-500">Add athletes to the roster before using availability, final attendance or load context.</p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {roster.map(player => {
            const playerGroups = player.groupIds.map(id => groupNameById.get(id)).filter((name): name is string => Boolean(name));
            const isLoadWatch = player.groupIds.some(id => loadWatchGroupIds.has(id));
            return <PlayerCard key={player.id} player={player} groups={playerGroups} isLoadWatch={isLoadWatch} />;
          })}
        </div>
      )}
    </div>
  );
}

function PlayerCard({
  player,
  groups,
  isLoadWatch,
}: {
  player: { id: string; name: string; sport?: string; token?: string };
  groups: string[];
  isLoadWatch: boolean;
}) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-900/40 text-sm font-black text-indigo-200">
              {initials(player.name)}
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-base font-black text-white">{player.name}</h3>
              <p className="text-xs text-gray-500">{player.sport || 'Athlete'}</p>
            </div>
          </div>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold ${isLoadWatch ? 'border-amber-800 bg-amber-950/30 text-amber-300' : 'border-emerald-800 bg-emerald-950/30 text-emerald-300'}`}>
          {isLoadWatch ? 'Load watch' : 'Normal'}
        </span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <MiniInfo label="Groups" value={groups.length > 0 ? String(groups.length) : '0'} />
        <MiniInfo label="Availability" value="Default expected" />
        <MiniInfo label="Final status" value="Coach-owned" />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {groups.length === 0 ? (
          <span className="rounded-full border border-gray-800 bg-gray-950/50 px-2.5 py-1 text-xs text-gray-500">No group assigned</span>
        ) : groups.map(group => (
          <span key={group} className="rounded-full border border-violet-800/50 bg-violet-950/20 px-2.5 py-1 text-xs font-semibold text-violet-200">{group}</span>
        ))}
      </div>

      <p className="mt-3 text-xs leading-5 text-gray-500">
        Use this player view to understand the athlete layer. Session attendance is finalized in Attendance; risk context lives in Load Monitor.
      </p>
    </div>
  );
}

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-950/50 px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-600">{label}</p>
      <p className="mt-1 text-xs font-semibold text-gray-300">{value}</p>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, text, tone }: { icon: ElementType; label: string; value: string; text: string; tone: 'indigo' | 'violet' | 'amber' | 'cyan' }) {
  const tones = {
    indigo: 'border-indigo-800/50 bg-indigo-950/20 text-indigo-300',
    violet: 'border-violet-800/50 bg-violet-950/20 text-violet-300',
    amber: 'border-amber-800/50 bg-amber-950/20 text-amber-300',
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

function initials(name: string): string {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
