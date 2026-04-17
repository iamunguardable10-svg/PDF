import { useState, useEffect, useRef } from 'react';
import { Search, Building2, Users, ArrowRight, Link, ChevronLeft, Loader2, Check, Clock } from 'lucide-react';
import { searchOrganizations } from '../../lib/organizationStorage';
import { loadTeamsByOrganization, requestToJoinTeam, joinTeamByToken } from '../../lib/attendanceStorage';
import type { Organization } from '../../types/organization';
import type { AttendanceTeam } from '../../types/attendance';

interface Props {
  userId: string;
  userName: string;
  userSport?: string;
  /** Called after a direct join via invite link. */
  onJoined: () => void;
  /** Called after a join request has been sent (pending approval). */
  onRequested?: () => void;
  onBack: () => void;
}

type Screen = 'search' | 'teams' | 'code' | 'requested';

export function ClubJoinFlow({ userId, userName, userSport = '', onJoined, onRequested, onBack }: Props) {
  const [screen,       setScreen]       = useState<Screen>('search');
  const [query,        setQuery]        = useState('');
  const [results,      setResults]      = useState<Organization[]>([]);
  const [searching,    setSearching]    = useState(false);
  const [selectedOrg,  setSelectedOrg]  = useState<Organization | null>(null);
  const [teams,        setTeams]        = useState<AttendanceTeam[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [requesting,   setRequesting]   = useState<string | null>(null);
  const [requestedTeam, setRequestedTeam] = useState<AttendanceTeam | null>(null);
  const [joinCode,     setJoinCode]     = useState('');
  const [joining,      setJoining]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Vereinssuche ───────────────────────────────────────────────────────────

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
    setError(null);
    setLoadingTeams(true);
    setScreen('teams');
    const ts = await loadTeamsByOrganization(org.id);
    setTeams(ts);
    setLoadingTeams(false);
  }

  // ── Beitrittsanfrage senden ────────────────────────────────────────────────

  async function handleRequestJoin(team: AttendanceTeam) {
    setRequesting(team.id);
    setError(null);
    const ok = await requestToJoinTeam(team.id, userId, userName, userSport);
    setRequesting(null);
    if (ok) {
      setRequestedTeam(team);
      setScreen('requested');
      onRequested?.();
    } else {
      setError('Anfrage konnte nicht gesendet werden. Bitte versuche es später erneut.');
    }
  }

  // ── Direkter Beitritt via Einladungscode ────────────────────────────────────

  async function handleJoinByCode() {
    const raw = joinCode.trim();
    if (!raw) return;
    const match = raw.match(/[A-Za-z0-9_-]{10,}/);
    const token = match ? match[0] : raw;
    setJoining(true); setError(null);
    const ok = await joinTeamByToken(token, userId, userName, userSport);
    setJoining(false);
    if (ok) { onJoined(); }
    else { setError('Code ungültig oder Einladung abgelaufen. Bitte frage deinen Trainer nach einem neuen Link.'); }
  }

  // ── Back logic ─────────────────────────────────────────────────────────────

  function handleBack() {
    if (screen === 'teams' || screen === 'code') { setScreen('search'); setError(null); }
    else if (screen === 'requested') { onJoined(); } // treat as done
    else { onBack(); }
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

        {/* Back */}
        {screen !== 'requested' && (
          <button onClick={handleBack}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors">
            <ChevronLeft size={14} />
            {screen === 'teams' ? selectedOrg?.name : 'Zurück'}
          </button>
        )}

        {/* ── SCREEN: Vereinssuche ── */}
        {screen === 'search' && (
          <>
            <div className="space-y-1">
              <h1 className="text-xl font-bold">Team beitreten</h1>
              <p className="text-sm text-gray-500">Suche deinen Verein oder gib einen Einladungslink ein.</p>
            </div>

            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Vereinsname suchen…"
                className="w-full h-11 pl-9 pr-10 rounded-2xl bg-gray-900 border border-gray-700 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-violet-600"
              />
              {searching && (
                <Loader2 size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 animate-spin" />
              )}
            </div>

            {results.length > 0 && (
              <div className="space-y-1.5">
                {results.map(org => (
                  <button key={org.id} onClick={() => handleSelectOrg(org)}
                    className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-gray-900 border border-gray-700/60 hover:border-violet-700/60 text-left transition-colors group">
                    <div className="w-9 h-9 rounded-xl bg-violet-900/30 flex items-center justify-center flex-shrink-0">
                      <Building2 size={16} className="text-violet-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{org.name}</p>
                      {org.sport && <p className="text-[11px] text-gray-500">{org.sport}</p>}
                    </div>
                    <ArrowRight size={14} className="text-gray-600 group-hover:text-violet-400 transition-colors flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}

            {query.trim() && !searching && results.length === 0 && (
              <p className="text-xs text-gray-600 text-center py-2">Kein Verein gefunden — versuche einen anderen Suchbegriff.</p>
            )}

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-800" />
              <span className="text-xs text-gray-600">oder</span>
              <div className="flex-1 h-px bg-gray-800" />
            </div>

            <button onClick={() => setScreen('code')}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-dashed border-gray-700 hover:border-violet-700 text-gray-500 hover:text-violet-400 text-sm transition-colors">
              <Link size={14} /> Einladungslink eingeben
            </button>
          </>
        )}

        {/* ── SCREEN: Teamliste des gewählten Vereins ── */}
        {screen === 'teams' && selectedOrg && (
          <>
            <div className="space-y-0.5">
              <h1 className="text-xl font-bold truncate">{selectedOrg.name}</h1>
              <p className="text-sm text-gray-500">Wähle dein Team — der Trainer muss deinen Beitritt bestätigen.</p>
            </div>

            {/* Info-Hinweis */}
            <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-sky-900/20 border border-sky-800/30">
              <Clock size={13} className="text-sky-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-sky-300 leading-relaxed">
                Du sendest eine Beitrittsanfrage. Der Trainer erhält eine Benachrichtigung und kann dich freischalten.
              </p>
            </div>

            {loadingTeams ? (
              <div className="flex items-center gap-2 py-6 text-xs text-gray-600">
                <Loader2 size={14} className="animate-spin" /> Teams werden geladen…
              </div>
            ) : teams.length === 0 ? (
              <div className="text-center py-6 space-y-1">
                <p className="text-sm text-gray-500">Dieser Verein hat noch keine Teams.</p>
                <p className="text-xs text-gray-700">Bitte frage deinen Trainer nach einem Einladungslink.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {teams.map(team => (
                  <div key={team.id}
                    className="flex items-center gap-3 p-3.5 rounded-2xl bg-gray-900 border border-gray-700/60">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: team.color + '22', border: `1px solid ${team.color}44` }}>
                      <Users size={15} style={{ color: team.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{team.name}</p>
                      {team.sport && <p className="text-[11px] text-gray-500">{team.sport}</p>}
                    </div>
                    <button
                      onClick={() => handleRequestJoin(team)}
                      disabled={requesting !== null}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-700/50 hover:bg-sky-600/60 disabled:opacity-40 text-sky-300 text-xs font-medium transition-colors flex-shrink-0"
                    >
                      {requesting === team.id
                        ? <Loader2 size={12} className="animate-spin" />
                        : <><ArrowRight size={12} /> Anfragen</>
                      }
                    </button>
                  </div>
                ))}
              </div>
            )}

            {error && <p className="text-xs text-rose-400">{error}</p>}

            <button onClick={() => setScreen('code')}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-gray-800 hover:border-gray-700 text-gray-600 hover:text-gray-400 text-xs transition-colors">
              <Link size={12} /> Einladungslink eingeben
            </button>
          </>
        )}

        {/* ── SCREEN: Einladungslink eingeben ── */}
        {screen === 'code' && (
          <>
            <div className="space-y-1">
              <h1 className="text-xl font-bold">Einladungslink</h1>
              <p className="text-sm text-gray-500">
                Füge den Einladungslink deines Trainers ein — du wirst sofort aufgenommen.
              </p>
            </div>
            <textarea
              autoFocus
              value={joinCode}
              onChange={e => setJoinCode(e.target.value)}
              placeholder="https://… oder Token (ti_…)"
              rows={3}
              className="w-full px-3.5 py-3 rounded-2xl bg-gray-900 border border-gray-700 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-violet-600 resize-none"
            />
            {error && <p className="text-xs text-rose-400">{error}</p>}
            <button
              onClick={handleJoinByCode}
              disabled={joining || !joinCode.trim()}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-semibold text-sm transition-all"
            >
              {joining ? <Loader2 size={16} className="animate-spin" /> : <><ArrowRight size={15} /> Team beitreten</>}
            </button>
          </>
        )}

        {/* ── SCREEN: Anfrage gesendet ── */}
        {screen === 'requested' && requestedTeam && (
          <div className="text-center space-y-5 py-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-900/30 border border-emerald-700/40 flex items-center justify-center mx-auto">
              <Check size={28} className="text-emerald-400" />
            </div>
            <div className="space-y-1.5">
              <h1 className="text-xl font-bold">Anfrage gesendet</h1>
              <p className="text-sm text-gray-400">
                Deine Beitrittsanfrage für <span className="text-white font-medium">{requestedTeam.name}</span> wurde übermittelt.
              </p>
              <p className="text-sm text-gray-600">
                Sobald dein Trainer dich freigeschaltet hat, erscheinen die Trainingseinheiten in deinem Kalender.
              </p>
            </div>
            <button
              onClick={onJoined}
              className="w-full py-3 rounded-2xl bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium text-sm transition-colors"
            >
              Zur App
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
