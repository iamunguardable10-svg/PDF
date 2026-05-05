import { useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { CalendarDays, ChevronRight, Check, Loader2, Plus, Trash2, Users2, X } from 'lucide-react';
import type { CoachOutletContext } from '../CoachShell';

const TEAM_COLORS = [
  '#7c3aed','#0284c7','#059669','#e11d48','#d97706',
  '#db2777','#0891b2','#65a30d','#9333ea','#dc2626',
];

export function TeamsScreen() {
  const navigate = useNavigate();
  const { teams, sessions, departments, roster, loading, onCreateTeam, onDeleteTeam, coachContext } =
    useOutletContext<CoachOutletContext>();

  const isAdmin = !coachContext || coachContext.role === 'org_admin';

  const [showForm,   setShowForm]   = useState(false);
  const [newName,    setNewName]    = useState('');
  const [newSport,   setNewSport]   = useState('');
  const [colorIdx,   setColorIdx]   = useState(0);
  const [saving,     setSaving]     = useState(false);
  const [deleting,   setDeleting]   = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const today = new Date().toISOString().split('T')[0];
  const teamRows = useMemo(() => teams.map(team => {
    const teamSessions = sessions.filter(session => session.teamId === team.id);
    const upcoming = teamSessions.filter(session => session.datum >= today).length;
    const nextSession = teamSessions
      .filter(session => session.datum >= today)
      .sort((a, b) => `${a.datum} ${a.startTime ?? ''}`.localeCompare(`${b.datum} ${b.startTime ?? ''}`))[0] ?? null;
    const department = departments.find(item => item.id === team.departmentId)?.name ?? 'No department';
    return { team, upcoming, nextSession, department };
  }), [departments, sessions, teams, today]);

  const activeTeams = teamRows.filter(row => row.upcoming > 0).length;
  const unassignedTeams = teamRows.filter(row => row.department === 'No department').length;
  const upcomingSessions = sessions.filter(session => session.datum >= today).length;

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    setSaving(true);
    await onCreateTeam(name, newSport.trim() || 'Basketball', TEAM_COLORS[colorIdx]);
    setSaving(false);
    setNewName(''); setNewSport(''); setShowForm(false);
  }

  async function handleDelete(teamId: string) {
    setDeleting(teamId);
    await onDeleteTeam(teamId);
    setDeleting(null);
    setConfirmDel(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-sky-300">Club structure</p>
          <h2 className="mt-1 text-2xl font-black text-white">Teams</h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-400">
            Teams are the scheduling and responsibility layer. Use them for U18, U16 or position units that own sessions, calendars and attendance.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowForm(v => !v)}
            className="flex w-fit items-center gap-1 rounded-full border border-sky-700/50 bg-sky-900/40 px-3 py-1.5 text-xs font-semibold text-sky-300 transition-colors hover:bg-sky-800/50"
          >
            <Plus size={12} /> New team
          </button>
        )}
      </div>

      <section className="grid gap-3 sm:grid-cols-4">
        <SummaryCard icon={Users2} label="Teams" value={String(teams.length)} text="Scheduling units in this workspace." tone="sky" />
        <SummaryCard icon={CalendarDays} label="Active" value={String(activeTeams)} text="Teams with upcoming sessions." tone="emerald" />
        <SummaryCard icon={CalendarDays} label="Sessions" value={String(upcomingSessions)} text="Upcoming sessions across all teams." tone="violet" />
        <SummaryCard icon={Users2} label="Roster base" value={String(roster.length)} text="Players are managed separately." tone="gray" />
      </section>

      {unassignedTeams > 0 && (
        <div className="rounded-2xl border border-amber-800/50 bg-amber-950/20 px-4 py-3 text-sm text-amber-100/80">
          {unassignedTeams} team{unassignedTeams === 1 ? '' : 's'} are not assigned to a department. That is fine for a small team, but clubs should connect teams to departments for cleaner planning.
        </div>
      )}

      {showForm && (
        <div className="rounded-2xl border border-gray-700 bg-gray-900/80 p-4 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Create scheduling unit</p>
          <div className="grid gap-2 sm:grid-cols-[1fr_160px]">
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowForm(false); }}
              placeholder="e.g. U18 Boys"
              className="h-11 rounded-xl border border-gray-700 bg-gray-950 px-3 text-sm text-white placeholder-gray-600 outline-none focus:border-sky-500"
            />
            <input
              value={newSport}
              onChange={e => setNewSport(e.target.value)}
              placeholder="Sport"
              className="h-11 rounded-xl border border-gray-700 bg-gray-950 px-3 text-sm text-white placeholder-gray-600 outline-none focus:border-sky-500"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {TEAM_COLORS.map((c, i) => (
              <button
                key={c}
                onClick={() => setColorIdx(i)}
                className={`h-7 w-7 rounded-full transition-all ${colorIdx === i ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-900 scale-110' : 'opacity-70 hover:opacity-100'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={saving || !newName.trim()}
              className="flex items-center gap-1 rounded-xl bg-sky-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-sky-500 disabled:opacity-40"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              Create team
            </button>
            <button onClick={() => setShowForm(false)} className="rounded-xl bg-gray-800 px-3 py-2 text-xs text-gray-300 transition-colors hover:bg-gray-700">
              <X size={12} />
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-8 text-xs text-gray-600">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
          Loading teams...
        </div>
      ) : teams.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-800 bg-gray-900/40 px-4 py-10 text-center">
          <p className="text-sm font-semibold text-white">No teams yet</p>
          {isAdmin && <p className="mt-1 text-xs text-gray-500">Create the first team before planning sessions or attendance.</p>}
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {teamRows.map(row => {
            const isConfirming = confirmDel === row.team.id;
            return (
              <div key={row.team.id} className="rounded-2xl border border-gray-800 bg-gray-900/60 p-4 transition-all hover:border-sky-800/60">
                <div className="flex items-start gap-3">
                  <button onClick={() => navigate(`/coach/teams/${row.team.id}`)} className="flex min-w-0 flex-1 items-start gap-3 text-left">
                    <div className="mt-1 h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: row.team.color }} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-base font-black text-white">{row.team.name}</h3>
                        <ChevronRight size={15} className="shrink-0 text-gray-600" />
                      </div>
                      <p className="mt-1 text-xs text-gray-500">{row.team.sport || 'Sport'} · {row.department}</p>
                    </div>
                  </button>

                  {isAdmin && (
                    isConfirming ? (
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          onClick={() => handleDelete(row.team.id)}
                          disabled={deleting === row.team.id}
                          className="rounded-lg bg-red-900/50 px-2 py-1 text-[11px] text-red-300 transition-colors hover:bg-red-800/60"
                        >
                          {deleting === row.team.id ? <Loader2 size={11} className="animate-spin" /> : 'Delete'}
                        </button>
                        <button onClick={() => setConfirmDel(null)} className="rounded-lg bg-gray-800 px-2 py-1 text-[11px] text-gray-400 transition-colors hover:text-gray-200">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmDel(row.team.id)} className="shrink-0 rounded-lg p-1.5 text-gray-600 transition-colors hover:bg-red-900/20 hover:text-red-400">
                        <Trash2 size={13} />
                      </button>
                    )
                  )}
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <MiniInfo label="Upcoming" value={`${row.upcoming} sessions`} />
                  <MiniInfo label="Next" value={row.nextSession ? `${row.nextSession.datum}${row.nextSession.startTime ? ` · ${row.nextSession.startTime}` : ''}` : 'None planned'} />
                  <MiniInfo label="Use" value="Calendar + attendance" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-950/50 px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-600">{label}</p>
      <p className="mt-1 truncate text-xs font-semibold text-gray-300">{value}</p>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, text, tone }: { icon: typeof Users2; label: string; value: string; text: string; tone: 'sky' | 'emerald' | 'violet' | 'gray' }) {
  const tones = {
    sky: 'border-sky-800/50 bg-sky-950/20 text-sky-300',
    emerald: 'border-emerald-800/50 bg-emerald-950/20 text-emerald-300',
    violet: 'border-violet-800/50 bg-violet-950/20 text-violet-300',
    gray: 'border-gray-800 bg-gray-900/60 text-gray-300',
  };
  return (
    <div className={`rounded-2xl border px-4 py-3 ${tones[tone]}`}>
      <div className="flex items-center gap-2">
        <Icon size={16} />
        <p className="text-xs font-bold uppercase tracking-wide opacity-80">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-xs leading-5 text-gray-500">{text}</p>
    </div>
  );
}
