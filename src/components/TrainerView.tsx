import { useMemo, useState, useEffect, useCallback } from 'react';
import type { TrainerShareData } from '../lib/trainerShare';
type PlannedEntry = TrainerShareData['planned'];
import { fetchLiveTrainerData } from '../lib/trainerShare';
import type { ACWRDataPoint, Session, PlannedSession, TrainingUnit } from '../types/acwr';
import { TE_EMOJI, TE_COLORS } from '../types/acwr';
import { getACWRZoneLabel, projectFutureACWR, aggregateDailyLoads, calculateEWMA } from '../lib/acwrCalculations';
import type { DayLoad } from '../types/acwr';
import { ACWRChart } from './ACWRChart';
import { ACWRForecast } from './ACWRForecast';

const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

interface Props {
  data?: TrainerShareData;      // legacy base64
  token?: string;               // live Supabase token
}

export function TrainerView({ data: staticData, token }: Props) {
  const [liveData, setLiveData]   = useState<TrainerShareData | null>(null);
  const [loading, setLoading]     = useState(!!token);
  const [error, setError]         = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(false);
    const result = await fetchLiveTrainerData(token);
    if (result) {
      setLiveData(result);
      setLastRefresh(new Date());
    } else {
      setError(true);
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 5 minutes
    if (token) {
      const interval = setInterval(fetchData, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [fetchData, token]);

  const data = liveData ?? staticData ?? null;
  const isLive = !!token;

  const today = new Date().toISOString().split('T')[0];

  const currentPoint = useMemo(() => {
    const active = [...(data?.acwrHistory ?? [])].reverse().find(p => p.v !== null);
    return active ?? null;
  }, [data]);

  const acwr = currentPoint?.v ?? null;
  const zone = acwr !== null ? getACWRZoneLabel(acwr) : null;

  const next14Days = useMemo(() => Array.from({ length: 14 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i);
    return d.toISOString().split('T')[0];
  }), []);

  const plannedByDay = useMemo(() => {
    const map = new Map<string, PlannedEntry>();
    for (const iso of next14Days) map.set(iso, []);
    for (const s of (data?.planned ?? [])) {
      if (map.has(s.d)) map.get(s.d)!.push(s);
    }
    return map;
  }, [data, next14Days]);

  const recentSessions = useMemo(() =>
    [...(data?.sessions28 ?? [])]
      .sort((a, b) => b.d.localeCompare(a.d))
      .slice(0, 10),
  [data]);

  // Reconstruct Session[] from sessions28 for projection
  const sessions28AsSessions = useMemo<Session[]>(() =>
    (data?.sessions28 ?? []).map((s, i) => ({
      id: `ts-${i}`,
      name: data?.athleteName ?? '',
      datum: s.d,
      te: s.te as TrainingUnit,
      rpe: s.rpe,
      dauer: s.rpe > 0 ? Math.round(s.tl / s.rpe) : 60,
      tl: s.tl,
    })),
  [data]);

  const plannedAsPS = useMemo<PlannedSession[]>(() =>
    (data?.planned ?? []).map((s, i) => ({
      id: `tp-${i}`,
      datum: s.d,
      te: s.t as TrainingUnit,
      uhrzeit: s.u,
      geschaetzteDauer: s.dur,
      confirmed: false,
      reminderScheduled: false,
    })),
  [data]);

  const projectedData = useMemo(() =>
    projectFutureACWR(sessions28AsSessions, plannedAsPS),
  [sessions28AsSessions, plannedAsPS]);

  const trainerDailyLoads = useMemo<DayLoad[]>(() =>
    aggregateDailyLoads(sessions28AsSessions),
  [sessions28AsSessions]);

  const trainerEwmaData = useMemo(() =>
    calculateEWMA(sessions28AsSessions),
  [sessions28AsSessions]);

  // Use server-precomputed acwrHistory (calculated from ALL sessions, not just 28d).
  // sessions28 is only used for the daily-load bars (TE breakdown) — accurate for last 28 days.
  const acwrData: ACWRDataPoint[] = useMemo(() =>
    (data?.acwrHistory ?? []).map(p => ({
      datum: p.d, taeglLoad: 0, acuteLoad: p.a, chronicLoad: p.c,
      acwr: p.v, chronicFull: true,
    })),
  [data]);

  function fmtDate(iso: string) {
    const d = new Date(iso + 'T00:00');
    return `${WEEKDAYS[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}`;
  }

  const daysSinceGenerated = data
    ? Math.floor((Date.now() - new Date(data.generatedAt).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  // ── Loading / Error states ────────────────────────────────────────────────

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-[#0a0b0f] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-400 text-sm">Athletendaten laden…</p>
        </div>
      </div>
    );
  }

  if (error || (!loading && !data)) {
    return (
      <div className="min-h-screen bg-[#0a0b0f] flex items-center justify-center p-4">
        <div className="text-center space-y-3 max-w-sm">
          <div className="text-4xl">🔒</div>
          <h2 className="text-white font-bold text-lg">Link ungültig</h2>
          <p className="text-gray-500 text-sm">
            Dieser Trainer-Link ist abgelaufen oder wurde vom Athleten widerrufen.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0b0f] text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-700 rounded-xl flex items-center justify-center text-sm">
              📊
            </div>
            <div>
              <h1 className="text-sm font-bold text-white leading-none">
                ACWR · {data!.athleteName}
              </h1>
              <p className="text-xs text-gray-500">{data!.sport}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {isLive ? (
              <span className="text-xs px-2.5 py-1 rounded-full border border-green-700/60 bg-green-900/20 text-green-300 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse inline-block" />
                Live · Trainer-Ansicht
              </span>
            ) : (
              <span className="text-xs px-2.5 py-1 rounded-full border border-amber-700/60 bg-amber-900/20 text-amber-300">
                👁 Trainer-Ansicht
              </span>
            )}
            {isLive && lastRefresh && (
              <button
                onClick={fetchData}
                disabled={loading}
                className="text-xs text-gray-600 hover:text-gray-400 transition-colors disabled:opacity-50"
                title="Daten aktualisieren"
              >
                {loading ? '…' : '↻ ' + lastRefresh.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
              </button>
            )}
            {!isLive && daysSinceGenerated > 0 && (
              <span className="text-xs text-gray-600">Stand: vor {daysSinceGenerated}d</span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-5">

        {/* ACWR Status */}
        <div className="bg-gray-900/50 rounded-3xl p-5 border border-gray-800">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-lg">📊</span>
            <h2 className="text-sm font-semibold text-white">Akute:Chronische Belastungsquotient</h2>
          </div>

          {acwr !== null && zone ? (
            <>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-2xl flex flex-col items-center justify-center shrink-0 border border-gray-700"
                  style={{ backgroundColor: zone.color + '22' }}>
                  <span className="text-xl font-black leading-none" style={{ color: zone.color }}>
                    {acwr.toFixed(2)}
                  </span>
                  <span className="text-xs text-gray-400 mt-0.5">ACWR</span>
                </div>
                <div>
                  <div className="font-semibold text-white text-sm">{zone.label}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {acwr < 0.8 && 'Unterbelastung – Verletzungsrisiko durch mangelnde Adaptation.'}
                    {acwr >= 0.8 && acwr <= 1.3 && 'Optimale Zone – gute Balance zwischen Belastung und Erholung.'}
                    {acwr > 1.3 && 'Überbelastung – erhöhtes Verletzungsrisiko, Recovery priorisieren.'}
                  </div>
                </div>
              </div>

              {/* Gauge — scale 0–2, zones at 0.8 (40%) and 1.3 (65%) */}
              <div className="relative h-4 rounded-full overflow-hidden mb-1"
                style={{ background: 'linear-gradient(to right, #60a5fa 0%, #60a5fa 40%, #4ade80 40%, #4ade80 65%, #f87171 65%, #f87171 100%)' }}>
                <div className="absolute top-0 bottom-0 flex items-center"
                  style={{ left: `${Math.min(100, Math.max(0, (acwr / 2) * 100))}%`, transform: 'translateX(-50%)' }}>
                  <div className="w-3 h-3 bg-white rounded-full border-2 border-gray-900 shadow" />
                </div>
              </div>
              <div className="relative h-4">
                {([0, 0.8, 1.3, 2.0] as const).map(v => (
                  <span key={v}
                    className={`absolute text-xs transform -translate-x-1/2 ${v === 0.8 ? 'text-blue-400' : v === 1.3 ? 'text-red-400' : 'text-gray-500'}`}
                    style={{ left: `${(v / 2) * 100}%` }}>
                    {v}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="bg-gray-900 rounded-2xl p-3 border border-gray-800">
                  <div className="text-xs text-gray-500 mb-1">Acute Load (7d Ø)</div>
                  <div className="text-lg font-bold text-blue-400">
                    {currentPoint?.a ?? '—'} <span className="text-xs font-normal text-gray-500">AU</span>
                  </div>
                </div>
                <div className="bg-gray-900 rounded-2xl p-3 border border-gray-800">
                  <div className="text-xs text-gray-500 mb-1">Chronic Load (28d Ø)</div>
                  <div className="text-lg font-bold text-amber-400">
                    {currentPoint?.c ?? '—'} <span className="text-xs font-normal text-gray-500">AU</span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-600 text-center py-4">Keine ACWR-Daten vorhanden.</p>
          )}
        </div>

        {/* ACWR Chart */}
        {acwrData.length > 0 && (
          <div className="bg-gray-900/50 rounded-3xl p-5 border border-gray-800">
            <h3 className="text-sm font-semibold text-white mb-3">ACWR Verlauf</h3>
            <ACWRChart
              data={acwrData}
              projectedData={projectedData}
              dailyLoads={trainerDailyLoads}
              ewmaData={trainerEwmaData}
            />
          </div>
        )}

        {/* ACWR Forecast */}
        {projectedData.length > 0 && currentPoint && (
          <ACWRForecast
            projected={projectedData}
            currentAcwr={acwr}
            currentAcute={currentPoint.a}
            currentChronic={currentPoint.c}
            plannedCount={(data?.planned ?? []).length}
          />
        )}

        {/* Nächste 14 Tage */}
        <div className="bg-gray-900/50 rounded-3xl p-5 border border-gray-800">
          <h3 className="text-sm font-semibold text-white mb-3">Geplante Einheiten – nächste 14 Tage</h3>
          {(data?.planned ?? []).length === 0 ? (
            <p className="text-sm text-gray-600 text-center py-4">Keine geplanten Einheiten geteilt.</p>
          ) : (
            <div className="space-y-1.5">
              {next14Days.map(iso => {
                const sessions = plannedByDay.get(iso) ?? [];
                if (sessions.length === 0) return null;
                const isToday = iso === today;
                return (
                  <div key={iso} className={`flex items-start gap-3 rounded-xl px-3 py-2.5 border ${
                    isToday ? 'border-violet-700/60 bg-violet-900/10' : 'border-gray-800 bg-gray-900/50'
                  }`}>
                    <div className="shrink-0 w-16 text-xs text-gray-500 pt-0.5">{fmtDate(iso)}</div>
                    <div className="flex flex-wrap gap-1.5 flex-1">
                      {sessions.map((s, i) => {
                        const color = TE_COLORS[s.t as keyof typeof TE_COLORS] ?? '#6b7280';
                        const emoji = TE_EMOJI[s.t as keyof typeof TE_EMOJI] ?? '💪';
                        return (
                          <span key={i} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs border border-dashed"
                            style={{ borderColor: color + '80', backgroundColor: color + '11', color }}>
                            {emoji} {s.t}
                            {s.u && <span className="text-gray-500 ml-1">{s.u}</span>}
                            {s.dur && <span className="text-gray-600 ml-1">{s.dur}′</span>}
                          </span>
                        );
                      })}
                    </div>
                    {isToday && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-violet-900/50 text-violet-300 border border-violet-700/50 shrink-0">
                        Heute
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Letzte Sessions */}
        {recentSessions.length > 0 && (
          <div className="bg-gray-900/50 rounded-3xl p-5 border border-gray-800">
            <h3 className="text-sm font-semibold text-white mb-3">Letzte Einheiten (28 Tage)</h3>
            <div className="space-y-1.5">
              {recentSessions.map((s, i) => {
                const emoji = TE_EMOJI[s.te as keyof typeof TE_EMOJI] ?? '💪';
                const rpeColor = s.rpe <= 3 ? '#4ade80' : s.rpe <= 6 ? '#facc15' : '#f87171';
                return (
                  <div key={i} className="flex items-center gap-3 bg-gray-900/60 rounded-xl px-3 py-2 border border-gray-800">
                    <span>{emoji}</span>
                    <span className="text-sm text-gray-300 flex-1">{s.te}</span>
                    <span className="text-xs text-gray-500">{fmtDate(s.d)}</span>
                    <span className="text-xs font-medium" style={{ color: rpeColor }}>RPE {s.rpe}</span>
                    <span className="text-xs font-semibold text-orange-400">{s.tl} AU</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="text-center text-xs text-gray-700 pb-6">
          {isLive
            ? `Live Trainer-Ansicht · aktualisiert ${lastRefresh?.toLocaleString('de-DE') ?? '…'} · FitFuel`
            : `Schreibgeschützte Trainer-Ansicht · Geteilt am ${data!.generatedAt} · FitFuel`
          }
        </div>
      </main>
    </div>
  );
}
