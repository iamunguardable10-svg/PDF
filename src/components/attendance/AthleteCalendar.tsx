import { useState, useEffect } from 'react';
import { CalendarDays, MapPin, Clock, Check, X, HelpCircle, RefreshCw } from 'lucide-react';
import {
  loadMySessions,
  loadMyTeamMemberships,
  submitAthleteOverride,
  clearAthleteOverride,
} from '../../lib/attendanceStorage';
import type { AttendanceSession, AttendanceTeamMember } from '../../types/attendance';

interface Props {
  userId: string;
  userName: string;
}

type RSVP = 'yes' | 'maybe' | 'no';

interface SessionWithRSVP extends AttendanceSession {
  rsvp: RSVP | null;
  membershipTeamName?: string;
}

const TYPE_DOT: Record<string, string> = {
  Training: 'bg-violet-500', Spiel: 'bg-rose-500', Wettkampf: 'bg-orange-500',
  'S&C': 'bg-emerald-500', Taktik: 'bg-blue-500', Videoanalyse: 'bg-sky-500',
  Regeneration: 'bg-teal-500', Sonstiges: 'bg-gray-500',
};

const TYPE_PILL: Record<string, string> = {
  Training: 'bg-violet-900/40 text-violet-300', Spiel: 'bg-rose-900/40 text-rose-300',
  Wettkampf: 'bg-orange-900/40 text-orange-300', 'S&C': 'bg-emerald-900/40 text-emerald-300',
  Taktik: 'bg-blue-900/40 text-blue-300', Videoanalyse: 'bg-sky-900/40 text-sky-300',
  Regeneration: 'bg-teal-900/40 text-teal-300', Sonstiges: 'bg-gray-800 text-gray-400',
};

export function AthleteCalendar({ userId, userName: _userName }: Props) {
  const [sessions,  setSessions]  = useState<SessionWithRSVP[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState<string | null>(null);
  const [showPast,  setShowPast]  = useState(false);

  const today = new Date().toISOString().split('T')[0];

  async function load() {
    setLoading(true);
    const [rawSessions, memberships]: [AttendanceSession[], AttendanceTeamMember[]] =
      await Promise.all([loadMySessions(userId), loadMyTeamMemberships(userId)]);

    // Build a teamId → teamName map from memberships (teamId is on memberships via teamId field)
    const teamNames: Record<string, string> = {};
    for (const m of memberships) teamNames[m.teamId] = m.name;

    // We don't have team names from memberships directly (they only have member names).
    // For now just annotate with teamId — the session itself has teamId.
    const enriched: SessionWithRSVP[] = rawSessions.map(s => ({
      ...s,
      rsvp: null,   // TODO: load from att_records when needed
      membershipTeamName: s.teamId ? teamNames[s.teamId] : undefined,
    }));

    setSessions(enriched.sort((a, b) => a.datum.localeCompare(b.datum)));
    setLoading(false);
  }

  useEffect(() => { load(); }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const upcoming = sessions.filter(s => s.datum >= today);
  const past     = sessions.filter(s => s.datum <  today).reverse();

  async function handleRSVP(session: SessionWithRSVP, rsvp: RSVP) {
    setSaving(session.id);
    if (rsvp === 'yes') {
      await clearAthleteOverride(session.id, userId);
    } else if (rsvp === 'maybe') {
      await submitAthleteOverride(session.id, userId, 'maybe');
    } else {
      await submitAthleteOverride(session.id, userId, 'no');
    }
    setSessions(prev => prev.map(s => s.id === session.id ? { ...s, rsvp } : s));
    setSaving(null);
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-12 text-xs text-gray-600">
        <span className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        Sessions werden geladen…
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="text-center py-16 space-y-2">
        <CalendarDays className="w-10 h-10 text-gray-700 mx-auto" />
        <p className="text-gray-500 text-sm font-medium">Noch keine Sessions</p>
        <p className="text-gray-700 text-xs">Tritt einem Team bei — dann erscheinen hier deine Trainingseinheiten.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">{upcoming.length} bevorstehende Einheiten</p>
        <button onClick={load} className="p-1.5 rounded-lg text-gray-600 hover:text-gray-400 hover:bg-gray-800 transition-colors">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Upcoming */}
      {upcoming.length === 0 ? (
        <p className="text-gray-600 text-sm text-center py-4">Keine bevorstehenden Einheiten</p>
      ) : (
        <div className="space-y-2.5">
          {upcoming.map(s => <SessionCard key={s.id} session={s} today={today} saving={saving} onRSVP={handleRSVP} />)}
        </div>
      )}

      {/* Past toggle */}
      {past.length > 0 && (
        <div>
          <button
            onClick={() => setShowPast(p => !p)}
            className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-400 transition-colors"
          >
            <span className={`transition-transform ${showPast ? 'rotate-90' : ''}`}>▶</span>
            {past.length} vergangene Einheiten
          </button>
          {showPast && (
            <div className="mt-2.5 space-y-2 opacity-60">
              {past.map(s => <SessionCard key={s.id} session={s} today={today} saving={saving} onRSVP={handleRSVP} past />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Session Card ──────────────────────────────────────────────────────────────

function SessionCard({
  session: s, today, saving, onRSVP, past = false,
}: {
  session: SessionWithRSVP;
  today: string;
  saving: string | null;
  onRSVP: (s: SessionWithRSVP, r: RSVP) => void;
  past?: boolean;
}) {
  const isToday   = s.datum === today;
  const isSaving  = saving === s.id;
  const dateLabel = isToday
    ? 'Heute'
    : new Date(s.datum + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });

  const dotColor = TYPE_DOT[s.trainingType] ?? TYPE_DOT.Sonstiges;
  const pill     = TYPE_PILL[s.trainingType] ?? TYPE_PILL.Sonstiges;

  return (
    <div className={`rounded-2xl border p-4 space-y-3 transition-colors ${
      isToday
        ? 'bg-violet-950/30 border-violet-800/50'
        : 'bg-gray-800/50 border-gray-700/40'
    }`}>
      {/* Top row */}
      <div className="flex items-start gap-3">
        {/* Date block */}
        <div className="flex-shrink-0 w-12 text-center">
          <p className={`text-[11px] font-semibold ${isToday ? 'text-violet-400' : 'text-gray-500'}`}>{dateLabel}</p>
        </div>

        {/* Session info */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
            <p className="text-sm font-medium text-white truncate">{s.title}</p>
          </div>
          {s.trainingType && (
            <span className={`inline-flex text-[10px] font-medium px-1.5 py-0.5 rounded-md ${pill}`}>{s.trainingType}</span>
          )}
          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
            {(s.startTime || s.endTime) && (
              <span className="flex items-center gap-1 text-[11px] text-gray-500">
                <Clock size={10} />
                {s.startTime}{s.endTime ? `–${s.endTime}` : ''}
              </span>
            )}
            {s.location && (
              <span className="flex items-center gap-1 text-[11px] text-gray-500">
                <MapPin size={10} />
                {s.location}
              </span>
            )}
          </div>
          {s.coachNote && (
            <p className="text-[11px] text-gray-600 italic">"{s.coachNote}"</p>
          )}
        </div>
      </div>

      {/* RSVP — only for upcoming */}
      {!past && (
        <div className="flex items-center gap-2 pt-0.5">
          <span className="text-[11px] text-gray-600 flex-shrink-0">Status:</span>
          <div className="flex gap-1.5">
            <RsvpButton
              active={s.rsvp === 'yes' || s.rsvp === null}
              loading={isSaving}
              onClick={() => onRSVP(s, 'yes')}
              icon={<Check size={11} />}
              label="Komme"
              activeClass="bg-emerald-700/60 text-emerald-300 border-emerald-700/50"
            />
            <RsvpButton
              active={s.rsvp === 'maybe'}
              loading={isSaving}
              onClick={() => onRSVP(s, 'maybe')}
              icon={<HelpCircle size={11} />}
              label="Unsicher"
              activeClass="bg-amber-700/60 text-amber-300 border-amber-700/50"
            />
            <RsvpButton
              active={s.rsvp === 'no'}
              loading={isSaving}
              onClick={() => onRSVP(s, 'no')}
              icon={<X size={11} />}
              label="Absage"
              activeClass="bg-rose-700/60 text-rose-300 border-rose-700/50"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function RsvpButton({
  active, loading, onClick, icon, label, activeClass,
}: {
  active: boolean;
  loading: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  activeClass: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-medium transition-all disabled:opacity-50 ${
        active
          ? activeClass
          : 'bg-gray-800/60 border-gray-700/40 text-gray-500 hover:text-gray-300 hover:border-gray-600'
      }`}
    >
      {icon}{label}
    </button>
  );
}
