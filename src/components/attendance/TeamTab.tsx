import { useState, useEffect, useRef } from 'react';
import type { AttendanceSession, AttendanceRecord, AttendanceTeam, AttendanceOverrideStatus, AbsenceReason } from '../../types/attendance';
import { getEffectiveStatus } from '../../types/attendance';
import {
  loadMyTeamMemberships, loadMySessions, loadMyRecords,
  loadTeamMessages,
  submitAthleteOverride, clearAthleteOverride,
} from '../../lib/attendanceStorage';
import { supabase, CLOUD_ENABLED } from '../../lib/supabase';
import { TeamChat } from './TeamChat';
import { WeekCalendar } from './WeekCalendar';

const ABSENCE_REASONS: { value: AbsenceReason; label: string }[] = [
  { value: 'verletzt',  label: 'Verletzt' },
  { value: 'krank',     label: 'Krank' },
  { value: 'schule',    label: 'Schule / Uni' },
  { value: 'arbeit',    label: 'Arbeit' },
  { value: 'privat',    label: 'Privat' },
  { value: 'sonstiges', label: 'Sonstiges' },
];

type SubTab = 'sessions' | 'chat';
type ModalTab = 'info' | 'chat';

interface Props {
  userId: string;
  userName: string;
  onGoToJoin?: () => void;
}

interface OverrideModal {
  session: AttendanceSession;
  record?: AttendanceRecord;
}

function chatReadKey(teamId: string) { return `chat_read_${teamId}`; }

export function TeamTab({ userId, userName, onGoToJoin }: Props) {
  const [myTeams, setMyTeams] = useState<AttendanceTeam[]>([]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState<SubTab>('sessions');
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  // Override modal
  const [overrideModal, setOverrideModal] = useState<OverrideModal | null>(null);
  const [modalTab, setModalTab] = useState<ModalTab>('info');
  const [overrideStatus, setOverrideStatus] = useState<AttendanceOverrideStatus>('no');
  const [overrideReason, setOverrideReason] = useState<AbsenceReason | ''>('');
  const [overrideNote, setOverrideNote] = useState('');
  const [saving, setSaving] = useState(false);

  // Unread chat badge
  const [unreadCount, setUnreadCount] = useState(0);
  const lastReadRef = useRef<string>('');

  // Load teams + sessions + records
  useEffect(() => {
    let cancelled = false;
    loadMyTeamMemberships(userId).then(async memberships => {
      if (cancelled) return;
      const teamIds = [...new Set(memberships.map(m => m.teamId))];
      if (teamIds.length === 0) { setLoading(false); return; }
      if (!CLOUD_ENABLED || cancelled) return;
      const { data } = await supabase.from('att_teams').select('*').in('id', teamIds);
      if (!cancelled && data) {
        setMyTeams((data as Record<string, unknown>[]).map(r => ({
          id: r.id as string, trainerId: r.trainer_id as string,
          name: r.name as string, sport: r.sport as string,
          color: r.color as string, inviteToken: r.invite_token as string | null,
          inviteActive: r.invite_active as boolean, createdAt: r.created_at as string,
        })));
        if (!selectedTeamId && data.length > 0) setSelectedTeamId(data[0].id as string);
      }
      const [ss, rs] = await Promise.all([loadMySessions(userId), loadMyRecords(userId)]);
      if (!cancelled) { setSessions(ss); setRecords(rs); setLoading(false); }
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Unread count: load on mount + team change
  useEffect(() => {
    if (!selectedTeamId || !CLOUD_ENABLED) return;
    const lastRead = localStorage.getItem(chatReadKey(selectedTeamId)) ?? '';
    lastReadRef.current = lastRead;
    loadTeamMessages(selectedTeamId).then(msgs => {
      const count = msgs.filter(m => m.createdAt > lastRead && m.senderUserId !== userId).length;
      setUnreadCount(count);
    });
  }, [selectedTeamId, userId]);

  // Realtime unread subscription
  useEffect(() => {
    if (!selectedTeamId || !CLOUD_ENABLED) return;
    const channel = supabase
      .channel(`unread-${selectedTeamId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public',
        table: 'att_team_messages',
        filter: `team_id=eq.${selectedTeamId}`,
      }, (payload) => {
        const r = payload.new as Record<string, unknown>;
        if (r.sender_user_id !== userId && subTab !== 'chat') {
          setUnreadCount(prev => prev + 1);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedTeamId, userId, subTab]);

  function switchToChat() {
    setSubTab('chat');
    if (selectedTeamId) {
      const now = new Date().toISOString();
      localStorage.setItem(chatReadKey(selectedTeamId), now);
      lastReadRef.current = now;
      setUnreadCount(0);
    }
  }

  function getRecord(sessionId: string) {
    return records.find(r => r.sessionId === sessionId);
  }

  const today = new Date().toISOString().split('T')[0];
  const teamSessions = selectedTeamId ? sessions.filter(s => s.teamId === selectedTeamId) : sessions;
  const upcoming = teamSessions
    .filter(s => {
      const rec = getRecord(s.id);
      const eff = rec ? getEffectiveStatus(rec) : 'expected';
      return s.datum >= today && eff !== 'no';
    })
    .sort((a, b) => a.datum.localeCompare(b.datum));
  const cancelled = teamSessions
    .filter(s => {
      const rec = getRecord(s.id);
      const eff = rec ? getEffectiveStatus(rec) : 'expected';
      return eff === 'no';
    })
    .sort((a, b) => b.datum.localeCompare(a.datum));

  function openOverride(session: AttendanceSession) {
    const rec = getRecord(session.id);
    setOverrideModal({ session, record: rec });
    setModalTab('info');
    setOverrideStatus(rec?.overrideStatus ?? 'no');
    setOverrideReason(rec?.absenceReason ?? '');
    setOverrideNote(rec?.absenceNote ?? '');
  }

  async function handleSaveOverride() {
    if (!overrideModal) return;
    if (overrideStatus === 'no' && (!overrideReason || !overrideNote.trim())) return;
    setSaving(true);
    await submitAthleteOverride(overrideModal.session.id, userId, overrideStatus, overrideReason as AbsenceReason | undefined, overrideNote);
    await Promise.all([loadMySessions(userId), loadMyRecords(userId)]).then(([ss, rs]) => {
      setSessions(ss); setRecords(rs);
    });
    setSaving(false);
    setOverrideModal(null);
  }

  async function handleClearOverride() {
    if (!overrideModal) return;
    setSaving(true);
    await clearAthleteOverride(overrideModal.session.id, userId);
    const rs = await loadMyRecords(userId);
    setRecords(rs);
    setSaving(false);
    setOverrideModal(null);
  }

  function formatDate(d: string) {
    const date = new Date(d + 'T12:00:00');
    const diff = Math.round((date.getTime() - new Date().setHours(0,0,0,0)) / 86400000);
    if (diff === 0) return 'Heute';
    if (diff === 1) return 'Morgen';
    if (diff === 2) return 'Übermorgen';
    return date.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  if (loading) {
    return <div className="py-12 text-center text-gray-500 text-sm">Laden...</div>;
  }

  if (myTeams.length === 0) {
    return (
      <div className="py-10 px-4 space-y-5">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 text-center space-y-3">
          <div className="w-12 h-12 bg-violet-950/60 border border-violet-800/40 rounded-2xl flex items-center justify-center text-2xl mx-auto">🏆</div>
          <div>
            <p className="text-white text-sm font-semibold mb-1">Kein Team gefunden</p>
            <p className="text-gray-500 text-xs leading-relaxed">
              Dein Trainer fügt dich direkt hinzu — du siehst das Team dann automatisch hier.
              Alternativ kannst du mit einem Einladungslink beitreten.
            </p>
          </div>
          {onGoToJoin && (
            <button onClick={onGoToJoin}
              className="px-4 py-2.5 border border-gray-700 text-gray-400 rounded-xl text-sm hover:border-gray-500 hover:text-white transition-colors">
              Mit Link beitreten
            </button>
          )}
        </div>
        <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4 space-y-2">
          <p className="text-xs text-gray-500 font-medium">So funktioniert es</p>
          <div className="space-y-2.5 text-xs text-gray-400">
            {[
              'Dein Trainer fügt dich in seiner Trainer-Ansicht zum Team hinzu',
              'Das Team erscheint automatisch hier – kein Einladungslink nötig',
              'Du siehst alle geplanten Einheiten und kannst Zu-/Absagen verwalten',
            ].map((text, i) => (
              <div key={i} className="flex gap-2.5 items-start">
                <span className="w-5 h-5 rounded-full bg-violet-900/60 border border-violet-700/40 flex-shrink-0 flex items-center justify-center text-violet-300 font-bold text-xs">{i + 1}</span>
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Team selector */}
      {myTeams.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {myTeams.map(t => (
            <button key={t.id} onClick={() => setSelectedTeamId(t.id)}
              className={`px-3 py-1.5 text-sm rounded-xl border font-medium transition-colors ${
                selectedTeamId === t.id
                  ? 'bg-violet-600 text-white border-transparent'
                  : 'border-gray-700 text-gray-400 hover:border-gray-500'
              }`}>
              {t.name}
            </button>
          ))}
        </div>
      )}

      {/* Sub-tabs */}
      <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-2xl p-1">
        <button onClick={() => setSubTab('sessions')}
          className={`flex-1 py-2 text-xs rounded-xl font-medium transition-colors ${
            subTab === 'sessions' ? 'bg-violet-600 text-white' : 'text-gray-500 hover:text-gray-300'
          }`}>
          Einheiten
        </button>
        <button onClick={switchToChat}
          className={`flex-1 py-2 text-xs rounded-xl font-medium transition-colors relative ${
            subTab === 'chat' ? 'bg-violet-600 text-white' : 'text-gray-500 hover:text-gray-300'
          }`}>
          Chat
          {unreadCount > 0 && subTab !== 'chat' && (
            <span className="absolute top-1 right-3 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Sessions tab */}
      {subTab === 'sessions' && (
        <div className="space-y-4">
          {/* Week calendar */}
          {sessions.length > 0 && (
            <div className="bg-gray-900/50 rounded-2xl border border-gray-800 overflow-hidden">
              <WeekCalendar
                sessions={selectedTeamId ? sessions.filter(s => s.teamId === selectedTeamId) : sessions}
                teams={myTeams}
                readOnly
                cancelledSessionIds={new Set(records.filter(r => r.overrideStatus === 'no').map(r => r.sessionId))}
                onSessionClick={openOverride}
              />
            </div>
          )}

          {upcoming.length === 0 && cancelled.length === 0 && (
            <p className="text-center text-gray-600 text-sm py-8">Keine bevorstehenden Einheiten</p>
          )}

          {upcoming.length > 0 && (
            <div className="space-y-2">
              {upcoming.map(s => {
                const rec = getRecord(s.id);
                const eff = rec ? getEffectiveStatus(rec) : 'expected';
                return (
                  <AthleteSessionCard
                    key={s.id} session={s} status={eff} record={rec}
                    formatDate={formatDate} onTap={() => openOverride(s)}
                  />
                );
              })}
            </div>
          )}

          {cancelled.length > 0 && (
            <details className="group">
              <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-400 select-none">
                {cancelled.length} abgesagte Einheit{cancelled.length !== 1 ? 'en' : ''} ▾
              </summary>
              <div className="mt-2 space-y-2 opacity-60">
                {cancelled.map(s => {
                  const rec = getRecord(s.id);
                  return (
                    <AthleteSessionCard
                      key={s.id} session={s} status="no" record={rec}
                      formatDate={formatDate} onTap={() => openOverride(s)}
                    />
                  );
                })}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Chat tab — team chat */}
      {subTab === 'chat' && selectedTeamId && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden" style={{ height: '420px' }}>
          <TeamChat mode={{ kind: 'team', teamId: selectedTeamId }} userId={userId} userName={userName} />
        </div>
      )}

      {/* Override Modal */}
      {overrideModal && (() => {
        const alreadyCancelled = overrideModal.record?.overrideStatus === 'no';
        const showAbsenceFields = overrideStatus === 'no';

        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4">
            <div className="bg-gray-900 border border-gray-800 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm flex flex-col"
              style={{ maxHeight: '90vh' }}>

              {/* Header */}
              <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-800 flex-shrink-0">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{overrideModal.session.title}</p>
                  <p className="text-xs text-gray-400">
                    {formatDate(overrideModal.session.datum)}
                    {overrideModal.session.startTime ? ` · ${overrideModal.session.startTime}` : ''}
                    {overrideModal.session.location ? ` · ${overrideModal.session.location}` : ''}
                  </p>
                </div>
                <button onClick={() => setOverrideModal(null)} className="text-gray-500 hover:text-white text-xl leading-none ml-3 flex-shrink-0">×</button>
              </div>

              {/* Modal tabs: Info / Chat */}
              <div className="flex gap-1 px-4 pt-3 pb-1 flex-shrink-0">
                {(['info', 'chat'] as ModalTab[]).map(t => (
                  <button key={t} onClick={() => setModalTab(t)}
                    className={`px-4 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                      modalTab === t ? 'bg-violet-600 text-white' : 'text-gray-500 hover:text-gray-300 border border-gray-800'
                    }`}>
                    {t === 'info' ? 'Teilnahme' : '💬 Chat'}
                  </button>
                ))}
              </div>

              {/* Info tab */}
              {modalTab === 'info' && (
                <div className="px-4 py-4 space-y-4 overflow-y-auto flex-1">
                  {alreadyCancelled ? (
                    <>
                      <div className="bg-red-950/40 border border-red-800/50 rounded-xl px-3 py-2.5 text-xs text-red-300 text-center">
                        Du hast diese Einheit abgesagt
                      </div>
                      <div className="flex gap-2">
                        <button onClick={handleClearOverride} disabled={saving}
                          className="flex-1 py-3 text-sm bg-emerald-700 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors disabled:opacity-40">
                          {saving ? '...' : '✓ Wieder zusagen'}
                        </button>
                        <button onClick={() => setOverrideModal(null)}
                          className="px-4 py-3 text-sm border border-gray-700 text-gray-400 rounded-xl hover:border-gray-500 transition-colors">
                          Schließen
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <p className="text-xs text-gray-400 mb-2">Status</p>
                        <div className="flex gap-2">
                          {(['maybe', 'no'] as AttendanceOverrideStatus[]).map(s => (
                            <button key={s} onClick={() => setOverrideStatus(s)}
                              className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                                overrideStatus === s
                                  ? s === 'no' ? 'bg-red-700 text-white border-transparent' : 'bg-yellow-700 text-white border-transparent'
                                  : 'border-gray-700 text-gray-400 hover:border-gray-500'
                              }`}>
                              {s === 'maybe' ? 'Unsicher' : 'Absagen'}
                            </button>
                          ))}
                        </div>
                      </div>

                      {showAbsenceFields && (
                        <div>
                          <p className="text-xs text-gray-400 mb-2">Grund</p>
                          <div className="flex flex-wrap gap-2">
                            {ABSENCE_REASONS.map(r => (
                              <button key={r.value} onClick={() => setOverrideReason(r.value)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                                  overrideReason === r.value
                                    ? 'bg-violet-600 text-white border-transparent'
                                    : 'border-gray-700 text-gray-400 hover:border-gray-500'
                                }`}>
                                {r.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div>
                        <p className="text-xs text-gray-400 mb-1">
                          Nachricht an Trainer
                          {overrideStatus === 'no'
                            ? <span className="text-red-500 ml-1">*</span>
                            : <span className="text-gray-600"> (optional)</span>}
                        </p>
                        <textarea value={overrideNote} onChange={e => setOverrideNote(e.target.value)}
                          rows={2} placeholder={overrideStatus === 'no' ? 'Bitte kurz erklären...' : 'Kurze Info...'}
                          className={`w-full bg-gray-800 border rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-violet-500 resize-none ${
                            overrideStatus === 'no' && !overrideNote.trim() ? 'border-red-800' : 'border-gray-700'
                          }`} />
                      </div>

                      <div className="flex gap-2">
                        {overrideModal.record?.overrideStatus && (
                          <button onClick={handleClearOverride} disabled={saving}
                            className="flex-1 py-2.5 text-sm border border-gray-700 text-gray-400 rounded-xl hover:border-gray-500 transition-colors disabled:opacity-40">
                            Zurücksetzen
                          </button>
                        )}
                        <button onClick={handleSaveOverride}
                          disabled={saving || (overrideStatus === 'no' && (!overrideReason || !overrideNote.trim()))}
                          className="flex-1 py-2.5 text-sm bg-violet-600 text-white rounded-xl font-medium disabled:opacity-40 hover:bg-violet-500 transition-colors">
                          {saving ? 'Speichern...' : 'Bestätigen'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Chat tab — session chat */}
              {modalTab === 'chat' && (
                <div className="flex-1 min-h-0" style={{ height: '360px' }}>
                  <TeamChat
                    mode={{ kind: 'session', sessionId: overrideModal.session.id }}
                    userId={userId}
                    userName={userName}
                  />
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}


function AthleteSessionCard({
  session, status, record, formatDate, onTap,
}: {
  session: AttendanceSession;
  status: string;
  record?: AttendanceRecord;
  formatDate: (d: string) => string;
  onTap: () => void;
}) {
  const statusInfo: Record<string, { label: string; border: string; badge: string }> = {
    expected:         { label: 'Erwartet',    border: 'border-gray-700',    badge: 'bg-gray-700 text-gray-300' },
    maybe:            { label: 'Unsicher',    border: 'border-yellow-800',  badge: 'bg-yellow-900/60 text-yellow-300' },
    no:               { label: 'Abgesagt',    border: 'border-red-900',     badge: 'bg-red-900/60 text-red-300' },
    present:          { label: 'Anwesend',    border: 'border-emerald-800', badge: 'bg-emerald-900/60 text-emerald-300' },
    late:             { label: 'Verspätet',   border: 'border-amber-800',   badge: 'bg-amber-900/60 text-amber-300' },
    excused_absent:   { label: 'Entschuldigt',border: 'border-blue-900',    badge: 'bg-blue-900/60 text-blue-300' },
    unexcused_absent: { label: 'Unentschuld.',border: 'border-red-900',     badge: 'bg-red-900/60 text-red-300' },
  };
  const info = statusInfo[status] ?? statusInfo.expected;

  return (
    <button onClick={onTap}
      className={`w-full bg-gray-800 border ${info.border} rounded-xl px-4 py-3 text-left hover:border-violet-600 transition-colors`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{session.title}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {formatDate(session.datum)}
            {session.startTime && ` · ${session.startTime}${session.endTime ? `–${session.endTime}` : ''}`}
          </p>
          {session.location && <p className="text-xs text-gray-500 mt-0.5">{session.location}</p>}
          {record?.absenceReason && (
            <p className="text-xs text-gray-600 mt-1">{record.absenceReason}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${info.badge}`}>{info.label}</span>
          {session.trainingType && (
            <span className="text-xs text-gray-500">{session.trainingType}</span>
          )}
        </div>
      </div>
    </button>
  );
}
