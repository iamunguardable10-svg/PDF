import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, HelpCircle, XCircle } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import type { CoachOutletContext } from '../CoachShell';
import type { AttendanceSession, FinalAttendanceStatus } from '../../../types/attendance';
import type { ManagedAthlete } from '../../../types/trainerDashboard';
import type { AthleteAvailabilityRecord, AthleteAvailabilityStatus } from '../../../lib/availability';
import { loadAvailabilityForCoachSessionsAsync } from '../../../lib/availability';
import {
  clearFinalAttendanceAsync,
  finalAttendanceLabel,
  loadFinalAttendanceForSessionAsync,
  loadFinalAttendanceRecords,
  saveFinalAttendanceAsync,
  validateFinalAttendance,
} from '../../../lib/finalAttendance';
import type { CoachFinalAttendanceInput, CoachFinalAttendanceRecord } from '../../../lib/finalAttendance';

type CoachAvailabilityRow = {
  id: string;
  sessionId: string;
  sessionTitle: string;
  sessionDate: string;
  sessionTime: string;
  athleteId: string;
  athleteName: string;
  status: AthleteAvailabilityStatus;
  lateMinutes?: number;
  reason: string;
};

type StatusSummary = Record<AthleteAvailabilityStatus, number>;
type FinalSummary = Record<FinalAttendanceStatus, number>;
type FinalRow = { athleteId: string; athleteName: string; finalRecord: CoachFinalAttendanceRecord | null };

type DemoAvailabilitySpec = {
  sessionIndex: number;
  athleteIndex: number;
  status: 'late' | 'maybe' | 'no';
  reason: string;
  lateMinutes?: number;
};

const FINAL_STATUS_OPTIONS: { status: FinalAttendanceStatus; label: string }[] = [
  { status: 'present', label: 'Present' },
  { status: 'late', label: 'Late' },
  { status: 'partial', label: 'Partial' },
  { status: 'excused_absent', label: 'Excused' },
  { status: 'unexcused_absent', label: 'Unexcused' },
];

export function AttendanceScreen() {
  const { sessions, teams, roster, demoMode } = useOutletContext<CoachOutletContext>();
  const [finalRecords, setFinalRecords] = useState<CoachFinalAttendanceRecord[]>(() => demoMode ? buildDemoFinalRecords(sessions, roster) : loadFinalAttendanceRecords());
  const [availabilityRecords, setAvailabilityRecords] = useState<AthleteAvailabilityRecord[]>([]);
  const [minutesByKey, setMinutesByKey] = useState<Record<string, number>>({});
  const [noteByKey, setNoteByKey] = useState<Record<string, string>>({});
  const [errorByKey, setErrorByKey] = useState<Record<string, string>>({});
  const [hydratingFinal, setHydratingFinal] = useState(false);
  const [hydratingAvailability, setHydratingAvailability] = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const upcomingSessions = useMemo(() => sessions
    .filter(session => session.datum >= today)
    .sort((a, b) => `${a.datum} ${a.startTime ?? ''}`.localeCompare(`${b.datum} ${b.startTime ?? ''}`)), [sessions, today]);
  const activeSession = todaySessionsFirst(sessions)[0] ?? upcomingSessions[0] ?? sessions[0] ?? null;

  useEffect(() => {
    if (demoMode || !activeSession) return;

    let cancelled = false;
    setHydratingFinal(true);

    loadFinalAttendanceForSessionAsync(activeSession.id)
      .then(records => {
        if (cancelled) return;
        setFinalRecords(prev => {
          const rest = prev.filter(item => item.sessionId !== activeSession.id);
          return [...records, ...rest].sort((a, b) => b.finalizedAt.localeCompare(a.finalizedAt));
        });
      })
      .catch(error => console.warn('[AttendanceScreen:hydrateFinal]', error))
      .finally(() => {
        if (!cancelled) setHydratingFinal(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeSession?.id, demoMode]);

  useEffect(() => {
    if (demoMode) return;

    const sessionIds = upcomingSessions.map(session => session.id);
    if (sessionIds.length === 0) {
      setAvailabilityRecords([]);
      return;
    }

    let cancelled = false;
    setHydratingAvailability(true);

    loadAvailabilityForCoachSessionsAsync(sessionIds)
      .then(records => {
        if (!cancelled) setAvailabilityRecords(records);
      })
      .catch(error => console.warn('[AttendanceScreen:hydrateAvailability]', error))
      .finally(() => {
        if (!cancelled) setHydratingAvailability(false);
      });

    return () => {
      cancelled = true;
    };
  }, [demoMode, upcomingSessions]);

  const availabilityRows = useMemo(() => buildAvailabilityRows(upcomingSessions, roster, demoMode, availabilityRecords), [availabilityRecords, upcomingSessions, roster, demoMode]);
  const summary = useMemo(() => summarize(availabilityRows), [availabilityRows]);
  const finalSummary = useMemo(() => summarizeFinal(finalRecords), [finalRecords]);
  const exceptionRows = availabilityRows.filter(row => row.status !== 'expected');
  const expectedCount = Math.max(0, estimateExpectedCount(upcomingSessions, roster, teams.length) - exceptionRows.length);
  const activeSessionFinalRows = activeSession ? buildFinalRows(activeSession, roster, finalRecords, demoMode) : [];

  async function handleFinalize(sessionId: string, athleteId: string, athleteName: string, status: FinalAttendanceStatus) {
    const key = `${sessionId}:${athleteId}`;
    const input: CoachFinalAttendanceInput = { status, note: noteByKey[key] };
    if (status === 'partial') input.minutesParticipated = minutesByKey[key] ?? 30;

    const validation = validateFinalAttendance(input);
    if (validation) {
      setErrorByKey(prev => ({ ...prev, [key]: validation }));
      return;
    }

    setErrorByKey(prev => ({ ...prev, [key]: '' }));
    const record = await saveFinalAttendanceAsync(sessionId, athleteId, athleteName, input);
    setFinalRecords(prev => [record, ...prev.filter(item => item.id !== record.id)]);
  }

  async function handleClearFinal(sessionId: string, athleteId: string) {
    const key = `${sessionId}:${athleteId}`;
    await clearFinalAttendanceAsync(sessionId, athleteId);
    setFinalRecords(prev => prev.filter(item => item.id !== key));
    setErrorByKey(prev => ({ ...prev, [key]: '' }));
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-green-300">TeamLoad</p>
        <h2 className="mt-1 text-2xl font-black text-white">Attendance</h2>
        <p className="mt-1 text-sm text-gray-400">Operational availability before the session, then coach-final attendance after or during the session.</p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Card label="Expected" value={String(expectedCount)} text="Default: available unless marked otherwise." tone="green" />
        <Card label="Late" value={String(summary.late)} text="Players arriving later." tone="amber" />
        <Card label="Maybe / No" value={String(summary.maybe + summary.no)} text={hydratingAvailability ? 'Loading cloud exceptions...' : 'Requires coach attention.'} tone="red" />
        <Card label="Finalized" value={String(finalRecords.length)} text={hydratingFinal ? 'Loading cloud records...' : 'Coach-confirmed records.'} tone="blue" />
      </div>

      <section className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900/60">
        <div className="flex flex-col gap-2 border-b border-gray-800 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <div>
            <h3 className="text-sm font-bold text-white">Coach final attendance</h3>
            <p className="mt-0.5 text-xs text-gray-500">Mark present, late, partial, excused or unexcused for the active session.</p>
          </div>
          <span className="w-fit rounded-full border border-gray-700 bg-gray-950 px-2.5 py-1 text-xs font-semibold text-gray-300">{activeSession?.title ?? 'No session'}</span>
        </div>
        <div className="grid grid-cols-2 gap-2 border-b border-gray-800 px-3 py-3 sm:grid-cols-5 sm:px-4">
          {FINAL_STATUS_OPTIONS.map(option => (
            <div key={option.status} className="rounded-xl border border-gray-800 bg-gray-950/60 px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">{option.label}</p>
              <p className="mt-1 text-lg font-black text-white">{finalSummary[option.status]}</p>
            </div>
          ))}
        </div>
        {activeSession && activeSessionFinalRows.length > 0 ? (
          <div className="divide-y divide-gray-800">
            {activeSessionFinalRows.map(row => {
              const key = `${activeSession.id}:${row.athleteId}`;
              return (
                <div key={row.athleteId} className="space-y-3 px-3 py-3 sm:px-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-bold text-white">{row.athleteName}</p>
                      <p className="mt-0.5 text-xs text-gray-500">Current final: {row.finalRecord ? finalAttendanceLabel(row.finalRecord.status) : 'Not finalized'}</p>
                    </div>
                    {row.finalRecord && (
                      <button onClick={() => void handleClearFinal(activeSession.id, row.athleteId)} className="w-fit rounded-lg border border-gray-700 px-2.5 py-1 text-xs font-semibold text-gray-400 hover:border-gray-500 hover:text-white">Clear</button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {FINAL_STATUS_OPTIONS.map(option => (
                      <button
                        key={option.status}
                        onClick={() => void handleFinalize(activeSession.id, row.athleteId, row.athleteName, option.status)}
                        className={`min-h-11 rounded-xl border px-2.5 py-2 text-xs font-bold transition-colors ${row.finalRecord?.status === option.status ? 'border-green-500 bg-green-900/30 text-green-200' : 'border-gray-800 bg-gray-950/50 text-gray-400 hover:border-gray-600 hover:text-white'}`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[150px_1fr]">
                    <label className="text-xs text-gray-500">
                      Partial minutes
                      <input
                        type="number"
                        min={1}
                        max={240}
                        value={minutesByKey[key] ?? row.finalRecord?.minutesParticipated ?? 30}
                        onChange={event => setMinutesByKey(prev => ({ ...prev, [key]: Number(event.target.value) }))}
                        className="mt-1 min-h-11 w-full rounded-lg border border-gray-700 bg-gray-950 px-2.5 py-2 text-sm text-white outline-none focus:border-green-500"
                      />
                    </label>
                    <label className="text-xs text-gray-500">
                      Coach note
                      <input
                        value={noteByKey[key] ?? row.finalRecord?.note ?? ''}
                        onChange={event => setNoteByKey(prev => ({ ...prev, [key]: event.target.value }))}
                        placeholder="Optional note, e.g. left early"
                        className="mt-1 min-h-11 w-full rounded-lg border border-gray-700 bg-gray-950 px-2.5 py-2 text-sm text-white outline-none focus:border-green-500"
                      />
                    </label>
                  </div>
                  {errorByKey[key] && <p className="text-xs font-semibold text-rose-300">{errorByKey[key]}</p>}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="px-4 py-8 text-center text-sm text-gray-500">No roster athletes available for final attendance.</div>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900/60">
        <div className="flex flex-col gap-2 border-b border-gray-800 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <div>
            <h3 className="text-sm font-bold text-white">Availability exceptions</h3>
            <p className="mt-0.5 text-xs text-gray-500">Late, maybe and no are shown here. Everyone else remains expected.</p>
          </div>
          <span className="w-fit rounded-full border border-gray-700 bg-gray-950 px-2.5 py-1 text-xs font-semibold text-gray-300">{hydratingAvailability ? 'Loading' : `${exceptionRows.length} open`}</span>
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
            <div key={session.id} className="rounded-2xl border border-gray-800 bg-gray-900/40 px-3 py-3 sm:px-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-white">{session.title}</p>
                  <p className="mt-0.5 text-xs text-gray-500">{formatDate(session.datum)} - {formatTime(session)}{team ? ` - ${team.name}` : ''}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${rows.length > 0 ? 'bg-amber-900/40 text-amber-200' : 'bg-emerald-900/40 text-emerald-200'}`}>{rows.length > 0 ? `${rows.length} exceptions` : 'all expected'}</span>
              </div>
              {rows.length > 0 && (
                <div className="mt-3 space-y-2">
                  {rows.map(row => (
                    <div key={row.id} className="flex items-center justify-between gap-2 rounded-xl bg-gray-950/60 px-3 py-2">
                      <span className="text-xs text-gray-300">{row.athleteName}</span>
                      <span className="shrink-0 text-xs font-semibold text-gray-400">{row.status === 'late' ? `${row.lateMinutes ?? 0} min late` : statusLabel(row.status)}</span>
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

function buildFinalRows(session: AttendanceSession, roster: ManagedAthlete[], records: CoachFinalAttendanceRecord[], demoMode: boolean): FinalRow[] {
  const baseAthletes = roster.length > 0 ? roster : demoMode ? buildFallbackRoster() : [];
  return baseAthletes.map(athlete => {
    const athleteId = athlete.id || athlete.token;
    const record = records.find(item => item.sessionId === session.id && item.athleteId === athleteId) ?? null;
    return { athleteId, athleteName: athlete.name, finalRecord: record };
  });
}

function buildAvailabilityRows(sessions: AttendanceSession[], roster: ManagedAthlete[], demoMode: boolean, records: AthleteAvailabilityRecord[]): CoachAvailabilityRow[] {
  if (demoMode) return buildDemoAvailabilityRows(sessions, roster);
  const bySession = new Map(sessions.map(session => [session.id, session]));
  return records
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
        athleteId: record.athleteUserId,
        athleteName: athlete?.name ?? 'Athlete',
        status: record.status,
        lateMinutes: record.lateMinutes,
        reason: record.reason,
      };
    })
    .sort(sortRows);
}

function buildDemoAvailabilityRows(sessions: AttendanceSession[], roster: ManagedAthlete[]): CoachAvailabilityRow[] {
  const demoRoster = roster.length > 0 ? roster : buildFallbackRoster();
  if (sessions.length === 0 || demoRoster.length === 0) return [];
  const specs: DemoAvailabilitySpec[] = [
    { sessionIndex: 0, athleteIndex: 1, status: 'late', lateMinutes: 20, reason: 'Schule endet spaeter' },
    { sessionIndex: 0, athleteIndex: 3, status: 'maybe', reason: 'Leichte Kniebeschwerden, entscheidet nach Warm-up' },
    { sessionIndex: 1, athleteIndex: 4, status: 'no', reason: 'Krank' },
    { sessionIndex: 3, athleteIndex: 2, status: 'late', lateMinutes: 15, reason: 'Bahn verspaetet' },
  ];
  return specs
    .map((spec, index) => {
      const session = sessions[spec.sessionIndex % sessions.length];
      const athlete = demoRoster[spec.athleteIndex % demoRoster.length];
      return {
        id: `demo-availability-${index}`,
        sessionId: session.id,
        sessionTitle: session.title,
        sessionDate: session.datum,
        sessionTime: formatTime(session),
        athleteId: athlete.id,
        athleteName: athlete.name,
        status: spec.status,
        lateMinutes: spec.lateMinutes,
        reason: spec.reason,
      };
    })
    .sort(sortRows);
}

function buildDemoFinalRecords(sessions: AttendanceSession[], roster: ManagedAthlete[]): CoachFinalAttendanceRecord[] {
  const session = todaySessionsFirst(sessions)[0] ?? sessions[0];
  const demoRoster = roster.length > 0 ? roster : buildFallbackRoster();
  if (!session || demoRoster.length < 3) return [];
  const first = demoRoster[0];
  const second = demoRoster[1];
  const third = demoRoster[2];
  return [
    demoFinal(session.id, first.id, first.name, 'present'),
    demoFinal(session.id, second.id, second.name, 'late', undefined, 'Arrived after school'),
    demoFinal(session.id, third.id, third.name, 'partial', 45, 'Managed minutes'),
  ];
}

function demoFinal(sessionId: string, athleteId: string, athleteName: string, status: FinalAttendanceStatus, minutesParticipated?: number, note = ''): CoachFinalAttendanceRecord {
  return {
    id: `${sessionId}:${athleteId}`,
    sessionId,
    athleteId,
    athleteName,
    status,
    minutesParticipated,
    note,
    finalizedAt: new Date().toISOString(),
  };
}

function buildFallbackRoster(): ManagedAthlete[] {
  return ['Noah K.', 'Elias M.', 'Jonas B.', 'Leo S.', 'Mika T.', 'Amin R.'].map((name, index) => ({
    id: `demo-final-athlete-${index}`,
    name,
    sport: 'Basketball',
    token: `demo-final-${index}`,
    groupIds: [],
    addedAt: new Date().toISOString(),
  }));
}

function todaySessionsFirst(sessions: AttendanceSession[]): AttendanceSession[] {
  const today = new Date().toISOString().split('T')[0];
  return sessions
    .filter(session => session.datum === today)
    .sort((a, b) => `${a.datum} ${a.startTime ?? ''}`.localeCompare(`${b.datum} ${b.startTime ?? ''}`));
}

function summarize(rows: CoachAvailabilityRow[]): StatusSummary {
  return rows.reduce<StatusSummary>((acc, row) => {
    acc[row.status] += 1;
    return acc;
  }, { expected: 0, maybe: 0, no: 0, late: 0 });
}

function summarizeFinal(rows: CoachFinalAttendanceRecord[]): FinalSummary {
  return rows.reduce<FinalSummary>((acc, row) => {
    acc[row.status] += 1;
    return acc;
  }, { present: 0, late: 0, partial: 0, excused_absent: 0, unexcused_absent: 0 });
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
    <div className="grid gap-3 px-3 py-3 sm:grid-cols-[1.1fr_1.3fr_auto] sm:items-center sm:px-4">
      <div>
        <div className="flex items-center gap-2">
          <Icon size={15} />
          <p className="text-sm font-bold text-white">{row.athleteName}</p>
        </div>
        <p className="mt-1 text-xs text-gray-500">{formatDate(row.sessionDate)} - {row.sessionTime}</p>
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
    <div className={`rounded-xl border px-3 py-3 sm:px-4 ${tones[tone]}`}>
      <p className="text-xs opacity-80">{label}</p>
      <p className="mt-1 text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-[11px] leading-4 text-gray-500 sm:text-xs">{text}</p>
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
