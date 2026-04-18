import { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { ChevronRight, Plus, Trash2, Check, X, Loader2 } from 'lucide-react';
import type { CoachOutletContext } from '../CoachShell';

const TEAM_COLORS = [
  '#7c3aed','#0284c7','#059669','#e11d48','#d97706',
  '#db2777','#0891b2','#65a30d','#9333ea','#dc2626',
];

export function TeamsScreen() {
  const navigate = useNavigate();
  const { teams, sessions, loading, onCreateTeam, onDeleteTeam, coachContext } =
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

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    setSaving(true);
    await onCreateTeam(name, newSport.trim(), TEAM_COLORS[colorIdx]);
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">Teams</h2>
          <p className="text-xs text-gray-500 mt-0.5">{teams.length} Teams</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-violet-900/40 border border-violet-700/50 hover:bg-violet-800/50 text-violet-300 text-xs font-semibold transition-colors"
          >
            <Plus size={12} /> Neues Team
          </button>
        )}
      </div>

      {/* Create form */}
      {showForm && (
        <div className="p-4 rounded-xl bg-gray-800/80 border border-gray-700 space-y-3">
          <p className="text-xs font-medium text-gray-400">Neues Team erstellen</p>
          <div className="flex gap-2">
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowForm(false); }}
              placeholder="Teamname"
              className="flex-1 h-9 px-3 rounded-xl bg-gray-900 border border-gray-700 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500"
            />
            <input
              value={newSport}
              onChange={e => setNewSport(e.target.value)}
              placeholder="Sportart"
              className="w-28 h-9 px-3 rounded-xl bg-gray-900 border border-gray-700 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500"
            />
          </div>
          {/* Color picker */}
          <div className="flex gap-2 flex-wrap">
            {TEAM_COLORS.map((c, i) => (
              <button
                key={c}
                onClick={() => setColorIdx(i)}
                className={`w-6 h-6 rounded-full transition-all ${colorIdx === i ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-800 scale-110' : 'opacity-70 hover:opacity-100'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={saving || !newName.trim()}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-xs font-medium transition-colors"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              Erstellen
            </button>
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 rounded-xl bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs transition-colors">
              <X size={12} />
            </button>
          </div>
        </div>
      )}

      {/* Team list */}
      {loading ? (
        <div className="flex items-center gap-2 py-8 text-xs text-gray-600">
          <span className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          Wird geladen…
        </div>
      ) : teams.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-gray-800 rounded-xl space-y-2">
          <p className="text-gray-500 text-sm">Noch keine Teams</p>
          {isAdmin && <p className="text-gray-600 text-xs">Klick auf "Neues Team" um zu starten</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {teams.map(team => {
            const upcoming = sessions.filter(s => s.teamId === team.id && s.datum >= today).length;
            const isConfirming = confirmDel === team.id;
            return (
              <div
                key={team.id}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-800/60 border border-gray-700/50 hover:border-violet-700/40 transition-all group"
              >
                <button
                  onClick={() => navigate(`/coach/teams/${team.id}`)}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left"
                >
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: team.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white group-hover:text-violet-200 truncate">{team.name}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {team.sport}
                      {upcoming > 0 && ` · ${upcoming} kommende Einheiten`}
                    </p>
                  </div>
                  <ChevronRight size={15} className="text-gray-600 group-hover:text-violet-400 flex-shrink-0" />
                </button>

                {/* Delete */}
                {isAdmin && (
                  isConfirming ? (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleDelete(team.id)}
                        disabled={deleting === team.id}
                        className="text-[11px] px-2 py-1 rounded-lg bg-red-900/50 hover:bg-red-800/60 text-red-300 transition-colors"
                      >
                        {deleting === team.id ? <Loader2 size={11} className="animate-spin" /> : 'Löschen'}
                      </button>
                      <button onClick={() => setConfirmDel(null)} className="text-[11px] px-2 py-1 rounded-lg bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors">
                        Abbruch
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={e => { e.stopPropagation(); setConfirmDel(team.id); }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-900/20 transition-all flex-shrink-0"
                    >
                      <Trash2 size={13} />
                    </button>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
