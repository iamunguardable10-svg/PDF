import { useOutletContext } from 'react-router-dom';
import type { CoachOutletContext } from '../CoachShell';

export function AnalyticsScreen() {
  const { teams, departments, sessions, roster } = useOutletContext<CoachOutletContext>();

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">TeamLoad</p>
        <h2 className="mt-1 text-2xl font-black text-white">Analytics</h2>
        <p className="mt-1 text-sm text-gray-400">High-level operating metrics for attendance, planning and workload.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Teams" value={teams.length} />
        <Stat label="Departments" value={departments.length} />
        <Stat label="Sessions" value={sessions.length} />
        <Stat label="Players" value={roster.length} />
      </div>
      <div className="rounded-xl border border-gray-700 bg-gray-800/40 px-4 py-4 text-sm text-gray-400">
        Next phase: attendance rate, late rate, override rate, excused absence rate and team availability trends.
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border border-gray-700 bg-gray-800/50 px-4 py-3"><p className="text-xs text-gray-500">{label}</p><p className="mt-1 text-2xl font-bold text-white">{value}</p></div>;
}
