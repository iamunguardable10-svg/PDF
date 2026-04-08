import { useState } from 'react';
import type { DayMealPlan } from '../types/health';

interface Props {
  plan: DayMealPlan[];
  tips: string;
}

export function MealPlanView({ plan, tips }: Props) {
  const [selectedDay, setSelectedDay] = useState(0);

  if (!plan || plan.length === 0) return null;

  const day = plan[selectedDay];

  return (
    <div className="bg-gray-900/50 rounded-3xl border border-gray-800 overflow-hidden">
      {/* Day tabs */}
      <div className="flex overflow-x-auto border-b border-gray-800 bg-gray-900/50">
        {plan.map((d, i) => (
          <button
            key={i}
            onClick={() => setSelectedDay(i)}
            className={`shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
              selectedDay === i
                ? 'border-violet-500 text-violet-300'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {d.day.split(' - ')[0]}
          </button>
        ))}
      </div>

      <div className="p-6 space-y-4">
        {/* Day summary */}
        {(() => {
          const meals = day.meals || [];
          const totalKcal = meals.reduce((s, m) => s + (m.calories || 0), 0);
          const totalP    = meals.reduce((s, m) => s + (m.protein  || 0), 0);
          const totalC    = meals.reduce((s, m) => s + (m.carbs    || 0), 0);
          const totalF    = meals.reduce((s, m) => s + (m.fat      || 0), 0);
          return (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-white">{day.day}</h3>
                  <p className="text-sm text-gray-400">{meals.length} Mahlzeiten</p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-orange-400">{totalKcal} kcal</div>
                  <div className="text-xs text-gray-500">Tagesgesamt</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-gray-900 rounded-xl py-2 px-3 border border-gray-800">
                  <div className="text-sm font-bold text-blue-400">{totalP}g</div>
                  <div className="text-xs text-gray-500">Protein</div>
                </div>
                <div className="bg-gray-900 rounded-xl py-2 px-3 border border-gray-800">
                  <div className="text-sm font-bold text-yellow-400">{totalC}g</div>
                  <div className="text-xs text-gray-500">Kohlenhydrate</div>
                </div>
                <div className="bg-gray-900 rounded-xl py-2 px-3 border border-gray-800">
                  <div className="text-sm font-bold text-green-400">{totalF}g</div>
                  <div className="text-xs text-gray-500">Fett</div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Meals */}
        <div className="space-y-3">
          {(day.meals || []).map((meal, i) => (
            <details key={i} className="bg-gray-900 rounded-2xl border border-gray-800 group">
              <summary className="flex items-center justify-between p-4 cursor-pointer list-none">
                <div className="flex items-center gap-3">
                  <div className="text-sm font-bold text-gray-500 w-10 shrink-0">{meal.time}</div>
                  <div>
                    <div className="font-medium text-white text-sm">{meal.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      P: {meal.protein}g · KH: {meal.carbs}g · F: {meal.fat}g
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-semibold text-orange-400">{meal.calories} kcal</span>
                  <span className="text-gray-600 group-open:rotate-180 transition-transform">▼</span>
                </div>
              </summary>

              <div className="px-4 pb-4 border-t border-gray-800 mt-0 pt-3">
                <div className="mb-3">
                  <div className="text-xs text-gray-500 mb-1.5 font-medium uppercase tracking-wide">Zutaten</div>
                  <ul className="space-y-1">
                    {(meal.ingredients || []).map((ing, j) => (
                      <li key={j} className="text-sm text-gray-300 flex items-start gap-2">
                        <span className="text-gray-600 mt-0.5">•</span>
                        {ing}
                      </li>
                    ))}
                  </ul>
                </div>
                {meal.preparation && (
                  <div>
                    <div className="text-xs text-gray-500 mb-1.5 font-medium uppercase tracking-wide">Zubereitung</div>
                    <p className="text-sm text-gray-300">{meal.preparation}</p>
                  </div>
                )}
              </div>
            </details>
          ))}
        </div>

        {/* Tips */}
        {tips && selectedDay === 0 && (
          <div className="bg-violet-900/20 border border-violet-800/50 rounded-2xl p-4">
            <div className="text-sm font-medium text-violet-300 mb-1.5">💡 Persönliche Tipps</div>
            <p className="text-sm text-gray-300">{tips}</p>
          </div>
        )}
      </div>
    </div>
  );
}
