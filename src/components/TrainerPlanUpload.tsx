import { useState } from 'react';
import type { PlannedSession } from '../types/acwr';
import { parseTrainerPlan } from '../lib/parseTrainerPlan';

interface Props {
  onSessionsAdded: (sessions: PlannedSession[]) => void;
}

const EXAMPLE_MSG = `Wochenplan KW 15:
Mo 17:00 Team 90min
Di 09:00 S&C 60min
Mi Ruhe
Do 17:00 Team 90min + Aufwärmen 30min
Fr Schulsport 45min
Sa 14:00 Aufwärmen 45min + Spiel
So Ruhe`;

export function TrainerPlanUpload({ onSessionsAdded }: Props) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [preview, setPreview] = useState<PlannedSession[] | null>(null);
  const [error, setError] = useState('');
  const [dayOffset, setDayOffset] = useState(0);

  function shiftDate(datum: string, days: number): string {
    const d = new Date(datum);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  }

  const shiftedPreview = preview?.map(s => ({ ...s, datum: shiftDate(s.datum, dayOffset) })) ?? null;

  const handleParse = async () => {
    if (!message.trim()) return;
    setLoading(true);
    setError('');
    setPreview(null);
    setProgress('');

    try {
      const sessions = await parseTrainerPlan(message, setProgress);
      setPreview(sessions);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Parsen. Bitte erneut versuchen.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmImport = () => {
    if (!shiftedPreview) return;
    onSessionsAdded(shiftedPreview);
    setPreview(null);
    setDayOffset(0);
    setMessage('');
    setProgress('');
    setOpen(false);
  };

  function formatDatum(d: string) {
    const date = new Date(d);
    return date.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
  }

  return (
    <div className="bg-gray-900/50 rounded-3xl border border-gray-800 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-5 hover:bg-gray-900/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">📋</span>
          <div className="text-left">
            <div className="font-semibold text-white text-sm">Trainer-Plan importieren</div>
            <div className="text-xs text-gray-400">Nachricht einfügen → KI erkennt alle Einheiten automatisch</div>
          </div>
        </div>
        <span className="text-gray-500 text-sm">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t border-gray-800 p-5 space-y-4">
          {/* Textarea */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                Trainer-Nachricht (WhatsApp, E-Mail, etc.)
              </label>
              <button
                onClick={() => setMessage(EXAMPLE_MSG)}
                className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
              >
                Beispiel laden
              </button>
            </div>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={7}
              placeholder={`Wochenplan einfügen, z.B.:\n${EXAMPLE_MSG}`}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500 font-mono resize-none"
            />
          </div>

          {/* Parse Button */}
          <button
            onClick={handleParse}
            disabled={loading || !message.trim()}
            className={`w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
              loading || !message.trim()
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-violet-600 hover:bg-violet-500 text-white'
            }`}
          >
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Analysiere...
              </>
            ) : '🤖 KI-Analyse starten'}
          </button>

          {/* Live progress */}
          {loading && progress && (
            <div className="bg-gray-900 rounded-xl p-3 border border-gray-800">
              <pre className="text-xs text-gray-400 font-mono whitespace-pre-wrap overflow-hidden max-h-32">
                {progress.slice(-400)}
              </pre>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-900/20 border border-red-800/50 rounded-xl p-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Preview */}
          {shiftedPreview && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-white">
                  {shiftedPreview.length} Einheiten erkannt
                </div>
                {dayOffset !== 0 && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${dayOffset > 0 ? 'bg-blue-900/40 text-blue-400 border border-blue-800' : 'bg-orange-900/40 text-orange-400 border border-orange-800'}`}>
                    {dayOffset > 0 ? `+${dayOffset}` : dayOffset} Tage
                  </span>
                )}
              </div>

              {/* Date offset controls */}
              <div className="bg-gray-900 rounded-2xl p-3 border border-gray-700 space-y-2">
                <div className="text-xs text-gray-500 flex items-center gap-1.5">
                  <span>📅</span>
                  <span>Datumskorrektur — falls die KI alle Einheiten um eine Woche versetzt hat:</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <button onClick={() => setDayOffset(o => o - 7)}
                      className="px-2.5 py-1.5 rounded-lg border border-gray-700 text-gray-300 hover:border-orange-500 hover:text-orange-400 text-xs font-mono transition-colors">
                      −7
                    </button>
                    <button onClick={() => setDayOffset(o => o - 1)}
                      className="px-2.5 py-1.5 rounded-lg border border-gray-700 text-gray-300 hover:border-orange-500 hover:text-orange-400 text-xs font-mono transition-colors">
                      −1
                    </button>
                  </div>
                  <div className="flex-1 text-center text-sm font-bold text-white tabular-nums">
                    {dayOffset === 0 ? 'Kein Versatz' : `${dayOffset > 0 ? '+' : ''}${dayOffset} ${Math.abs(dayOffset) === 1 ? 'Tag' : 'Tage'}`}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => setDayOffset(o => o + 1)}
                      className="px-2.5 py-1.5 rounded-lg border border-gray-700 text-gray-300 hover:border-blue-500 hover:text-blue-400 text-xs font-mono transition-colors">
                      +1
                    </button>
                    <button onClick={() => setDayOffset(o => o + 7)}
                      className="px-2.5 py-1.5 rounded-lg border border-gray-700 text-gray-300 hover:border-blue-500 hover:text-blue-400 text-xs font-mono transition-colors">
                      +7
                    </button>
                  </div>
                  {dayOffset !== 0 && (
                    <button onClick={() => setDayOffset(0)}
                      className="text-xs text-gray-600 hover:text-gray-400 transition-colors px-1">
                      ↺
                    </button>
                  )}
                </div>
              </div>

              {/* Session list */}
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {shiftedPreview.map(s => (
                  <div key={s.id} className="flex items-center gap-3 bg-gray-900 rounded-xl px-3 py-2.5 border border-gray-800">
                    <div className="text-xs font-mono text-gray-400 w-20 shrink-0">{formatDatum(s.datum)}</div>
                    <div className="flex-1">
                      <span className="text-sm font-medium text-white">{s.te}</span>
                      {s.uhrzeit && <span className="text-xs text-gray-500 ml-2">{s.uhrzeit}</span>}
                      {s.notiz && <span className="text-xs text-gray-600 ml-2">· {s.notiz}</span>}
                    </div>
                    {s.geschaetzteDauer && (
                      <span className="text-xs text-gray-500 shrink-0">~{s.geschaetzteDauer} Min</span>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <button onClick={handleConfirmImport}
                  className="flex-1 py-2.5 rounded-xl bg-green-700 hover:bg-green-600 text-white font-semibold text-sm transition-colors">
                  ✓ Importieren
                </button>
                <button onClick={() => { setPreview(null); setDayOffset(0); }}
                  className="px-4 py-2.5 rounded-xl border border-gray-700 text-gray-400 hover:text-white text-sm transition-colors">
                  Neu
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
