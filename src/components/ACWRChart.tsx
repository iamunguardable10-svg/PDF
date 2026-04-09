import { useState, useMemo } from 'react';
import type { ACWRDataPoint, DayLoad } from '../types/acwr';
import { TE_COLORS } from '../types/acwr';
import {
  Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ReferenceArea, ResponsiveContainer, Legend,
  ComposedChart,
} from 'recharts';

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  data: ACWRDataPoint[];
  projectedData?: ACWRDataPoint[];
  dailyLoads?: DayLoad[];
  ewmaData?: ACWRDataPoint[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function localISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDatum(iso: string) {
  const d = new Date(iso + 'T00:00');
  return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}`;
}

const TE_TYPES = ['Team', 'S&C', 'Spiel', 'Aufwärmen', 'Indi', 'Schulsport', 'Prävention'] as const;

function zoneColor(v: number) {
  return v < 0.8 ? '#60a5fa' : v <= 1.3 ? '#4ade80' : '#f87171';
}

// ── Unified chart point ───────────────────────────────────────────────────────

type ChartPoint = {
  datum: string;
  // TE bars (from dailyLoads, historical)
  Team: number; 'S&C': number; Spiel: number; Aufwärmen: number;
  Indi: number; Schulsport: number; Prävention: number;
  // TE bars planned (projected, low opacity)
  Team_p: number; 'S&C_p': number; Spiel_p: number; Aufwärmen_p: number;
  Indi_p: number; Schulsport_p: number; Prävention_p: number;
  taeglLoad: number;
  // Rolling averages (AU, left axis)
  acuteLoad: number | null;
  chronicLoad: number | null;
  // ACWR (ratio, right axis)
  acwr: number | null;
  projectedAcwr?: number | null;
  isProjected: boolean;
  // Constant threshold lines (right axis — keeps axis active even without ACWR data)
  high: number;
  low: number;
  mid: number;
  // Meta
  chronicFull?: boolean;
  forecastBasis?: string;
};

// ── Custom dots ───────────────────────────────────────────────────────────────

function ACWRDot(props: { cx?: number; cy?: number; payload?: ChartPoint }) {
  const { cx, cy, payload } = props;
  if (!payload || payload.acwr == null || payload.isProjected || cx == null || cy == null) return null;
  return <circle cx={cx} cy={cy} r={3.5} fill={zoneColor(payload.acwr)} stroke="#1f2937" strokeWidth={1.5} />;
}

function ProjectedDot(props: { cx?: number; cy?: number; payload?: ChartPoint }) {
  const { cx, cy, payload } = props;
  if (!payload || payload.projectedAcwr == null || !payload.isProjected || cx == null || cy == null) return null;
  return <circle cx={cx} cy={cy} r={3} fill="transparent" stroke={zoneColor(payload.projectedAcwr)} strokeWidth={1.5} strokeDasharray="2 2" />;
}

// ── Tooltip ───────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d: ChartPoint = payload[0]?.payload;
  const acwr    = d?.acwr ?? d?.projectedAcwr ?? null;
  const zone    = acwr == null ? null : acwr < 0.8 ? 'Niedrig' : acwr <= 1.3 ? 'Optimal' : 'Hoch';
  const zoneCol = acwr == null ? '#9ca3af' : zoneColor(acwr);
  const teEntries = TE_TYPES.filter(te => (d[te] ?? 0) > 0);
  const teEntriesP = d.isProjected ? TE_TYPES.filter(te => ((d as Record<string, number>)[`${te}_p`] ?? 0) > 0) : [];
  const totalTL = teEntries.reduce((s, te) => s + (d[te] ?? 0), 0)
                + teEntriesP.reduce((s, te) => s + ((d as Record<string, number>)[`${te}_p`] ?? 0), 0);

  return (
    <div className="bg-gray-900/95 border border-gray-700 rounded-xl p-3 text-sm shadow-xl min-w-[180px] backdrop-blur-sm">
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="font-semibold text-white">{label}</span>
        {d.isProjected && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-violet-900/50 text-violet-300 border border-violet-700/50">Prognose</span>
        )}
        {d.forecastBasis && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-800 text-gray-400">{d.forecastBasis}</span>
        )}
      </div>
      <div className="space-y-1 text-gray-300">

        {/* TE breakdown */}
        {teEntries.map(te => (
          <div key={te} className="flex justify-between gap-4">
            <span style={{ color: TE_COLORS[te as keyof typeof TE_COLORS] }}>{te}</span>
            <span className="text-white font-medium">{d[te]} AU</span>
          </div>
        ))}
        {teEntriesP.map(te => (
          <div key={`${te}_p`} className="flex justify-between gap-4">
            <span style={{ color: TE_COLORS[te as keyof typeof TE_COLORS] + 'aa' }}>{te} <span className="text-gray-600">(gepl.)</span></span>
            <span className="text-gray-300 font-medium">{(d as Record<string, number>)[`${te}_p`]} AU</span>
          </div>
        ))}
        {totalTL > 0 && (
          <div className="flex justify-between border-t border-gray-700 pt-1 mt-1">
            <span className="text-gray-400">Gesamt</span>
            <span className="text-orange-400 font-bold">{totalTL} AU{d.isProjected && <span className="text-gray-500 ml-1 font-normal">(gesch.)</span>}</span>
          </div>
        )}

        {/* Rolling averages */}
        {(d.acuteLoad != null || d.chronicLoad != null) && (
          <div className="border-t border-gray-700 pt-1 mt-1 space-y-0.5">
            {d.acuteLoad != null && (
              <div className="flex justify-between gap-4">
                <span className="text-gray-500">Acute (7d)</span>
                <span className="text-sky-300">{d.acuteLoad} AU</span>
              </div>
            )}
            {d.chronicLoad != null && (
              <div className="flex justify-between gap-4">
                <span className="text-gray-500">Chronic (28d)</span>
                <span className="text-gray-300">{d.chronicLoad} AU</span>
              </div>
            )}
          </div>
        )}

        {/* ACWR */}
        {acwr != null && (
          <div className="border-t border-gray-700 pt-1.5 mt-1 space-y-1">
            <div className="flex items-center justify-between gap-4">
              <span className="text-gray-400">ACWR</span>
              <span style={{ color: zoneCol }} className="font-bold text-base">
                {acwr.toFixed(2)} <span className="text-xs font-normal">({zone})</span>
              </span>
            </div>
            {!d.chronicFull && (
              <div className="text-xs text-amber-400/80">⚠ Chronic-Fenster im Aufbau (&lt;28 Tage)</div>
            )}
          </div>
        )}

        {acwr == null && !d.isProjected && (
          <div className="border-t border-gray-700 pt-1 mt-1 text-xs text-gray-600">
            Noch keine Aussagekraft — Aufbauphase
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ACWRChart({ data, projectedData = [], dailyLoads = [], ewmaData = [] }: Props) {
  const [method, setMethod] = useState<'rolling' | 'ewma'>('rolling');

  const todayISO       = localISO(new Date());
  const todayFormatted = formatDatum(todayISO);

  // Last 60 days
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 60);
  const cutoff = localISO(cutoffDate);

  // Active dataset (rolling or EWMA) — single source of truth for all values
  const activeData = method === 'ewma' && ewmaData.length > 0 ? ewmaData : data;
  const filtered   = useMemo(() => activeData.filter(d => d.datum >= cutoff), [activeData, cutoff]);

  // ── Build unified chart data ───────────────────────────────────────────────
  const chartData: ChartPoint[] = useMemo(() => {
    const loadMap = new Map(dailyLoads.map(d => [d.datum, d]));
    const zeroPlan = { Team_p: 0, 'S&C_p': 0, Spiel_p: 0, Aufwärmen_p: 0, Indi_p: 0, Schulsport_p: 0, Prävention_p: 0 };

    const historical: ChartPoint[] = filtered.map((pt, idx) => {
      const day = loadMap.get(pt.datum);
      const isLast = idx === filtered.length - 1;
      return {
        datum:       formatDatum(pt.datum),
        Team:        day?.loads['Team']       ?? 0,
        'S&C':       day?.loads['S&C']        ?? 0,
        Spiel:       day?.loads['Spiel']       ?? 0,
        Aufwärmen:   day?.loads['Aufwärmen']   ?? 0,
        Indi:        day?.loads['Indi']        ?? 0,
        Schulsport:  day?.loads['Schulsport']  ?? 0,
        Prävention:  day?.loads['Prävention']  ?? 0,
        ...zeroPlan,
        taeglLoad:   pt.taeglLoad,
        // Gate: acute/chronic nur wenn ACWR valide ist (ab Tag 8)
        acuteLoad:   pt.acwr !== null ? pt.acuteLoad  : null,
        chronicLoad: pt.acwr !== null ? pt.chronicLoad : null,
        acwr:        pt.acwr,
        // Bridge: letzter historischer Punkt startet die Projektions-Linie
        projectedAcwr: (isLast && projectedData.length > 0) ? (pt.acwr ?? undefined) : undefined,
        isProjected: false,
        high:        1.3,
        low:         0.8,
        mid:         1.0,
        chronicFull: pt.chronicFull,
      };
    });

    const projected: ChartPoint[] = projectedData.map(d => {
      // plannedTeLoads is pre-computed in projectFutureACWR using medianRpeByTE from history
      const tl = d.plannedTeLoads ?? {};
      return {
        datum:       formatDatum(d.datum),
        Team: 0, 'S&C': 0, Spiel: 0, Aufwärmen: 0, Indi: 0, Schulsport: 0, Prävention: 0,
        Team_p:       tl['Team']       ?? 0,
        'S&C_p':      tl['S&C']        ?? 0,
        Spiel_p:      tl['Spiel']      ?? 0,
        Aufwärmen_p:  tl['Aufwärmen']  ?? 0,
        Indi_p:       tl['Indi']       ?? 0,
        Schulsport_p: tl['Schulsport'] ?? 0,
        Prävention_p: tl['Prävention'] ?? 0,
        taeglLoad:   d.taeglLoad,
        acuteLoad:   d.acwr !== null ? d.acuteLoad  : null,
        chronicLoad: d.acwr !== null ? d.chronicLoad : null,
        acwr:        null,
        projectedAcwr: d.acwr ?? undefined,
        isProjected: true,
        high:         1.3,
        low:          0.8,
        mid:          1.0,
        chronicFull:  d.chronicFull,
        forecastBasis: d.forecastBasis,
      };
    });

    return [...historical, ...projected];
  }, [filtered, projectedData, dailyLoads]);

  // Aufbauphase: Bereich ohne ACWR-Aussagekraft
  const buildingRange = useMemo(() => {
    const nullPts = chartData.filter(d => !d.isProjected && d.acwr == null);
    if (nullPts.length === 0) return null;
    return { x1: nullPts[0].datum, x2: nullPts[nullPts.length - 1].datum };
  }, [chartData]);

  const xAxisProps = {
    dataKey:     'datum',
    tick:        { fill: '#6b7280', fontSize: 10 },
    interval:    'preserveStartEnd' as const,
    angle:       -40,
    textAnchor:  'end' as const,
    height:      45,
  };

  return (
    <div className="space-y-2">

      {/* Method toggle */}
      {ewmaData.length > 0 && (
        <div className="flex gap-1">
          {(['rolling', 'ewma'] as const).map(m => (
            <button key={m} onClick={() => setMethod(m)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                method === m ? 'bg-sky-700 text-white' : 'bg-gray-800 text-gray-500 hover:text-white'
              }`}>
              {m === 'rolling' ? 'Rolling Avg' : 'EWMA'}
            </button>
          ))}
        </div>
      )}

      {/* Unified chart */}
      <ResponsiveContainer width="100%" height={340}>
        <ComposedChart data={chartData} margin={{ top: 10, right: 48, left: -10, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
          <XAxis {...xAxisProps} />

          {/* Left axis — AU (bars + acute + chronic) */}
          <YAxis yAxisId="left" tick={{ fill: '#6b7280', fontSize: 10 }}
            tickLine={false} axisLine={false}
            label={{ value: 'AU', angle: -90, position: 'insideLeft', fill: '#4b5563', fontSize: 10, dy: 20 }} />

          {/* Right axis — ACWR ratio */}
          <YAxis yAxisId="right" orientation="right" domain={[0, 2.5]}
            ticks={[0.8, 1.0, 1.3, 2.0]}
            tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false}
            tickFormatter={v => v.toFixed(1)} />

          <Tooltip content={<ChartTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
            formatter={(value) => <span style={{ color: '#9ca3af' }}>{value}</span>}
          />

          {/* Aufbauphase */}
          {buildingRange && (
            <ReferenceArea yAxisId="right" x1={buildingRange.x1} x2={buildingRange.x2}
              fill="#6b7280" fillOpacity={0.07}
              label={{ value: 'Aufbauphase', position: 'insideTopLeft', fill: '#6b7280', fontSize: 10 }} />
          )}

          {/* Heute-Linie bei Projektion */}
          {projectedData.length > 0 && (
            <ReferenceLine yAxisId="right" x={todayFormatted} stroke="#6b7280"
              strokeWidth={1} strokeDasharray="4 4"
              label={{ value: 'Heute', position: 'top', fill: '#9ca3af', fontSize: 10 }} />
          )}

          {/* ACWR-Schwellenwerte — als Line damit rechte Achse immer aktiv ist */}
          <Line yAxisId="right" dataKey="high" name="Risiko 1.3"
            stroke="#ef4444" strokeWidth={1.5} strokeOpacity={0.7}
            dot={false} legendType="plainline" isAnimationActive={false} connectNulls />
          <Line yAxisId="right" dataKey="low" name="Niedrig 0.8"
            stroke="#3b82f6" strokeWidth={1.5} strokeOpacity={0.7}
            dot={false} legendType="plainline" isAnimationActive={false} connectNulls />
          <Line yAxisId="right" dataKey="mid"
            stroke="#6b7280" strokeWidth={1} strokeOpacity={0.4} strokeDasharray="2 4"
            dot={false} legendType="none" isAnimationActive={false} connectNulls />

          {/* TE-Balken historisch (gestapelt, linke Achse) */}
          {TE_TYPES.map(te => (
            <Bar key={te} yAxisId="left" dataKey={te} stackId="tl" name={te}
              fill={TE_COLORS[te as keyof typeof TE_COLORS]}
              maxBarSize={18} isAnimationActive={false} />
          ))}

          {/* TE-Balken geplant (Projektion, niedrige Opacity) */}
          {projectedData.length > 0 && TE_TYPES.map(te => (
            <Bar key={`${te}_p`} yAxisId="left" dataKey={`${te}_p`} stackId="tl" name={undefined}
              fill={TE_COLORS[te as keyof typeof TE_COLORS]}
              fillOpacity={0.35} legendType="none"
              maxBarSize={18} isAnimationActive={false} />
          ))}

          {/* Acute (7d) — linke Achse */}
          <Line yAxisId="left" type="monotone" dataKey="acuteLoad" name="Acute 7d"
            stroke="#38bdf8" strokeWidth={1.5} strokeDasharray="3 2"
            dot={false} isAnimationActive={false} legendType="plainline" connectNulls={false} />

          {/* Chronic (28d) — linke Achse */}
          <Line yAxisId="left" type="monotone" dataKey="chronicLoad" name="Chronic 28d"
            stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="5 3"
            dot={false} isAnimationActive={false} legendType="plainline" connectNulls={false} />

          {/* ACWR historisch — rechte Achse */}
          <Line yAxisId="right" type="monotone" dataKey="acwr" name="ACWR"
            stroke="#a78bfa" strokeWidth={2.5}
            dot={<ACWRDot />} connectNulls={false} isAnimationActive={false}
            activeDot={{ r: 6, fill: '#a78bfa' }} />

          {/* ACWR Projektion — rechte Achse */}
          {projectedData.length > 0 && (
            <Line yAxisId="right" type="monotone" dataKey="projectedAcwr" name="Projektion"
              stroke="#a78bfa" strokeWidth={2} strokeDasharray="6 4" strokeOpacity={0.55}
              dot={<ProjectedDot />} connectNulls={false} isAnimationActive={false}
              activeDot={{ r: 5, fill: '#a78bfa', fillOpacity: 0.5 }} />
          )}

        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
