import { useOutletContext } from 'react-router-dom';
import type { CoachOutletContext } from '../CoachShell';

export function SessionsScreen() {
  const { sessions, teams } = useOutletContext<CoachOutletContext>();
  const today = new Date().toISOString().split('T')[0];
  const upcoming = sessions
    .filter(s => s.datum >= today)
    .sort((a, b) => `${a.datum}${a.startTime ?? ''}`.localeCompare(`${b.datum}${b.startTime ?? ''}`))
    .slice(0, 12);

  return (
    <div className="space-y-4">
      <Header title="Sessions" text="Training and event schedule for the next operational block." />
      <div className="space-y-2">
        {upcoming.length === 0 ? <Empty text="No upcoming sessions planned." /> : upcoming.map(session => (
          <div key={session.id} className="rounded-xl border border-gray-700 bg-gray-800/50 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-white truncate">{session.title}</p>
                <p className="text-xs text-gray-500">{formatDate(session.datum)}{session.startTime ? ` - ${session.startTime}` : ''}{session.location ? ` - ${session.location}` : ''}</p>
              </div>
              <span className="rounded-lg bg-gray-900 px-2 py-1 text-[11px] text-gray-400">{teams.find(t => t.id === session.teamId)?.name ?? 'Team'}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Header({ title, text }: { title: string; text: string }) {
  return <div><p className="text-xs font-semibold uppercase tracking-wider text-violet-300">TeamLoad</p><h2 className="mt-1 text-2xl font-black text-white">{title}</h2><p className="mt-1 text-sm text-gray-400">{text}</p></div>;
}
function Empty({ text }: { text: string }) { return <div className="rounded-xl border border-dashed border-gray-700 bg-gray-800/30 px-4 py-5 text-sm text-gray-500">{text}</div>; }
function formatDate(iso: string) { return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); }
