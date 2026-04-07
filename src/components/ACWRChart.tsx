import type { ACWRDataPoint } from '../types/acwr';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Legend,
} from 'recharts';

interface Props {
  data: ACWRDataPoint[];
  projectedData?: ACWRDataPoint[];
}

type ChartPoint = {
  datum: string;
  taeglLoad: number;
  acuteLoad: number;
  chronicLoad: number;
  acwr?: number | null;
  projectedAcwr?: number | null;
  isProjected?: boolean;
};

function formatDatum(datum: string) {
  const d = new Date(datum);
  return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}`;
}

function ACWRDot(props: { cx?: number; cy?: number; payload?: ChartPoint }) {
  const { cx, cy, payload } = props;
  if (!payload || payload.acwr === null || payload.acwr === undefined || cx === undefined || cy === undefined) return null;
  const v = payload.acwr;
  const color = v < 0.8 ? '#60a5fa' : v <= 1.3 ? '#4ade80' : '#f87171';
  return <circle cx={cx} cy={cy} r={3.5} fill={color} stroke="#1f2937" strokeWidth={1.5} />;
}

function ProjectedDot(props: { cx?: number; cy?: number; payload?: ChartPoint }) {
  const { cx, cy, payload } = props;
  if (
    !payload || payload.projectedAcwr === null || payload.projectedAcwr === undefined
    || cx === undefined || cy === undefined || !payload.isProjected
  ) return null;
  const v = payload.projectedAcwr;
  const color = v < 0.8 ? '#60a5fa' : v <= 1.3 ? '#4ade80' : '#f87171';
  return <circle cx={cx} cy={cy} r={3} fill="transparent" stroke={color} strokeWidth={1.5} strokeDasharray="2 2" />;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d: ChartPoint = payload[0]?.payload;
  const acwr    = d?.acwr ?? d?.projectedAcwr;
  const proj    = d?.isProjected;
  const zone    = acwr == null ? null : acwr < 0.8 ? 'Low Risk' : acwr <= 1.3 ? 'Optimal' : 'High Risk';
  const zoneCol = acwr == null ? '#9ca3af' : acwr < 0.8 ? '#60a5fa' : acwr <= 1.3 ? '#4ade80' : '#f87171';

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-3 text-sm shadow-xl">
      <div className="flex items-center gap-2 mb-2">
        <span className="font-semibold text-white">{label}</span>
        {proj && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-violet-900/50 text-violet-300 border border-violet-700/50">
            Projektion
          </span>
        )}
      </div>
      <div className="space-y-1 text-gray-300">
        {d.taeglLoad > 0 && (
          <div>Tagesl.: <span className="text-white font-medium">{d.taeglLoad} AU</span>
            {proj && <span className="text-gray-500 ml-1">(gesch.)</span>}
          </div>
        )}
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

// Heutiges Datum als formatiertes Label für Referenzlinie
const todayFormatted = formatDatum(new Date().toISOString().split('T')[0]);

export function ACWRChart({ data, projectedData = [] }: Props) {
  const today = new Date().toISOString().split('T')[0];

  // Letzte 60 historische Tage
  const lastDate = data[data.length - 1]?.datum ?? today;
  const cutoff   = new Date(new Date(lastDate).getTime() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const filtered = data.filter(d => d.datum >= cutoff);

  // Letzter historischer Punkt als Übergangspunkt zur Projektionslinie
  const lastHistorical = filtered[filtered.length - 1];

  // Kombinierter Datensatz
  const chartData: ChartPoint[] = [
    ...filtered.map(d => ({
      ...d,
      datum:          formatDatum(d.datum),
      projectedAcwr:  undefined as number | undefined,
      isProjected:    false,
    })),
    // Übergangspunkt: beide Werte gesetzt → Linien verbinden sich
    ...(projectedData.length > 0 && lastHistorical
      ? [{
          ...lastHistorical,
          datum:         formatDatum(lastHistorical.datum),
          projectedAcwr: lastHistorical.acwr ?? undefined,
          isProjected:   false,
        }]
      : []),
    ...projectedData.map(d => ({
      ...d,
      datum:        formatDatum(d.datum),
      acwr:         undefined as number | undefined,
      projectedAcwr: d.acwr ?? undefined,
      isProjected:  true,
    })),
  ];

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
        <XAxis
          dataKey="datum"
          tick={{ fill: '#6b7280', fontSize: 11 }}
          interval="preserveStartEnd"
          angle={-40}
          textAnchor="end"
          height={45}
        />
        <YAxis
          domain={[0, 2.5]}
          ticks={[0, 0.5, 0.8, 1.0, 1.3, 1.5, 2.0, 2.5]}
          tick={{ fill: '#6b7280', fontSize: 11 }}
          tickFormatter={v => v.toFixed(1)}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: '12px', color: '#9ca3af', paddingTop: '8px' }} />

        {/* Zonen-Referenzlinien */}
        <ReferenceLine y={0.8} stroke="#3b82f6" strokeDasharray="6 3" strokeWidth={1.5}
          label={{ value: '0.8', position: 'left', fill: '#3b82f6', fontSize: 10 }} />
        <ReferenceLine y={1.3} stroke="#ef4444" strokeDasharray="6 3" strokeWidth={1.5}
          label={{ value: '1.3', position: 'left', fill: '#ef4444', fontSize: 10 }} />
        <ReferenceLine y={1.0} stroke="#6b7280" strokeDasharray="2 4" strokeWidth={1} />

        {/* Heute-Linie */}
        {projectedData.length > 0 && (
          <ReferenceLine
            x={todayFormatted}
            stroke="#6b7280"
            strokeWidth={1}
            strokeDasharray="4 4"
            label={{ value: 'Heute', position: 'top', fill: '#9ca3af', fontSize: 10 }}
          />
        )}

        {/* Historische ACWR-Linie */}
        <Line
          type="monotone"
          dataKey="acwr"
          name="ACWR"
          stroke="#a78bfa"
          strokeWidth={2.5}
          dot={<ACWRDot />}
          connectNulls={false}
          activeDot={{ r: 6, fill: '#a78bfa' }}
        />

        {/* Projizierte ACWR-Linie (gestrichelt) */}
        {projectedData.length > 0 && (
          <Line
            type="monotone"
            dataKey="projectedAcwr"
            name="Projektion"
            stroke="#a78bfa"
            strokeWidth={2}
            strokeDasharray="6 4"
            strokeOpacity={0.55}
            dot={<ProjectedDot />}
            connectNulls={false}
            activeDot={{ r: 5, fill: '#a78bfa', fillOpacity: 0.5 }}
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}
