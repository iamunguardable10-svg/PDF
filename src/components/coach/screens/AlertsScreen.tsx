import { useOutletContext } from 'react-router-dom';
import type { CoachOutletContext } from '../CoachShell';

export function AlertsScreen() {
  const { sessions, roster } = useOutletContext<CoachOutletContext>();
  const today = new Date().toISOString().split('T')[0];
  const alerts = [
    ...(sessions.filter(s => s.datum >= today).length === 0 ? ['No upcoming sessions are planned.'] : []),
    ...(roster.length === 0 ? ['No players in the roster yet. Add players to unlock attendance and load alerts.'] : []),
  ];

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-red-300">TeamLoad</p>
        <h2 className="mt-1 text-2xl font-black text-white">Alerts</h2>
        <p className="mt-1 text-sm text-gray-400">Operational warnings for attendance, no-shows, load risk and low availability.</p>
      </div>
      <div className="space-y-2">
        {alerts.length === 0 ? (
          <div className="rounded-xl border border-gray-700 bg-gray-800/40 px-4 py-5 text-sm text-gray-400">No alerts right now.</div>
        ) : alerts.map(alert => (
          <div key={alert} className="rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-200">{alert}</div>
        ))}
      </div>
    </div>
  );
}
