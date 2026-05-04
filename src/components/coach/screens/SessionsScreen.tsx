import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { CalendarDays, Lock, Plus, ShieldCheck } from 'lucide-react';
import type { CoachOutletContext } from '../CoachShell';
import { canEditSession, isSessionAssignedToCoach, roleLabel } from '../../../lib/rolePermissions';

type SessionFilter = 'mine' | 'editable' | 'all';

export function SessionsScreen() {
  const { user, sessions, teams, coachContext, permissions } = useOutletContext<CoachOutletContext>();
  const [filter, setFilter] = useState<SessionFilter>('mine');
  const today = new Date().toISOString().split('T')[0];

  const sessionRows = useMemo(() => {
    return sessions
      .filter(session => session.datum >= today)
      .map(session => {
        const assigned = isSessionAssignedToCoach(session, teams, user.id, coachContext);
        const editable = canEditSession(session, teams, user.id, permissions, coachContext);
        return { session, assigned, editable };
      })
      .filter(row => {
        if (filter === 'mine') return row.assigned;
        if (filter === 'editable') return row.editable;
        return true;
      })
      .sort((a, b) => {
        if (a.assigned !== b.assigned) return a.assigned ? -1 : 1;
        return `${a.session.datum}${a.session.startTime ?? ''}`.localeCompare(`${b.session.datum}${b.session.startTime ?? ''}`);
      })
      .slice(0, 16);
  }, [coachContext, filter, permissions, sessions, teams, today, user.id]);

  const assignedCount = sessionRows.filter(row => row.assigned).length;
  const editableCount = sessionRows.filter(row => row.editable).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <Header title="Sessions" text="Your assigned sessions are shown first. Actions are limited by your role and permissions." />
        <div className="flex flex-wrap gap-2">
          <FilterButton active={filter === 'mine'} onClick={() => setFilter('mine')}>My sessions</FilterButton>
          <FilterButton active={filter === 'editable'} onClick={() => setFilter('editable')}>Editable</FilterButton>
          <FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>All visible</FilterButton>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <InfoCard label="Role" value={roleLabel(permissions.role)} text="Controls what you can create or edit." />
        <InfoCard label="Assigned" value={String(assignedCount)} text="Sessions directly relevant to you." />
        <InfoCard label="Editable" value={String(editableCount)} text="Sessions you may manage." />
      </section>

      <div className="rounded-2xl border border-gray-800 bg-gray-900/70 p-3">
        <div className="mb-3 flex items-center justify-between gap-3 px-1">
          <div>
            <p className="text-sm font-bold text-white">Upcoming operational block</p>
            <p className="text-xs text-gray-500">Default player status is expected/available until they report maybe or no.</p>
          </div>
          {permissions.canCreateSessions ? (
            <button className="inline-flex items-center gap-1.5 rounded-xl border border-violet-700 bg-violet-900/30 px-3 py-1.5 text-xs font-bold text-violet-200">
              <Plus size={14} /> New session
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs font-bold text-gray-500">
              <Lock size={14} /> View only
            </span>
          )}
        </div>

        <div className="space-y-2">
          {sessionRows.length === 0 ? <Empty text="No upcoming sessions match this filter." /> : sessionRows.map(({ session, assigned, editable }) => {
            const team = teams.find(t => t.id === session.teamId);
            return (
              <div
                key={session.id}
                className={`rounded-xl border px-4 py-3 ${assigned ? 'border-violet-700/70 bg-violet-950/20' : 'border-gray-700 bg-gray-800/50'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-white truncate">{session.title}</p>
                      {assigned && <Badge tone="violet">Assigned</Badge>}
                      {editable ? <Badge tone="green">Editable</Badge> : <Badge tone="gray">Read only</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {formatDate(session.datum)}{session.startTime ? ` - ${session.startTime}` : ''}{session.location ? ` - ${session.location}` : ''}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-gray-500">
                      <span className="inline-flex items-center gap-1 rounded-lg bg-gray-950/60 px-2 py-1"><CalendarDays size={12} /> {team?.name ?? 'No team assigned'}</span>
                      {session.trainingType && <span className="rounded-lg bg-gray-950/60 px-2 py-1">{session.trainingType}</span>}
                      {editable && <span className="inline-flex items-center gap-1 rounded-lg bg-gray-950/60 px-2 py-1"><ShieldCheck size={12} /> Coach actions allowed</span>}
                    </div>
                  </div>
                  <div className="text-right text-xs text-gray-500">
                    <p className="font-semibold text-gray-300">Expected</p>
                    <p>availability pending</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Header({ title, text }: { title: string; text: string }) {
  return <div><p className="text-xs font-semibold uppercase tracking-wider text-violet-300">TeamLoad</p><h2 className="mt-1 text-2xl font-black text-white">{title}</h2><p className="mt-1 text-sm text-gray-400">{text}</p></div>;
}
function Empty({ text }: { text: string }) { return <div className="rounded-xl border border-dashed border-gray-700 bg-gray-800/30 px-4 py-5 text-sm text-gray-500">{text}</div>; }
function formatDate(iso: string) { return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); }
function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition-colors ${active ? 'border-violet-600 bg-violet-900/40 text-violet-200' : 'border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-500 hover:text-white'}`}>{children}</button>;
}
function InfoCard({ label, value, text }: { label: string; value: string; text: string }) {
  return <div className="rounded-xl border border-gray-800 bg-gray-900/70 px-4 py-3"><p className="text-[11px] font-medium uppercase tracking-wider text-gray-500">{label}</p><p className="mt-1 text-xl font-black text-white">{value}</p><p className="mt-1 text-xs text-gray-500">{text}</p></div>;
}
function Badge({ tone, children }: { tone: 'violet' | 'green' | 'gray'; children: React.ReactNode }) {
  const tones = {
    violet: 'border-violet-700 bg-violet-900/40 text-violet-200',
    green: 'border-green-700 bg-green-900/30 text-green-200',
    gray: 'border-gray-700 bg-gray-900 text-gray-400',
  };
  return <span className={`rounded-lg border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${tones[tone]}`}>{children}</span>;
}
