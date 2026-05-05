import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { CalendarDays, CheckCircle2, ChevronLeft, Clock, MapPin, ShieldCheck, UsersRound } from 'lucide-react';
import type { AttendanceRecord, FinalAttendanceStatus } from '../../../types/attendance';
import { getEffectiveStatus } from '../../../types/attendance';
import { clearFinalStatus, deleteSession, loadSessionRecords, setFinalStatus } from '../../../lib/attendanceStorage';
import type { CoachOutletContext } from '../CoachShell';

type ExceptionBucket = 'out' | 'maybe' | 'late';

const FINAL_STATUSES: { value: FinalAttendanceStatus; label: string }[] = [
  { value: 'present', label: 'Present' },
  { value: 'late', label: 'Late' },
  { value: 'partial', label: 'Partial' },
  { value: 'excused_absent', label: 'Excused' },
  { value: 'unexcused_absent', label: 'Unexcused' },
];

function formatDate(datum: string): string {
  return new Date(`${datum}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short' });
}

function initials(name: string): string {
  return name.split(' ').map(part => part[0]).filter(Boolean).join('').slice(0, 2).toUpperCase() || 'A';
}

function effectiveLabel(record: AttendanceRecord): string {
  const status = getEffectiveStatus(record);
  const labels: Record<typeof status, string> = {
    expected: 'Expected',
    maybe: 'Maybe',
    no: 'Out',
    present: 'Present',
    late: 'Late',
    partial: 'Partial',
    excused_absent: 'Excused',
    unexcused_absent: 'Unexcused',
  };
  return labels[status];
}

function statusClass(record: AttendanceRecord): string {
  const status = getEffectiveStatus(record);
  if (status === 'present') return 'border-emerald-800/60 bg-emerald-950/20 text-emerald-300';
  if (status === 'late') return 'border-amber-800/60 bg-amber-950/20 text-amber-300';
  if (status === 'partial' || status === 'maybe') return 'border-yellow-800/60 bg-yellow-950/20 text-yellow-300';
  if (status === 'no' || status === 'unexcused_absent') return 'border-red-800/60 bg-red-950/20 text-red-300';
  if (status === 'excused_absent') return 'border-blue-800/60 bg-blue-950/20 text-blue-300';
  return 'border-gray-700 bg-gray-900/70 text-gray-400';
}

function exceptionBucket(record: AttendanceRecord): ExceptionBucket | null {
  if (record.overrideStatus === 'no') return 'out';
  if (record.overrideStatus === 'maybe') return 'maybe';
  if (record.overrideStatus === 'late') return 'late';
  return null;
}

export function SessionCockpitScreen() {
  const { teamId, sessionId } = useParams<{ teamId: string; sessionId: string }>();
  const navigate = useNavigate();
  const { sessions, teams, reload } = useOutletContext<CoachOutletContext>();

  const session = useMemo(() => sessions.find(item => item.id === sessionId) ?? null, [sessionId, sessions]);
  const team = useMemo(() => teams.find(item => item.id === (session?.teamId ?? teamId)) ?? null, [session?.teamId, teamId, teams]);

  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingRecord, setSavingRecord] = useState<string | null>(null);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [showExpected, setShowExpected] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    const recs = await loadSessionRecords(sessionId);
    setRecords(recs);
    setLoading(false);
  }, [sessionId]);

  useEffect(() => { load(); }, [load]);

  const expectedRows = useMemo(() => records.filter(record => !record.overrideStatus && !record.finalStatus), [records]);
  const finalizedRows = useMemo(() => records.filter(record => Boolean(record.finalStatus)), [records]);
  const exceptionRows = useMemo(() => records.filter(record => exceptionBucket(record)), [records]);
  const outRows = useMemo(() => exceptionRows.filter(record => exceptionBucket(record) === 'out'), [exceptionRows]);
  const maybeRows = useMemo(() => exceptionRows.filter(record => exceptionBucket(record) === 'maybe'), [exceptionRows]);
  const lateRows = useMemo(() => exceptionRows.filter(record => exceptionBucket(record) === 'late'), [exceptionRows]);
  const needsReviewCount = exceptionRows.filter(record => !record.finalStatus).length;

  async function handleSetFinal(recordId: string, status: FinalAttendanceStatus | null) {
    setSavingRecord(recordId);
    if (status === null) await clearFinalStatus(recordId);
    else await setFinalStatus(recordId, status);
    await load();
    setSavingRecord(null);
  }

  async function handleConfirmExpected() {
    if (expectedRows.length === 0 || bulkSaving) return;
    setBulkSaving(true);
    await Promise.all(expectedRows.map(record => setFinalStatus(record.id, 'present')));
    await load();
    setBulkSaving(false);
  }

  async function handleDelete() {
    if (!session) return;
    await deleteSession(session.id);
    reload();
    navigate(teamId ? `/coach/teams/${teamId}` : '/coach/teams');
  }

  if (!session) {
    return (
      <div className="space-y-3">
        <button onClick={() => navigate(teamId ? `/coach/teams/${teamId}` : '/coach/teams')} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300">
          <ChevronLeft size={14} /> Back
        </button>
        <div className="rounded-2xl border border-gray-800 bg-gray-900/60 px-4 py-10 text-center">
          <p className="text-sm font-semibold text-white">Session not found</p>
          <p className="mt-1 text-xs text-gray-500">Refresh data or return to the team calendar.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(teamId ? `/coach/teams/${teamId}` : '/coach/teams')}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          <ChevronLeft size={14} /> {team?.name ?? 'Team'}
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black uppercase tracking-wide text-sky-300">Session cockpit</p>
          <h2 className="truncate text-xl font-black text-white">{session.title}</h2>
        </div>
      </div>

      <section className="rounded-2xl border border-gray-800 bg-gray-900/60 px-4 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2 text-xs text-gray-400">
              <span className="inline-flex items-center gap-1 rounded-full border border-gray-800 px-2 py-1"><CalendarDays size={12} /> {formatDate(session.datum)}</span>
              {session.startTime && <span className="inline-flex items-center gap-1 rounded-full border border-gray-800 px-2 py-1"><Clock size={12} /> {session.startTime}{session.endTime ? ` - ${session.endTime}` : ''}</span>}
              {session.location && <span className="inline-flex items-center gap-1 rounded-full border border-gray-800 px-2 py-1"><MapPin size={12} /> {session.location}</span>}
              {session.trainingType && <span className="rounded-full border border-violet-800/60 bg-violet-950/20 px-2 py-1 text-violet-300">{session.trainingType}</span>}
            </div>
            <p className="max-w-3xl text-sm leading-6 text-gray-400">
              This page is exception-first: the coach sees who is not coming, unsure or late before the normal expected list.
            </p>
          </div>

          <button
            onClick={handleConfirmExpected}
            disabled={expectedRows.length === 0 || bulkSaving}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <CheckCircle2 size={14} />
            {bulkSaving ? 'Confirming...' : `Confirm expected (${expectedRows.length})`}
          </button>
        </div>
      </section>

      <section className="grid gap-2 sm:grid-cols-5">
        <MetricCard label="Needs review" value={String(needsReviewCount)} tone={needsReviewCount > 0 ? 'amber' : 'emerald'} />
        <MetricCard label="Out" value={String(outRows.length)} tone={outRows.length > 0 ? 'red' : 'gray'} />
        <MetricCard label="Maybe" value={String(maybeRows.length)} tone={maybeRows.length > 0 ? 'yellow' : 'gray'} />
        <MetricCard label="Late" value={String(lateRows.length)} tone={lateRows.length > 0 ? 'amber' : 'gray'} />
        <MetricCard label="Finalized" value={`${finalizedRows.length}/${records.length}`} tone="emerald" />
      </section>

      {loading ? (
        <div className="rounded-2xl border border-gray-800 bg-gray-900/60 px-4 py-10 text-center text-sm text-gray-500">Loading session records...</div>
      ) : (
        <div className="space-y-4">
          <section className="rounded-2xl border border-amber-900/50 bg-amber-950/10 px-4 py-4">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-amber-300" />
              <p className="text-xs font-black uppercase tracking-wide text-amber-300">Action required first</p>
            </div>
            <p className="mt-1 text-sm text-gray-400">Review exceptions. Expected players are lower on the page because they are usually not the problem.</p>
            <div className="mt-4 space-y-3">
              <ExceptionSection title="Out" rows={outRows} empty="No one has said they are out." onSetFinal={handleSetFinal} savingRecord={savingRecord} />
              <ExceptionSection title="Maybe" rows={maybeRows} empty="No uncertain players." onSetFinal={handleSetFinal} savingRecord={savingRecord} />
              <ExceptionSection title="Late" rows={lateRows} empty="No late reports." onSetFinal={handleSetFinal} savingRecord={savingRecord} />
            </div>
          </section>

          <section className="rounded-2xl border border-gray-800 bg-gray-900/60 px-4 py-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-gray-500">Expected / normal</p>
                <p className="mt-1 text-sm text-gray-400">These players have no exception. Keep this collapsed unless you need to audit the full list.</p>
              </div>
              <button onClick={() => setShowExpected(value => !value)} className="rounded-xl border border-gray-700 px-3 py-2 text-xs font-semibold text-gray-300 transition-colors hover:border-gray-500 hover:text-white">
                {showExpected ? 'Hide expected' : `Show expected (${expectedRows.length})`}
              </button>
            </div>
            {showExpected && (
              <div className="mt-4 space-y-2">
                {expectedRows.length > 0 ? expectedRows.map(record => (
                  <RecordRow key={record.id} record={record} onSetFinal={handleSetFinal} saving={savingRecord === record.id} compact />
                )) : <EmptyState text="No unfinalized expected players." />}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-gray-800 bg-gray-900/60 px-4 py-4">
            <div className="flex items-center gap-2">
              <UsersRound size={16} className="text-emerald-300" />
              <p className="text-xs font-black uppercase tracking-wide text-emerald-300">Finalized</p>
            </div>
            <div className="mt-4 space-y-2">
              {finalizedRows.length > 0 ? finalizedRows.map(record => (
                <RecordRow key={record.id} record={record} onSetFinal={handleSetFinal} saving={savingRecord === record.id} compact />
              )) : <EmptyState text="No final attendance saved yet." />}
            </div>
          </section>

          <section className="rounded-2xl border border-orange-900/50 bg-orange-950/10 px-4 py-4">
            <p className="text-xs font-black uppercase tracking-wide text-orange-300">Load context</p>
            <p className="mt-1 text-sm leading-6 text-gray-400">
              Attendance explains participation. It does not create load. Session load still comes from RPE x duration or validated workload data.
            </p>
          </section>
        </div>
      )}

      <section className="rounded-2xl border border-gray-800 bg-gray-900/60 px-4 py-4">
        {confirmDelete ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <button onClick={() => setConfirmDelete(false)} className="rounded-xl border border-gray-700 px-3 py-2 text-xs font-semibold text-gray-300 hover:border-gray-500">Cancel</button>
            <button onClick={handleDelete} className="rounded-xl bg-red-700 px-3 py-2 text-xs font-bold text-white hover:bg-red-600">Delete session</button>
          </div>
        ) : (
          <button onClick={() => setConfirmDelete(true)} className="rounded-xl border border-red-900/50 px-3 py-2 text-xs font-semibold text-red-300 hover:border-red-700">Delete session</button>
        )}
      </section>
    </div>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: string; tone: 'amber' | 'emerald' | 'red' | 'yellow' | 'gray' }) {
  const tones = {
    amber: 'border-amber-800/50 bg-amber-950/20 text-amber-300',
    emerald: 'border-emerald-800/50 bg-emerald-950/20 text-emerald-300',
    red: 'border-red-800/50 bg-red-950/20 text-red-300',
    yellow: 'border-yellow-800/50 bg-yellow-950/20 text-yellow-300',
    gray: 'border-gray-800 bg-gray-900/60 text-gray-400',
  };
  return (
    <div className={`rounded-2xl border px-3 py-3 ${tones[tone]}`}>
      <p className="text-[10px] font-black uppercase tracking-wide opacity-80">{label}</p>
      <p className="mt-1 text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function ExceptionSection({ title, rows, empty, onSetFinal, savingRecord }: {
  title: string;
  rows: AttendanceRecord[];
  empty: string;
  onSetFinal: (recordId: string, status: FinalAttendanceStatus | null) => void;
  savingRecord: string | null;
}) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-950/40 px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-black uppercase tracking-wide text-white">{title}</p>
        <span className="rounded-full border border-gray-700 px-2 py-0.5 text-[10px] font-bold text-gray-500">{rows.length}</span>
      </div>
      <div className="mt-3 space-y-2">
        {rows.length > 0 ? rows.map(record => (
          <RecordRow key={record.id} record={record} onSetFinal={onSetFinal} saving={savingRecord === record.id} />
        )) : <EmptyState text={empty} />}
      </div>
    </div>
  );
}

function RecordRow({ record, onSetFinal, saving, compact = false }: {
  record: AttendanceRecord;
  onSetFinal: (recordId: string, status: FinalAttendanceStatus | null) => void;
  saving: boolean;
  compact?: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/80 px-3 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-800 text-xs font-black text-gray-300">{initials(record.athleteName)}</div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">{record.athleteName}</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusClass(record)}`}>{effectiveLabel(record)}</span>
              {record.absenceReason && <span className="rounded-full border border-gray-700 px-2 py-0.5 text-[10px] font-bold text-gray-500">{record.absenceReason}</span>}
              {record.lateMinutes != null && <span className="rounded-full border border-amber-800/60 px-2 py-0.5 text-[10px] font-bold text-amber-300">+{record.lateMinutes} min</span>}
            </div>
            {!compact && record.absenceNote && <p className="mt-2 text-xs leading-5 text-gray-400">{record.absenceNote}</p>}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 sm:justify-end">
          {FINAL_STATUSES.map(status => (
            <button
              key={status.value}
              disabled={saving}
              onClick={() => onSetFinal(record.id, record.finalStatus === status.value ? null : status.value)}
              className={`rounded-lg px-2 py-1 text-[10px] font-bold transition-colors disabled:opacity-50 ${record.finalStatus === status.value ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'}`}
            >
              {status.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="rounded-xl border border-gray-800 bg-gray-950/50 px-3 py-4 text-center text-xs text-gray-500">{text}</p>;
}
