import { useState, useEffect } from 'react';
import { CalendarDays, MapPin, Clock, Check, X, HelpCircle, Timer, RefreshCw } from 'lucide-react';
import {
  loadMySessions,
  submitAthleteOverride,
  clearAthleteOverride,
} from '../../lib/attendanceStorage';
import type { AttendanceSession } from '../../types/attendance';

interface Props {
  userId: string;
}

type RSVP = 'yes' | 'late' | 'maybe' | 'no';

interface SessionRow extends AttendanceSession {
  rsvp: RSVP;
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

export function AthleteCalendar({ userId }: Props) {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  async function load() {
    setLoading(true);
    const raw = await loadMySessions(userId);
    setSessions(
      raw
        .sort((a, b) => a.datum.localeCompare(b.datum))
        .map(s => ({ ...s, rsvp: 'yes' as RSVP }))
    );
    setLoading(false);
  }

  useEffect(() => { load(); }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const upcoming = sessions.filter(s => s.datum >= today);
  const past     = sessions.filter(s => s.datum <  today).reverse();

  async function handleRSVP(session: SessionRow, rsvp: RSVP) {
    if (saving === session.id) return;
    setSaving(session.id);
    if (rsvp === 'yes') {
      await clearAthleteOverride(session.id, userId);
    } else if (rsvp === 'late') {
      await submitAthleteOverride(session.id, userId, 'late');
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
        Einheiten werden geladen…
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="text-center py-16 space-y-3">
        <CalendarDays className="w-10 h-10 text-gray-700 mx-auto" />
        <div>
          <p className="text-gray-500 text-sm font-medium">Noch keine Einheiten</p>
          <p className="text-gray-700 text-xs mt-0.5">Tritt einem Team bei — dann erscheinen hier deine Trainingseinheiten.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">{upcoming.length} bevorstehende {upcoming.length === 1 ? 'Einheit' : 'Einheiten'}</p>
        <button onClick={load}
          className="p-1.5 rounded-lg text-gray-600 hover:text-gray-400 hover:bg-gray-800 transition-colors">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Upcoming */}
      {upcoming.length === 0
        ? <p className="text-gray-600 text-sm text-center py-4">Keine bevorstehenden Einheiten</p>
        : <div className="space-y-2.5">{upcoming.map(s => (
            <SessionCard key={s.id} session={s} today={today} saving={saving} onRSVP={handleRSVP} />
          ))}</div>
      }

      {/* Past */}
      {past.length > 0 && (
        <div>
          <button onClick={() => setShowPast(p => !p)}
            className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-400 transition-colors">
            <span className={`transition-transform duration-150 inline-block ${showPast ? 'rotate-90' : ''}`}>▶</span>
            {past.length} vergangene {past.length === 1 ? 'Einheit' : 'Einheiten'}
          </button>
          {showPast && (
            <div className="mt-2.5 space-y-2 opacity-55">
              {past.map(s => <SessionCard key={s.id} session={s} today={today} saving={saving} onRSVP={handleRSVP} past />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Session Card ──────────────────────────────────────────────────────────────

function SessionCard({ session: s, today, saving, onRSVP, past = false }: {
  session: SessionRow;
  today: string;
  saving: string | null;
  onRSVP: (s: SessionRow, r: RSVP) => void;
  past?: boolean;
}) {
  const isToday  = s.datum === today;
  const isSaving = saving === s.id;
  const dateObj  = new Date(s.datum + 'T12:00:00');
  const dateLabel = isToday
    ? 'Heute'
    : dateObj.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });

  const dotColor = TYPE_DOT[s.trainingType]  ?? TYPE_DOT.Sonstiges;
  const pill     = TYPE_PILL[s.trainingType] ?? TYPE_PILL.Sonstiges;

  const rsvpBg: Record<RSVP, string> = {
    yes:   'bg-emerald-950/30 border-emerald-800/40',
    late:  'bg-amber-950/30 border-amber-800/40',
    maybe: 'bg-gray-800/50 border-gray-700/40',
    no:    'bg-rose-950/30 border-rose-800/40',
  };

  return (
    <div className={`rounded-2xl border p-4 space-y-3 transition-colors ${
      isToday
        ? 'bg-violet-950/30 border-violet-800/50'
        : rsvpBg[s.rsvp]
    }`}>
      <div className="flex items-start gap-3">
        {/* Date */}
        <div className="flex-shrink-0 w-14 text-center">
          <p className={`text-[11px] font-semibold ${isToday ? 'text-violet-400' : 'text-gray-500'}`}>{dateLabel}</p>
          {!isToday && <p className="text-[10px] text-gray-700">{dateObj.toLocaleDateString('de-DE', { year: '2-digit' })}</p>}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
            <p className="text-sm font-semibold text-white">{s.title}</p>
            {s.trainingType && (
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${pill}`}>{s.trainingType}</span>
            )}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
            {(s.startTime || s.endTime) && (
              <span className="flex items-center gap-1 text-[11px] text-gray-500">
                <Clock size={10} />{s.startTime}{s.endTime ? `–${s.endTime}` : ''}
              </span>
            )}
            {s.location && (
              <span className="flex items-center gap-1 text-[11px] text-gray-500">
                <MapPin size={10} />{s.location}
              </span>
            )}
          </div>
          {s.coachNote && <p className="text-[11px] text-gray-600 italic">"{s.coachNote}"</p>}
        </div>

        {/* Current RSVP badge */}
        {!past && <RsvpBadge rsvp={s.rsvp} />}
      </div>

      {/* RSVP buttons — upcoming only */}
      {!past && (
        <div className="flex gap-1.5 flex-wrap pt-0.5">
          <RsvpBtn active={s.rsvp === 'yes'}   loading={isSaving} onClick={() => onRSVP(s, 'yes')}
            icon={<Check size={11} />} label="Komme"      activeClass="bg-emerald-700/60 text-emerald-200 border-emerald-600/50" />
          <RsvpBtn active={s.rsvp === 'late'}  loading={isSaving} onClick={() => onRSVP(s, 'late')}
            icon={<Timer size={11} />} label="Verspätet"  activeClass="bg-amber-700/60 text-amber-200 border-amber-600/50" />
          <RsvpBtn active={s.rsvp === 'maybe'} loading={isSaving} onClick={() => onRSVP(s, 'maybe')}
            icon={<HelpCircle size={11} />} label="Unsicher" activeClass="bg-gray-600/60 text-gray-200 border-gray-500/50" />
          <RsvpBtn active={s.rsvp === 'no'}    loading={isSaving} onClick={() => onRSVP(s, 'no')}
            icon={<X size={11} />} label="Absage"      activeClass="bg-rose-700/60 text-rose-200 border-rose-600/50" />
        </div>
      )}
    </div>
  );
}

function RsvpBadge({ rsvp }: { rsvp: RSVP }) {
  const cfg: Record<RSVP, { label: string; cls: string }> = {
    yes:   { label: '✓ Dabei',      cls: 'text-emerald-400 bg-emerald-900/30' },
    late:  { label: '⏱ Verspätet', cls: 'text-amber-400 bg-amber-900/30' },
    maybe: { label: '? Unsicher',   cls: 'text-gray-400 bg-gray-800' },
    no:    { label: '✕ Absage',     cls: 'text-rose-400 bg-rose-900/30' },
  };
  const { label, cls } = cfg[rsvp];
  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${cls}`}>{label}</span>
  );
}

function RsvpBtn({ active, loading, onClick, icon, label, activeClass }: {
  active: boolean; loading: boolean; onClick: () => void;
  icon: React.ReactNode; label: string; activeClass: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-[11px] font-medium transition-all disabled:opacity-50 ${
        active
          ? activeClass
          : 'bg-gray-800/60 border-gray-700/40 text-gray-500 hover:text-gray-300 hover:border-gray-600'
      }`}
    >
      {icon}{label}
    </button>
  );
}
