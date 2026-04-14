import { useState, useEffect } from 'react';
import type { AttendanceSession, AttendanceRecord, AttendanceTeam, AttendanceOverrideStatus, AbsenceReason } from '../../types/attendance';
import { getEffectiveStatus } from '../../types/attendance';
import {
  loadMyTeamMemberships, loadMySessions, loadMyRecords,
  submitAthleteOverride, clearAthleteOverride,
} from '../../lib/attendanceStorage';
import { TeamChat } from './TeamChat';

const ABSENCE_REASONS: { value: AbsenceReason; label: string }[] = [
  { value: 'verletzt',  label: 'Verletzt' },
  { value: 'krank',     label: 'Krank' },
  { value: 'schule',    label: 'Schule / Uni' },
  { value: 'arbeit',    label: 'Arbeit' },
  { value: 'privat',    label: 'Privat' },
  { value: 'sonstiges', label: 'Sonstiges' },
];

type SubTab = 'sessions' | 'calendar' | 'chat';

interface Props {
  userId: string;
  userName: string;
  onGoToJoin?: () => void;
}

interface OverrideModal {
  session: AttendanceSession;
  record?: AttendanceRecord;
}

export function TeamTab({ userId, userName, onGoToJoin }: Props) {
  const [myTeams, setMyTeams] = useState<AttendanceTeam[]>([]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState<SubTab>('sessions');
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [overrideModal, setOverrideModal] = useState<OverrideModal | null>(null);
  const [overrideStatus, setOverrideStatus] = useState<AttendanceOverrideStatus>('no');
  const [overrideReason, setOverrideReason] = useState<AbsenceReason | ''>('');
  const [overrideNote, setOverrideNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [calMonth, setCalMonth] = useState(() => new Date());


  // Load real team names from team table
  useEffect(() => {
    let cancelled = false;
    loadMyTeamMemberships(userId).then(async memberships => {
      if (cancelled) return;
      const teamIds = [...new Set(memberships.map(m => m.teamId))];
      if (teamIds.length === 0) { setLoading(false); return; }
      const { supabase, CLOUD_ENABLED } = await import('../../lib/supabase');
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
    setOverrideStatus(rec?.overrideStatus ?? 'no');
    setOverrideReason(rec?.absenceReason ?? '');
    setOverrideNote(rec?.absenceNote ?? '');
  }

  async function handleSaveOverride() {
    if (!overrideModal) return;
    if (!overrideReason) return;
    setSaving(true);
    await submitAthleteOverride(overrideModal.session.id, userId, overrideStatus, overrideReason as AbsenceReason, overrideNote);
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

  // Calendar helpers
  function calDays() {
    const year = calMonth.getFullYear();
    const month = calMonth.getMonth();
    const first = new Date(year, month, 1).getDay(); // 0=Sun
    const startOffset = (first === 0 ? 6 : first - 1); // Mon-based
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = Array(startOffset).fill(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  }

  function sessionDaysInMonth() {
    const year = calMonth.getFullYear();
    const month = calMonth.getMonth();
    return new Set(
      teamSessions
        .map(s => new Date(s.datum + 'T12:00:00'))
        .filter(d => d.getFullYear() === year && d.getMonth() === month)
        .map(d => d.getDate())
    );
  }

  const sessionDays = sessionDaysInMonth();
  const todayDate = new Date();

  if (loading) {
    return <div className="py-12 text-center text-gray-500 text-sm">Laden...</div>;
  }

  if (myTeams.length === 0) {
    return (
      <div className="py-12 text-center space-y-4">
        <div className="text-4xl">🏆</div>
        <p className="text-gray-400 text-sm">Du bist noch in keinem Team</p>
        {onGoToJoin && (
          <button onClick={onGoToJoin}
            className="px-4 py-2 bg-violet-600 text-white rounded-xl text-sm hover:bg-violet-500 transition-colors">
            Team beitreten
          </button>
        )}
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
        {(['sessions', 'calendar', 'chat'] as SubTab[]).map(t => (
          <button key={t} onClick={() => setSubTab(t)}
            className={`flex-1 py-2 text-xs rounded-xl font-medium transition-colors ${
              subTab === t ? 'bg-violet-600 text-white' : 'text-gray-500 hover:text-gray-300'
            }`}>
            {t === 'sessions' ? 'Einheiten' : t === 'calendar' ? 'Kalender' : 'Chat'}
          </button>
        ))}
      </div>

      {/* Sessions tab */}
      {subTab === 'sessions' && (
        <div className="space-y-4">
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

      {/* Calendar tab */}
      {subTab === 'calendar' && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() - 1))}
              className="text-gray-400 hover:text-white px-2">‹</button>
            <p className="text-sm font-medium text-white">
              {calMonth.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
            </p>
            <button onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() + 1))}
              className="text-gray-400 hover:text-white px-2">›</button>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Mo','Di','Mi','Do','Fr','Sa','So'].map(d => (
              <div key={d} className="text-center text-xs text-gray-600 font-medium py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {calDays().map((day, i) => {
              if (!day) return <div key={i} />;
              const isToday = day === todayDate.getDate() &&
                calMonth.getMonth() === todayDate.getMonth() &&
                calMonth.getFullYear() === todayDate.getFullYear();
              const hasSession = sessionDays.has(day);
              return (
                <div key={i} className={`aspect-square flex flex-col items-center justify-center rounded-lg text-xs relative ${
                  isToday ? 'bg-violet-600 text-white font-bold' : 'text-gray-300'
                }`}>
                  {day}
                  {hasSession && (
                    <span className={`w-1 h-1 rounded-full absolute bottom-1 ${isToday ? 'bg-white' : 'bg-violet-400'}`} />
                  )}
                </div>
              );
            })}
          </div>
          {/* Sessions for this month */}
          <div className="mt-4 space-y-1">
            {teamSessions
              .filter(s => {
                const d = new Date(s.datum + 'T12:00:00');
                return d.getFullYear() === calMonth.getFullYear() && d.getMonth() === calMonth.getMonth();
              })
              .sort((a, b) => a.datum.localeCompare(b.datum))
              .map(s => {
                const rec = getRecord(s.id);
                const eff = rec ? getEffectiveStatus(rec) : 'expected';
                return (
                  <button key={s.id} onClick={() => openOverride(s)}
                    className="w-full flex items-center gap-3 px-3 py-2 bg-gray-800 rounded-xl border border-gray-700 hover:border-violet-600 transition-colors text-left">
                    <span className="text-xs text-gray-500 w-8 flex-shrink-0">
                      {new Date(s.datum + 'T12:00:00').getDate()}
                    </span>
                    <span className="flex-1 text-sm text-white truncate">{s.title}</span>
                    <StatusDot status={eff} />
                  </button>
                );
              })}
          </div>
        </div>
      )}

      {/* Chat tab */}
      {subTab === 'chat' && selectedTeamId && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden" style={{ height: '420px' }}>
          <TeamChat mode={{ kind: 'team', teamId: selectedTeamId }} userId={userId} userName={userName} />
        </div>
      )}

      {/* Override Modal */}
      {overrideModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm">
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-800">
              <div>
                <p className="text-sm font-semibold text-white">{overrideModal.session.title}</p>
                <p className="text-xs text-gray-400">{formatDate(overrideModal.session.datum)}{overrideModal.session.startTime ? ` · ${overrideModal.session.startTime}` : ''}</p>
              </div>
              <button onClick={() => setOverrideModal(null)} className="text-gray-500 hover:text-white text-xl">×</button>
            </div>

            <div className="px-4 py-4 space-y-4">
              {/* Status choice */}
              <div>
                <p className="text-xs text-gray-400 mb-2">Dein Status</p>
                <div className="flex gap-2">
                  {(['maybe', 'no'] as AttendanceOverrideStatus[]).map(s => (
                    <button key={s} onClick={() => setOverrideStatus(s)}
                      className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${
                        overrideStatus === s
                          ? s === 'no' ? 'bg-red-700 text-white border-transparent' : 'bg-yellow-700 text-white border-transparent'
                          : 'border-gray-700 text-gray-400 hover:border-gray-500'
                      }`}>
                      {s === 'maybe' ? 'Unsicher' : 'Absagen'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reason */}
              <div>
                <p className="text-xs text-gray-400 mb-2">Grund *</p>
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

              {/* Note */}
              <div>
                <p className="text-xs text-gray-400 mb-1">Nachricht an Trainer</p>
                <textarea value={overrideNote} onChange={e => setOverrideNote(e.target.value)}
                  rows={3} placeholder="Erkläre kurz was los ist..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-violet-500 resize-none" />
              </div>

              <div className="flex gap-2">
                {overrideModal.record?.overrideStatus && (
                  <button onClick={handleClearOverride} disabled={saving}
                    className="flex-1 py-2.5 text-sm border border-gray-700 text-gray-400 rounded-xl hover:border-gray-500 transition-colors disabled:opacity-40">
                    Zurücksetzen
                  </button>
                )}
                <button onClick={handleSaveOverride} disabled={saving || !overrideReason}
                  className="flex-1 py-2.5 text-sm bg-violet-600 text-white rounded-xl font-medium disabled:opacity-40 hover:bg-violet-500 transition-colors">
                  {saving ? 'Speichern...' : 'Bestätigen'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    expected: 'bg-gray-500', maybe: 'bg-yellow-500', no: 'bg-red-500',
    present: 'bg-emerald-500', late: 'bg-amber-500', partial: 'bg-yellow-500',
    excused_absent: 'bg-blue-500', unexcused_absent: 'bg-red-600',
  };
  return <span className={`w-2 h-2 rounded-full flex-shrink-0 ${colors[status] ?? 'bg-gray-500'}`} />;
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
