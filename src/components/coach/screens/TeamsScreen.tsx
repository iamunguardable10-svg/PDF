import { useNavigate, useOutletContext } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import type { CoachOutletContext } from '../CoachShell';

export function TeamsScreen() {
  const navigate = useNavigate();
  const { teams, sessions, loading } = useOutletContext<CoachOutletContext>();

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">Teams</h2>
          <p className="text-xs text-gray-500 mt-0.5">{teams.length} Teams in deiner Verfügung</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-8 text-xs text-gray-600">
          <span className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          Wird geladen…
        </div>
      ) : teams.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-gray-800 rounded-xl space-y-2">
          <p className="text-gray-500 text-sm">Noch keine Teams</p>
          <p className="text-gray-600 text-xs">Erstelle ein Team im Setup-Assistenten</p>
        </div>
      ) : (
        <div className="space-y-2">
          {teams.map(team => {
            const teamSessions = sessions.filter(s => s.teamId === team.id && s.datum >= today);
            return (
              <button
                key={team.id}
                onClick={() => navigate(`/coach/teams/${team.id}`)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-800/60 border border-gray-700/50 hover:border-violet-700/60 hover:bg-violet-950/20 transition-all text-left group"
              >
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: team.color }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white group-hover:text-violet-200 truncate">
                    {team.name}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {team.sport}
                    {teamSessions.length > 0 && ` · ${teamSessions.length} kommende Einheiten`}
                  </p>
                </div>
                <ChevronRight size={15} className="text-gray-600 group-hover:text-violet-400 flex-shrink-0" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
