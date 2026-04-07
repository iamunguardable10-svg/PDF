import { useState, useEffect, useRef } from 'react';
import { WearableDashboard } from './components/WearableDashboard';
import { MealPlanGenerator } from './components/MealPlanGenerator';
import { MealPlanView } from './components/MealPlanView';
import { ShoppingList } from './components/ShoppingList';
import { ACWRSection } from './components/ACWRSection';
import { Onboarding } from './components/Onboarding';
import { ProfileSettings } from './components/ProfileSettings';
import { AppTour } from './components/AppTour';
import { FoodLog } from './components/FoodLog';
import { NutritionForecast } from './components/NutritionForecast';
import { AuthScreen } from './components/AuthScreen';
import { wearableData as mockWearable, trainingGoals } from './lib/mockData';
import { initialSessions, initialPlannedSessions } from './lib/acwrMockData';
import { decodeShareData } from './lib/trainerShare';
import { TrainerView } from './components/TrainerView';
import { loadProfile, saveProfile } from './lib/profileStorage';
import { loadFoodLog, saveFoodLog } from './lib/foodStorage';
import { loadSessions, saveSessions, loadPlannedSessions, savePlannedSessions } from './lib/trainingStorage';
import { calculateACWR, getCurrentACWR } from './lib/acwrCalculations';
import { calcTDEE, calcMacros } from './types/profile';
import { supabase, CLOUD_ENABLED } from './lib/supabase';
import {
  pullAllData,
  pushProfile, pushSessions, pushPlannedSessions, pushFoodLog,
  deletePlannedSession, deleteFoodEntry,
} from './lib/cloudSync';
import type { DayMealPlan, ShoppingItem, WearableData } from './types/health';
import type { Session, PlannedSession } from './types/acwr';
import type { AthleteProfile } from './types/profile';
import type { FoodEntry } from './types/food';
import type { NutritionForecast as NutritionForecastData } from './lib/foodApi';
import type { User } from '@supabase/supabase-js';

type Tab = 'dashboard' | 'tagebuch' | 'acwr';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [showSettings, setShowSettings] = useState(false);

  // Auth state
  const [user, setUser]           = useState<User | null | 'loading'>('loading');
  const [isGuest, setIsGuest]     = useState(() => !CLOUD_ENABLED || !!localStorage.getItem('fitfuel_guest'));
  const [cloudReady, setCloudReady] = useState(false);

  const [profile, setProfile] = useState<AthleteProfile>(() => loadProfile());
  const [showTour, setShowTour] = useState(() => !localStorage.getItem('fitfuel_tour_done'));

  const [wearable, setWearable] = useState<WearableData>(mockWearable);

  // Dashboard state
  const [mealPlan, setMealPlan] = useState<DayMealPlan[]>([]);
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>([]);
  const [tips, setTips] = useState('');

  // ACWR state
  const [sessions, setSessions] = useState<Session[]>(() => loadSessions());
  const [plannedSessions, setPlannedSessions] = useState<PlannedSession[]>(() => loadPlannedSessions());

  // Food log state
  const [foodLog, setFoodLog] = useState<FoodEntry[]>(() => loadFoodLog());

  // Forecast state
  const [forecast, setForecast] = useState<NutritionForecastData | null>(null);
  const [forecastOutdated, setForecastOutdated] = useState(false);

  // Track which planned/food items were deleted so we can remove from cloud too
  const deletedPlanned = useRef<Set<string>>(new Set());
  const deletedFood    = useRef<Set<string>>(new Set());

  const pendingCount = plannedSessions.filter(s => !s.confirmed).length;
  const today = new Date().toISOString().split('T')[0];
  const todayEntries = foodLog.filter(e => e.date === today);

  // Auto-calculate weeklyTrainings from last 28 days of actual sessions
  const autoWeeklyTrainings = Math.max(1, Math.round(
    sessions.filter(s => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 28);
      return new Date(s.datum) >= cutoff;
    }).length / 4
  ));
  const profileWithAutoFreq = { ...profile, weeklyTrainings: autoWeeklyTrainings };

  const acwrDataPoints = sessions.length > 0 ? calculateACWR(sessions) : [];
  const currentACWRPoint = acwrDataPoints.length > 0 ? getCurrentACWR(acwrDataPoints) : null;
  const acwr = currentACWRPoint?.acwr ?? null;

  const tdee   = calcTDEE(profileWithAutoFreq, acwr);
  const macros = calcMacros(profileWithAutoFreq, tdee);

  // ── Auth setup ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!CLOUD_ENABLED) { setUser(null); return; }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── Load cloud data after login ────────────────────────────────────────────

  useEffect(() => {
    if (!user || user === 'loading' || isGuest || cloudReady) return;

    pullAllData((user as User).id).then(({ profile: cloudProfile, sessions: cloudSessions, plannedSessions: cloudPlanned, foodLog: cloudFood }) => {
      if (cloudProfile) {
        setProfile(cloudProfile);
        saveProfile(cloudProfile);
      }
      if (cloudSessions.length > 0) {
        setSessions(cloudSessions);
        saveSessions(cloudSessions);
      }
      if (cloudPlanned.length > 0) {
        setPlannedSessions(cloudPlanned);
        savePlannedSessions(cloudPlanned);
      }
      if (cloudFood.length > 0) {
        setFoodLog(cloudFood);
        saveFoodLog(cloudFood);
      }
      setCloudReady(true);
    });
  }, [user, isGuest, cloudReady]);

  // ── Persist locally + sync to cloud ───────────────────────────────────────

  const userId = user && user !== 'loading' && !isGuest ? (user as User).id : null;

  useEffect(() => {
    if (profile.onboardingCompleted) {
      saveProfile(profile);
      if (userId) pushProfile(userId, profile);
    }
  }, [profile, userId]);

  useEffect(() => {
    saveFoodLog(foodLog);
    if (userId && cloudReady) pushFoodLog(userId, foodLog);
  }, [foodLog, userId, cloudReady]);

  useEffect(() => {
    saveSessions(sessions);
    if (userId && cloudReady) pushSessions(userId, sessions);
  }, [sessions, userId, cloudReady]);

  useEffect(() => {
    savePlannedSessions(plannedSessions);
    if (userId && cloudReady) pushPlannedSessions(userId, plannedSessions);
  }, [plannedSessions, userId, cloudReady]);

  /* ── Handlers ── */

  const handleTourDone = () => {
    localStorage.setItem('fitfuel_tour_done', '1');
    setShowTour(false);
  };

  const handleOnboardingComplete = (p: AthleteProfile) => {
    setProfile(p);
    saveProfile(p);
  };

  const handleProfileSave = (p: AthleteProfile) => {
    setProfile({ ...p, onboardingCompleted: true });
  };

  const handleAddSession = (s: Session) => setSessions(prev => [...prev, s]);

  const handleAddPlanned = (newSessions: PlannedSession[]) =>
    setPlannedSessions(prev => {
      const existing = new Set(prev.map(s => `${s.datum}-${s.te}`));
      const fresh = newSessions.filter(s => !existing.has(`${s.datum}-${s.te}`));
      return [...prev, ...fresh];
    });

  const handleSessionConfirmed = () => setForecastOutdated(true);

  const handleConfirmPlanned = (id: string, rpe: number, dauer: number) => {
    const ps = plannedSessions.find(s => s.id === id);
    if (!ps || ps.confirmed) return;
    setSessions(prev => [...prev, {
      id: `confirmed-${id}`,
      name: profile.name,
      datum: ps.datum,
      te: ps.te,
      rpe, dauer, tl: rpe * dauer,
    }]);
    setPlannedSessions(prev =>
      prev.map(s => s.id === id ? { ...s, confirmed: true, rpe, actualDauer: dauer } : s)
    );
  };

  const handleUpdatePlanned = (id: string, updates: Partial<PlannedSession>) =>
    setPlannedSessions(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));

  const handleDismissPlanned = (id: string) => {
    deletedPlanned.current.add(id);
    setPlannedSessions(prev => prev.filter(s => s.id !== id));
    if (userId) deletePlannedSession(id);
  };

  const handleLoadMockData = () => {
    setSessions(initialSessions);
    setPlannedSessions(initialPlannedSessions);
    setForecast(null);
    setForecastOutdated(false);
  };

  const handlePlanGenerated = (plan: DayMealPlan[], shopping: ShoppingItem[], tipText: string) => {
    setMealPlan(plan); setShoppingList(shopping); setTips(tipText);
  };

  const handleItemToggle = (index: number) =>
    setShoppingList(prev => prev.map((item, i) =>
      i === index ? { ...item, checked: !item.checked } : item
    ));

  const handleAddFood = (entry: FoodEntry) =>
    setFoodLog(prev => [...prev, entry]);

  const handleDeleteFood = (id: string) => {
    deletedFood.current.add(id);
    setFoodLog(prev => prev.filter(e => e.id !== id));
    if (userId) deleteFoodEntry(id);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setCloudReady(false);
  };

  const handleGuestMode = () => {
    localStorage.setItem('fitfuel_guest', '1');
    setIsGuest(true);
  };

  const handleLoggedIn = () => {
    localStorage.removeItem('fitfuel_guest');
    setIsGuest(false);
    setCloudReady(false);
  };

  /* ── Trainer-Ansicht gate ── */
  const trainerEncoded = window.location.hash.match(/^#trainer\/(.+)$/)?.[1];
  const trainerData = trainerEncoded ? decodeShareData(trainerEncoded) : null;
  if (trainerData) return <TrainerView data={trainerData} />;

  /* ── Auth gate ── */
  if (CLOUD_ENABLED && !isGuest && (user === 'loading' || user === null)) {
    if (user === 'loading') {
      return (
        <div className="min-h-screen bg-[#0a0b0f] flex items-center justify-center">
          <div className="text-gray-600 text-sm">…</div>
        </div>
      );
    }
    return <AuthScreen onGuest={handleGuestMode} onLoggedIn={handleLoggedIn} />;
  }

  /* ── Onboarding gate ── */
  if (!profile.onboardingCompleted) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  const loggedInUser = user && user !== 'loading' ? user as User : null;

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
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'dashboard' ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              🥗 Ernährung
            </button>
            <button
              onClick={() => setActiveTab('tagebuch')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'tagebuch' ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              📒 Tagebuch
            </button>
            <button
              onClick={() => setActiveTab('acwr')}
              className={`relative px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
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

          {/* Profile button */}
          <button
            onClick={() => setShowSettings(true)}
            className="ml-auto flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors px-3 py-1.5 rounded-xl border border-gray-800 hover:border-gray-600"
          >
            <span className="text-base">👤</span>
            <span className="hidden sm:inline">{profile.name}</span>
            {loggedInUser && (
              <span className="hidden sm:inline text-xs text-violet-400">☁</span>
            )}
            <span className="text-xs text-gray-600">⚙</span>
          </button>

          {/* Sign out (only when logged in with account) */}
          {loggedInUser && !isGuest && (
            <button
              onClick={handleSignOut}
              className="text-xs text-gray-600 hover:text-gray-400 transition-colors shrink-0"
              title="Abmelden"
            >
              Abmelden
            </button>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">

        {/* ── ERNÄHRUNG ── */}
        {activeTab === 'dashboard' && (
          <>
            <WearableDashboard data={wearable} onDataChange={setWearable} />
            <NutritionForecast
              plannedSessions={plannedSessions}
              recentSessions={sessions}
              acwrHistory={acwrDataPoints}
              baseTDEE={tdee}
              baseProtein={macros.protein}
              profile={profileWithAutoFreq}
              acwr={acwr}
              outdated={forecastOutdated}
              forecast={forecast}
              onForecastChange={setForecast}
              onForecastGenerated={() => setForecastOutdated(false)}
            />
            <MealPlanGenerator
              wearable={wearable}
              goal={trainingGoals[0]}
              activities={[]}
              onPlanGenerated={handlePlanGenerated}
              profile={profileWithAutoFreq}
              acwr={acwr}
              forecast={forecast}
            />
            {mealPlan.length > 0 ? (
              <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2"><MealPlanView plan={mealPlan} tips={tips} /></div>
                <ShoppingList
                  items={shoppingList}
                  onItemToggle={handleItemToggle}
                  onOrder={() => console.log('Knuspr order')}
                />
              </div>
            ) : (
              <div className="text-center py-12 text-gray-600">
                <div className="text-5xl mb-4">🍽️</div>
                <p className="text-lg">Generiere deinen KI-Ernährungsplan</p>
                <p className="text-sm mt-2">Personalisiert auf dein Profil, ACWR & Trainingsziele</p>
              </div>
            )}
          </>
        )}

        {/* ── TAGEBUCH ── */}
        {activeTab === 'tagebuch' && (
          <FoodLog
            entries={todayEntries}
            targetCalories={tdee}
            targetProtein={macros.protein}
            targetCarbs={macros.carbs}
            targetFat={macros.fat}
            onAdd={handleAddFood}
            onDelete={handleDeleteFood}
          />
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
            onSessionConfirmed={handleSessionConfirmed}
            onLoadMockData={handleLoadMockData}
            playerName={profile.name}
            playerSport={profile.sport}
          />
        )}
      </main>

      {showSettings && (
        <ProfileSettings
          profile={profile}
          onSave={handleProfileSave}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showTour && <AppTour onDone={handleTourDone} />}
    </div>
  );
}

export default App;
