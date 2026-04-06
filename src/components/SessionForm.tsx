import { useState } from 'react';
import type { Session, TrainingUnit } from '../types/acwr';
import { TRAINING_UNITS, TE_COLORS } from '../types/acwr';

interface Props {
  playerName: string;
  onAdd: (session: Session) => void;
}

export function SessionForm({ playerName, onAdd }: Props) {
  const today = new Date().toISOString().split('T')[0];
  const [datum, setDatum] = useState(today);
  const [te, setTe] = useState<TrainingUnit>('Team');
  const [rpe, setRpe] = useState<number>(7);
  const [dauer, setDauer] = useState<number>(90);
  const [error, setError] = useState('');

  const tl = rpe * dauer;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!datum) { setError('Datum fehlt'); return; }
    if (rpe < 1 || rpe > 10) { setError('RPE muss 1–10 sein'); return; }
    if (dauer <= 0) { setError('Dauer muss > 0 sein'); return; }
    setError('');

    onAdd({
      id: `s-${Date.now()}`,
      name: playerName,
      datum,
      te,
      rpe,
      dauer,
      tl,
    });

    // Reset form
    setDatum(today);
    setTe('Team');
    setRpe(7);
    setDauer(90);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* TE-Typ */}
      <div>
        <label className="text-xs text-gray-500 uppercase tracking-wide font-medium block mb-2">
          Trainingseinheit
        </label>
        <div className="flex flex-wrap gap-2">
          {TRAINING_UNITS.map(unit => (
            <button
              key={unit}
              type="button"
              onClick={() => setTe(unit)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                te === unit
                  ? 'border-transparent text-white'
                  : 'border-gray-700 text-gray-400 hover:border-gray-500'
              }`}
              style={te === unit ? { backgroundColor: TE_COLORS[unit] } : {}}
            >
              {unit}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {/* Datum */}
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wide font-medium block mb-1.5">
            Datum
          </label>
          <input
            type="date"
            value={datum}
            onChange={e => setDatum(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500"
          />
        </div>

        {/* RPE */}
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wide font-medium block mb-1.5">
            RPE (1–10)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={1} max={10} step={1}
              value={rpe}
              onChange={e => setRpe(Number(e.target.value))}
              className="flex-1 accent-violet-500"
            />
            <span className={`w-8 text-center font-bold text-lg ${
              rpe <= 3 ? 'text-green-400' : rpe <= 6 ? 'text-yellow-400' : 'text-red-400'
            }`}>{rpe}</span>
          </div>
        </div>

        {/* Dauer */}
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wide font-medium block mb-1.5">
            Dauer (min)
          </label>
          <input
            type="number"
            min={1} max={300}
            value={dauer}
            onChange={e => setDauer(Number(e.target.value))}
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500"
          />
        </div>
      </div>

      {/* TL Preview */}
      <div className="bg-gray-900 rounded-xl p-3 border border-gray-800 flex items-center justify-between">
        <span className="text-sm text-gray-400">Trainingsload (TL = RPE × Dauer)</span>
        <span className="font-bold text-orange-400 text-lg">{tl} AU</span>
      </div>

      {error && (
        <div className="text-red-400 text-sm bg-red-900/20 border border-red-800/50 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <button
        type="submit"
        className="w-full py-3 rounded-xl font-semibold text-sm bg-violet-600 hover:bg-violet-500 text-white transition-colors"
      >
        + Session hinzufügen
      </button>
    </form>
  );
}
