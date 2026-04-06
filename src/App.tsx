import { useState } from 'react';
import { WearableDashboard } from './components/WearableDashboard';
import { TrainingSection } from './components/TrainingSection';
import { MealPlanGenerator } from './components/MealPlanGenerator';
import { MealPlanView } from './components/MealPlanView';
import { ShoppingList } from './components/ShoppingList';
import { ACWRSection } from './components/ACWRSection';
import { wearableData, trainingGoals, recentActivities } from './lib/mockData';
import { initialSessions, initialPlannedSessions } from './lib/acwrMockData';
import type { DayMealPlan, ShoppingItem, TrainingGoal } from './types/health';
import type { Session, PlannedSession } from './types/acwr';

type Tab = 'dashboard' | 'acwr';

const PLAYER_NAME = 'Athlet';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  // Dashboard state
  const [selectedGoal, setSelectedGoal] = useState<TrainingGoal>(trainingGoals[0]);
  const [mealPlan, setMealPlan] = useState<DayMealPlan[]>([]);
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>([]);
  const [tips, setTips] = useState('');

  // ACWR state
  const [sessions, setSessions] = useState<Session[]>(initialSessions);
  const [plannedSessions, setPlannedSessions] = useState<PlannedSession[]>(initialPlannedSessions);

  const pendingCount = plannedSessions.filter(s => !s.confirmed).length;

  /* ── ACWR handlers ── */

  const handleAddSession = (s: Session) => setSessions(prev => [...prev, s]);

  const handleAddPlanned = (newSessions: PlannedSession[]) =>
    setPlannedSessions(prev => {
      // Duplikate (gleicher Tag + TE) verhindern
      const existing = new Set(prev.map(s => `${s.datum}-${s.te}`));
      const fresh = newSessions.filter(s => !existing.has(`${s.datum}-${s.te}`));
      return [...prev, ...fresh];
    });

  /** Geplante Session bestätigen → wird als Session gespeichert + aus Pending entfernt */
  const handleConfirmPlanned = (id: string, rpe: number, dauer: number) => {
    const ps = plannedSessions.find(s => s.id === id);
    if (!ps) return;

    const newSession: Session = {
      id: `confirmed-${id}`,
      name: PLAYER_NAME,
      datum: ps.datum,
      te: ps.te,
      rpe,
      dauer,
      tl: rpe * dauer,
    };

    setSessions(prev => [...prev, newSession]);
    setPlannedSessions(prev =>
      prev.map(s => s.id === id ? { ...s, confirmed: true, rpe, actualDauer: dauer } : s)
    );
  };

  /** Geplante Session nachträglich bearbeiten */
  const handleUpdatePlanned = (id: string, updates: Partial<PlannedSession>) =>
    setPlannedSessions(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));

  /** Planned session entfernen */
  const handleDismissPlanned = (id: string) =>
    setPlannedSessions(prev => prev.filter(s => s.id !== id));

  /* ── Meal plan handlers ── */

  const handlePlanGenerated = (plan: DayMealPlan[], shopping: ShoppingItem[], tipText: string) => {
    setMealPlan(plan); setShoppingList(shopping); setTips(tipText);
  };

  const handleItemToggle = (index: number) =>
    setShoppingList(prev => prev.map((item, i) =>
      i === index ? { ...item, checked: !item.checked } : item
    ));

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
              <p className="text-xs text-gray-500">KI-Gesundheitsassistent</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 ml-4 bg-gray-900 rounded-xl p-1 border border-gray-800">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'dashboard' ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              🥗 Ernährung
            </button>
            <button
              onClick={() => setActiveTab('acwr')}
              className={`relative px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'acwr' ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              📊 ACWR
              {pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                  {pendingCount}
                </span>
              )}
            </button>
          </div>

          <div className="ml-auto text-sm text-gray-400">👤 {PLAYER_NAME}</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* ── ERNÄHRUNG ── */}
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
            {mealPlan.length > 0 ? (
              <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2"><MealPlanView plan={mealPlan} tips={tips} /></div>
                <div>
                  <ShoppingList
                    items={shoppingList}
                    onItemToggle={handleItemToggle}
                    onOrder={() => console.log('Knuspr order')}
                  />
                </div>
              </div>
            ) : (
              <div className="text-center py-16 text-gray-600">
                <div className="text-5xl mb-4">🍽️</div>
                <p className="text-lg">Generiere deinen ersten KI-Ernährungsplan</p>
                <p className="text-sm mt-2">Personalisiert auf deine Wearable-Daten & Trainingsziele</p>
              </div>
            )}
          </>
        )}

        {/* ── ACWR ── */}
        {activeTab === 'acwr' && (
          <ACWRSection
            sessions={sessions}
            plannedSessions={plannedSessions}
            onAddSession={handleAddSession}
            onAddPlanned={handleAddPlanned}
            onConfirmPlanned={handleConfirmPlanned}
            onUpdatePlanned={handleUpdatePlanned}
            onDismissPlanned={handleDismissPlanned}
            playerName={PLAYER_NAME}
          />
        )}
      </main>
    </div>
  );
}

export default App;
