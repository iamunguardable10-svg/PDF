import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { CalendarDays, Lock, Plus, ShieldCheck } from 'lucide-react';
import type { CoachOutletContext } from '../CoachShell';
import type { AttendanceSession, AttendanceTrainingType } from '../../../types/attendance';
import { createSession } from '../../../lib/attendanceStorage';
import { loadAvailabilityForCoachSessionsAsync } from '../../../lib/availability';
import type { AthleteAvailabilityRecord } from '../../../lib/availability';
import { loadFinalAttendanceForSessionAsync } from '../../../lib/finalAttendance';
import type { CoachFinalAttendanceRecord } from '../../../lib/finalAttendance';
import { canEditSession, isSessionAssignedToCoach, roleLabel } from '../../../lib/rolePermissions';
import { CoachSessionDetailV1 } from '../CoachSessionDetailV1';
import type { ManagedAthlete } from '../../../types/trainerDashboard';

type SessionFilter = 'mine' | 'editable' | 'all';
type SessionLifecycle = 'upcoming' | 'live' | 'after';
type SessionRow = { session: AttendanceSession; assigned: boolean; editable: boolean; lifecycle: SessionLifecycle };
type CreateSessionFormValue = { title: string; datum: string; startTime: string; endTime: string; location: string; teamId: string; trainingType: AttendanceTrainingType; coachNote: string };

const TRAINING_TYPES: AttendanceTrainingType[] = ['Training', 'Spiel', 'S&C', 'Taktik', 'Videoanalyse', 'Regeneration', 'Sonstiges'];

export function SessionsScreen() {
  const navigate = useNavigate();
  const { user, sessions, teams, roster, groups, coachContext, permissions, demoMode, org, reload } = useOutletContext<CoachOutletContext>();
  const [filter, setFilter] = useState<SessionFilter>('mine');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [availabilityRecords, setAvailabilityRecords] = useState<AthleteAvailabilityRecord[]>([]);
  const [finalRecords, setFinalRecords] = useState<CoachFinalAttendanceRecord[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [, setLoadingAvailability] = useState(false);
  const [, setLoadingFinal] = useState(false);

  const relevantSessions = useMemo(() => sessions
    .filter(session => session.datum >= addDaysIso(-2))
    .sort((a, b) => `${a.datum}${a.startTime ?? ''}`.localeCompare(`${b.datum}${b.startTime ?? ''}`)), [sessions]);

  const demoAvailabilityRecords = useMemo(() => demoMode ? buildDemoAvailabilityRecords(relevantSessions, roster) : [], [demoMode, relevantSessions, roster]);
  const activeAvailabilityRecords = demoMode ? demoAvailabilityRecords : availabilityRecords;

  const sessionRows = useMemo<SessionRow[]>(() => relevantSessions
    .map(session => {
      const assigned = isSessionAssignedToCoach(session, teams, user.id, coachContext);
      const editable = canEditSession(session, teams, user.id, permissions, coachContext);
      return { session, assigned, editable, lifecycle: getSessionLifecycle(session) };
    })
    .filter(row => {
      if (filter === 'mine') return row.assigned;
      if (filter === 'editable') return row.editable;
      return true;
    })
    .sort((a, b) => {
      const lifecycleDiff = lifecycleWeight(a.lifecycle) - lifecycleWeight(b.lifecycle);
      if (lifecycleDiff !== 0) return lifecycleDiff;
      if (a.assigned !== b.assigned) return a.assigned ? -1 : 1;
      return `${a.session.datum}${a.session.startTime ?? ''}`.localeCompare(`${b.session.datum}${b.session.startTime ?? ''}`);
    })
    .slice(0, 16), [coachContext, filter, permissions, relevantSessions, teams, user.id]);

  const selectedRow = useMemo(() => sessionRows.find(row => row.session.id === selectedSessionId) ?? sessionRows[0] ?? null, [selectedSessionId, sessionRows]);
  const selectedSession = selectedRow?.session ?? null;

  useEffect(() => {
    if (demoMode) {
      setAvailabilityRecords([]);
      return;
    }
    const sessionIds = relevantSessions.map(session => session.id);
    if (sessionIds.length === 0) {
      setAvailabilityRecords([]);
      return;
    }
    let cancelled = false;
    setLoadingAvailability(true);
    loadAvailabilityForCoachSessionsAsync(sessionIds)
      .then(records => { if (!cancelled) setAvailabilityRecords(records); })
      .catch(error => console.warn('[SessionsScreen:availability]', error))
      .finally(() => { if (!cancelled) setLoadingAvailability(false); });
    return () => { cancelled = true; };
  }, [demoMode, relevantSessions]);

  useEffect(() => {
    if (!selectedSession || demoMode) {
      setFinalRecords([]);
      return;
    }
    let cancelled = false;
    setLoadingFinal(true);
    loadFinalAttendanceForSessionAsync(selectedSession.id)
      .then(records => { if (!cancelled) setFinalRecords(records); })
      .catch(error => console.warn('[SessionsScreen:finalAttendance]', error))
      .finally(() => { if (!cancelled) setLoadingFinal(false); });
    return () => { cancelled = true; };
  }, [demoMode, selectedSession]);

  async function handleCreateSession(input: CreateSessionFormValue) {
    if (demoMode) {
      setCreateOpen(false);
      return;
    }
    const team = teams.find(item => item.id === input.teamId);
    const result = await createSession({
      trainerId: user.id,
      title: input.title.trim(),
      description: input.coachNote.trim(),
      datum: input.datum,
      startTime: input.startTime,
      endTime: input.endTime,
      location: input.location.trim(),
      radiusM: 75,
      teamId: input.teamId || undefined,
      organizationId: org?.id,
      departmentId: team?.departmentId,
      trainingType: input.trainingType,
      coachNote: input.coachNote.trim(),
      memberIds: roster.map(player => ({ id: player.id, rosterId: player.id, name: player.name })),
    });
    setCreateOpen(false);
    await reload();
    if (result?.session?.id) setSelectedSessionId(result.session.id);
  }

  const selectedAvailability = selectedSession ? activeAvailabilityRecords.filter(record => record.sessionId === selectedSession.id) : [];
  const selectedFinalRecords = selectedSession && demoMode ? buildDemoFinalRecords(selectedSession, roster) : finalRecords;
  const selectedTeam = selectedSession ? teams.find(team => team.id === selectedSession.teamId) ?? null : null;
  const assignedCount = sessionRows.filter(row => row.assigned).length;
  const editableCount = sessionRows.filter(row => row.editable).length;
  const liveCount = sessionRows.filter(row => row.lifecycle === 'live').length;
  const afterCount = sessionRows.filter(row => row.lifecycle === 'after').length;
  const hasRelevantSessions = relevantSessions.length > 0;
  const emptyTitle = hasRelevantSessions ? 'No sessions match this filter' : 'No sessions in this window yet';
  const emptyText = hasRelevantSessions
    ? 'Switch to All visible or Editable to find sessions outside your direct assignment.'
    : 'Create the first training block so athletes can see what is coming and only report exceptions.';

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <Header title="Sessions" text="Select one session to see the time-aware coach detail view: attendance first, load context only where it helps." />
        <div className="flex flex-wrap gap-2">
          <FilterButton active={filter === 'mine'} onClick={() => setFilter('mine')}>My sessions</FilterButton>
          <FilterButton active={filter === 'editable'} onClick={() => setFilter('editable')}>Editable</FilterButton>
          <FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>All visible</FilterButton>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-4">
        <InfoCard label="Role" value={roleLabel(permissions.role)} text="Controls what you can create or edit." />
        <InfoCard label="Live" value={String(liveCount)} text="Needs the fastest operational scan." />
        <InfoCard label="To complete" value={String(afterCount)} text="Review attendance after session." />
        <InfoCard label="Editable" value={String(editableCount)} text={`${assignedCount} assigned in this queue.`} />
      </section>

      <div className="grid gap-4 xl:grid-cols-[0.82fr_1.18fr]">
        <div className="rounded-2xl border border-gray-800 bg-gray-900/70 p-3">
          <div className="mb-3 flex items-center justify-between gap-3 px-1">
            <div>
              <p className="text-sm font-bold text-white">Session queue</p>
              <p className="text-xs text-gray-500">Sorted by urgency: live, after session, upcoming.</p>
            </div>
            {permissions.canCreateSessions ? (
              <button onClick={() => setCreateOpen(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-violet-700 bg-violet-900/30 px-3 py-1.5 text-xs font-bold text-violet-200">
                <Plus size={14} /> New
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs font-bold text-gray-500">
                <Lock size={14} /> View
              </span>
            )}
          </div>

          <div className="space-y-2">
            {sessionRows.length === 0 ? <Empty title={emptyTitle} text={emptyText} canCreate={permissions.canCreateSessions} onCreate={() => setCreateOpen(true)} /> : sessionRows.map(({ session, assigned, editable, lifecycle }) => {
              const team = teams.find(t => t.id === session.teamId);
              const sessionAvailability = activeAvailabilityRecords.filter(record => record.sessionId === session.id);
              const isSelected = selectedSession?.id === session.id;
              return (
                <button key={session.id} onClick={() => setSelectedSessionId(session.id)} className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${sessionCardClass(isSelected, assigned, lifecycle)}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <QueueLifecycleBadge lifecycle={lifecycle} />
                        <p className="truncate font-semibold text-white">{session.title}</p>
                        {assigned && <Badge tone="violet">Assigned</Badge>}
                        {editable ? <Badge tone="green">Editable</Badge> : <Badge tone="gray">Read only</Badge>}
                      </div>
                      <p className="mt-1 text-xs text-gray-500">{formatDate(session.datum)}{session.startTime ? ` - ${session.startTime}` : ''}{session.location ? ` - ${session.location}` : ''}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-gray-500">
                        <span className="inline-flex items-center gap-1 rounded-lg bg-gray-950/60 px-2 py-1"><CalendarDays size={12} /> {team?.name ?? 'No team assigned'}</span>
                        {session.trainingType && <span className="rounded-lg bg-gray-950/60 px-2 py-1">{session.trainingType}</span>}
                        {editable && <span className="inline-flex items-center gap-1 rounded-lg bg-gray-950/60 px-2 py-1"><ShieldCheck size={12} /> Coach actions</span>}
                      </div>
                      <p className={`mt-2 text-xs font-bold ${queueHintClass(lifecycle)}`}>{queueHint(lifecycle)}</p>
                    </div>
                    <div className="shrink-0 text-right text-xs text-gray-500">
                      <p className="font-semibold text-gray-300">{sessionAvailability.length}</p>
                      <p>exceptions</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {selectedRow ? (
          <CoachSessionDetailV1
            session={selectedRow.session}
            teamName={selectedTeam?.name ?? 'No team assigned'}
            roster={roster}
            groups={groups}
            availabilityRecords={selectedAvailability}
            finalRecords={selectedFinalRecords}
            editable={selectedRow.editable}
            onOpenPlayer={(athleteId) => navigate(`/coach/players?athlete=${encodeURIComponent(athleteId)}`)}
          />
        ) : (
          <section className="rounded-2xl border border-dashed border-gray-800 bg-gray-900/50 p-6 text-sm text-gray-500">
            Select or create a session to open its operational detail view.
          </section>
        )}
      </div>

      {createOpen && <CreateSessionSheet teams={teams} demoMode={demoMode} onClose={() => setCreateOpen(false)} onCreate={handleCreateSession} />}
    </div>
  );
}

function CreateSessionSheet({ teams, demoMode, onClose, onCreate }: { teams: { id: string; name: string }[]; demoMode: boolean; onClose: () => void; onCreate: (value: CreateSessionFormValue) => Promise<void> }) {
  const [form, setForm] = useState<CreateSessionFormValue>({ title: 'Team Practice', datum: todayIso(), startTime: '18:30', endTime: '20:00', location: 'Main Court', teamId: teams[0]?.id ?? '', trainingType: 'Training', coachNote: 'Attendance first. Adjust intensity with Team Readiness.' });
  const [saving, setSaving] = useState(false);
  const canSave = Boolean(form.title.trim() && form.datum && form.startTime && form.endTime && form.location.trim() && (demoMode || form.teamId));

  async function submit() {
    if (!canSave || saving) return;
    setSaving(true);
    await onCreate(form);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center" onClick={event => { if (event.currentTarget === event.target) onClose(); }}>
      <div className="max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-3xl border border-gray-700 bg-gray-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-800 px-5 py-4">
          <div><p className="text-sm font-black text-white">New session</p><p className="text-xs text-gray-500">Create the operational block athletes react to.</p></div>
          <button onClick={onClose} className="rounded-xl px-3 py-1 text-gray-500 hover:bg-gray-800 hover:text-white">×</button>
        </div>
        <div className="space-y-3 px-5 py-4">
          {demoMode && <div className="rounded-2xl border border-green-800/40 bg-green-950/20 px-3 py-2 text-xs text-green-200">Demo mode: this preview closes the sheet. Turn demo off to write a real session.</div>}
          <Field label="Title"><input value={form.title} onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))} className="input" /></Field>
          <div className="grid grid-cols-2 gap-2"><Field label="Date"><input type="date" value={form.datum} onChange={e => setForm(prev => ({ ...prev, datum: e.target.value }))} className="input [color-scheme:dark]" /></Field><Field label="Team"><select value={form.teamId} onChange={e => setForm(prev => ({ ...prev, teamId: e.target.value }))} className="input"><option value="">Select</option>{teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}</select></Field></div>
          <div className="grid grid-cols-2 gap-2"><Field label="Start"><input type="time" value={form.startTime} onChange={e => setForm(prev => ({ ...prev, startTime: e.target.value }))} className="input [color-scheme:dark]" /></Field><Field label="End"><input type="time" value={form.endTime} onChange={e => setForm(prev => ({ ...prev, endTime: e.target.value }))} className="input [color-scheme:dark]" /></Field></div>
          <Field label="Location"><input value={form.location} onChange={e => setForm(prev => ({ ...prev, location: e.target.value }))} className="input" /></Field>
          <Field label="Type"><select value={form.trainingType} onChange={e => setForm(prev => ({ ...prev, trainingType: e.target.value as AttendanceTrainingType }))} className="input">{TRAINING_TYPES.map(type => <option key={type} value={type}>{type}</option>)}</select></Field>
          <Field label="Coach note"><textarea rows={3} value={form.coachNote} onChange={e => setForm(prev => ({ ...prev, coachNote: e.target.value }))} className="input resize-none" /></Field>
          <button disabled={!canSave || saving} onClick={submit} className="w-full rounded-2xl bg-violet-600 py-3 text-sm font-black text-white disabled:opacity-40">{saving ? 'Saving...' : demoMode ? 'Preview session flow' : 'Create session'}</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block text-xs text-gray-500">{label}<div className="mt-1 [&_.input]:w-full [&_.input]:rounded-xl [&_.input]:border [&_.input]:border-gray-700 [&_.input]:bg-gray-800 [&_.input]:px-3 [&_.input]:py-2 [&_.input]:text-sm [&_.input]:text-white [&_.input]:outline-none [&_.input]:focus:border-violet-500">{children}</div></label>;
}

function Header({ title, text }: { title: string; text: string }) {
  return <div><p className="text-xs font-semibold uppercase tracking-wider text-violet-300">TeamLoad</p><h2 className="mt-1 text-2xl font-black text-white">{title}</h2><p className="mt-1 text-sm text-gray-400">{text}</p></div>;
}

function Empty({ title, text, canCreate, onCreate }: { title: string; text: string; canCreate: boolean; onCreate: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-violet-800/70 bg-violet-950/15 px-5 py-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-black text-white">{title}</p>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-400">{text}</p>
        </div>
        {canCreate && <button onClick={onCreate} className="inline-flex w-fit items-center gap-1.5 rounded-xl bg-violet-500 px-3 py-2 text-xs font-black text-white"><Plus size={14} /> Plan first session</button>}
      </div>
    </div>
  );
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return <button onClick={onClick} className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition-colors ${active ? 'border-violet-600 bg-violet-900/40 text-violet-200' : 'border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-500 hover:text-white'}`}>{children}</button>;
}

function InfoCard({ label, value, text }: { label: string; value: string; text: string }) {
  return <div className="rounded-xl border border-gray-800 bg-gray-900/70 px-4 py-3"><p className="text-[11px] font-medium uppercase tracking-wider text-gray-500">{label}</p><p className="mt-1 text-xl font-black text-white">{value}</p><p className="mt-1 text-xs text-gray-500">{text}</p></div>;
}

function Badge({ tone, children }: { tone: 'violet' | 'green' | 'gray'; children: ReactNode }) {
  const tones = { violet: 'border-violet-700 bg-violet-900/40 text-violet-200', green: 'border-green-700 bg-green-900/30 text-green-200', gray: 'border-gray-700 bg-gray-900 text-gray-400' };
  return <span className={`rounded-lg border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${tones[tone]}`}>{children}</span>;
}

function QueueLifecycleBadge({ lifecycle }: { lifecycle: SessionLifecycle }) {
  const text = lifecycle === 'live' ? 'Live' : lifecycle === 'after' ? 'Complete' : 'Upcoming';
  const cls = lifecycle === 'live' ? 'border-emerald-700 bg-emerald-900/30 text-emerald-200' : lifecycle === 'after' ? 'border-amber-700 bg-amber-900/30 text-amber-200' : 'border-sky-700 bg-sky-900/30 text-sky-200';
  return <span className={`rounded-lg border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${cls}`}>{text}</span>;
}

function getSessionLifecycle(session: AttendanceSession): SessionLifecycle {
  const now = new Date();
  const start = parseSessionTime(session.datum, session.startTime, false);
  const end = parseSessionTime(session.datum, session.endTime, true);
  if (session.datum < todayIso()) return 'after';
  if (start && end && now >= start && now <= end) return 'live';
  if (end && now > end) return 'after';
  return 'upcoming';
}

function buildDemoAvailabilityRecords(sessions: AttendanceSession[], roster: ManagedAthlete[]): AthleteAvailabilityRecord[] {
  const find = (name: string) => roster.find(player => player.name.toLowerCase().includes(name));
  const records: AthleteAvailabilityRecord[] = [];
  const now = new Date().toISOString();
  const u18 = sessions.find(session => session.id === 'demo-session-1');
  const u16 = sessions.find(session => session.id === 'demo-session-2');
  const guards = sessions.find(session => session.id === 'demo-session-3');
  const recovery = sessions.find(session => session.id === 'demo-session-7');

  function add(session: AttendanceSession | undefined, athlete: ManagedAthlete | undefined, status: AthleteAvailabilityRecord['status'], reason: string, lateMinutes?: number) {
    if (!session || !athlete) return;
    records.push({ id: `${session.id}:${athlete.id}:demo`, sessionId: session.id, athleteUserId: athlete.id, status, reason, lateMinutes, updatedAt: now });
  }

  add(u18, find('elias'), 'late', 'Physio vorher, kommt nach Warm-up.', 20);
  add(u18, find('leo'), 'maybe', 'Sprunggelenk reagiert auf Belastung.', undefined);
  add(u18, find('tom'), 'no', 'Krank gemeldet.', undefined);
  add(u16, find('mika'), 'late', 'Schule geht länger.', 15);
  add(guards, find('finn'), 'maybe', 'Fühlt sich müde, entscheidet nach Shootaround.', undefined);
  add(recovery, find('elias'), 'no', 'Individuelle Behandlung statt Team-Recovery.', undefined);

  return records;
}

function buildDemoFinalRecords(session: AttendanceSession, roster: ManagedAthlete[]): CoachFinalAttendanceRecord[] {
  if (session.id !== 'demo-session-1' && session.id !== 'demo-session-2') return [];
  const now = new Date().toISOString();
  const base = roster.slice(0, 5);
  return base.map((athlete, index) => ({
    id: `${session.id}:${athlete.id}:final-demo`,
    sessionId: session.id,
    athleteId: athlete.id,
    athleteName: athlete.name,
    status: index === 1 ? 'late' : index === 3 ? 'partial' : 'present',
    minutesParticipated: index === 3 ? 42 : undefined,
    note: index === 1 ? 'Late arrival confirmed.' : index === 3 ? 'Partial load due to return-to-play limit.' : '',
    finalizedAt: now,
  }));
}

function parseSessionTime(dateIso: string, time: string | undefined, isEnd: boolean): Date | null {
  const value = time || (isEnd ? '23:59' : '00:00');
  const parsed = new Date(`${dateIso}T${value}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function lifecycleWeight(lifecycle: SessionLifecycle) { return lifecycle === 'live' ? 0 : lifecycle === 'after' ? 1 : 2; }
function sessionCardClass(isSelected: boolean, assigned: boolean, lifecycle: SessionLifecycle) {
  if (isSelected && lifecycle === 'live') return 'border-emerald-500 bg-emerald-950/25 shadow-lg shadow-emerald-950/20';
  if (isSelected && lifecycle === 'after') return 'border-amber-500 bg-amber-950/25 shadow-lg shadow-amber-950/20';
  if (isSelected) return 'border-sky-500 bg-sky-950/20';
  if (lifecycle === 'live') return 'border-emerald-800/70 bg-emerald-950/15 hover:border-emerald-600';
  if (lifecycle === 'after') return 'border-amber-800/70 bg-amber-950/15 hover:border-amber-600';
  if (assigned) return 'border-violet-700/70 bg-violet-950/20 hover:border-violet-500';
  return 'border-gray-700 bg-gray-800/50 hover:border-gray-500';
}
function queueHint(lifecycle: SessionLifecycle) { return lifecycle === 'live' ? 'Now: scan attendance and adjust session plan.' : lifecycle === 'after' ? 'After session: finalize attendance when ready.' : 'Before session: check exceptions first.'; }
function queueHintClass(lifecycle: SessionLifecycle) { return lifecycle === 'live' ? 'text-emerald-300' : lifecycle === 'after' ? 'text-amber-300' : 'text-sky-300'; }
function formatDate(iso: string) { return new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); }
function todayIso() { return new Date().toISOString().split('T')[0]; }
function addDaysIso(days: number) { const date = new Date(); date.setDate(date.getDate() + days); return date.toISOString().split('T')[0]; }
