import type { TrainingGoal, TrainingActivity } from '../types/health';

interface Props {
  goals: TrainingGoal[];
  selectedGoal: TrainingGoal;
  onGoalChange: (goal: TrainingGoal) => void;
  activities: TrainingActivity[];
}

export function TrainingSection({ goals, selectedGoal, onGoalChange, activities }: Props) {
  const intensityColor = (intensity: TrainingActivity['intensity']) => {
    switch (intensity) {
      case 'leicht': return 'text-green-400 bg-green-900/30';
      case 'mittel': return 'text-yellow-400 bg-yellow-900/30';
      case 'intensiv': return 'text-red-400 bg-red-900/30';
    }
  };

  return (
    <div className="space-y-4">
      {/* Goal Selection */}
      <div className="bg-gray-900/50 rounded-3xl p-6 border border-gray-800">
        <h2 className="text-lg font-semibold text-white mb-4">🎯 Trainingsziel</h2>
        <div className="grid grid-cols-2 gap-2">
          {goals.map((goal) => (
            <button
              key={goal.type}
              onClick={() => onGoalChange(goal)}
              className={`p-3 rounded-xl border text-left transition-all ${
                selectedGoal.type === goal.type
                  ? 'border-violet-500 bg-violet-900/30 text-white'
                  : 'border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-600'
              }`}
            >
              <div className="font-medium text-sm">{goal.label}</div>
              <div className="text-xs mt-1 opacity-70">{goal.dailyCalorieTarget} kcal/Tag</div>
            </button>
          ))}
        </div>

        {/* Macro targets */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          {[
            { label: 'Protein', value: selectedGoal.proteinTarget, unit: 'g', color: 'text-blue-400' },
            { label: 'Kohlenhydrate', value: selectedGoal.carbTarget, unit: 'g', color: 'text-amber-400' },
            { label: 'Fett', value: selectedGoal.fatTarget, unit: 'g', color: 'text-pink-400' },
          ].map((macro) => (
            <div key={macro.label} className="bg-gray-900 rounded-xl p-3 border border-gray-800 text-center">
              <div className={`text-lg font-bold ${macro.color}`}>{macro.value}{macro.unit}</div>
              <div className="text-xs text-gray-500">{macro.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activities */}
      <div className="bg-gray-900/50 rounded-3xl p-6 border border-gray-800">
        <h2 className="text-lg font-semibold text-white mb-4">💪 Letzte Aktivitäten</h2>
        <div className="space-y-2">
          {activities.map((activity) => (
            <div
              key={activity.id}
              className="flex items-center gap-3 bg-gray-900 rounded-xl p-3 border border-gray-800"
            >
              <span className="text-2xl">{activity.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-white">{activity.type}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${intensityColor(activity.intensity)}`}>
                    {activity.intensity}
                  </span>
                </div>
                {activity.notes && (
                  <div className="text-xs text-gray-500 mt-0.5 truncate">{activity.notes}</div>
                )}
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-medium text-orange-400">{activity.caloriesBurned} kcal</div>
                <div className="text-xs text-gray-500">{activity.duration} Min · {activity.date}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
