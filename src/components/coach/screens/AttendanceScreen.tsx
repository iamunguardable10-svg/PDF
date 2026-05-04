import { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, HelpCircle, XCircle } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import type { CoachOutletContext } from '../CoachShell';
import type { AttendanceSession } from '../../../types/attendance';
import type { ManagedAthlete } from '../../../types/trainerDashboard';
import type { AthleteAvailabilityStatus } from '../../../lib/availability';
import { loadAvailabilityRecords } from '../../../lib/availability';

type CoachAvailabilityRow = {
  id: string;
  sessionId: string;
  sessionTitle: string;
  sessionDate: string;
  sessionTime: string;
  athleteName: string;
  status: AthleteAvailabilityStatus;
  lateMinutes?: number;
  reason: string;
};

type StatusSummary = Record<AthleteAvailabilityStatus, number>;

type DemoAvailabilitySpec = {
  sessionIndex: number;
  athleteIndex: number;
  status: 'late' | 'maybe' | 'no';
  reason: string;
  lateMinutes?: number;
};

export function AttendanceScreen() {
  const { sessions, teams, roster, demoMode } = useOutletContext<CoachOutletContext>();
  const today = new Date().toISOString().split('T')[0];
  const upcomingSessions = sessions
    .filter(session => session.datum >= today)
    .sort((a, b) => `${a.datum} ${a.startTime ?? ''}`.localeCompare(`${b.datum} ${b.startTime ?? ''}`));
  const todaySessions = sessions.filter(session => session.datum === today);

  const availabilityRows = useMemo(() => buildAvailabilityRows(upcomingSessions, roster, demoMode), [upcomingSessions, roster, demoMode]);
  const summary = useMemo(() => summarize(availabilityRows), [availabilityRows]);
  const exceptionRows = availabilityRows.filter(row => row.status !== 'expected');
  const expectedCount = Math.max(0, estimateExpectedCount(upcomingSessions, roster, teams.length) - exceptionRows.length);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-green-300">TeamLoad</p>
        <h2 className="mt-1 text-2xl font-black text-white">Attendance</h2>
        <p className="mt-1 text-sm text-gray-400">Operational availability board. Players are expected by default; only exceptions need action.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Card label="Expected" value={String(expectedCount)} text="Default: available and planned unless marked otherwise." tone="green" />
        <Card label="Late" value={String(summary.late)} text="Players arriving later, including minute estimate." tone="amber" />
        <Card label="Maybe / No" value={String(summary.maybe + summary.no)} text="Requires a reason before the coach can plan around it." tone="red" />
        <Card label="Today" value={String(todaySessions.length)} text="Sessions scheduled for today." tone="blue" />
      </div>

      <section className="rounded-2xl border border-gray-800 bg-gray-900/60 overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-gray-800 px-4 py-3">
          <div>
            <h3 className="text-sm font-bold text-white">Availability exceptions</h3>
            <p className="mt-0.5 text-xs text-gray-500">Late, maybe and no are shown here. Everyone else remains expected.</p>
          </div>
          <span className="rounded-full border border-gray-700 bg-gray-950 px-2.5 py-1 text-xs font-semibold text-gray-300">{exceptionRows.length} open</span>
        </div>

        {exceptionRows.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-400" />
            <p className="mt-3 text-sm font-semibold text-white">No availability exceptions</p>
            <p className="mt-1 text-xs text-gray-500">All upcoming players are treated as expected unless they mark late, maybe or no.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {exceptionRows.map(row => <AvailabilityRow key={row.id} row={row} />)}
          </div>
        )}
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        {upcomingSessions.slice(0, 6).map(session => {
          const rows = availabilityRows.filter(row => row.sessionId === session.id && row.status !== 'expected');
          const team = teams.find(item => item.id === session.teamId);
          return (
            <div key={session.id} className="rounded-2xl border border-gray-800 bg-gray-900/40 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-white">{session.title}</p>
                  <p className="mt-0.5 text-xs text-gray-500">{formatDate(session.datum)} · {formatTime(session)}{team ? ` · ${team.name}` : ''}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${rows.length > 0 ? 'bg-amber-900/40 text-amber-200' : 'bg-emerald-900/40 text-emerald-200'}`}>{rows.length > 0 ? `${rows.length} exceptions` : 'all expected'}</span>
              </div>
              {rows.length > 0 && (
                <div className="mt-3 space-y-2">
                  {rows.map(row => (
                    <div key={row.id} className="flex items-center justify-between gap-2 rounded-xl bg-gray-950/60 px-3 py-2">
                      <span className="text-xs text-gray-300">{row.athleteName}</span>
                      <span className="text-xs font-semibold text-gray-400">{row.status === 'late' ? `${row.lateMinutes ?? 0} min late` : statusLabel(row.status)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}

function buildAvailabilityRows(sessions: AttendanceSession[], roster: ManagedAthlete[], demoMode: boolean): CoachAvailabilityRow[] {
  if (demoMode) return buildDemoAvailabilityRows(sessions, roster);
  const bySession = new Map(sessions.map(session => [session.id, session]));
  return loadAvailabilityRecords()
    .filter(record => bySession.has(record.sessionId))
    .map(record => {
      const session = bySession.get(record.sessionId)!;
      const athlete = roster.find(item => item.id === record.athleteUserId || item.token === record.athleteUserId);
      return {
        id: record.id,
        sessionId: record.sessionId,
        sessionTitle: session.title,
        sessionDate: session.datum,
        sessionTime: formatTime(session),
        athleteName: athlete?.name ?? 'Athlete',
        status: record.status,
        lateMinutes: record.lateMinutes,
        reason: record.reason,
      };
    })
    .sort(sortRows);
}

function buildDemoAvailabilityRows(sessions: AttendanceSession[], roster: ManagedAthlete[]): CoachAvailabilityRow[] {
  if (sessions.length === 0 || roster.length === 0) return [];
  const specs: DemoAvailabilitySpec[] = [
    { sessionIndex: 0, athleteIndex: 1, status: 'late', lateMinutes: 20, reason: 'Schule endet spaeter' },
    { sessionIndex: 0, athleteIndex: 3, status: 'maybe', reason: 'Leichte Kniebeschwerden, entscheidet nach Warm-up' },
    { sessionIndex: 1, athleteIndex: 4, status: 'no', reason: 'Krank' },
    { sessionIndex: 3, athleteIndex: 2, status: 'late', lateMinutes: 15, reason: 'Bahn verspaetet' },
  ];
  return specs
    .map((spec, index) => {
      const session = sessions[spec.sessionIndex % sessions.length];
      const athlete = roster[spec.athleteIndex % roster.length];
      return {
        id: `demo-availability-${index}`,
        sessionId: session.id,
        sessionTitle: session.title,
        sessionDate: session.datum,
        sessionTime: formatTime(session),
        athleteName: athlete.name,
        status: spec.status,
        lateMinutes: spec.lateMinutes,
        reason: spec.reason,
      };
    })
    .sort(sortRows);
}

function summarize(rows: CoachAvailabilityRow[]): StatusSummary {
  return rows.reduce<StatusSummary>((acc, row) => {
    acc[row.status] += 1;
    return acc;
  }, { expected: 0, maybe: 0, no: 0, late: 0 });
}

function estimateExpectedCount(sessions: AttendanceSession[], roster: ManagedAthlete[], teamCount: number): number {
  if (sessions.length === 0) return 0;
  const baseRoster = roster.length > 0 ? roster.length : Math.max(8, teamCount * 6);
  return sessions.length * baseRoster;
}

function sortRows(a: CoachAvailabilityRow, b: CoachAvailabilityRow): number {
  return `${a.sessionDate} ${a.sessionTime}`.localeCompare(`${b.sessionDate} ${b.sessionTime}`);
}

function AvailabilityRow({ row }: { row: CoachAvailabilityRow }) {
  const Icon = row.status === 'late' ? Clock3 : row.status === 'maybe' ? HelpCircle : XCircle;
  const tone = row.status === 'late'
    ? 'border-amber-800/60 bg-amber-950/20 text-amber-200'
    : row.status === 'maybe'
      ? 'border-gray-700 bg-gray-800/50 text-gray-200'
      : 'border-rose-800/60 bg-rose-950/20 text-rose-200';

  return (
    <div className="grid gap-3 px-4 py-3 sm:grid-cols-[1.1fr_1.3fr_auto] sm:items-center">
      <div>
        <div className="flex items-center gap-2">
          <Icon size={15} />
          <p className="text-sm font-bold text-white">{row.athleteName}</p>
        </div>
        <p className="mt-1 text-xs text-gray-500">{formatDate(row.sessionDate)} · {row.sessionTime}</p>
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-200">{row.sessionTitle}</p>
        <p className="mt-1 text-xs text-gray-500">{row.reason || 'No reason provided'}</p>
      </div>
      <span className={`inline-flex w-fit items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold ${tone}`}>
        {row.status === 'late' && <AlertTriangle size={12} />}
        {row.status === 'late' ? `${row.lateMinutes ?? 0} min late` : statusLabel(row.status)}
      </span>
    </div>
  );
}

function Card({ label, value, text, tone }: { label: string; value: string; text: string; tone: 'green' | 'amber' | 'red' | 'blue' }) {
  const tones = {
    green: 'border-emerald-800/50 bg-emerald-950/20 text-emerald-200',
    amber: 'border-amber-800/50 bg-amber-950/20 text-amber-200',
    red: 'border-rose-800/50 bg-rose-950/20 text-rose-200',
    blue: 'border-blue-800/50 bg-blue-950/20 text-blue-200',
  };
  return (
    <div className={`rounded-xl border px-4 py-3 ${tones[tone]}`}>
      <p className="text-xs opacity-80">{label}</p>
      <p className="mt-1 text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{text}</p>
    </div>
  );
}

function statusLabel(status: AthleteAvailabilityStatus): string {
  if (status === 'expected') return 'Expected';
  if (status === 'late') return 'Late';
  if (status === 'maybe') return 'Maybe';
  return 'No';
}

function formatTime(session: AttendanceSession): string {
  if (session.startTime && session.endTime) return `${session.startTime}-${session.endTime}`;
  if (session.startTime) return session.startTime;
  return 'Time tbd';
}

function formatDate(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
}
