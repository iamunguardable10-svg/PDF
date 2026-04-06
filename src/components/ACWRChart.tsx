import type { ACWRDataPoint } from '../types/acwr';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Legend,
} from 'recharts';

interface Props {
  data: ACWRDataPoint[];
}

function formatDatum(datum: string) {
  const d = new Date(datum);
  return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}`;
}

function ACWRDot(props: { cx?: number; cy?: number; payload?: ACWRDataPoint }) {
  const { cx, cy, payload } = props;
  if (!payload || payload.acwr === null || cx === undefined || cy === undefined) return null;
  const v = payload.acwr;
  const color = v < 0.8 ? '#60a5fa' : v <= 1.3 ? '#4ade80' : '#f87171';
  return <circle cx={cx} cy={cy} r={4} fill={color} stroke="#1f2937" strokeWidth={1.5} />;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d: ACWRDataPoint = payload[0]?.payload;
  const acwr = d?.acwr;
  const zone = acwr === null ? null : acwr < 0.8 ? 'Low Risk' : acwr <= 1.3 ? 'Optimal' : 'High Risk';
  const zoneColor = acwr === null ? '#9ca3af' : acwr < 0.8 ? '#60a5fa' : acwr <= 1.3 ? '#4ade80' : '#f87171';

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-3 text-sm shadow-xl">
      <div className="font-semibold text-white mb-2">{label}</div>
      <div className="space-y-1 text-gray-300">
        <div>Tagesl.: <span className="text-white font-medium">{d.taeglLoad} AU</span></div>
        <div>Acute (7d): <span className="text-white font-medium">{d.acuteLoad} AU</span></div>
        <div>Chronic (28d): <span className="text-white font-medium">{d.chronicLoad} AU</span></div>
        {acwr !== null && (
          <div className="mt-2 pt-2 border-t border-gray-700">
            ACWR: <span style={{ color: zoneColor }} className="font-bold text-base">{acwr.toFixed(2)}</span>
            <span className="ml-2" style={{ color: zoneColor }}>({zone})</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function ACWRChart({ data }: Props) {
  // Nur Tage mit Daten oder in den letzten 28 Tagen zeigen
  const lastDate = data[data.length - 1]?.datum;
  const cutoff = lastDate
    ? new Date(new Date(lastDate).getTime() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    : '';
  const filtered = data.filter(d => d.datum >= cutoff);

  const chartData = filtered.map(d => ({
    ...d,
    datum: formatDatum(d.datum),
    acwr: d.acwr,
    // Balken für Tagesload (skaliert auf ACWR-Achse für Übersicht)
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
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
        <Legend
          wrapperStyle={{ fontSize: '12px', color: '#9ca3af', paddingTop: '8px' }}
        />

        {/* Referenzlinien Zonen */}
        <ReferenceLine y={0.8} stroke="#3b82f6" strokeDasharray="6 3" strokeWidth={1.5}
          label={{ value: 'Low 0.8', position: 'left', fill: '#3b82f6', fontSize: 10 }} />
        <ReferenceLine y={1.3} stroke="#ef4444" strokeDasharray="6 3" strokeWidth={1.5}
          label={{ value: 'High 1.3', position: 'left', fill: '#ef4444', fontSize: 10 }} />
        <ReferenceLine y={1.0} stroke="#6b7280" strokeDasharray="2 4" strokeWidth={1} />

        {/* ACWR Linie */}
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
      </LineChart>
    </ResponsiveContainer>
  );
}
