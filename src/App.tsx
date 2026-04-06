import { useState } from 'react';
import { WearableDashboard } from './components/WearableDashboard';
import { TrainingSection } from './components/TrainingSection';
import { MealPlanGenerator } from './components/MealPlanGenerator';
import { MealPlanView } from './components/MealPlanView';
import { ShoppingList } from './components/ShoppingList';
import { ACWRSection } from './components/ACWRSection';
import { wearableData, trainingGoals, recentActivities } from './lib/mockData';
import { initialSessions } from './lib/acwrMockData';
import type { DayMealPlan, ShoppingItem, TrainingGoal } from './types/health';
import type { Session } from './types/acwr';

type Tab = 'dashboard' | 'acwr';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  // Dashboard state
  const [selectedGoal, setSelectedGoal] = useState<TrainingGoal>(trainingGoals[0]);
  const [mealPlan, setMealPlan] = useState<DayMealPlan[]>([]);
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>([]);
  const [tips, setTips] = useState('');

  // ACWR state
  const [sessions, setSessions] = useState<Session[]>(initialSessions);

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
    console.log('Ordering from Knuspr:', shoppingList.filter(i => !i.checked));
  };

  const handleAddSession = (s: Session) => {
    setSessions(prev => [...prev, s]);
  };

  return (
    <div className="min-h-screen bg-[#0a0b0f] text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-purple-700 rounded-xl flex items-center justify-center text-lg">
              🥗
            </div>
            <div>
              <h1 className="text-lg font-bold text-white leading-none">FitFuel</h1>
              <p className="text-xs text-gray-500">KI-Ernährungsassistent</p>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-1 ml-4 bg-gray-900 rounded-xl p-1 border border-gray-800">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-violet-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              🥗 Ernährung
            </button>
            <button
              onClick={() => setActiveTab('acwr')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'acwr'
                  ? 'bg-violet-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              📊 ACWR
            </button>
          </div>

          <div className="ml-auto flex items-center gap-2 text-sm text-gray-400">
            <span>👋</span>
            <span>Ben</span>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">

        {/* ── DASHBOARD TAB ── */}
        {activeTab === 'dashboard' && (
          <>
            <div className="grid lg:grid-cols-2 gap-6">
              <WearableDashboard data={wearableData} />
              <TrainingSection
                goals={trainingGoals}
                selectedGoal={selectedGoal}
                onGoalChange={setSelectedGoal}
                activities={recentActivities}
              />
            </div>

            <MealPlanGenerator
              wearable={wearableData}
              goal={selectedGoal}
              activities={recentActivities}
              onPlanGenerated={handlePlanGenerated}
            />

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

            {mealPlan.length === 0 && (
              <div className="text-center py-16 text-gray-600">
                <div className="text-5xl mb-4">🍽️</div>
                <p className="text-lg">Generiere deinen ersten KI-Ernährungsplan</p>
                <p className="text-sm mt-2">Personalisiert auf deine Wearable-Daten & Trainingsziele</p>
              </div>
            )}
          </>
        )}

        {/* ── ACWR TAB ── */}
        {activeTab === 'acwr' && (
          <ACWRSection
            sessions={sessions}
            onAddSession={handleAddSession}
            playerName="Ben"
          />
        )}
      </main>
    </div>
  );
}

export default App;
