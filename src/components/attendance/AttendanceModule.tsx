import { useState, useEffect, useCallback, useMemo } from 'react';
import type { AttendanceTeam, AttendanceTeamMember, AttendanceSession, AttendanceRecord } from '../../types/attendance';
import type { ManagedAthlete, AthleteGroup } from '../../types/trainerDashboard';
import {
  loadTeams, createTeam, deleteTeam, regenerateTeamInvite,
  loadTeamMembers, addMemberFromRoster, removeMember,
  loadTrainerSessions, loadRecordsBySessionIds,
} from '../../lib/attendanceStorage';
import { SessionPlanner } from './SessionPlanner';
import { SessionDetail } from './SessionDetail';
import { TeamChat } from './TeamChat';
import { WeekCalendar } from './WeekCalendar';

const TEAM_COLORS = [
  { key: 'violet', bg: '#7c3aed' },
  { key: 'sky',    bg: '#0284c7' },
  { key: 'emerald',bg: '#059669' },
  { key: 'rose',   bg: '#e11d48' },
  { key: 'amber',  bg: '#d97706' },
];

// ── Mock data ────────────────────────────────────────────────────────────────

function buildMockAttendanceSessions(trainerId: string): { teams: AttendanceTeam[]; sessions: AttendanceSession[] } {
  const today = new Date();
  const d = (offset: number) => {
    const dt = new Date(today);
    dt.setDate(dt.getDate() + offset);
    return dt.toISOString().split('T')[0];
  };
  const teams: AttendanceTeam[] = [
    { id: 'mock-team-1', trainerId, name: 'U19 Herren', sport: 'Basketball', color: 'violet',
      inviteToken: null, inviteActive: false, createdAt: today.toISOString() },
    { id: 'mock-team-2', trainerId, name: 'Guards', sport: 'Basketball', color: 'sky',
      inviteToken: null, inviteActive: false, createdAt: today.toISOString() },
  ];
  const sessions: AttendanceSession[] = [
    { id: 'ms1', trainerId, title: 'Teamtraining', description: '', datum: d(0), startTime: '17:00', endTime: '19:00',
      location: 'Sporthalle Nord', radiusM: 100, teamId: 'mock-team-1', trainingType: 'Training', coachNote: '', createdAt: '' },
    { id: 'ms2', trainerId, title: 'Taktik & Video', description: '', datum: d(2), startTime: '16:00', endTime: '17:30',
      location: 'Vereinsheim', radiusM: 100, teamId: 'mock-team-1', trainingType: 'Taktik', coachNote: '', createdAt: '' },
    { id: 'ms3', trainerId, title: 'Ligaspiel vs. TuS', description: '', datum: d(4), startTime: '18:00', endTime: '20:30',
      location: 'Auswärtshalle', radiusM: 150, teamId: 'mock-team-1', trainingType: 'Spiel', coachNote: '', createdAt: '' },
    { id: 'ms4', trainerId, title: 'Guard-Training', description: '', datum: d(1), startTime: '15:00', endTime: '16:30',
      location: 'Sporthalle Nord', radiusM: 100, teamId: 'mock-team-2', trainingType: 'Training', coachNote: '', createdAt: '' },
    { id: 'ms5', trainerId, title: 'S&C Guards', description: '', datum: d(-2), startTime: '07:00', endTime: '08:30',
      location: 'Kraftraum', radiusM: 80, teamId: 'mock-team-2', trainingType: 'S&C', coachNote: '', createdAt: '' },
  ];
  return { teams, sessions };
}

// ── Types ─────────────────────────────────────────────────────────────────────

type TeamTab = 'sessions' | 'members' | 'chat';

interface Props {
  trainerId: string;
  trainerName: string;
  roster: ManagedAthlete[];
  groups: AthleteGroup[];
  isMock?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AttendanceModule({ trainerId, trainerName, roster, groups, isMock }: Props) {
  const [teams, setTeams] = useState<AttendanceTeam[]>([]);
  const [membersByTeam, setMembersByTeam] = useState<Record<string, AttendanceTeamMember[]>>({});
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [sessionRecords, setSessionRecords] = useState<AttendanceRecord[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [teamTab, setTeamTab] = useState<TeamTab>('sessions');
  const [showPlanner, setShowPlanner] = useState(false);
  const [plannerPrefill, setPlannerPrefill] = useState<string | undefined>();
  const [plannerPrefillTime, setPlannerPrefillTime] = useState<string | undefined>();
  const [showNewTeam, setShowNewTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamSport, setNewTeamSport] = useState('');
  const [newTeamColor, setNewTeamColor] = useState('violet');
  const [teamCreateError, setTeamCreateError] = useState('');
  const [teamCreating, setTeamCreating] = useState(false);
  const [openSession, setOpenSession] = useState<AttendanceSession | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const [addingFromRoster, setAddingFromRoster] = useState(false);

  const reload = useCallback(async () => {
    if (isMock) {
      const { teams: mt, sessions: ms } = buildMockAttendanceSessions(trainerId);
      setTeams(mt);
      setSessions(ms);
      if (!selectedTeamId) setSelectedTeamId(mt[0].id);
      return;
    }
    const [ts, ss] = await Promise.all([
      loadTeams(trainerId),
      loadTrainerSessions(trainerId),
    ]);
    setTeams(ts);
    setSessions(ss);
    if (ts.length > 0 && !selectedTeamId) setSelectedTeamId(ts[0].id);
  }, [trainerId, selectedTeamId, isMock]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    if (!selectedTeamId || isMock) return;
    loadTeamMembers(selectedTeamId).then(m => {
      setMembersByTeam(prev => ({ ...prev, [selectedTeamId]: m }));
    });
  }, [selectedTeamId, isMock]);

  // Load all records for session stats on calendar blocks
  useEffect(() => {
    if (isMock || sessions.length === 0) return;
    loadRecordsBySessionIds(sessions.map(s => s.id)).then(setSessionRecords);
  }, [sessions, isMock]);

  const sessionStats = useMemo(() => {
    const stats: Record<string, { confirmed: number; cancelled: number; maybe: number }> = {};
    for (const r of sessionRecords) {
      if (!stats[r.sessionId]) stats[r.sessionId] = { confirmed: 0, cancelled: 0, maybe: 0 };
      if (r.overrideStatus === 'no') stats[r.sessionId].cancelled++;
      else if (r.overrideStatus === 'maybe') stats[r.sessionId].maybe++;
      else stats[r.sessionId].confirmed++;
    }
    return stats;
  }, [sessionRecords]);

  async function handleCreateTeam() {
    if (!newTeamName.trim()) return;
    if (isMock) { setTeamCreateError('Im Demo-Modus nicht möglich'); return; }
    setTeamCreating(true);
    setTeamCreateError('');
    const team = await createTeam(trainerId, newTeamName.trim(), newTeamSport.trim(), newTeamColor);
    setTeamCreating(false);
    if (team) {
      setTeams(prev => [...prev, team]);
      setSelectedTeamId(team.id);
      setShowNewTeam(false);
      setNewTeamName('');
      setNewTeamSport('');
      setTeamCreateError('');
    } else {
      setTeamCreateError('Fehler beim Erstellen — Supabase-Verbindung prüfen');
    }
  }

  async function handleDeleteTeam(teamId: string) {
    if (isMock) return;
    await deleteTeam(teamId);
    setTeams(prev => prev.filter(t => t.id !== teamId));
    setSelectedTeamId(teams.find(t => t.id !== teamId)?.id ?? null);
  }

  async function handleRegenInvite(teamId: string) {
    if (isMock) return;
    const token = await regenerateTeamInvite(teamId);
    if (token) setTeams(prev => prev.map(t => t.id === teamId ? { ...t, inviteToken: token } : t));
  }

  async function handleAddFromRoster(athlete: ManagedAthlete) {
    if (!selectedTeamId || isMock) return;
    const member = await addMemberFromRoster(selectedTeamId, athlete.id, athlete.name, athlete.sport ?? '', athlete.token);
    if (member) {
      setMembersByTeam(prev => ({
        ...prev,
        [selectedTeamId]: [...(prev[selectedTeamId] ?? []), member],
      }));
    }
  }

  async function handleRemoveMember(memberId: string) {
    if (!selectedTeamId || isMock) return;
    await removeMember(memberId);
    setMembersByTeam(prev => ({
      ...prev,
      [selectedTeamId]: (prev[selectedTeamId] ?? []).filter(m => m.id !== memberId),
    }));
  }

  function copyInviteLink(token: string) {
    const url = `${window.location.origin}${window.location.pathname}#team-join/${token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    });
  }

  function openPlannerForDay(day: string, time?: string) {
    setPlannerPrefill(day);
    setPlannerPrefillTime(time);
    setShowPlanner(true);
  }

  // ── Derived data ──────────────────────────────────────────────────────────

  const selectedTeam = teams.find(t => t.id === selectedTeamId) ?? null;
  const teamMembers = selectedTeamId ? (membersByTeam[selectedTeamId] ?? []) : [];
  const teamSessions = sessions.filter(s => s.teamId === selectedTeamId);
  const today = new Date().toISOString().split('T')[0];
  const upcoming = teamSessions.filter(s => s.datum >= today).sort((a, b) => a.datum.localeCompare(b.datum));
  const past = teamSessions.filter(s => s.datum < today).sort((a, b) => b.datum.localeCompare(a.datum));
  const rosterNotInTeam = roster.filter(a =>
    !teamMembers.some(m => m.athleteRosterId === a.id || m.athleteUserId === a.id)
  );


  function formatDate(d: string) {
    const date = new Date(d + 'T12:00:00');
    const diff = Math.round((date.getTime() - new Date().setHours(0,0,0,0)) / 86400000);
    if (diff === 0) return 'Heute';
    if (diff === 1) return 'Morgen';
    if (diff === -1) return 'Gestern';
    return date.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {isMock && (
        <div className="bg-amber-950/30 border border-amber-800/50 rounded-xl px-3 py-2 text-xs text-amber-300 text-center">
          Demo-Modus aktiv — Änderungen werden nicht gespeichert
        </div>
      )}

      {/* Team selector */}
      <div className="flex items-center gap-2 flex-wrap">
        {teams.map(t => (
          <button key={t.id} onClick={() => { setSelectedTeamId(t.id); setTeamTab('sessions'); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors ${
              selectedTeamId === t.id
                ? 'bg-violet-600 text-white border-transparent'
                : 'border-gray-700 text-gray-400 hover:border-gray-500'
            }`}>
            <span className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: TEAM_COLORS.find(c => c.key === t.color)?.bg ?? '#7c3aed' }} />
            {t.name}
          </button>
        ))}
        <button onClick={() => { setShowNewTeam(true); setTeamCreateError(''); }}
          className="px-3 py-1.5 text-xs text-gray-500 border border-dashed border-gray-700 rounded-xl hover:border-gray-500 hover:text-gray-300 transition-colors">
          + Team
        </button>
      </div>

      {/* New team form */}
      {showNewTeam && (
        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-4 space-y-3">
          <h3 className="text-sm font-medium text-white">Neues Team</h3>
          {isMock && (
            <p className="text-xs text-amber-400 bg-amber-950/30 border border-amber-800/40 rounded-xl px-3 py-2">
              Demo-Modus deaktivieren um echte Teams zu erstellen
            </p>
          )}
          <input value={newTeamName} onChange={e => setNewTeamName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreateTeam()}
            placeholder="Team-Name *" disabled={isMock}
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-violet-500 disabled:opacity-40" />
          <input value={newTeamSport} onChange={e => setNewTeamSport(e.target.value)}
            placeholder="Sportart (optional)" disabled={isMock}
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-violet-500 disabled:opacity-40" />
          <div className="flex gap-2">
            {TEAM_COLORS.map(c => (
              <button key={c.key} onClick={() => setNewTeamColor(c.key)} disabled={isMock}
                className={`w-7 h-7 rounded-full transition-transform disabled:opacity-40 ${newTeamColor === c.key ? 'ring-2 ring-white scale-110' : ''}`}
                style={{ backgroundColor: c.bg }} />
            ))}
          </div>
          {teamCreateError && <p className="text-xs text-red-400">{teamCreateError}</p>}
          <div className="flex gap-2">
            <button onClick={() => { setShowNewTeam(false); setTeamCreateError(''); }}
              className="flex-1 py-2.5 text-sm border border-gray-600 text-gray-400 rounded-xl hover:border-gray-500 transition-colors">
              Abbrechen
            </button>
            <button onClick={handleCreateTeam} disabled={!newTeamName.trim() || teamCreating || isMock}
              className="flex-1 py-2.5 text-sm bg-violet-600 text-white rounded-xl disabled:opacity-40 hover:bg-violet-500 font-medium transition-colors">
              {teamCreating ? 'Erstelle...' : 'Erstellen'}
            </button>
          </div>
        </div>
      )}

      {selectedTeam && (
        <>
          {/* Team header */}
          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold text-white">{selectedTeam.name}</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {teamMembers.length} Mitglieder · {upcoming.length} bevorstehend
                </p>
              </div>
              {!isMock && (
                <button onClick={() => handleDeleteTeam(selectedTeam.id)}
                  className="text-gray-600 hover:text-red-400 text-xs transition-colors">
                  Löschen
                </button>
              )}
            </div>

            {/* Invite link */}
            {!isMock && (
              <div className="mt-3 flex items-center gap-2">
                <div className="flex-1 bg-gray-900 rounded-lg px-2.5 py-1.5 text-xs text-gray-400 truncate font-mono">
                  {selectedTeam.inviteToken
                    ? `…#team-join/${selectedTeam.inviteToken.slice(0, 12)}…`
                    : 'Kein Link aktiv'}
                </div>
                {selectedTeam.inviteToken && (
                  <button onClick={() => copyInviteLink(selectedTeam.inviteToken!)}
                    className="px-2.5 py-1.5 bg-gray-700 text-xs text-gray-300 rounded-lg hover:bg-gray-600 transition-colors whitespace-nowrap">
                    {copiedToken ? '✓ Kopiert' : 'Link kopieren'}
                  </button>
                )}
                <button onClick={() => handleRegenInvite(selectedTeam.id)}
                  className="px-2.5 py-1.5 bg-gray-700 text-xs text-gray-300 rounded-lg hover:bg-gray-600 transition-colors">
                  ↺
                </button>
              </div>
            )}
          </div>

          {/* Team sub-tabs */}
          <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-2xl p-1">
            {(['sessions', 'members', 'chat'] as TeamTab[]).map(t => (
              <button key={t} onClick={() => setTeamTab(t)}
                className={`flex-1 py-2 text-xs rounded-xl font-medium transition-colors ${
                  teamTab === t ? 'bg-violet-600 text-white' : 'text-gray-500 hover:text-gray-300'
                }`}>
                {t === 'sessions' ? 'Einheiten' : t === 'members' ? 'Mitglieder' : 'Chat'}
              </button>
            ))}
          </div>

          {/* Sessions tab */}
          {teamTab === 'sessions' && (
            <div className="space-y-3">
              {/* New session button */}
              <button onClick={() => { setShowPlanner(true); setPlannerPrefill(undefined); setPlannerPrefillTime(undefined); }}
                className="w-full py-2.5 bg-violet-600 text-white rounded-xl text-sm font-medium hover:bg-violet-500 transition-colors">
                + Neue Einheit
              </button>

              {/* Week calendar — always visible, shows all teams */}
              <WeekCalendar
                sessions={sessions}
                teams={teams}
                isMock={isMock}
                sessionStats={sessionStats}
                onSessionClick={s => setOpenSession(s)}
                onAddSession={(datum, time) => openPlannerForDay(datum, time)}
                onSessionsChanged={reload}
              />

              {/* Compact upcoming list for selected team */}
              {upcoming.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-2 px-1">Nächste Einheiten — {selectedTeam?.name}</p>
                  <div className="space-y-2">
                    {upcoming.slice(0, 5).map(s => <SessionCard key={s.id} session={s} onClick={() => setOpenSession(s)} formatDate={formatDate} />)}
                  </div>
                </div>
              )}
              {upcoming.length === 0 && past.length === 0 && (
                <p className="text-center text-gray-600 text-sm py-4">Noch keine Einheiten — im Kalender auf einen Tag klicken</p>
              )}
            </div>
          )}

          {/* Members tab */}
          {teamTab === 'members' && (
            <div className="space-y-3">
              <div className="space-y-1">
                {teamMembers.length === 0 && (
                  <p className="text-center text-gray-600 text-sm py-4">
                    {isMock ? 'Demo: Mitglieder laden…' : 'Noch keine Mitglieder'}
                  </p>
                )}
                {teamMembers.map(m => (
                  <div key={m.id} className="flex items-center gap-3 bg-gray-800 rounded-xl px-3 py-2.5 border border-gray-700">
                    <div className="w-7 h-7 rounded-full bg-violet-900/50 flex items-center justify-center text-xs font-medium text-violet-300 flex-shrink-0">
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{m.name}</p>
                      <p className="text-xs text-gray-500">{m.sport || 'Kein Sport'} · {m.athleteUserId ? 'App-verknüpft' : 'Roster'}</p>
                    </div>
                    {!isMock && (
                      <button onClick={() => handleRemoveMember(m.id)}
                        className="text-gray-600 hover:text-red-400 text-xs transition-colors">
                        Entfernen
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {!isMock && rosterNotInTeam.length > 0 && (
                <div>
                  <button onClick={() => setAddingFromRoster(v => !v)}
                    className="w-full py-2 text-xs text-gray-400 border border-dashed border-gray-700 rounded-xl hover:border-gray-500 transition-colors">
                    {addingFromRoster ? '▲ Schließen' : '+ Aus Kader hinzufügen'}
                  </button>
                  {addingFromRoster && (
                    <div className="mt-2 space-y-1">
                      {rosterNotInTeam.map(a => (
                        <button key={a.id} onClick={() => handleAddFromRoster(a)}
                          className="w-full flex items-center gap-3 px-3 py-2 bg-gray-800 rounded-xl border border-gray-700 hover:border-violet-600 transition-colors text-left">
                          <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-xs text-gray-300 flex-shrink-0">
                            {a.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm text-gray-300">{a.name}</span>
                          <span className="text-xs text-violet-400 ml-auto">+ Hinzufügen</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Chat tab */}
          {teamTab === 'chat' && !isMock && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden" style={{ height: '420px' }}>
              <TeamChat
                mode={{ kind: 'team', teamId: selectedTeam.id }}
                userId={trainerId}
                userName={trainerName}
              />
            </div>
          )}
          {teamTab === 'chat' && isMock && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 text-center text-gray-500 text-sm">
              Chat nicht im Demo-Modus verfügbar
            </div>
          )}
        </>
      )}

      {teams.length === 0 && !showNewTeam && !isMock && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-sm mb-4">Noch keine Teams erstellt</p>
          <button onClick={() => setShowNewTeam(true)}
            className="px-4 py-2 bg-violet-600 text-white rounded-xl text-sm hover:bg-violet-500 transition-colors">
            Erstes Team erstellen
          </button>
        </div>
      )}

      {/* Modals */}
      {showPlanner && (
        <SessionPlanner
          trainerId={trainerId}
          teams={teams}
          membersByTeam={membersByTeam}
          roster={roster}
          groups={groups}
          prefillDatum={plannerPrefill}
          prefillTime={plannerPrefillTime}
          isMock={isMock}
          onCreated={reload}
          onClose={() => { setShowPlanner(false); setPlannerPrefill(undefined); setPlannerPrefillTime(undefined); }}
        />
      )}

      {openSession && !isMock && (
        <SessionDetail
          session={openSession}
          trainerId={trainerId}
          onClose={() => setOpenSession(null)}
          onDeleted={() => { setOpenSession(null); reload(); }}
        />
      )}

      {openSession && isMock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-sm space-y-3">
            <div className="flex justify-between items-start">
              <h3 className="text-base font-semibold text-white">{openSession.title}</h3>
              <button onClick={() => setOpenSession(null)} className="text-gray-500 hover:text-white">×</button>
            </div>
            <p className="text-xs text-gray-400">{formatDate(openSession.datum)}{openSession.startTime ? ` · ${openSession.startTime}` : ''}</p>
            {openSession.location && <p className="text-xs text-gray-500">{openSession.location}</p>}
            <p className="text-xs text-amber-400 text-center mt-3">Demo-Modus: Details nicht verfügbar</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    Training: 'text-violet-400', Spiel: 'text-rose-400', Wettkampf: 'text-orange-400',
    'S&C': 'text-emerald-400', Taktik: 'text-blue-400', Videoanalyse: 'text-sky-400',
    Regeneration: 'text-teal-400', Sonstiges: 'text-gray-400',
  };
  return <span className={`text-xs font-medium flex-shrink-0 ${colors[type] ?? 'text-gray-400'}`}>{type}</span>;
}

function SessionCard({
  session, onClick, formatDate,
}: {
  session: AttendanceSession;
  onClick: () => void;
  formatDate: (d: string) => string;
}) {
  return (
    <button onClick={onClick}
      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-left hover:border-violet-600 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{session.title}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {formatDate(session.datum)}
            {session.startTime && ` · ${session.startTime}${session.endTime ? `–${session.endTime}` : ''}`}
          </p>
          {session.location && <p className="text-xs text-gray-500 mt-0.5">{session.location}</p>}
        </div>
        {session.trainingType && <TypeBadge type={session.trainingType} />}
      </div>
    </button>
  );
}
