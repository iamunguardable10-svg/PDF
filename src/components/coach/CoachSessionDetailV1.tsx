import { CalendarDays, CheckCircle2, Clock3, UsersRound } from 'lucide-react';
import type { AttendanceSession } from '../../types/attendance';
import type { AthleteAvailabilityRecord } from '../../lib/availability';
import type { CoachFinalAttendanceRecord } from '../../lib/finalAttendance';
import type { ManagedAthlete, AthleteGroup } from '../../types/trainerDashboard';

type Lifecycle = 'upcoming' | 'live' | 'after';

export function CoachSessionDetailV1({
  session,
  teamName,
  roster,
  groups,
  availabilityRecords,
  finalRecords,
  editable,
  onOpenPlayer,
}: {
  session: AttendanceSession;
  teamName: string;
  roster: ManagedAthlete[];
  groups: AthleteGroup[];
  availabilityRecords: AthleteAvailabilityRecord[];
  finalRecords: CoachFinalAttendanceRecord[];
  editable: boolean;
  onOpenPlayer: (athleteId: string) => void;
}) {
  const lifecycle = getLifecycle(session);
  const absent = availabilityRecords.filter(r => r.status === 'no');
  const late = availabilityRecords.filter(r => r.status === 'late');
  const maybe = availabilityRecords.filter(r => r.status === 'maybe');
  const expected = Math.max(0, roster.length - availabilityRecords.length);
  const risks = buildLoadRisks(roster, groups);
  const readiness = buildReadiness(risks.length);

  return (
    <section className="overflow-hidden rounded-3xl border border-gray-800 bg-gray-900/75">
      <div className="border-b border-gray-800 bg-gradient-to-br from-sky-950/30 via-gray-900 to-gray-900 p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap gap-2">
              <Badge tone={lifecycle === 'live' ? 'green' : lifecycle === 'after' ? 'amber' : 'blue'}>{lifecycleLabel(lifecycle)}</Badge>
              <Badge tone={editable ? 'green' : 'gray'}>{editable ? 'Coach actions allowed' : 'Read only'}</Badge>
            </div>
            <h2 className="mt-3 text-2xl font-black text-white">{session.title}</h2>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-300/80">
              <span className="inline-flex items-center gap-1 rounded-lg bg-black/25 px-2 py-1"><CalendarDays size={12} /> {formatDate(session.datum)}{session.startTime ? ` · ${session.startTime}` : ''}{session.endTime ? `–${session.endTime}` : ''}</span>
              <span className="inline-flex items-center gap-1 rounded-lg bg-black/25 px-2 py-1"><UsersRound size={12} /> {teamName}</span>
            </div>
          </div>
          <div className="rounded-2xl border border-sky-800/60 bg-sky-950/25 p-4 lg:w-72">
            <p className="text-xs font-black uppercase tracking-wider text-sky-200">Team Readiness</p>
            <h3 className="mt-1 text-xl font-black text-white">{readiness.title}</h3>
            <p className="mt-2 text-xs leading-5 text-gray-300">{readiness.text}</p>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        <div className="rounded-2xl border border-gray-800 bg-gray-950/40 px-4 py-3">
          <p className="text-sm font-black text-white">{guidanceTitle(lifecycle)}</p>
          <p className="mt-1 text-xs leading-5 text-gray-500">{guidanceText(lifecycle)}</p>
        </div>

        <section className="grid gap-3 sm:grid-cols-4">
          <Metric label="Fehlt" value={String(absent.length)} />
          <Metric label="Spät" value={String(late.length)} />
          <Metric label="Maybe" value={String(maybe.length)} />
          <Metric label="Expected" value={String(expected)} />
        </section>

        <section className="rounded-2xl border border-gray-800 bg-gray-950/40 p-3">
          <p className="text-sm font-black text-white">Attendance first</p>
          <p className="mt-1 text-xs text-gray-500">Problems first. Expected athletes stay at the end.</p>
          <div className="mt-3 space-y-3">
            <AttendanceGroup title="Fehlt" records={absent} empty="Keine Absagen." />
            <AttendanceGroup title="Spät" records={late} empty="Keine Verspätungen." />
            <AttendanceGroup title="Maybe" records={maybe} empty="Keine Unsicherheiten." />
            <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/15 px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <div><p className="text-sm font-bold text-emerald-100">Expected</p><p className="mt-1 text-xs text-emerald-300/70">Default available unless an exception was reported.</p></div>
                <span className="text-2xl font-black text-white">{expected}</span>
              </div>
            </div>
          </div>
        </section>

        {lifecycle === 'after' && (
          <section className="rounded-2xl border border-amber-800/40 bg-amber-950/10 p-3">
            <p className="text-sm font-black text-white">After-session completion</p>
            <p className="mt-1 text-xs text-gray-500">Finalize attendance after the session. Load completeness is only a passive quality signal.</p>
            <div className="mt-3 rounded-xl border border-gray-800 bg-gray-950/50 px-3 py-2 text-sm text-gray-300">{finalRecords.length} final records</div>
          </section>
        )}

        <section className="rounded-2xl border border-gray-800 bg-gray-950/40 p-3">
          <p className="text-sm font-black text-white">Load Hinweise</p>
          <p className="mt-1 text-xs text-gray-500">Only athletes with a load context signal. Tap opens the full player profile.</p>
          {risks.length === 0 ? <div className="mt-3 rounded-xl border border-emerald-900/40 bg-emerald-950/15 px-3 py-3 text-sm text-emerald-100/80">No load signals.</div> : <div className="mt-3 space-y-2">{risks.map(risk => <button key={risk.athlete.id} onClick={() => onOpenPlayer(risk.athlete.id)} className="flex w-full items-center justify-between rounded-xl border border-gray-800 bg-gray-900/70 px-3 py-2 text-left hover:bg-gray-800"><span className="truncate text-sm font-bold text-white">{risk.athlete.name}</span><span className="text-xs font-bold text-amber-300">{risk.label}</span></button>)}</div>}
        </section>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-gray-800 bg-gray-950/40 px-4 py-3"><p className="text-[11px] font-black uppercase tracking-wider text-gray-500">{label}</p><p className="mt-1 text-2xl font-black text-white">{value}</p></div>;
}

function AttendanceGroup({ title, records, empty }: { title: string; records: AthleteAvailabilityRecord[]; empty: string }) {
  return <div className="rounded-xl border border-gray-800 bg-gray-900/50 px-3 py-3"><div className="flex items-center justify-between"><p className="text-sm font-black text-white">{title}</p><span className="rounded-lg bg-black/20 px-2 py-0.5 text-xs font-black text-white">{records.length}</span></div><div className="mt-2 space-y-1.5">{records.length === 0 ? <p className="text-xs text-gray-500">{empty}</p> : records.map(record => <div key={record.id} className="rounded-lg bg-black/20 px-3 py-2"><p className="truncate text-sm font-bold text-white">{shortAthlete(record.athleteUserId)}</p><p className="mt-1 text-xs text-gray-400">{record.status === 'late' ? `${record.lateMinutes ?? 0} min late` : record.reason || record.status}</p></div>)}</div></div>;
}

function Badge({ tone, children }: { tone: 'green' | 'amber' | 'blue' | 'gray'; children: ReactNode }) {
  const cls = tone === 'green' ? 'border-green-700 bg-green-900/30 text-green-200' : tone === 'amber' ? 'border-amber-700 bg-amber-900/30 text-amber-200' : tone === 'blue' ? 'border-sky-700 bg-sky-900/30 text-sky-200' : 'border-gray-700 bg-gray-900 text-gray-400';
  return <span className={`rounded-lg border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${cls}`}>{children}</span>;
}

function getLifecycle(session: AttendanceSession): Lifecycle {
  const now = new Date();
  const start = parseTime(session.datum, session.startTime, false);
  const end = parseTime(session.datum, session.endTime, true);
  if (session.datum < todayIso()) return 'after';
  if (start && end && now >= start && now <= end) return 'live';
  if (end && now > end) return 'after';
  return 'upcoming';
}

function parseTime(dateIso: string, time: string | undefined, isEnd: boolean): Date | null {
  const value = time || (isEnd ? '23:59' : '00:00');
  const parsed = new Date(`${dateIso}T${value}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildLoadRisks(roster: ManagedAthlete[], groups: AthleteGroup[]) {
  const groupById = new Map(groups.map(group => [group.id, group.name]));
  return roster.map(athlete => {
    const names = athlete.groupIds.map(id => groupById.get(id) ?? '').join(' ');
    if (/risk|load|return|watch|reha|under|low/i.test(names)) return { athlete, label: names || 'Load signal' };
    return null;
  }).filter((item): item is { athlete: ManagedAthlete; label: string } => Boolean(item)).slice(0, 8);
}

function buildReadiness(riskCount: number) {
  if (riskCount >= 3) return { title: 'Attention', text: `${riskCount} athletes have load signals. Plan intensity with control.` };
  if (riskCount > 0) return { title: 'Watch', text: `${riskCount} athletes need load context. Training is still manageable.` };
  return { title: 'Stable', text: 'No major load signals. Normal planning is reasonable.' };
}

function lifecycleLabel(lifecycle: Lifecycle) { return lifecycle === 'live' ? 'Live' : lifecycle === 'after' ? 'After session' : 'Upcoming'; }
function guidanceTitle(lifecycle: Lifecycle) { return lifecycle === 'live' ? 'Live session focus' : lifecycle === 'after' ? 'Post-session completion' : 'Pre-session focus'; }
function guidanceText(lifecycle: Lifecycle) { return lifecycle === 'live' ? 'Keep this operational and adjust intensity if the roster or readiness context requires it.' : lifecycle === 'after' ? 'Finalize attendance first. Load checks stay passive so the coach flow does not become annoying.' : 'Check absent, late and maybe athletes first. Expected athletes come last.'; }
function shortAthlete(value: string) { return value.length <= 12 ? value : `Athlete ${value.slice(0, 4)}`; }
function formatDate(iso: string) { return new Date(iso + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' }); }
function todayIso() { return new Date().toISOString().split('T')[0]; }
