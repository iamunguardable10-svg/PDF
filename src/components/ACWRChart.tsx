import { useState, useMemo } from 'react';
import type { ACWRDataPoint, DayLoad } from '../types/acwr';
import { TE_COLORS } from '../types/acwr';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Legend,
  ComposedChart, Bar, YAxis as YAxisType, // eslint-disable-line @typescript-eslint/no-unused-vars
} from 'recharts';

// suppress unused import warning — YAxisType is the same as YAxis, just aliased
void (YAxisType as unknown);

interface Props {
  data: ACWRDataPoint[];
  projectedData?: ACWRDataPoint[];
  dailyLoads?: DayLoad[];
}

function localISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDatum(iso: string) {
  const d = new Date(iso + 'T00:00');
  return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}`;
}

const TE_TYPES = ['Team', 'S&C', 'Spiel', 'Aufwärmen', 'Indi', 'Schulsport', 'Prävention'] as const;

// ── Simple view types ─────────────────────────────────────────────────────────

type SimplePoint = {
  datum: string;
  taeglLoad: number;
  acuteLoad: number;
  chronicLoad: number;
  acwr?: number | null;
  projectedAcwr?: number | null;
  isProjected?: boolean;
};

function ACWRDot(props: { cx?: number; cy?: number; payload?: SimplePoint }) {
  const { cx, cy, payload } = props;
  if (!payload || payload.acwr == null || cx == null || cy == null) return null;
  const v = payload.acwr;
  const color = v < 0.8 ? '#60a5fa' : v <= 1.3 ? '#4ade80' : '#f87171';
  return <circle cx={cx} cy={cy} r={3.5} fill={color} stroke="#1f2937" strokeWidth={1.5} />;
}

function ProjectedDot(props: { cx?: number; cy?: number; payload?: SimplePoint }) {
  const { cx, cy, payload } = props;
  if (!payload || payload.projectedAcwr == null || cx == null || cy == null || !payload.isProjected) return null;
  const v = payload.projectedAcwr;
  const color = v < 0.8 ? '#60a5fa' : v <= 1.3 ? '#4ade80' : '#f87171';
  return <circle cx={cx} cy={cy} r={3} fill="transparent" stroke={color} strokeWidth={1.5} strokeDasharray="2 2" />;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SimpleTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d: SimplePoint = payload[0]?.payload;
  const acwr    = d?.acwr ?? d?.projectedAcwr;
  const proj    = d?.isProjected;
  const zone    = acwr == null ? null : acwr < 0.8 ? 'Low Risk' : acwr <= 1.3 ? 'Optimal' : 'High Risk';
  const zoneCol = acwr == null ? '#9ca3af' : acwr < 0.8 ? '#60a5fa' : acwr <= 1.3 ? '#4ade80' : '#f87171';
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-3 text-sm shadow-xl">
      <div className="flex items-center gap-2 mb-2">
        <span className="font-semibold text-white">{label}</span>
        {proj && <span className="text-xs px-1.5 py-0.5 rounded bg-violet-900/50 text-violet-300 border border-violet-700/50">Projektion</span>}
      </div>
      <div className="space-y-1 text-gray-300">
        {d.taeglLoad > 0 && <div>Tagesl.: <span className="text-white font-medium">{d.taeglLoad} AU</span>{proj && <span className="text-gray-500 ml-1">(gesch.)</span>}</div>}
        <div>Acute (7d): <span className="text-white font-medium">{d.acuteLoad} AU</span></div>
        <div>Chronic (28d): <span className="text-white font-medium">{d.chronicLoad} AU</span></div>
        {acwr != null && (
          <div className="mt-2 pt-2 border-t border-gray-700">
            ACWR: <span style={{ color: zoneCol }} className="font-bold text-base">{acwr.toFixed(2)}</span>
            <span className="ml-2" style={{ color: zoneCol }}>({zone})</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Detail view types ─────────────────────────────────────────────────────────

type DetailPoint = {
  datum: string;
  Team: number; 'S&C': number; Spiel: number; Aufwärmen: number;
  Indi: number; Schulsport: number; Prävention: number;
  chronicLoad: number;
  acuteLoad: number;
  acwr: number | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DetailTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d: DetailPoint = payload[0]?.payload;
  const totalTL = TE_TYPES.reduce((s, te) => s + (d[te] ?? 0), 0);
  const acwr    = d.acwr;
  const zoneCol = acwr == null ? '#9ca3af' : acwr < 0.8 ? '#60a5fa' : acwr <= 1.3 ? '#4ade80' : '#f87171';
  const zone    = acwr == null ? null : acwr < 0.8 ? 'Niedrig' : acwr <= 1.3 ? 'Optimal' : 'Hoch';
  const teEntries = TE_TYPES.filter(te => d[te] > 0);
  return (
    <div className="bg-gray-900/95 border border-gray-700 rounded-xl p-3 text-sm shadow-xl min-w-[180px] backdrop-blur-sm">
      <div className="font-semibold text-white mb-2 text-sm">{label}</div>
      <div className="space-y-1 text-gray-300">
        {teEntries.map(te => (
          <div key={te} className="flex justify-between gap-4">
            <span style={{ color: TE_COLORS[te as keyof typeof TE_COLORS] }}>{te}</span>
            <span className="text-white font-medium">{d[te]} AU</span>
          </div>
        ))}
        {totalTL > 0 && (
          <div className="flex justify-between border-t border-gray-700 pt-1 mt-1">
            <span className="text-gray-400">Gesamt</span><span className="text-orange-400 font-bold">{totalTL} AU</span>
          </div>
        )}
        <div className="border-t border-gray-700 pt-1 mt-1 space-y-0.5">
          <div className="flex justify-between gap-4"><span className="text-gray-500">Acute (7d)</span><span className="text-sky-300">{d.acuteLoad} AU</span></div>
          <div className="flex justify-between gap-4"><span className="text-gray-500">Chronic (28d)</span><span className="text-gray-300">{d.chronicLoad} AU</span></div>
        </div>
        {acwr != null && (
          <div className="flex items-center justify-between border-t border-gray-700 pt-1.5 mt-1 gap-4">
            <span className="text-gray-400">ACWR</span>
            <span style={{ color: zoneCol }} className="font-bold text-base">
              {acwr.toFixed(2)} <span className="text-xs font-normal">({zone})</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function ACWRChart({ data, projectedData = [], dailyLoads = [] }: Props) {
  const [view, setView] = useState<'simple' | 'detail'>('simple');

  const todayISO       = localISO(new Date());
  const todayFormatted = formatDatum(todayISO);

  // Last 60 days
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 60);
  const cutoff = localISO(cutoffDate);


  const filtered = useMemo(() => data.filter(d => d.datum >= cutoff), [data, cutoff]);

  // ── Simple chart data ──────────────────────────────────────────────────────
  const lastHistorical = filtered[filtered.length - 1];
  const simpleData: SimplePoint[] = useMemo(() => [
    ...filtered.map(d => ({
      ...d, datum: formatDatum(d.datum), projectedAcwr: undefined as number | undefined, isProjected: false,
    })),
    ...(projectedData.length > 0 && lastHistorical ? [{
      ...lastHistorical, datum: formatDatum(lastHistorical.datum),
      projectedAcwr: lastHistorical.acwr ?? undefined, isProjected: false,
    }] : []),
    ...projectedData.map(d => ({
      ...d, datum: formatDatum(d.datum), acwr: undefined as number | undefined,
      projectedAcwr: d.acwr ?? undefined, isProjected: true,
    })),
  ], [filtered, projectedData, lastHistorical]);

  // ── Detail chart data ──────────────────────────────────────────────────────
  const detailData: DetailPoint[] = useMemo(() => {
    const loadMap = new Map(dailyLoads.map(d => [d.datum, d]));
    return filtered.map(pt => {
      const day = loadMap.get(pt.datum);
      return {
        datum:       formatDatum(pt.datum),
        Team:        day?.loads['Team']       ?? 0,
        'S&C':       day?.loads['S&C']        ?? 0,
        Spiel:       day?.loads['Spiel']       ?? 0,
        Aufwärmen:   day?.loads['Aufwärmen']   ?? 0,
        Indi:        day?.loads['Indi']        ?? 0,
        Schulsport:  day?.loads['Schulsport']  ?? 0,
        Prävention:  day?.loads['Prävention']  ?? 0,
        chronicLoad: pt.chronicLoad,
        acuteLoad:   pt.acuteLoad,
        acwr:        pt.acwr,
      };
    });
  }, [filtered, dailyLoads]);

  const xAxisProps = {
    dataKey: 'datum',
    tick: { fill: '#6b7280', fontSize: 10 },
    interval: 'preserveStartEnd' as const,
    angle: -40,
    textAnchor: 'end' as const,
    height: 45,
  };

  return (
    <div className="space-y-2">
      {/* Toggle */}
      <div className="flex justify-end gap-1">
        {(['simple', 'detail'] as const).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
              view === v ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            {v === 'simple' ? 'ACWR' : 'Detail'}
          </button>
        ))}
      </div>

      {/* Simple view */}
      {view === 'simple' && (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={simpleData} margin={{ top: 10, right: 20, left: -10, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis {...xAxisProps} />
            <YAxis domain={[0, 2.5]} ticks={[0, 0.5, 0.8, 1.0, 1.3, 1.5, 2.0, 2.5]}
              tick={{ fill: '#6b7280', fontSize: 11 }} tickFormatter={v => v.toFixed(1)} />
            <Tooltip content={<SimpleTooltip />} />
            <Legend wrapperStyle={{ fontSize: '12px', color: '#9ca3af', paddingTop: '8px' }} />
            <ReferenceLine y={0.8} stroke="#3b82f6" strokeDasharray="6 3" strokeWidth={1.5}
              label={{ value: '0.8', position: 'left', fill: '#3b82f6', fontSize: 10 }} />
            <ReferenceLine y={1.3} stroke="#ef4444" strokeDasharray="6 3" strokeWidth={1.5}
              label={{ value: '1.3', position: 'left', fill: '#ef4444', fontSize: 10 }} />
            <ReferenceLine y={1.0} stroke="#6b7280" strokeDasharray="2 4" strokeWidth={1} />
            {projectedData.length > 0 && (
              <ReferenceLine x={todayFormatted} stroke="#6b7280" strokeWidth={1} strokeDasharray="4 4"
                label={{ value: 'Heute', position: 'top', fill: '#9ca3af', fontSize: 10 }} />
            )}
            <Line type="monotone" dataKey="acwr" name="ACWR"
              stroke="#a78bfa" strokeWidth={2.5} dot={<ACWRDot />}
              connectNulls={false} activeDot={{ r: 6, fill: '#a78bfa' }} />
            {projectedData.length > 0 && (
              <Line type="monotone" dataKey="projectedAcwr" name="Projektion"
                stroke="#a78bfa" strokeWidth={2} strokeDasharray="6 4" strokeOpacity={0.55}
                dot={<ProjectedDot />} connectNulls={false}
                activeDot={{ r: 5, fill: '#a78bfa', fillOpacity: 0.5 }} />
            )}
          </LineChart>
        </ResponsiveContainer>
      )}

      {/* Detail view — matches Excel layout */}
      {view === 'detail' && (
        <ResponsiveContainer width="100%" height={340}>
          <ComposedChart data={detailData} margin={{ top: 10, right: 44, left: -10, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
            <XAxis {...xAxisProps} />
            {/* Left axis: TL in AU */}
            <YAxis yAxisId="left" tick={{ fill: '#6b7280', fontSize: 10 }}
              tickLine={false} axisLine={false}
              label={{ value: 'AU', angle: -90, position: 'insideLeft', fill: '#4b5563', fontSize: 10, dy: 20 }} />
            {/* Right axis: ACWR ratio */}
            <YAxis yAxisId="right" orientation="right" domain={[0, 2.5]}
              ticks={[0.8, 1.0, 1.3, 2.0]}
              tick={{ fill: '#6b7280', fontSize: 10 }}
              tickLine={false} axisLine={false}
              tickFormatter={v => v.toFixed(1)} />
            <Tooltip content={<DetailTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
              formatter={(value) => <span style={{ color: '#9ca3af' }}>{value}</span>}
            />

            {/* Stacked bars per TE type — matches Excel */}
            {TE_TYPES.map(te => (
              <Bar key={te} yAxisId="left" dataKey={te} stackId="tl" name={te}
                fill={TE_COLORS[te as keyof typeof TE_COLORS]}
                maxBarSize={18} isAnimationActive={false} radius={[0, 0, 0, 0]} />
            ))}

            {/* Chronic rolling average (gray dashed, left axis) */}
            <Line yAxisId="left" type="monotone" dataKey="chronicLoad" name="Chronic (28d)"
              stroke="#6b7280" strokeWidth={1.5} strokeDasharray="5 3" dot={false}
              isAnimationActive={false} legendType="plainline" />

            {/* Flat ACWR threshold reference lines on right axis */}
            <ReferenceLine yAxisId="right" y={1.3} stroke="#ef4444" strokeWidth={1.5}
              strokeDasharray="0" opacity={0.7}
              label={{ value: 'High 1.3', position: 'right', fill: '#ef4444', fontSize: 10, dx: 4 }} />
            <ReferenceLine yAxisId="right" y={0.8} stroke="#94a3b8" strokeWidth={1.5}
              strokeDasharray="0" opacity={0.7}
              label={{ value: 'Low 0.8', position: 'right', fill: '#94a3b8', fontSize: 10, dx: 4 }} />

            {/* ACWR ratio — right axis, prominent dashed line */}
            <Line yAxisId="right" type="monotone" dataKey="acwr" name="ACWR"
              stroke="#38bdf8" strokeWidth={2.5} strokeDasharray="7 3"
              dot={{ r: 2.5, fill: '#38bdf8', strokeWidth: 0 }}
              connectNulls={false} isAnimationActive={false}
              activeDot={{ r: 5, fill: '#38bdf8', stroke: '#0ea5e9', strokeWidth: 2 }} />
          </ComposedChart>
        </ResponsiveContainer>
      )}

    </div>
  );
}
