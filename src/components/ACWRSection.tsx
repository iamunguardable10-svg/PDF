import { useMemo, useState, useEffect, useRef, useCallback } from 'react';

/** Animates a number from 0 to target over ~600ms */
function useAnimatedNumber(target: number | null): number | null {
  const [display, setDisplay] = useState<number | null>(null);
  const rafRef = useRef<number>(0);
  const animate = useCallback(() => {
    if (target === null) { setDisplay(null); return; }
    const start = performance.now();
    const duration = 600;
    const from = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const ease = 1 - Math.pow(1 - t, 3); // ease-out-cubic
      setDisplay(Math.round(from + (target - from) * ease));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [target]);
  useEffect(() => {
    animate();
    return () => cancelAnimationFrame(rafRef.current);
  }, [animate]);
  return display;
}
import type { Session, PlannedSession, DayLoad } from '../types/acwr';
import { TE_COLORS } from '../types/acwr';
import { calculateACWR, calculateEWMA, aggregateDailyLoads, getCurrentACWR, getACWRZoneLabel, projectFutureACWR, calculateStrainMonotony } from '../lib/acwrCalculations';
import { CLOUD_ENABLED } from '../lib/supabase';
import { encodeShareData, createLiveShare, revokeLiveShare, getActiveShare } from '../lib/trainerShare';
import {
  requestNotificationPermission, getNotificationPermission,
  scheduleSessionReminder, cancelReminder, sendTestNotification,
} from '../lib/notifications';
import { loadMySessions } from '../lib/attendanceStorage';
import type { AttendanceSession } from '../types/attendance';
import type { TrainingUnit } from '../types/acwr';
import { ACWRChart } from './ACWRChart';
import { ACWRForecast } from './ACWRForecast';
import { SessionForm } from './SessionForm';
import { TrainerPlanUpload } from './TrainerPlanUpload';
import { PendingSessions } from './PendingSessions';
import { TrainingOverview } from './TrainingOverview';

interface Props {
  sessions: Session[];
  plannedSessions: PlannedSession[];
  onAddSession: (s: Session) => void;
  onAddPlanned: (sessions: PlannedSession[]) => void;
  onConfirmPlanned: (id: string, rpe: number, dauer: number) => void;
  onUpdatePlanned: (id: string, updates: Partial<PlannedSession>) => void;
  onDismissPlanned: (id: string) => void;
  onDeleteSession?: (id: string) => void;
  onEditSession?: (id: string, rpe: number, dauer: number) => void;
  onSessionConfirmed?: () => void;
  onLoadMockData?: () => void;
  playerName: string;
  playerSport?: string;
  userId?: string;
}

export function ACWRSection({
  sessions, plannedSessions, onAddSession, onAddPlanned,
  onConfirmPlanned, onUpdatePlanned, onDismissPlanned,
  onDeleteSession, onEditSession,
  onSessionConfirmed, onLoadMockData, playerName, playerSport = 'Sport', userId,
}: Props) {
  const [showForm, setShowForm] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [shareToast, setShareToast] = useState<'copied' | 'error' | null>(null);
  const [calendarJumpDate, setCalendarJumpDate] = useState<string | undefined>();
  const [activeToken, setActiveToken] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const notifPerm = getNotificationPermission();

  // Reminder-Timeouts: id → timeoutId
  const reminderTimeouts = useRef<Map<string, number>>(new Map());

  const [chartMethod, setChartMethod] = useState<'rolling' | 'ewma'>('rolling');

  // Attendance sessions + records — trainer-created sessions shown in personal calendar
  const [attendanceSessions, setAttendanceSessions] = useState<AttendanceSession[]>([]);
  const [attendanceCancelledIds, setAttendanceCancelledIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!userId || !CLOUD_ENABLED) return;
    let cancelled = false;
    Promise.all([
      loadMySessions(userId),
      import('../lib/attendanceStorage').then(m => m.loadMyRecords(userId)),
    ]).then(([ss, records]) => {
      if (cancelled) return;
      setAttendanceSessions(ss);
      setAttendanceCancelledIds(new Set(
        records.filter(r => r.overrideStatus === 'no').map(r => r.sessionId),
      ));
    });
    return () => { cancelled = true; };
  }, [userId]);

  // Map AttendanceTrainingType → TrainingUnit for the personal calendar
  const ATT_TE_MAP: Record<string, TrainingUnit> = {
    Training: 'Team', Spiel: 'Spiel', Wettkampf: 'Spiel',
    'S&C': 'S&C', Taktik: 'Team', Videoanalyse: 'Team',
    Regeneration: 'Prävention', Sonstiges: 'Team',
  };

  // Derive planned sessions — excludes cancelled + already confirmed
  const attendancePlanned = useMemo((): PlannedSession[] => {
    const today = new Date().toISOString().split('T')[0];
    return attendanceSessions
      .filter(s => s.datum >= today)
      .filter(s => !attendanceCancelledIds.has(s.id))
      .filter(s => !sessions.some(rs => rs.id === `confirmed-att_${s.id}`))
      .map(s => {
        const te: TrainingUnit = s.trainingType ? (ATT_TE_MAP[s.trainingType] ?? 'Team') : 'Team';
        let dauer = 90;
        if (s.startTime && s.endTime) {
          const [sh, sm] = s.startTime.split(':').map(Number);
          const [eh, em] = s.endTime.split(':').map(Number);
          dauer = Math.max(30, (eh * 60 + em) - (sh * 60 + sm));
        }
        return {
          id: `att_${s.id}`,
          datum: s.datum,
          te,
          uhrzeit: s.startTime,
          geschaetzteDauer: dauer,
          notiz: s.title + (s.location ? ` · ${s.location}` : ''),
          reminderScheduled: false,
          confirmed: false,
        };
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attendanceSessions, attendanceCancelledIds, sessions]);

  const allPlannedSessions = useMemo(
    () => [...plannedSessions, ...attendancePlanned],
    [plannedSessions, attendancePlanned],
  );

  const acwrData      = useMemo(() => calculateACWR(sessions), [sessions]);
  const ewmaData      = useMemo(() => calculateEWMA(sessions), [sessions]);
  // Use allPlannedSessions so attendance sessions are included in the ACWR forecast
  const projectedData = useMemo(() => projectFutureACWR(sessions, allPlannedSessions), [sessions, allPlannedSessions]);
  const dailyLoads    = useMemo(() => aggregateDailyLoads(sessions), [sessions]);
  const activeACWRData = chartMethod === 'ewma' ? ewmaData : acwrData;
  const current       = useMemo(() => getCurrentACWR(activeACWRData), [activeACWRData]);
  const acwr       = current?.acwr ?? null;
  const zone       = acwr !== null ? getACWRZoneLabel(acwr) : null;
  const strainMonotony = useMemo(() => calculateStrainMonotony(dailyLoads), [dailyLoads]);

  // Animated numbers for ACWR display
  const animatedAcute   = useAnimatedNumber(current?.acuteLoad ?? null);
  const animatedChronic = useAnimatedNumber(current?.chronicLoad ?? null);

  const last7Days = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    return sessions.filter(s => new Date(s.datum) >= cutoff);
  }, [sessions]);
  const weeklyLoad = last7Days.reduce((sum, s) => sum + s.tl, 0);

  // Pending sessions mit Erinnerung aktivieren wenn Permission vorhanden
  useEffect(() => {
    if (notifPerm !== 'granted') return;
    for (const ps of plannedSessions) {
      if (!ps.confirmed && ps.reminderScheduled && !reminderTimeouts.current.has(ps.id)) {
        const tid = scheduleSessionReminder(ps, (id) => {
          // Hebt die Sektion hervor (z.B. via State)
          console.log('Reminder clicked for', id);
        });
        if (tid !== null) reminderTimeouts.current.set(ps.id, tid);
      }
    }
    return () => {};
  }, [plannedSessions, notifPerm]);

  const handleRequestNotifications = async () => {
    const granted = await requestNotificationPermission();
    if (granted) sendTestNotification();
  };

  const handleScheduleReminder = (id: string) => {
    const ps = plannedSessions.find(s => s.id === id);
    if (!ps) return;
    if (notifPerm !== 'granted') {
      requestNotificationPermission().then(granted => {
        if (!granted) return;
        const tid = scheduleSessionReminder(ps, () => {});
        if (tid !== null) reminderTimeouts.current.set(id, tid);
        onUpdatePlanned(id, { reminderScheduled: true });
      });
    } else {
      const tid = scheduleSessionReminder(ps, () => {});
      if (tid !== null) reminderTimeouts.current.set(id, tid);
      onUpdatePlanned(id, { reminderScheduled: true });
    }
  };

  const handleDismiss = (id: string) => {
    const tid = reminderTimeouts.current.get(id);
    if (tid !== undefined) { cancelReminder(tid); reminderTimeouts.current.delete(id); }
    onDismissPlanned(id);
  };

  function formatDate(datum: string) {
    const [y, m, d] = datum.split('-');
    return `${d}.${m}.${y.slice(2)}`;
  }

  // Load existing active share on mount
  useEffect(() => {
    if (userId && CLOUD_ENABLED) {
      getActiveShare(userId).then(token => setActiveToken(token));
    }
  }, [userId]);

  function buildShareUrl(token: string) {
    return `${window.location.origin}${window.location.pathname}#trainer/${token}`;
  }

  function copyToClipboard(url: string) {
    navigator.clipboard.writeText(url).then(() => {
      setShareToast('copied');
      setTimeout(() => setShareToast(null), 2500);
    }).catch(() => {
      setShareToast('error');
      setTimeout(() => setShareToast(null), 2500);
    });
  }

  async function handleCreateLiveShare() {
    if (!userId || sessions.length === 0) return;
    setShareLoading(true);
    const token = await createLiveShare(userId);
    setShareLoading(false);
    if (!token) { setShareToast('error'); setTimeout(() => setShareToast(null), 2500); return; }
    setActiveToken(token);
    copyToClipboard(buildShareUrl(token));
  }

  async function handleRevokeShare() {
    if (!activeToken) return;
    await revokeLiveShare(activeToken);
    setActiveToken(null);
  }

  function handleGenerateTrainerLink() {
    // Fallback: legacy base64 link (guest mode / no cloud)
    if (sessions.length === 0) return;
    const encoded = encodeShareData(playerName, playerSport, acwrData, plannedSessions, sessions);
    if (!encoded) { setShareToast('error'); setTimeout(() => setShareToast(null), 2500); return; }
    copyToClipboard(`${window.location.origin}${window.location.pathname}#trainer/${encoded}`);
  }

  const recentDays: DayLoad[] = [...dailyLoads]
    .sort((a, b) => b.datum.localeCompare(a.datum))
    .slice(0, 14);

  const pendingCount = plannedSessions.filter(s => !s.confirmed).length;

  const [showInfo, setShowInfo] = useState(false);

  return (
    <div className="space-y-4">

      {/* ACWR Info */}
      <div className="bg-gray-900/50 rounded-2xl border border-gray-800 overflow-hidden">
        <button
          onClick={() => setShowInfo(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-900/40 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm">ℹ️</span>
            <span className="text-sm font-medium text-gray-300">Kennzahlen erklärt</span>
          </div>
          <span className="text-gray-600 text-xs">{showInfo ? '▲' : '▼'}</span>
        </button>
        {showInfo && (
          <div className="px-4 pb-4 space-y-3 border-t border-gray-800 pt-3">
            <p className="text-sm text-gray-400 leading-relaxed">
              Der <span className="text-white font-semibold">Acute:Chronic Workload Ratio (ACWR)</span> misst das Verhältnis zwischen kurzfristiger und langfristiger Trainingsbelastung. Er zeigt, ob du gerade mehr trainierst als dein Körper gewohnt ist.
            </p>
            <div className="grid grid-cols-1 gap-2 text-xs">
              <div className="bg-gray-800/60 rounded-xl p-3 space-y-2">
                <div>
                  <div className="font-semibold text-white mb-1">Formel</div>
                  <div className="text-gray-400">ACWR = Acute Load ÷ Chronic Load</div>
                  <div className="text-gray-500 mt-1">Trainingsbelastung (TL) = RPE × Dauer in Minuten</div>
                </div>
                <div className="border-t border-gray-700 pt-2 space-y-1">
                  <div className="font-semibold text-white">Rolling Average (gleitender Durchschnitt)</div>
                  <div className="text-gray-400"><span className="text-sky-400 font-medium">Acute Load (7d):</span> Ø tägliche Belastung der letzten 7 Tage — zeigt die aktuelle Trainingsintensität.</div>
                  <div className="text-gray-400"><span className="text-gray-300 font-medium">Chronic Load (28d):</span> Ø tägliche Belastung der letzten 28 Tage — zeigt die gewohnte Belastungskapazität.</div>
                  <div className="text-gray-500 mt-1">Ruhetage zählen als 0 und senken den Durchschnitt — so wird Detraining korrekt abgebildet.</div>
                </div>
                <div className="border-t border-gray-700 pt-2 space-y-1">
                  <div className="font-semibold text-white">EWMA <span className="text-xs font-normal text-gray-500">(Exponentially Weighted Moving Average)</span></div>
                  <div className="text-gray-400">Jüngere Tage werden stärker gewichtet als weiter zurückliegende — das Modell reagiert schneller auf Belastungsspitzen.</div>
                  <div className="text-gray-500 mt-1">
                    Gewichtungsfaktor: <span className="text-gray-300 font-mono">λ_acute = 0.25</span> (7d) · <span className="text-gray-300 font-mono">λ_chronic ≈ 0.07</span> (28d).
                    Geeignet wenn kurzfristige Veränderungen früh erkannt werden sollen.
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-blue-900/20 border border-blue-800/40 rounded-xl p-2.5 text-center">
                  <div className="text-blue-400 font-bold text-sm">&lt; 0.8</div>
                  <div className="text-gray-400 mt-0.5">Unterbelastung</div>
                  <div className="text-gray-500 text-xs mt-0.5">Verletzungsrisiko durch mangelnde Fitness</div>
                </div>
                <div className="bg-green-900/20 border border-green-800/40 rounded-xl p-2.5 text-center">
                  <div className="text-green-400 font-bold text-sm">0.8 – 1.3</div>
                  <div className="text-gray-400 mt-0.5">Optimal</div>
                  <div className="text-gray-500 text-xs mt-0.5">Trainingsreiz ohne Überbelastung</div>
                </div>
                <div className="bg-red-900/20 border border-red-800/40 rounded-xl p-2.5 text-center">
                  <div className="text-red-400 font-bold text-sm">&gt; 1.3</div>
                  <div className="text-gray-400 mt-0.5">Überbelastung</div>
                  <div className="text-gray-500 text-xs mt-0.5">Erhöhtes Verletzungsrisiko</div>
                </div>
              </div>
              <div className="border-t border-gray-700 pt-2 space-y-1">
                <div className="font-semibold text-white">Monotonie & Training Strain</div>
                <div className="text-gray-400">
                  <span className="text-gray-300 font-medium">Monotonie</span> = Mittlere Tageslast ÷ Standardabweichung (letzte 7 Tage).
                  Werte unter 1.5 zeigen gute Variation; über 2.0 ist die Belastung zu gleichförmig — Risiko für Übertraining steigt.
                </div>
                <div className="text-gray-400 mt-1">
                  <span className="text-gray-300 font-medium">Training Strain</span> = Wochenlast × Monotonie (Foster 1998).
                  Kombiniert Volumen und Eintönigkeit. Unter 3.000 moderat, über 6.000 kritisch.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Trainingsübersicht — includes attendance sessions as planned (att_ prefix) */}
      <TrainingOverview
        sessions={sessions}
        plannedSessions={allPlannedSessions}
        onConfirmPlanned={(id, rpe, dauer) => {
          if (id.startsWith('att_')) {
            // Attendance session confirmed with RPE → add as real session
            const ps = attendancePlanned.find(s => s.id === id);
            if (ps) {
              onAddSession({
                id: `confirmed-att_${id.slice(4)}`,
                name: playerName,
                datum: ps.datum,
                te: ps.te,
                rpe, dauer, tl: rpe * dauer,
              });
              onSessionConfirmed?.();
            }
          } else {
            onConfirmPlanned(id, rpe, dauer);
            onSessionConfirmed?.();
          }
        }}
        onUpdatePlanned={(id, updates) => { if (!id.startsWith('att_')) onUpdatePlanned(id, updates); }}
        onDismissPlanned={id => { if (!id.startsWith('att_')) handleDismiss(id); }}
        onAddPlanned={onAddPlanned}
        onAddSessionDirect={s => { onAddSession(s); onSessionConfirmed?.(); }}
        onDeleteSession={onDeleteSession}
        onEditSession={onEditSession}
        jumpToDate={calendarJumpDate}
        sport={playerSport}
      />

      {/* Trainer-Plan Import */}
      <TrainerPlanUpload
        onSessionsAdded={sessions => {
          onAddPlanned(sessions);
          // Auto-navigate calendar to first imported session
          const first = sessions.sort((a, b) => a.datum.localeCompare(b.datum))[0];
          if (first) setCalendarJumpDate(first.datum + '-' + Date.now()); // suffix forces re-trigger
        }}
      />

      {/* Ausstehende Sessions */}
      {pendingCount > 0 && (
        <PendingSessions
          planned={plannedSessions}
          onConfirm={(id, rpe, dauer) => { onConfirmPlanned(id, rpe, dauer); onSessionConfirmed?.(); }}
          onScheduleReminder={handleScheduleReminder}
          onDismiss={handleDismiss}
        />
      )}

      {/* Toast */}
      {shareToast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl text-sm font-medium shadow-xl border transition-all ${
          shareToast === 'copied'
            ? 'bg-green-900/90 border-green-700 text-green-200'
            : 'bg-red-900/90 border-red-700 text-red-200'
        }`}>
          {shareToast === 'copied' ? '✓ Trainer-Link in Zwischenablage kopiert' : '✕ Link konnte nicht erstellt werden'}
        </div>
      )}

      {/* ACWR Status */}
      <div className="bg-gray-900/50 rounded-3xl p-6 border border-gray-800">
        <div className="flex flex-wrap items-center justify-between gap-y-2 mb-5">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-2xl shrink-0">📊</span>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-white truncate">ACWR · {playerName}</h2>
              <p className="text-sm text-gray-400">Acute:Chronic Workload Ratio</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {/* Trainer-Link */}
            {sessions.length > 0 && (
              CLOUD_ENABLED && userId ? (
                activeToken ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-green-400 flex items-center gap-1 shrink-0">
                      <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse inline-block" />
                      Live-Link aktiv
                    </span>
                    <button
                      onClick={() => copyToClipboard(buildShareUrl(activeToken))}
                      className="text-xs px-2 py-1 rounded-lg border border-gray-700 text-gray-400 hover:text-white transition-colors"
                    >
                      Kopieren
                    </button>
                    <button
                      onClick={handleRevokeShare}
                      className="text-xs px-2 py-1 rounded-lg border border-red-900/60 text-red-500 hover:text-red-300 transition-colors"
                    >
                      Widerrufen
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleCreateLiveShare}
                    disabled={shareLoading}
                    className="text-xs px-3 py-1.5 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    🔗 {shareLoading ? '…' : 'Live-Link erstellen'}
                  </button>
                )
              ) : (
                <button
                  onClick={handleGenerateTrainerLink}
                  className="text-xs px-3 py-1.5 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors flex items-center gap-1.5"
                >
                  🔗 Trainer-Link
                </button>
              )
            )}
            {/* Benachrichtigungs-Button */}
            {notifPerm !== 'granted' && notifPerm !== 'unsupported' && (
              <button
                onClick={handleRequestNotifications}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors flex items-center gap-1.5"
              >
                🔔 Erinnerungen aktivieren
              </button>
            )}
            {notifPerm === 'granted' && (
              <span className="text-xs text-green-400 flex items-center gap-1">🔔✓ Aktiv</span>
            )}
            <button
              onClick={() => setShowForm(f => !f)}
              className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
            >
              {showForm ? '✕' : '+ Manuell'}
            </button>
          </div>
        </div>

        {/* Manuelles Formular */}
        {showForm && (
          <div className="mb-5 p-4 bg-gray-900 rounded-2xl border border-gray-700">
            <SessionForm playerName={playerName} onAdd={s => { onAddSession(s); setShowForm(false); }} />
          </div>
        )}

        {sessions.length === 0 && (
          <div className="text-center py-8 text-gray-600 space-y-3">
            <div className="text-3xl">📋</div>
            <p className="text-sm">Noch keine Sessions – Trainer-Plan importieren oder manuell eintragen.</p>
            {onLoadMockData && (
              <button
                onClick={onLoadMockData}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-700 text-xs text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
              >
                🧪 Testdaten laden (4 Wochen)
              </button>
            )}
          </div>
        )}


        {/* ACWR Gauge */}
        {acwr !== null && zone && (
          <div className="mb-5 space-y-3">
            {/* Hauptanzeige: Wert + Zone */}
            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-2xl flex flex-col items-center justify-center shrink-0 border border-gray-700"
                style={{ backgroundColor: zone.color + '22' }}
              >
                <span className="text-xl font-black leading-none" style={{ color: zone.color }}>
                  {acwr.toFixed(2)}
                </span>
                <span className="text-xs text-gray-400 mt-0.5">ACWR</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-white text-sm">{zone.label}</div>
                <div className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                  {acwr < 0.8 && 'Zu wenig Belastung – Risiko durch Unterbelastung.'}
                  {acwr >= 0.8 && acwr <= 1.3 && 'Optimale Zone – gute Balance zwischen Belastung und Erholung.'}
                  {acwr > 1.3 && 'Achtung! Überbelastung – erhöhtes Verletzungsrisiko.'}
                </div>
              </div>
            </div>

            {/* Horizontale Gauge-Leiste — scale 0 to 2.0 */}
            {(() => {
              // Map ACWR 0–2 linearly to 0–100%
              const toP = (v: number) => `${(v / 2) * 100}%`;
              const clampedACWR = Math.max(0, Math.min(2, acwr));
              const markerPct = (clampedACWR / 2) * 100;
              return (
                <>
                  <div className="relative h-5">
                    <div className="absolute inset-0 rounded-full overflow-hidden"
                      style={{ background: 'linear-gradient(to right, #60a5fa 0%, #60a5fa 36%, #4ade80 44%, #4ade80 61%, #f87171 69%, #f87171 100%)' }}
                    />
                    {/* Zone dividers */}
                    {[0.8, 1.3].map(v => (
                      <div key={v} className="absolute top-0 bottom-0 w-px bg-gray-900/50"
                        style={{ left: toP(v) }} />
                    ))}
                    {/* Marker */}
                    <div className="absolute top-0 bottom-0 flex items-center"
                      style={{ left: `${markerPct}%`, transform: 'translateX(-50%)' }}>
                      <div className="w-3 h-3 bg-white rounded-full border-2 border-gray-900 shadow-lg" />
                    </div>
                  </div>
                  {/* Scale labels — positioned absolutely to match values */}
                  <div className="relative h-4 -mt-0.5">
                    {([0, 0.8, 1.3, 2.0] as const).map(v => (
                      <span key={v}
                        className={`absolute text-xs transform -translate-x-1/2 ${
                          v === 0.8 ? 'text-blue-400' : v === 1.3 ? 'text-red-400' : 'text-gray-500'
                        }`}
                        style={{ left: toP(v) }}>
                        {v}
                      </span>
                    ))}
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* Kennzahlen: Acute vs Chronic Load */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {/* Acute Load */}
          <div className="bg-gray-900 rounded-2xl p-3.5 border border-gray-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500">Acute Load</span>
              <span className="text-xs text-gray-600">7d Ø</span>
            </div>
            <div className="text-xl font-bold text-blue-400">
              {animatedAcute ?? '—'}
              <span className="text-xs font-normal text-gray-500 ml-1">AU</span>
            </div>
            <div className="mt-2 h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-blue-400 rounded-full gauge-fill"
                style={{ width: `${Math.min(100, ((current?.acuteLoad ?? 0) / 1500) * 100)}%` }} />
            </div>
          </div>

          {/* Chronic Load */}
          <div className="bg-gray-900 rounded-2xl p-3.5 border border-gray-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500">Chronic Load</span>
              <span className="text-xs text-gray-600">28d Ø</span>
            </div>
            <div className="text-xl font-bold text-amber-400">
              {animatedChronic ?? '—'}
              <span className="text-xs font-normal text-gray-500 ml-1">AU</span>
            </div>
            <div className="mt-2 h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-amber-400 rounded-full gauge-fill"
                style={{ width: `${Math.min(100, ((current?.chronicLoad ?? 0) / 1500) * 100)}%` }} />
            </div>
          </div>
        </div>

        {/* Wöchentlicher Load + Empfehlung */}
        {(() => {
          const chronic = current?.chronicLoad ?? 0;
          const optMin = Math.round(chronic * 7 * 0.8);
          const optMax = Math.round(chronic * 7 * 1.3);
          const remaining = optMax - weeklyLoad;
          const pct = optMax > 0 ? Math.min(100, (weeklyLoad / optMax) * 100) : 0;
          const minPct = optMax > 0 ? Math.min(100, (optMin / optMax) * 100) : 0;
          const barColor = weeklyLoad < optMin
            ? '#60a5fa'
            : weeklyLoad <= optMax
            ? '#4ade80'
            : '#f87171';
          return (
            <div className="bg-gray-900 rounded-2xl p-3.5 border border-gray-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-gray-500 mb-0.5">Wochenload</div>
                  <div className="text-xl font-bold" style={{ color: barColor }}>
                    {weeklyLoad}
                    <span className="text-xs font-normal text-gray-500 ml-1">AU</span>
                  </div>
                </div>
                {chronic > 0 && (
                  <div className="text-right">
                    <div className="text-xs text-gray-500 mb-0.5">Zielkorridor</div>
                    <div className="text-sm font-semibold text-gray-300">
                      {optMin}–{optMax} <span className="text-xs font-normal text-gray-500">AU</span>
                    </div>
                  </div>
                )}
              </div>
              {chronic > 0 && (
                <>
                  <div className="relative h-2.5 bg-gray-800 rounded-full overflow-hidden">
                    <div className="absolute top-0 bottom-0 bg-green-900/50 rounded-full"
                      style={{ left: `${minPct}%`, right: '0%' }} />
                    <div className="absolute top-0 bottom-0 left-0 rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: barColor }} />
                    <div className="absolute top-0 bottom-0 w-0.5 bg-green-500/60"
                      style={{ left: `${minPct}%` }} />
                  </div>
                  <div className="text-xs text-gray-500">
                    {weeklyLoad < optMin && (
                      <span className="text-blue-400">
                        Noch <span className="font-semibold">{optMin - weeklyLoad} AU</span> bis Optimal-Zone
                      </span>
                    )}
                    {weeklyLoad >= optMin && weeklyLoad <= optMax && (
                      <span className="text-green-400">
                        ✓ Optimal-Zone · noch <span className="font-semibold">{remaining} AU</span> Spielraum
                      </span>
                    )}
                    {weeklyLoad > optMax && (
                      <span className="text-red-400">
                        ⚠ {weeklyLoad - optMax} AU über Limit – mehr Erholung empfohlen
                      </span>
                    )}
                  </div>
                </>
              )}
              <div className="border-t border-gray-800 pt-2 text-xs text-gray-600 leading-relaxed">
                Summe aller Trainingsloads (RPE × Dauer) der letzten 7 Tage.
                {chronic > 0 && <> Zielkorridor = Chronic Load × 7 × 0.8–1.3 (optimale ACWR-Zone).</>}
              </div>
            </div>
          );
        })()}

        {/* Monotony & Strain — eigene Karte, klar getrennt vom Wochenload */}
        {sessions.length > 0 && strainMonotony.weeklyLoad > 0 && (
          <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
            <div className="grid grid-cols-2 divide-x divide-gray-800">
              <div className="p-3.5 space-y-1">
                <div className="text-xs text-gray-500">Monotonie</div>
                <div className={`text-xl font-bold ${
                  strainMonotony.monotony < 1.5 ? 'text-green-400'
                  : strainMonotony.monotony < 2 ? 'text-amber-400'
                  : 'text-red-400'
                }`}>
                  {strainMonotony.monotony.toFixed(2)}
                </div>
                <div className="text-xs leading-tight" style={{ color: strainMonotony.monotony < 1.5 ? '#4ade80' : strainMonotony.monotony < 2 ? '#fb923c' : '#f87171' }}>
                  {strainMonotony.monotony < 1.5 ? 'Gute Variation'
                  : strainMonotony.monotony < 2 ? 'Wenig Variation'
                  : 'Zu eintönig'}
                </div>
              </div>
              <div className="p-3.5 space-y-1">
                <div className="text-xs text-gray-500">Training Strain</div>
                <div className={`text-xl font-bold ${
                  strainMonotony.strain < 3000 ? 'text-green-400'
                  : strainMonotony.strain < 6000 ? 'text-amber-400'
                  : 'text-red-400'
                }`}>
                  {strainMonotony.strain}
                </div>
                <div className="text-xs leading-tight" style={{ color: strainMonotony.strain < 3000 ? '#4ade80' : strainMonotony.strain < 6000 ? '#fb923c' : '#f87171' }}>
                  {strainMonotony.strain < 3000 ? 'Moderat'
                  : strainMonotony.strain < 6000 ? 'Erhöht'
                  : 'Kritisch'}
                </div>
              </div>
            </div>
            <div className="border-t border-gray-800 px-3.5 py-2.5 text-xs text-gray-600 leading-relaxed">
              <span className="text-gray-500 font-medium">Monotonie</span> = Ø Tageslast ÷ Standardabweichung (7 Tage) — zeigt wie gleichförmig du trainierst. ·{' '}
              <span className="text-gray-500 font-medium">Training Strain</span> = Wochenlast × Monotonie — kombiniert Volumen und Eintönigkeit (Foster 1998).
            </div>
          </div>
        )}
      </div>

      {/* Chart */}
      {sessions.length > 0 && (
        <div className="bg-gray-900/50 rounded-3xl p-6 border border-gray-800">
          <h3 className="text-sm font-semibold text-white mb-4">ACWR Verlauf</h3>
          <ACWRChart data={acwrData} projectedData={projectedData} dailyLoads={dailyLoads} ewmaData={ewmaData} onMethodChange={setChartMethod} />
        </div>
      )}

      {/* ACWR Forecast */}
      {projectedData.length > 0 && current && (
        <ACWRForecast
          projected={projectedData}
          currentAcwr={acwr}
          currentAcute={current.acuteLoad}
          currentChronic={current.chronicLoad}
          plannedCount={plannedSessions.filter(ps => !ps.confirmed && ps.datum > new Date().toISOString().split('T')[0]).length}
        />
      )}

      {/* Session-Log */}
      {recentDays.length > 0 && (
        <div className="bg-gray-900/50 rounded-3xl border border-gray-800 overflow-hidden">
          <button
            onClick={() => setShowLog(l => !l)}
            className="w-full flex items-center justify-between p-5 hover:bg-gray-900/30 transition-colors"
          >
            <h3 className="text-sm font-semibold text-white">Tagesprotokolle (letzte 14 Tage)</h3>
            <span className="text-gray-500 text-sm">{showLog ? '▲' : '▼'}</span>
          </button>
          {showLog && (
            <div className="border-t border-gray-800 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    {['Datum','Team','S&C','Spiel','Indi','Sonstige','Tagesl.'].map(h => (
                      <th key={h} className={`py-2.5 text-xs text-gray-500 font-medium ${h === 'Datum' ? 'text-left px-4' : 'text-right px-3'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentDays.map(day => {
                    const acwrPt = acwrData.find(d => d.datum === day.datum);
                    const av = acwrPt?.acwr;
                    const zc = av == null ? '#6b7280' : av < 0.8 ? '#60a5fa' : av <= 1.3 ? '#4ade80' : '#f87171';
                    const sonstige = (day.loads['Aufwärmen']??0)+(day.loads['Schulsport']??0)+(day.loads['Prävention']??0);
                    return (
                      <tr key={day.datum} className="border-b border-gray-800/50 hover:bg-gray-900/40">
                        <td className="px-4 py-2.5 text-gray-300 font-mono text-xs">{formatDate(day.datum)}</td>
                        {(['Team','S&C','Spiel','Indi'] as const).map(te => (
                          <td key={te} className="text-right px-3 py-2.5 text-xs"
                            style={{ color: day.loads[te] ? TE_COLORS[te] : '#374151' }}>
                            {day.loads[te] ?? 0}
                          </td>
                        ))}
                        <td className="text-right px-3 py-2.5 text-xs text-gray-500">{sonstige}</td>
                        <td className="text-right px-4 py-2.5">
                          <span className="font-semibold text-xs" style={{ color: zc }}>{day.taeglLoad}</span>
                          {av != null && <span className="ml-1 text-xs" style={{ color: zc }}>({av.toFixed(2)})</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
