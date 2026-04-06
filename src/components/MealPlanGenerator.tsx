import { useState, useRef } from 'react';
import type { WearableData, TrainingGoal, TrainingActivity, DayMealPlan, ShoppingItem } from '../types/health';
import type { AthleteProfile } from '../types/profile';
import { calcTDEE, calcMacros } from '../types/profile';
import { generateMealPlan } from '../lib/claudeApi';

interface Props {
  wearable: WearableData;
  goal: TrainingGoal;
  activities: TrainingActivity[];
  onPlanGenerated: (plan: DayMealPlan[], shopping: ShoppingItem[], tips: string) => void;
  profile?: AthleteProfile;
  acwr?: number | null;
}

export function MealPlanGenerator({ wearable, goal, activities, onPlanGenerated, profile, acwr }: Props) {
  // Compute personalized targets for display
  const tdee = profile ? calcTDEE(profile, acwr) : goal.dailyCalorieTarget;
  const macros = profile ? calcMacros(profile, tdee) : { protein: goal.proteinTarget, carbs: goal.carbTarget, fat: goal.fatTarget };
  const [days, setDays] = useState(5);
  const [preferences, setPreferences] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [error, setError] = useState('');
  const abortRef = useRef(false);

  const handleGenerate = async () => {
    if (loading) return;
    setLoading(true);
    setStreamText('');
    setError('');
    abortRef.current = false;

    let accumulated = '';

    try {
      await generateMealPlan(
        { wearable, goal, activities, days, preferences, profile, acwr },
        (chunk) => {
          if (abortRef.current) return;
          accumulated += chunk;
          setStreamText(accumulated);
        },
        () => {
          setLoading(false);
          // Parse JSON from accumulated text
          try {
            const jsonMatch = accumulated.match(/```json\s*([\s\S]*?)\s*```/) ||
              accumulated.match(/(\{[\s\S]*\})/);
            const jsonStr = jsonMatch ? jsonMatch[1] : accumulated;
            const parsed = JSON.parse(jsonStr);

            const mealPlans: DayMealPlan[] = parsed.days || [];
            const shoppingList: ShoppingItem[] = (parsed.shoppingList || []).map((item: { name: string; amount: string; category: string }) => ({
              ...item,
              checked: false,
            }));
            const tips = parsed.tips || '';

            onPlanGenerated(mealPlans, shoppingList, tips);
          } catch {
            setError('Fehler beim Verarbeiten des Ernährungsplans. Bitte erneut versuchen.');
          }
        }
      );
    } catch (err) {
      setLoading(false);
      if (err instanceof Error && err.message.includes('API key')) {
        setError('API-Key fehlt. Bitte VITE_ANTHROPIC_API_KEY in der .env-Datei setzen.');
      } else {
        setError('Verbindungsfehler. Bitte erneut versuchen.');
      }
    }
  };

  return (
    <div className="bg-gray-900/50 rounded-3xl p-6 border border-gray-800">
      <div className="flex items-center gap-3 mb-5">
        <span className="text-2xl">🤖</span>
        <div>
          <h2 className="text-lg font-semibold text-white">KI-Ernährungsplan</h2>
          <p className="text-sm text-gray-400">Personalisiert auf dein Profil & ACWR</p>
        </div>
      </div>

      {/* Personalized targets banner */}
      <div className="bg-gray-900 rounded-2xl p-3 border border-gray-800 mb-4 flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-orange-400">🔥</span>
          <span className="text-gray-400">Kalorienziel:</span>
          <span className="text-white font-semibold">{tdee} kcal</span>
        </div>
        <div className="flex items-center gap-2">
          <span>💪</span>
          <span className="text-gray-400">Protein:</span>
          <span className="text-white font-semibold">{macros.protein}g</span>
        </div>
        <div className="flex items-center gap-2">
          <span>🌾</span>
          <span className="text-gray-400">KH:</span>
          <span className="text-white font-semibold">{macros.carbs}g</span>
        </div>
        <div className="flex items-center gap-2">
          <span>🥑</span>
          <span className="text-gray-400">Fett:</span>
          <span className="text-white font-semibold">{macros.fat}g</span>
        </div>
        {acwr != null && (
          <div className="flex items-center gap-2 ml-auto">
            <span className={acwr > 1.3 ? 'text-red-400' : acwr < 0.7 ? 'text-blue-400' : 'text-green-400'}>
              {acwr > 1.3 ? '🔴' : acwr < 0.7 ? '🔵' : '🟢'}
            </span>
            <span className="text-gray-400">ACWR:</span>
            <span className="text-white font-semibold">{acwr.toFixed(2)}</span>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {/* Days selector */}
        <div>
          <label className="text-sm text-gray-400 mb-2 block">Planung für</label>
          <div className="flex gap-2">
            {[3, 5, 7].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
                  days === d
                    ? 'border-violet-500 bg-violet-900/40 text-violet-300'
                    : 'border-gray-700 text-gray-400 hover:border-gray-600'
                }`}
              >
                {d} Tage
              </button>
            ))}
          </div>
        </div>

        {/* Preferences */}
        <div>
          <label className="text-sm text-gray-400 mb-2 block">Ernährungspräferenzen (optional)</label>
          <input
            type="text"
            value={preferences}
            onChange={(e) => setPreferences(e.target.value)}
            placeholder="z.B. vegetarisch, laktosefrei, kein Schweinefleisch..."
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 transition-colors"
          />
        </div>

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={loading}
          className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all ${
            loading
              ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white shadow-lg shadow-violet-900/30'
          }`}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Plane deinen Ernährungsplan...
            </span>
          ) : (
            '✨ Ernährungsplan generieren'
          )}
        </button>

        {/* Error message */}
        {error && (
          <div className="bg-red-900/30 border border-red-800 rounded-xl p-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Streaming preview */}
        {loading && streamText && (
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 max-h-48 overflow-y-auto">
            <div className="text-xs text-gray-500 mb-2">Generiere Plan...</div>
            <pre className="text-xs text-gray-400 whitespace-pre-wrap font-mono streaming-text">
              {streamText.slice(-500)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
