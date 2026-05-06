import type { ReactNode } from 'react';
import { CalendarDays, CheckCircle2, Clock3, TrendingDown, TrendingUp, UsersRound } from 'lucide-react';
import type { AttendanceSession } from '../../types/attendance';
import type { AthleteAvailabilityRecord } from '../../lib/availability';
import type { CoachFinalAttendanceRecord } from '../../lib/finalAttendance';
import type { ManagedAthlete, AthleteGroup } from '../../types/trainerDashboard';

type Lifecycle = 'upcoming' | 'live' | 'after';
type RiskTone = 'red' | 'amber' | 'blue';

type LoadRisk = {
  athlete: ManagedAthlete;
  tone: RiskTone;
  label: string;
  detail: string;
  value: string;
};

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
  const readiness = buildReadiness(risks, roster.length);

  return (
    <section className="overflow-hidden rounded-3xl border border-gray-800 bg-gray-900/75">
      <div className={`border-b border-gray-800 p-4 sm:p-5 ${readiness.heroClass}`}>
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
          <div className={`rounded-2xl border p-4 lg:w-80 ${readiness.cardClass}`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wider opacity-80">Team Readiness</p>
                <h3 className="mt-1 text-xl font-black text-white">{readiness.title}</h3>
              </div>
              <readiness.Icon className="h-8 w-8 opacity-90" />
            </div>
            <p className="mt-2 text-xs leading-5 text-gray-300">{readiness.text}</p>
            <div className="mt-3 grid grid-cols-3 gap-1.5">
              {readiness.bars.map((height, index) => (
                <div key={index} className="flex h-10 items-end rounded-lg bg-black/20 px-1 py-1">
                  <span className="w-full rounded-md bg-white/45" style={{ height: `${height}%` }} />
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px] leading-4 text-gray-400">{readiness.hint}</p>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        <div className={`rounded-2xl border px-4 py-3 ${guidanceClass(lifecycle)}`}>
          <p className="text-sm font-black text-white">{guidanceTitle(lifecycle)}</p>
          <p className="mt-1 text-xs leading-5 text-gray-400">{guidanceText(lifecycle)}</p>
        </div>

        <section className="grid gap-3 sm:grid-cols-4">
          <Metric label="Fehlt" value={String(absent.length)} tone="red" />
          <Metric label="Spät" value={String(late.length)} tone="amber" />
          <Metric label="Maybe" value={String(maybe.length)} tone="gray" />
          <Metric label="Expected" value={String(expected)} tone="green" />
        </section>

        <section className="rounded-2xl border border-gray-800 bg-gray-950/40 p-3">
          <p className="text-sm font-black text-white">Attendance first</p>
          <p className="mt-1 text-xs text-gray-500">Problems first. Expected athletes stay at the end.</p>
          <div className="mt-3 space-y-3">
            <AttendanceGroup title="Fehlt" tone="red" records={absent} empty="Keine Absagen." />
            <AttendanceGroup title="Spät" tone="amber" records={late} empty="Keine Verspätungen." />
            <AttendanceGroup title="Maybe" tone="gray" records={maybe} empty="Keine Unsicherheiten." />
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
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black text-white">After-session completion</p>
                <p className="mt-1 text-xs text-gray-500">Finalize attendance after the session. Load completeness is only a passive quality signal.</p>
              </div>
              <span className="rounded-lg border border-amber-800/50 bg-amber-950/30 px-2 py-1 text-xs font-bold text-amber-200">{finalRecords.length} final</span>
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-gray-800 bg-gray-950/40 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black text-white">Load Hinweise</p>
              <p className="mt-1 text-xs text-gray-500">Only athletes with a load context signal. Tap opens the full player profile.</p>
            </div>
            <span className="rounded-lg border border-gray-800 bg-gray-900 px-2 py-1 text-xs text-gray-400">{risks.length} risk</span>
          </div>
          {risks.length === 0 ? (
            <div className="mt-3 rounded-xl border border-emerald-900/40 bg-emerald-950/15 px-3 py-3 text-sm text-emerald-100/80">No load signals.</div>
          ) : (
            <div className="mt-3 overflow-hidden rounded-xl border border-gray-800">
              {risks.map(risk => (
                <button key={risk.athlete.id} onClick={() => onOpenPlayer(risk.athlete.id)} className="flex w-full items-center justify-between gap-3 border-b border-gray-800 bg-gray-900/70 px-3 py-2 text-left last:border-b-0 hover:bg-gray-800">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${riskDotClass(risk.tone)}`} />
                      <span className="truncate text-sm font-bold text-white">{risk.athlete.name}</span>
                      <span className={`rounded-lg border px-2 py-0.5 text-[10px] font-black uppercase ${riskBadgeClass(risk.tone)}`}>{risk.label}</span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-gray-500">{risk.detail}</p>
                  </div>
                  <span className="shrink-0 text-xs font-black text-gray-300">{risk.value}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: 'red' | 'amber' | 'gray' | 'green' }) {
  return <div className={`rounded-2xl border px-4 py-3 ${tonePanelClass(tone)}`}><p className="text-[11px] font-black uppercase tracking-wider opacity-80">{label}</p><p className="mt-1 text-2xl font-black text-white">{value}</p></div>;
}

function AttendanceGroup({ title, tone, records, empty }: { title: string; tone: 'red' | 'amber' | 'gray'; records: AthleteAvailabilityRecord[]; empty: string }) {
  return <div className={`rounded-xl border px-3 py-3 ${tonePanelClass(tone)}`}><div className="flex items-center justify-between"><p className="text-sm font-black text-white">{title}</p><span className="rounded-lg bg-black/20 px-2 py-0.5 text-xs font-black text-white">{records.length}</span></div><div className="mt-2 space-y-1.5">{records.length === 0 ? <p className="text-xs text-gray-500">{empty}</p> : records.map(record => <div key={record.id} className="rounded-lg bg-black/20 px-3 py-2"><p className="truncate text-sm font-bold text-white">{shortAthlete(record.athleteUserId)}</p><p className="mt-1 text-xs text-gray-400">{record.status === 'late' ? `${record.lateMinutes ?? 0} min late` : record.reason || record.status}</p></div>)}</div></div>;
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

function buildLoadRisks(roster: ManagedAthlete[], groups: AthleteGroup[]): LoadRisk[] {
  const groupById = new Map(groups.map(group => [group.id, group.name]));
  return roster.map(athlete => {
    const names = athlete.groupIds.map(id => groupById.get(id) ?? '').join(' ');
    if (/risk|over|high/i.test(names)) return { athlete, tone: 'red' as const, label: 'hoch', detail: names || 'Hoher Load-Kontext', value: 'Risk' };
    if (/return|reha|under|low|aufbau/i.test(names)) return { athlete, tone: 'blue' as const, label: 'niedrig', detail: names || 'Return-to-load oder Aufbaukontext', value: 'Build' };
    if (/load|watch/i.test(names)) return { athlete, tone: 'amber' as const, label: 'watch', detail: names || 'Load-Watch Kontext', value: 'Watch' };
    return null;
  }).filter((item): item is LoadRisk => Boolean(item)).slice(0, 8);
}

function buildReadiness(risks: LoadRisk[], rosterCount: number) {
  const high = risks.filter(r => r.tone === 'red').length;
  const low = risks.filter(r => r.tone === 'blue').length;
  const watch = risks.filter(r => r.tone === 'amber').length;
  if (high >= 2) return { title: 'Hohe Belastung', text: `${high} athletes have high-load signals. Plan intensity and volume with control.`, hint: 'Coach cue: less unnecessary peak load, more dosage.', Icon: TrendingUp, bars: [70, 82, 88], cardClass: 'border-rose-800/60 bg-rose-950/30 text-rose-200', heroClass: 'bg-gradient-to-br from-rose-950/45 via-gray-900 to-gray-900' };
  if (low >= Math.max(2, Math.round(rosterCount * 0.25))) return { title: 'Belastung niedrig', text: `${low} athletes are in a low-load or build-up context. Progress carefully if attendance allows.`, hint: 'Coach cue: build controlled, avoid sudden jumps.', Icon: TrendingDown, bars: [34, 40, 46], cardClass: 'border-sky-800/60 bg-sky-950/30 text-sky-200', heroClass: 'bg-gradient-to-br from-sky-950/45 via-gray-900 to-gray-900' };
  if (watch > 0 || high > 0) return { title: 'Leicht erhöht', text: `${watch + high} athletes need load context. Training is manageable, but keep them visible.`, hint: 'Coach cue: normal session possible, watch affected players.', Icon: Clock3, bars: [55, 65, 62], cardClass: 'border-amber-800/60 bg-amber-950/25 text-amber-200', heroClass: 'bg-gradient-to-br from-amber-950/35 via-gray-900 to-gray-900' };
  return { title: 'Stabil', text: 'No major load signals in this team context. Normal planning is reasonable.', hint: 'Coach cue: planned training can be executed normally.', Icon: CheckCircle2, bars: [48, 52, 50], cardClass: 'border-emerald-800/60 bg-emerald-950/25 text-emerald-200', heroClass: 'bg-gradient-to-br from-emerald-950/35 via-gray-900 to-gray-900' };
}

function tonePanelClass(tone: 'red' | 'amber' | 'gray' | 'green') {
  if (tone === 'red') return 'border-rose-900/50 bg-rose-950/15 text-rose-300';
  if (tone === 'amber') return 'border-amber-900/50 bg-amber-950/15 text-amber-300';
  if (tone === 'green') return 'border-emerald-900/50 bg-emerald-950/15 text-emerald-300';
  return 'border-gray-800 bg-gray-900/50 text-gray-300';
}

function riskDotClass(tone: RiskTone) { return tone === 'red' ? 'bg-rose-400' : tone === 'blue' ? 'bg-sky-400' : 'bg-amber-400'; }
function riskBadgeClass(tone: RiskTone) { return tone === 'red' ? 'border-rose-800 bg-rose-950/40 text-rose-200' : tone === 'blue' ? 'border-sky-800 bg-sky-950/40 text-sky-200' : 'border-amber-800 bg-amber-950/40 text-amber-200'; }
function guidanceClass(lifecycle: Lifecycle) { return lifecycle === 'live' ? 'border-emerald-800/50 bg-emerald-950/20' : lifecycle === 'after' ? 'border-amber-800/50 bg-amber-950/20' : 'border-sky-800/50 bg-sky-950/20'; }
function lifecycleLabel(lifecycle: Lifecycle) { return lifecycle === 'live' ? 'Live' : lifecycle === 'after' ? 'After session' : 'Upcoming'; }
function guidanceTitle(lifecycle: Lifecycle) { return lifecycle === 'live' ? 'Live session focus' : lifecycle === 'after' ? 'Post-session completion' : 'Pre-session focus'; }
function guidanceText(lifecycle: Lifecycle) { return lifecycle === 'live' ? 'Keep this operational and adjust intensity if the roster or readiness context requires it.' : lifecycle === 'after' ? 'Finalize attendance first. Load checks stay passive so the coach flow does not become annoying.' : 'Check absent, late and maybe athletes first. Expected athletes come last.'; }
function shortAthlete(value: string) { return value.length <= 12 ? value : `Athlete ${value.slice(0, 4)}`; }
function formatDate(iso: string) { return new Date(iso + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' }); }
function todayIso() { return new Date().toISOString().split('T')[0]; }
