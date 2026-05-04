import { useOutletContext } from 'react-router-dom';
import type { CoachOutletContext } from '../CoachShell';

export function AttendanceScreen() {
  const { sessions } = useOutletContext<CoachOutletContext>();
  const today = new Date().toISOString().split('T')[0];
  const todaySessions = sessions.filter(s => s.datum === today);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-green-300">TeamLoad</p>
        <h2 className="mt-1 text-2xl font-black text-white">Attendance</h2>
        <p className="mt-1 text-sm text-gray-400">Daily availability and final attendance workflow. Players are expected by default.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Card label="Expected" value="Default" text="Athletes are counted in unless they mark no or maybe." />
        <Card label="Today" value={String(todaySessions.length)} text="Sessions scheduled for today." />
        <Card label="Coach final" value="Next" text="Present, late, partial, excused and unexcused states." />
      </div>
    </div>
  );
}

function Card({ label, value, text }: { label: string; value: string; text: string }) {
  return <div className="rounded-xl border border-gray-700 bg-gray-800/50 px-4 py-3"><p className="text-xs text-gray-500">{label}</p><p className="mt-1 text-xl font-bold text-white">{value}</p><p className="mt-1 text-xs text-gray-500">{text}</p></div>;
}
