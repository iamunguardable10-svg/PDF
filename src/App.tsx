import { useState } from 'react';
import { WearableDashboard } from './components/WearableDashboard';
import { TrainingSection } from './components/TrainingSection';
import { MealPlanGenerator } from './components/MealPlanGenerator';
import { MealPlanView } from './components/MealPlanView';
import { ShoppingList } from './components/ShoppingList';
import { wearableData, trainingGoals, recentActivities } from './lib/mockData';
import type { DayMealPlan, ShoppingItem, TrainingGoal } from './types/health';

function App() {
  const [selectedGoal, setSelectedGoal] = useState<TrainingGoal>(trainingGoals[0]);
  const [mealPlan, setMealPlan] = useState<DayMealPlan[]>([]);
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>([]);
  const [tips, setTips] = useState('');

  const handlePlanGenerated = (plan: DayMealPlan[], shopping: ShoppingItem[], tipText: string) => {
    setMealPlan(plan);
    setShoppingList(shopping);
    setTips(tipText);
  };

  const handleItemToggle = (index: number) => {
    setShoppingList(prev => prev.map((item, i) =>
      i === index ? { ...item, checked: !item.checked } : item
    ));
  };

  const handleOrder = () => {
    // In production: integrate with Knuspr API
    console.log('Ordering from Knuspr:', shoppingList.filter(i => !i.checked));
  };

  return (
    <div className="min-h-screen bg-[#0a0b0f] text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-purple-700 rounded-xl flex items-center justify-center text-lg">
              🥗
            </div>
            <div>
              <h1 className="text-lg font-bold text-white leading-none">FitFuel</h1>
              <p className="text-xs text-gray-500">KI-Ernährungsassistent</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span>👋</span>
            <span>Hallo, Max!</span>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Top row: wearable + training */}
        <div className="grid lg:grid-cols-2 gap-6">
          <WearableDashboard data={wearableData} />
          <TrainingSection
            goals={trainingGoals}
            selectedGoal={selectedGoal}
            onGoalChange={setSelectedGoal}
            activities={recentActivities}
          />
        </div>

        {/* Meal plan generator */}
        <MealPlanGenerator
          wearable={wearableData}
          goal={selectedGoal}
          activities={recentActivities}
          onPlanGenerated={handlePlanGenerated}
        />

        {/* Results: meal plan + shopping list */}
        {mealPlan.length > 0 && (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <MealPlanView plan={mealPlan} tips={tips} />
            </div>
            <div>
              <ShoppingList
                items={shoppingList}
                onItemToggle={handleItemToggle}
                onOrder={handleOrder}
              />
            </div>
          </div>
        )}

        {/* Empty state */}
        {mealPlan.length === 0 && (
          <div className="text-center py-16 text-gray-600">
            <div className="text-5xl mb-4">🍽️</div>
            <p className="text-lg">Generiere deinen ersten KI-Ernährungsplan</p>
            <p className="text-sm mt-2">Personalisiert auf deine Wearable-Daten & Trainingsziele</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
