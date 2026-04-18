import { useOutletContext } from 'react-router-dom';
import { JoinRequestsPanel } from '../JoinRequestsPanel';
import type { CoachOutletContext } from '../CoachShell';

export function DashboardScreen() {
  const { user, org, departments, teams, sessions, loading, reload, coachContext } =
    useOutletContext<CoachOutletContext>();

  const today    = new Date().toISOString().split('T')[0];
  const weekStart = (() => {
    const d = new Date();
    const diff = d.getDay() === 0 ? -6 : 1 - d.getDay();
    d.setDate(d.getDate() + diff);
    return d.toISOString().split('T')[0];
  })();
  const weekEnd = (() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 6);
    return d.toISOString().split('T')[0];
  })();

  const todayCount = sessions.filter(s => s.datum === today).length;
  const weekCount  = sessions.filter(s => s.datum >= weekStart && s.datum <= weekEnd).length;

  const roleLabel: Record<string, string> = {
    org_admin:       'Vereins-Admin',
    head_coach:      'Head Coach',
    assistant_coach: 'Assistent',
  };

  return (
    <div className="space-y-5">

      {/* Join requests */}
      <JoinRequestsPanel trainerId={user.id} onChanged={reload} />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Heute"       value={loading ? '…' : String(todayCount)}     sub="Einheiten"   color="violet" />
        <Stat label="Diese Woche" value={loading ? '…' : String(weekCount)}       sub="Einheiten"   color="sky" />
        <Stat label="Teams"       value={loading ? '…' : String(teams.length)}    sub="aktiv"       color="emerald" />
        <Stat label="Abteilungen" value={loading ? '…' : String(departments.length)} sub="gesamt"  color="amber" />
      </div>

      {/* Org overview */}
      {org && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-800/60 border border-gray-700/50">
          <div className="w-9 h-9 bg-gradient-to-br from-violet-600 to-purple-800 rounded-xl flex items-center justify-center text-lg flex-shrink-0">
            🏟
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{org.name}</p>
            {org.sport && <p className="text-xs text-gray-500">{org.sport}</p>}
          </div>
          {coachContext && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-violet-900/50 text-violet-300 border border-violet-800/50 flex-shrink-0">
              {roleLabel[coachContext.role] ?? coachContext.role}
            </span>
          )}
        </div>
      )}

      {/* Recent sessions */}
      {sessions.length > 0 && (
        <section>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Kommende Einheiten</p>
          <div className="space-y-1.5">
            {sessions
              .filter(s => s.datum >= today)
              .slice(0, 6)
              .map(s => (
                <div key={s.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-gray-800/50 border border-gray-700/40">
                  <div className="flex-shrink-0 text-center w-10">
                    <p className="text-[10px] text-gray-500">
                      {new Date(s.datum + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'short' })}
                    </p>
                    <p className="text-xs text-gray-400 font-medium">
                      {new Date(s.datum + 'T12:00:00').toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{s.title}</p>
                    <p className="text-[11px] text-gray-500">
                      {teams.find(t => t.id === s.teamId)?.name ?? ''}
                      {s.startTime ? ` · ${s.startTime}` : ''}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  const cls: Record<string, string> = {
    violet: 'text-violet-400 bg-violet-900/20 border-violet-800/40',
    sky:    'text-sky-400 bg-sky-900/20 border-sky-800/40',
    emerald:'text-emerald-400 bg-emerald-900/20 border-emerald-800/40',
    amber:  'text-amber-400 bg-amber-900/20 border-amber-800/40',
  };
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${cls[color] ?? cls.violet}`}>
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className="text-2xl font-bold leading-tight">{value}</p>
      <p className="text-[11px] text-gray-600">{sub}</p>
    </div>
  );
}
