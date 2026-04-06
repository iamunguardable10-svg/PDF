import { useState } from 'react';
import type { WearableData } from '../types/health';

interface Props {
  data: WearableData;
  onDataChange?: (data: WearableData) => void;
}

function MetricCard({
  icon, label, value, unit, color, subtext, editing,
  onValueChange, onSubChange, subLabel,
}: {
  icon: string; label: string; value: number; unit?: string;
  color: string; subtext?: string; editing: boolean;
  onValueChange: (v: number) => void;
  onSubChange?: (v: number) => void;
  subLabel?: string;
}) {
  return (
    <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 flex flex-col gap-1">
      <div className="flex items-center gap-2 text-gray-400 text-sm">
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      {editing ? (
        <div className="space-y-1.5">
          <input
            type="number" value={value}
            onChange={e => onValueChange(Number(e.target.value))}
            className="w-full bg-gray-800 border border-violet-600 rounded-lg px-2 py-1 text-white text-sm focus:outline-none"
          />
          {onSubChange && subLabel && (
            <input
              type="number"
              defaultValue={Number(subtext?.split(' ')[0])}
              onChange={e => onSubChange(Number(e.target.value))}
              placeholder={subLabel}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-gray-400 text-xs focus:outline-none focus:border-violet-600"
            />
          )}
        </div>
      ) : (
        <>
          <div className={`text-2xl font-bold ${color}`}>
            {label === 'Schritte' ? value.toLocaleString('de-DE') : value}
            {unit && <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>}
          </div>
          {subtext && <div className="text-xs text-gray-500">{subtext}</div>}
        </>
      )}
    </div>
  );
}

export function WearableDashboard({ data, onDataChange }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<WearableData>({ ...data });

  const sleepData = editing ? draft : data;
  const sleepColor = sleepData.sleepQuality === 'gut' ? 'text-green-400' : sleepData.sleepQuality === 'mittel' ? 'text-yellow-400' : 'text-red-400';
  const sleepEmoji = sleepData.sleepQuality === 'gut' ? '😴' : sleepData.sleepQuality === 'mittel' ? '😐' : '😫';

  const activeData = editing ? draft : data;

  const handleSave = () => {
    onDataChange?.(draft);
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft({ ...data });
    setEditing(false);
  };

  const upd = <K extends keyof WearableData>(key: K, val: WearableData[K]) =>
    setDraft(d => ({ ...d, [key]: val }));

  return (
    <div className="bg-gray-900/50 rounded-3xl p-6 border border-gray-800">
      <div className="flex items-center gap-3 mb-5">
        <div className="text-2xl">⌚</div>
        <div>
          <h2 className="text-lg font-semibold text-white">Wearable Daten</h2>
          <p className="text-sm text-gray-400">Heute</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {/* Demo badge */}
          <span className="text-xs px-2 py-0.5 bg-orange-900/50 text-orange-400 border border-orange-800 rounded-full font-medium">
            Demo-Daten
          </span>
          {/* Edit toggle */}
          {!editing ? (
            <button
              onClick={() => { setDraft({ ...data }); setEditing(true); }}
              title="Daten manuell eingeben"
              className="text-gray-500 hover:text-violet-400 transition-colors text-sm px-2 py-1 rounded-lg border border-gray-700 hover:border-violet-600"
            >
              ✏️ Bearbeiten
            </button>
          ) : (
            <div className="flex gap-1.5">
              <button onClick={handleSave} className="text-xs px-2.5 py-1 bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-medium transition-colors">
                Speichern
              </button>
              <button onClick={handleCancel} className="text-xs px-2.5 py-1 border border-gray-700 text-gray-400 hover:text-white rounded-lg transition-colors">
                Abbrechen
              </button>
            </div>
          )}
        </div>
      </div>

      {editing && (
        <div className="mb-4 bg-violet-900/20 border border-violet-800 rounded-xl p-3 text-xs text-violet-300">
          💡 Trage deine heutigen Werte manuell ein — z.B. von deiner Smartwatch-App
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          icon="👟" label="Schritte"
          value={activeData.steps} color="text-blue-400"
          subtext={`${activeData.distance} km`}
          editing={editing}
          onValueChange={v => upd('steps', v)}
          onSubChange={v => upd('distance', v)}
          subLabel="km"
        />
        <MetricCard
          icon="🔥" label="Kalorien"
          value={activeData.caloriesBurned} unit="kcal" color="text-orange-400"
          subtext="Verbraucht" editing={editing}
          onValueChange={v => upd('caloriesBurned', v)}
        />
        <MetricCard
          icon="❤️" label="Herzrate"
          value={activeData.heartRateAvg} unit="bpm" color="text-red-400"
          subtext={`Max: ${activeData.heartRateMax} bpm`}
          editing={editing}
          onValueChange={v => upd('heartRateAvg', v)}
          onSubChange={v => upd('heartRateMax', v)}
          subLabel="Max bpm"
        />
        <MetricCard
          icon="⚡" label="Aktiv"
          value={activeData.activeMinutes} unit="Min" color="text-yellow-400"
          subtext="Bewegungszeit" editing={editing}
          onValueChange={v => upd('activeMinutes', v)}
        />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3">
        <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{sleepEmoji}</span>
            <div>
              <div className="text-sm text-gray-400">Schlaf letzte Nacht</div>
              {editing ? (
                <input
                  type="number" min={0} max={12} step={0.5}
                  value={draft.sleepHours}
                  onChange={e => upd('sleepHours', Number(e.target.value))}
                  className="w-20 bg-gray-800 border border-violet-600 rounded-lg px-2 py-1 text-white text-sm focus:outline-none mt-1"
                />
              ) : (
                <div className={`text-xl font-bold ${sleepColor}`}>{sleepData.sleepHours}h</div>
              )}
            </div>
          </div>
          {editing ? (
            <div className="flex flex-col gap-1">
              {(['gut', 'mittel', 'schlecht'] as const).map(q => (
                <button key={q} onClick={() => upd('sleepQuality', q)}
                  className={`text-xs px-3 py-1 rounded-lg border transition-colors ${draft.sleepQuality === q ? 'border-violet-500 bg-violet-900/30 text-white' : 'border-gray-700 text-gray-400'}`}>
                  {q}
                </button>
              ))}
            </div>
          ) : (
            <div className={`text-sm font-medium px-3 py-1 rounded-full ${
              sleepData.sleepQuality === 'gut' ? 'bg-green-900/50 text-green-400' :
              sleepData.sleepQuality === 'mittel' ? 'bg-yellow-900/50 text-yellow-400' :
              'bg-red-900/50 text-red-400'
            }`}>
              {sleepData.sleepQuality.charAt(0).toUpperCase() + sleepData.sleepQuality.slice(1)}
            </div>
          )}
        </div>
      </div>

      {!editing && (
        <p className="text-xs text-gray-600 mt-3 text-center">
          Echte Wearable-Integration (Apple Health, Garmin, Fitbit) erfordert eine native App · <span className="text-gray-500">Klick auf "Bearbeiten" für manuelle Eingabe</span>
        </p>
      )}
    </div>
  );
}
