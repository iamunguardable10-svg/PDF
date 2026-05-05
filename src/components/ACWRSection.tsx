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
import { loadAthleteTeamRpeMap } from '../lib/rpeRecordHydration';
import type { AthleteTeamRpeMap } from '../lib/rpeRecordHydration';
import { buildAthleteAcwrSessions, mapAttendanceTrainingTypeToTrainingUnit } from '../lib/athleteLoadSources';
import type { AttendanceSession } from '../types/attendance';
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
  const [teamRpeMap, setTeamRpeMap] = useState<AthleteTeamRpeMap>(() => new Map());

  useEffect(() => {
    if (!userId || !CLOUD_ENABLED) return;
    let cancelled = false;
    Promise.all([
      loadMySessions(userId),
      import('../lib/attendanceStorage').then(m => m.loadMyRecords(userId)),
      loadAthleteTeamRpeMap(userId),
    ]).then(([ss, records, rpeMap]) => {
      if (cancelled) return;
      setAttendanceSessions(ss);
      setTeamRpeMap(rpeMap);
      setAttendanceCancelledIds(new Set(
        records.filter(r => r.overrideStatus === 'no').map(r => r.sessionId),
      ));
    });
    return () => { cancelled = true; };
  }, [userId]);

  // Derive planned sessions — excludes cancelled + already confirmed
  const attendancePlanned = useMemo((): PlannedSession[] => {
    const today = new Date().toISOString().split('T')[0];
    return attendanceSessions
      .filter(s => s.datum >= today)
      .filter(s => !attendanceCancelledIds.has(s.id))
      .filter(s => !sessions.some(rs => rs.id === `confirmed-att_${s.id}`))
      .map(s => {
        const te = mapAttendanceTrainingTypeToTrainingUnit(s.trainingType);
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

  const acwrSessions = useMemo(() => buildAthleteAcwrSessions({
    sessions,
    attendanceSessions,
    teamRpeMap,
    playerName,
  }), [sessions, attendanceSessions, teamRpeMap, playerName]);

  const acwrData      = useMemo(() => calculateACWR(acwrSessions), [acwrSessions]);
  const ewmaData      = useMemo(() => calculateEWMA(acwrSessions), [acwrSessions]);
  // Use allPlannedSessions so attendance sessions are included in the ACWR forecast
  const projectedData = useMemo(() => projectFutureACWR(acwrSessions, allPlannedSessions), [acwrSessions, allPlannedSessions]);
  const dailyLoads    = useMemo(() => aggregateDailyLoads(acwrSessions), [acwrSessions]);
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
    return acwrSessions.filter(s => new Date(s.datum) >= cutoff);
  }, [acwrSessions]);
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
    if (!userId || acwrSessions.length === 0) return;
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
    if (acwrSessions.length === 0) return;
    const encoded = encodeShareData(playerName, playerSport, acwrData, plannedSessions, acwrSessions);
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
            {acwrSessions.length > 0 && (
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
            <p className="text-sm">Noch keine Trainingsdaten vorhanden</p>
            {onLoadMockData && (
              <button
                onClick={onLoadMockData}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm font-medium transition-colors"
              >
                Beispieldaten laden
              </button>
            )}
          </div>
        )}

        {current && zone && (
          <>
            {/* Hauptmetrik */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className={`col-span-2 p-5 rounded-2xl border ${zone.bg} ${zone.color.replace('text-', 'border-')}/30`}>
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Aktueller ACWR</div>
                    <div className={`text-5xl font-bold ${zone.color}`}>{acwr?.toFixed(2)}</div>
                    <div className={`text-sm font-medium mt-1 ${zone.color}`}>{zone.label}</div>
                  </div>
                  <div className="text-right text-xs text-gray-500 max-w-[160px]">
                    <div className="mb-1">Methode: <span className="text-gray-300">{chartMethod === 'ewma' ? 'EWMA' : 'Rolling'}</span></div>
                    <button
                      onClick={() => setChartMethod(m => m === 'ewma' ? 'rolling' : 'ewma')}
                      className="px-2 py-1 rounded-lg bg-gray-800 text-gray-400 hover:text-white transition-colors"
                    >
                      Wechseln
                    </button>
                  </div>
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-gray-900 border border-gray-800">
                <div className="text-xs text-gray-500 mb-1">Acute Load</div>
                <div className="text-2xl font-bold text-white">{animatedAcute}</div>
                <div className="text-xs text-gray-600">7 Tage Ø</div>
              </div>
              <div className="p-4 rounded-2xl bg-gray-900 border border-gray-800">
                <div className="text-xs text-gray-500 mb-1">Chronic Load</div>
                <div className="text-2xl font-bold text-white">{animatedChronic}</div>
                <div className="text-xs text-gray-600">28 Tage Ø</div>
              </div>
            </div>

            {/* Zone-Erklärung */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[
                { label: 'Unterbelastung', range: '< 0.8', active: acwr! < 0.8, color: 'blue' },
                { label: 'Optimal', range: '0.8–1.3', active: acwr! >= 0.8 && acwr! <= 1.3, color: 'green' },
                { label: 'Überlastung', range: '> 1.3', active: acwr! > 1.3, color: 'red' },
              ].map(z => (
                <div key={z.label} className={`p-3 rounded-xl text-center border transition-all ${
                  z.active
                    ? z.color === 'green' ? 'bg-green-500/20 border-green-500/50'
                    : z.color === 'red' ? 'bg-red-500/20 border-red-500/50'
                    : 'bg-blue-500/20 border-blue-500/50'
                    : 'bg-gray-900 border-gray-800 opacity-50'
                }`}>
                  <div className="text-xs font-medium text-gray-300">{z.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{z.range}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Wochenlast */}
        {(() => {
          const chronic = current?.chronicLoad ?? 0;
          const targetLow = chronic > 0 ? Math.round(chronic * 7 * 0.8) : 0;
          const targetHigh = chronic > 0 ? Math.round(chronic * 7 * 1.3) : 0;
          const maxScale = Math.max(weeklyLoad, targetHigh, 1000);
          const pct = Math.min(100, (weeklyLoad / maxScale) * 100);
          const lowPct = targetLow > 0 ? (targetLow / maxScale) * 100 : 0;
          const highPct = targetHigh > 0 ? (targetHigh / maxScale) * 100 : 0;
          const inZone = chronic > 0 && weeklyLoad >= targetLow && weeklyLoad <= targetHigh;
          const tooLow = chronic > 0 && weeklyLoad < targetLow;
          const tooHigh = chronic > 0 && weeklyLoad > targetHigh;
          return (
            <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4 mb-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Wochenlast</div>
                  <div className="text-3xl font-bold text-white">{Math.round(weeklyLoad)}</div>
                </div>
                {chronic > 0 && (
                  <div className={`text-right text-xs ${inZone ? 'text-green-400' : tooHigh ? 'text-red-400' : 'text-blue-400'}`}>
                    <div className="font-medium">
                      {inZone ? 'Im Zielbereich' : tooHigh ? 'Über Zielbereich' : tooLow ? 'Unter Zielbereich' : ''}
                    </div>
                    <div className="text-gray-600 mt-0.5">Ziel: {targetLow}–{targetHigh}</div>
                  </div>
                )}
              </div>
              <div className="relative h-3 bg-gray-800 rounded-full overflow-hidden">
                {chronic > 0 && (
                  <div
                    className="absolute top-0 bottom-0 bg-green-500/25 border-x border-green-500/50"
                    style={{ left: `${lowPct}%`, width: `${Math.max(2, highPct - lowPct)}%` }}
                  />
                )}
                <div
                  className={`h-full rounded-full transition-all duration-700 ${inZone ? 'bg-green-500' : tooHigh ? 'bg-red-500' : 'bg-blue-500'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              {last7Days.length > 0 && (
                <>
                  <div className="grid grid-cols-7 gap-1.5">
                    {Array.from({ length: 7 }, (_, i) => {
                      const d = new Date(); d.setDate(d.getDate() - (6 - i));
                      const iso = d.toISOString().split('T')[0];
                      const dayLoad = last7Days.filter(s => s.datum === iso).reduce((sum, s) => sum + s.tl, 0);
                      const h = Math.max(8, Math.min(48, (dayLoad / Math.max(1, weeklyLoad)) * 120));
                      return (
                        <div key={iso} className="flex flex-col items-center gap-1">
                          <div className="h-12 flex items-end">
                            <div
                              className="w-5 rounded-t bg-violet-500/70"
                              style={{ height: `${h}px` }}
                            />
                          </div>
                          <span className="text-[10px] text-gray-600">{d.toLocaleDateString('de-DE', { weekday: 'short' }).slice(0,2)}</span>
                        </div>
                      );
                    })}
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
        {acwrSessions.length > 0 && strainMonotony.weeklyLoad > 0 && (
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
      {acwrSessions.length > 0 && (
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
                              style={{ color: TE_COLORS[te] }}>{Math.round(day.loads[te] ?? 0) || '–'}</td>
                        ))}
                        <td className="text-right px-3 py-2.5 text-xs text-gray-500">{Math.round(sonstige) || '–'}</td>
                        <td className="text-right px-4 py-2.5 text-xs font-bold">
                          <span style={{ color: zc }}>{Math.round(day.totalLoad)}</span>
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
