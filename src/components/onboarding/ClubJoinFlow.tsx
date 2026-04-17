import { useState, useEffect, useRef } from 'react';
import { Search, Building2, Users, ArrowRight, Link, ChevronLeft, Loader2 } from 'lucide-react';
import { searchOrganizations } from '../../lib/organizationStorage';
import { loadTeamsByOrganization, joinTeamByToken } from '../../lib/attendanceStorage';
import type { Organization } from '../../types/organization';
import type { AttendanceTeam } from '../../types/attendance';

interface Props {
  userId: string;
  userName: string;
  userSport?: string;
  onJoined: () => void;
  onBack: () => void;
}

type Screen = 'search' | 'teams' | 'code';

export function ClubJoinFlow({ userId, userName, userSport = '', onJoined, onBack }: Props) {
  const [screen,     setScreen]     = useState<Screen>('search');
  const [query,      setQuery]      = useState('');
  const [results,    setResults]    = useState<Organization[]>([]);
  const [searching,  setSearching]  = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [teams,      setTeams]      = useState<AttendanceTeam[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [joinCode,   setJoinCode]   = useState('');
  const [joining,    setJoining]    = useState(false);
  const [joinError,  setJoinError]  = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Search orgs ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      const orgs = await searchOrganizations(query);
      setResults(orgs);
      setSearching(false);
    }, 350);
  }, [query]);

  async function handleSelectOrg(org: Organization) {
    setSelectedOrg(org);
    setLoadingTeams(true);
    setScreen('teams');
    const ts = await loadTeamsByOrganization(org.id);
    setTeams(ts);
    setLoadingTeams(false);
  }

  // ── Join via token ─────────────────────────────────────────────────────────

  async function handleJoinByCode() {
    const raw = joinCode.trim();
    if (!raw) return;
    // Extract token from full URL or use raw
    const match = raw.match(/[A-Za-z0-9_-]{10,}/);
    const token = match ? match[0] : raw;
    setJoining(true); setJoinError(null);
    const ok = await joinTeamByToken(token, userId, userName, userSport);
    setJoining(false);
    if (ok) { onJoined(); }
    else { setJoinError('Code ungültig oder Einladung abgelaufen. Bitte erneut versuchen.'); }
  }

  async function handleJoinTeam(team: AttendanceTeam) {
    if (!team.inviteToken || !team.inviteActive) {
      setJoinError('Dieses Team hat keinen aktiven Einladungslink. Bitte frage deinen Trainer.');
      return;
    }
    setJoining(true); setJoinError(null);
    const ok = await joinTeamByToken(team.inviteToken, userId, userName, userSport);
    setJoining(false);
    if (ok) { onJoined(); }
    else { setJoinError('Beitritt fehlgeschlagen. Bitte kontaktiere deinen Trainer.'); }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0a0b0f] text-white flex flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-10">
        <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-700 rounded-2xl flex items-center justify-center text-xl shadow-lg shadow-violet-900/40">
          🏟
        </div>
        <span className="text-xl font-bold tracking-tight">Club OS</span>
      </div>

      <div className="w-full max-w-sm space-y-5">

        {/* ── Back button ── */}
        <button onClick={screen === 'search' || screen === 'code' ? onBack : () => setScreen('search')}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors">
          <ChevronLeft size={14} /> {screen === 'teams' ? selectedOrg?.name ?? 'Zurück' : 'Zurück'}
        </button>

        {/* ── SCREEN: Vereinssuche ── */}
        {screen === 'search' && (
          <>
            <div className="space-y-1">
              <h1 className="text-xl font-bold">Team beitreten</h1>
              <p className="text-sm text-gray-500">Suche deinen Verein oder gib einen Einladungscode ein.</p>
            </div>

            {/* Search input */}
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Vereinsname suchen…"
                className="w-full h-11 pl-9 pr-4 rounded-2xl bg-gray-900 border border-gray-700 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-violet-600"
              />
              {searching && (
                <Loader2 size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 animate-spin" />
              )}
            </div>

            {/* Results */}
            {results.length > 0 && (
              <div className="space-y-1.5">
                {results.map(org => (
                  <button key={org.id} onClick={() => handleSelectOrg(org)}
                    className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-gray-900 border border-gray-700/60 hover:border-violet-700/60 text-left transition-colors">
                    <div className="w-9 h-9 rounded-xl bg-violet-900/40 flex items-center justify-center flex-shrink-0">
                      <Building2 size={16} className="text-violet-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{org.name}</p>
                      {org.sport && <p className="text-[11px] text-gray-500">{org.sport}</p>}
                    </div>
                    <ArrowRight size={14} className="text-gray-600 flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}

            {query.trim() && !searching && results.length === 0 && (
              <p className="text-xs text-gray-600 text-center py-2">Kein Verein gefunden</p>
            )}

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-800" />
              <span className="text-xs text-gray-600">oder</span>
              <div className="flex-1 h-px bg-gray-800" />
            </div>

            {/* Code / Link entry */}
            <button onClick={() => setScreen('code')}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-dashed border-gray-700 hover:border-violet-700 text-gray-500 hover:text-violet-400 text-sm transition-colors">
              <Link size={14} /> Einladungslink / Code eingeben
            </button>
          </>
        )}

        {/* ── SCREEN: Teams des gewählten Vereins ── */}
        {screen === 'teams' && selectedOrg && (
          <>
            <div className="space-y-1">
              <h1 className="text-xl font-bold truncate">{selectedOrg.name}</h1>
              <p className="text-sm text-gray-500">Wähle dein Team</p>
            </div>

            {loadingTeams ? (
              <div className="flex items-center gap-2 py-6 text-xs text-gray-600">
                <Loader2 size={14} className="animate-spin" /> Teams werden geladen…
              </div>
            ) : teams.length === 0 ? (
              <p className="text-sm text-gray-600 text-center py-6">Dieser Verein hat noch keine Teams.</p>
            ) : (
              <div className="space-y-2">
                {teams.map(team => (
                  <button key={team.id}
                    onClick={() => handleJoinTeam(team)}
                    disabled={joining || !team.inviteActive}
                    className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-all disabled:opacity-40 ${
                      team.inviteActive
                        ? 'bg-gray-900 border-gray-700/60 hover:border-violet-700/60'
                        : 'bg-gray-900/40 border-gray-800'
                    }`}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: team.color + '33', border: `1px solid ${team.color}44` }}>
                      <Users size={15} style={{ color: team.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{team.name}</p>
                      <p className="text-[11px] text-gray-500">{team.sport}</p>
                    </div>
                    {team.inviteActive
                      ? <ArrowRight size={14} className="text-gray-600 flex-shrink-0" />
                      : <span className="text-[10px] text-gray-600">Beitritt deaktiviert</span>
                    }
                  </button>
                ))}
              </div>
            )}

            {joinError && <p className="text-xs text-rose-400">{joinError}</p>}

            {/* Also allow code entry from here */}
            <button onClick={() => setScreen('code')}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-gray-800 hover:border-gray-700 text-gray-600 hover:text-gray-400 text-xs transition-colors">
              <Link size={12} /> Einladungscode eingeben
            </button>
          </>
        )}

        {/* ── SCREEN: Code / Link eingeben ── */}
        {screen === 'code' && (
          <>
            <div className="space-y-1">
              <h1 className="text-xl font-bold">Einladungslink</h1>
              <p className="text-sm text-gray-500">Füge den Einladungslink oder Code deines Trainers ein.</p>
            </div>
            <textarea
              autoFocus
              value={joinCode}
              onChange={e => setJoinCode(e.target.value)}
              placeholder="https://… oder Einladungscode"
              rows={3}
              className="w-full px-3.5 py-3 rounded-2xl bg-gray-900 border border-gray-700 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-violet-600 resize-none"
            />
            {joinError && <p className="text-xs text-rose-400">{joinError}</p>}
            <button
              onClick={handleJoinByCode}
              disabled={joining || !joinCode.trim()}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-semibold text-sm transition-all"
            >
              {joining ? <Loader2 size={16} className="animate-spin" /> : <><ArrowRight size={15} /> Team beitreten</>}
            </button>
          </>
        )}

      </div>
    </div>
  );
}
