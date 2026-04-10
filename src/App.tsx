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
import { LandingPage } from './components/LandingPage';
import { wearableData as mockWearable, trainingGoals } from './lib/mockData';
import { initialSessions, initialPlannedSessions } from './lib/acwrMockData';
import { decodeShareData } from './lib/trainerShare';
import { TrainerView } from './components/TrainerView';
import { TrainerDashboard } from './components/TrainerDashboard';
import { InviteAccept } from './components/InviteAccept';
import { loadProfile, saveProfile } from './lib/profileStorage';
import { loadFoodLog, saveFoodLog } from './lib/foodStorage';
import { loadSessions, saveSessions, loadPlannedSessions, savePlannedSessions } from './lib/trainingStorage';
import { calculateACWR, getCurrentACWR } from './lib/acwrCalculations';
import { calcTDEE, calcMacros } from './types/profile';
import { supabase, CLOUD_ENABLED } from './lib/supabase';
import { isLiveToken } from './lib/trainerShare';
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
  const [currentHash, setCurrentHash] = useState(() => window.location.hash);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [showSettings, setShowSettings] = useState(false);

  // Landing page — show once to new visitors
  const [showLanding, setShowLanding] = useState(
    () => !localStorage.getItem('fitfuel_seen_landing')
  );

  // Auth state
  const [user, setUser]           = useState<User | null | 'loading'>('loading');
  const [isGuest, setIsGuest]     = useState(() => !CLOUD_ENABLED || !!localStorage.getItem('fitfuel_guest'));
  const [cloudReady, setCloudReady] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

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
      // Already logged in → skip landing page + tour
      if (session?.user) {
        localStorage.setItem('fitfuel_seen_landing', '1');
        localStorage.setItem('fitfuel_tour_done', '1');
        setShowLanding(false);
        setShowTour(false);
        setIsGuest(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      // Email confirmation or login → skip landing page + auth screen + tour
      if (session?.user) {
        localStorage.setItem('fitfuel_seen_landing', '1');
        localStorage.setItem('fitfuel_tour_done', '1');
        setShowLanding(false);
        setShowTour(false);
        localStorage.removeItem('fitfuel_guest');
        setIsGuest(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── Hash change tracking ───────────────────────────────────────────────────
  useEffect(() => {
    const onHashChange = () => setCurrentHash(window.location.hash);
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
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
  const trainerHash = currentHash.match(/^#trainer\/(.+)$/)?.[1];
  if (trainerHash) {
    if (isLiveToken(trainerHash)) return <TrainerView token={trainerHash} />;
    const trainerData = decodeShareData(trainerHash);
    if (trainerData) return <TrainerView data={trainerData} />;
  }

  /* ── Landing page ── */
  if (showLanding && !user) {
    const dismissLanding = () => {
      localStorage.setItem('fitfuel_seen_landing', '1');
      setShowLanding(false);
    };
    return (
      <>
        <LandingPage
          onStart={() => setShowAuthModal(true)}
          onGuest={() => { dismissLanding(); handleGuestMode(); }}
        />
        {showAuthModal && CLOUD_ENABLED && (
          <AuthScreen
            onClose={() => setShowAuthModal(false)}
            onGuest={() => { dismissLanding(); handleGuestMode(); setShowAuthModal(false); }}
            onLoggedIn={() => { handleLoggedIn(); setShowAuthModal(false); }}
          />
        )}
      </>
    );
  }

  /* ── Auth gate — skip when modal is open or still loading ── */
  if (CLOUD_ENABLED && !isGuest && !showAuthModal && user === 'loading') {
    return (
      <div className="min-h-screen bg-[#0a0b0f] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (CLOUD_ENABLED && !isGuest && !showAuthModal && user === null) {
    return <AuthScreen onGuest={handleGuestMode} onLoggedIn={handleLoggedIn} />;
  }

  /* ── Onboarding gate ── */
  if (!profile.onboardingCompleted) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  const loggedInUser = user && user !== 'loading' ? user as User : null;

  /* ── Invite acceptance gate (athletes, before coach gate) ── */
  const inviteHash = currentHash.match(/^#invite\/(.+)$/)?.[1];
  if (inviteHash) {
    return (
      <InviteAccept
        inviteCode={inviteHash}
        user={loggedInUser}
        onLoginRequest={() => setShowAuthModal(true)}
      />
    );
  }

  /* ── Coach Dashboard gate ── */
  if (currentHash === '#coach') {
    if (loggedInUser && !isGuest) return <TrainerDashboard user={loggedInUser} trainerName={profile.name || loggedInUser.email || 'Trainer'} />;
    setCurrentHash('');
    window.location.hash = '';
  }

  return (
    <div className="min-h-screen bg-[#0a0b0f] text-white">
      {/* Header */}
      <header className="border-b border-white/5 bg-[#0a0b0f]/80 backdrop-blur-xl sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
          {/* Logo */}
          <button
            onClick={() => { localStorage.removeItem('fitfuel_seen_landing'); setShowLanding(true); }}
            className="flex items-center gap-2.5 flex-1 hover:opacity-80 transition-opacity"
          >
            <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-700 rounded-xl flex items-center justify-center text-base shadow-lg shadow-violet-900/40">
              🥗
            </div>
            <span className="text-base font-bold text-white tracking-tight">FitFuel</span>
          </button>

          {/* Desktop tabs (hidden on mobile) */}
          <nav className="hidden sm:flex gap-0.5 bg-white/5 rounded-xl p-1">
            {([
              { id: 'dashboard', label: 'Ernährung', icon: '🥗', badge: 0 },
              { id: 'tagebuch',  label: 'Tagebuch',  icon: '📒', badge: 0 },
              { id: 'acwr',      label: 'ACWR',       icon: '📊', badge: pendingCount },
            ] as const).map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`relative px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === t.id
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {t.label}
                {t.badge > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                    {t.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            {CLOUD_ENABLED && !loggedInUser && (
              <button
                onClick={() => setShowAuthModal(true)}
                className="text-xs px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold transition-all shadow-sm shadow-violet-900/50"
              >
                Anmelden
              </button>
            )}
            {loggedInUser && !isGuest && (
              <button
                onClick={() => { window.location.hash = '#coach'; setCurrentHash('#coach'); }}
                className="text-xs px-3 py-1.5 rounded-xl border border-gray-700 text-gray-400 hover:border-violet-500 hover:text-violet-400 transition-all"
              >
                Trainer
              </button>
            )}
            {loggedInUser && !isGuest && (
              <button onClick={handleSignOut} className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
                Abmelden
              </button>
            )}
            <button
              onClick={() => setShowSettings(true)}
              className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-all"
              title="Einstellungen"
            >
              {loggedInUser ? <span className="text-violet-400 text-xs">☁</span> : <span className="text-sm">👤</span>}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-4 pb-24 sm:pb-6 space-y-4">

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
              <div className="text-center py-16 text-gray-600">
                <div className="text-6xl mb-5 opacity-60">🍽️</div>
                <p className="text-base font-semibold text-gray-500">Noch kein Ernährungsplan</p>
                <p className="text-sm mt-1 text-gray-700">Tippe auf "Plan generieren" um zu starten</p>
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
            userId={loggedInUser?.id}
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

      {showTour && !userId && <AppTour onDone={handleTourDone} />}

      {/* Bottom navigation — mobile only */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-20 bg-[#0d0e14]/95 backdrop-blur-xl border-t border-white/5">
        <div className="flex items-stretch h-16">
          {([
            { id: 'dashboard', label: 'Ernährung', icon: '🥗', badge: 0 },
            { id: 'tagebuch',  label: 'Tagebuch',  icon: '📒', badge: 0 },
            { id: 'acwr',      label: 'ACWR',       icon: '📊', badge: pendingCount },
          ] as const).map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 transition-all ${
                activeTab === t.id ? 'text-violet-400' : 'text-gray-600'
              }`}
            >
              <span className={`text-xl transition-transform ${activeTab === t.id ? 'scale-110' : ''}`}>{t.icon}</span>
              <span className={`text-[10px] font-medium ${activeTab === t.id ? 'text-violet-400' : 'text-gray-600'}`}>
                {t.label}
              </span>
              {t.badge > 0 && (
                <span className="absolute top-2 right-[calc(50%-14px)] w-4 h-4 bg-orange-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                  {t.badge}
                </span>
              )}
              {activeTab === t.id && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-violet-500 rounded-full" />
              )}
            </button>
          ))}
        </div>
        {/* iOS safe area */}
        <div className="h-safe-bottom bg-[#0d0e14]/95" />
      </nav>

      {showAuthModal && CLOUD_ENABLED && (
        <AuthScreen
          onGuest={() => { handleGuestMode(); setShowAuthModal(false); }}
          onLoggedIn={() => { handleLoggedIn(); setShowAuthModal(false); }}
          onClose={() => setShowAuthModal(false)}
        />
      )}
    </div>
  );
}

export default App;
