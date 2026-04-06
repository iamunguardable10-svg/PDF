import type { WearableData } from '../types/health';

interface Props {
  data: WearableData;
}

function MetricCard({
  icon,
  label,
  value,
  unit,
  color,
  subtext,
}: {
  icon: string;
  label: string;
  value: string | number;
  unit?: string;
  color: string;
  subtext?: string;
}) {
  return (
    <div className={`bg-gray-900 rounded-2xl p-4 border border-gray-800 flex flex-col gap-1`}>
      <div className="flex items-center gap-2 text-gray-400 text-sm">
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      <div className={`text-2xl font-bold ${color}`}>
        {value}
        {unit && <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>}
      </div>
      {subtext && <div className="text-xs text-gray-500">{subtext}</div>}
    </div>
  );
}

export function WearableDashboard({ data }: Props) {
  const sleepColor = data.sleepQuality === 'gut' ? 'text-green-400' : data.sleepQuality === 'mittel' ? 'text-yellow-400' : 'text-red-400';
  const sleepEmoji = data.sleepQuality === 'gut' ? '😴' : data.sleepQuality === 'mittel' ? '😐' : '😫';

  return (
    <div className="bg-gray-900/50 rounded-3xl p-6 border border-gray-800">
      <div className="flex items-center gap-3 mb-5">
        <div className="text-2xl">⌚</div>
        <div>
          <h2 className="text-lg font-semibold text-white">Wearable Daten</h2>
          <p className="text-sm text-gray-400">Heute • Live-Sync</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-xs text-green-400">Verbunden</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          icon="👟"
          label="Schritte"
          value={data.steps.toLocaleString('de-DE')}
          color="text-blue-400"
          subtext={`${data.distance} km`}
        />
        <MetricCard
          icon="🔥"
          label="Kalorien"
          value={data.caloriesBurned}
          unit="kcal"
          color="text-orange-400"
          subtext="Verbraucht"
        />
        <MetricCard
          icon="❤️"
          label="Herzrate"
          value={data.heartRateAvg}
          unit="bpm"
          color="text-red-400"
          subtext={`Max: ${data.heartRateMax} bpm`}
        />
        <MetricCard
          icon="⚡"
          label="Aktiv"
          value={data.activeMinutes}
          unit="Min"
          color="text-yellow-400"
          subtext="Bewegungszeit"
        />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3">
        <div className={`bg-gray-900 rounded-2xl p-4 border border-gray-800 flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">{sleepEmoji}</span>
            <div>
              <div className="text-sm text-gray-400">Schlaf letzte Nacht</div>
              <div className={`text-xl font-bold ${sleepColor}`}>{data.sleepHours}h</div>
            </div>
          </div>
          <div className={`text-sm font-medium px-3 py-1 rounded-full ${
            data.sleepQuality === 'gut' ? 'bg-green-900/50 text-green-400' :
            data.sleepQuality === 'mittel' ? 'bg-yellow-900/50 text-yellow-400' :
            'bg-red-900/50 text-red-400'
          }`}>
            {data.sleepQuality.charAt(0).toUpperCase() + data.sleepQuality.slice(1)}
          </div>
        </div>
      </div>
    </div>
  );
}
