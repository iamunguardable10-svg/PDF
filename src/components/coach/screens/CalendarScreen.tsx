import { useOutletContext } from 'react-router-dom';
import type { CoachOutletContext } from '../CoachShell';

export function CalendarScreen() {
  const { sessions } = useOutletContext<CoachOutletContext>();
  const today = new Date().toISOString().split('T')[0];
  const items = sessions.filter(s => s.datum >= today).slice(0, 10);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">TeamLoad</p>
        <h2 className="mt-1 text-2xl font-black text-white">Calendar</h2>
        <p className="mt-1 text-sm text-gray-400">Agenda preview. Full weekly grid stays in team and department calendars.</p>
      </div>
      <div className="rounded-2xl border border-gray-700 bg-gray-900/70 p-4">
        <div className="space-y-2">
          {items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-700 bg-gray-800/30 px-4 py-5 text-sm text-gray-500">No events to show.</div>
          ) : items.map(session => (
            <div key={session.id} className="flex items-center gap-3 rounded-xl bg-gray-800/50 px-3 py-2">
              <div className="w-12 text-center text-xs text-gray-500">{new Date(session.datum + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{session.title}</p>
                <p className="text-xs text-gray-500">{session.startTime ?? 'No time'}{session.location ? ` - ${session.location}` : ''}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
