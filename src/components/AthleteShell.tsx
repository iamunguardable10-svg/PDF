import { useState, useEffect, useRef } from 'react';
import { CalendarDays, Users, Activity, UtensilsCrossed, BookOpen, Dumbbell } from 'lucide-react';
import { WearableDashboard } from './WearableDashboard';
import { MealPlanGenerator } from './MealPlanGenerator';
import { MealPlanView } from './MealPlanView';
import { ShoppingList } from './ShoppingList';
import { ACWRSection } from './ACWRSection';
import { ProfileSettings } from './ProfileSettings';
import { FoodLog } from './FoodLog';
import { NutritionForecast } from './NutritionForecast';
import { TeamTab } from './attendance/TeamTab';
import { TeamJoinScreen } from './attendance/TeamJoinScreen';
import { ClubJoinFlow } from './onboarding/ClubJoinFlow';
import { UnifiedAthleteCalendar } from './attendance/UnifiedAthleteCalendar';
import { wearableData as mockWearable, trainingGoals } from '../lib/mockData';
import { initialSessions, initialPlannedSessions } from '../lib/acwrMockData';
import { loadFoodLog, saveFoodLog } from '../lib/foodStorage';
import { loadSessions, saveSessions, loadPlannedSessions, savePlannedSessions } from '../lib/trainingStorage';
import { calculateACWR, getCurrentACWR } from '../lib/acwrCalculations';
import { calcTDEE, calcMacros } from '../types/profile';
import {
  pullAllData,
  pushProfile, pushSessions, pushPlannedSessions, pushFoodLog,
  deletePlannedSession, deleteFoodEntry,
} from '../lib/cloudSync';
import { saveProfile } from '../lib/profileStorage';
import type { DayMealPlan, ShoppingItem, WearableData } from '../types/health';
import type { Session, PlannedSession } from '../types/acwr';
import type { AthleteProfile } from '../types/profile';
import type { FoodEntry } from '../types/food';
import type { NutritionForecast as NutritionForecastData } from '../lib/foodApi';
import type { AppMode } from '../types/appMode';
import type { User } from '@supabase/supabase-js';

// ── Tab definitions ───────────────────────────────────────────────────────────

// Athlet: Calendar-first (team sport focus)
type AthleteTab = 'kalender' | 'team' | 'performance' | 'ernaehrung' | 'tagebuch';
// Solo: Nutrition-first (personal training focus)
type SoloTab = 'ernaehrung' | 'tagebuch' | 'performance';
type AnyTab = AthleteTab | SoloTab;

interface TabDef {
  id: AnyTab;
  label: string;
  Icon: React.ElementType;
  badge?: number;
}

interface Props {
  user: User | null;
  isGuest: boolean;
  mode: AppMode;
  profile: AthleteProfile;
  onProfileChange: (p: AthleteProfile) => void;
  onShowAuth: () => void;
  onSignOut: () => void;
  onSwitchRole: () => void;
  teamJoinToken?: string;
  onTeamJoinDone: () => void;
}

export function AthleteShell({
  user,
  isGuest,
  mode,
  profile,
  onProfileChange,
  onShowAuth,
  onSignOut,
  onSwitchRole,
  teamJoinToken,
  onTeamJoinDone,
}: Props) {
  const isSolo = mode === 'solo';
  const [activeTab, setActiveTab] = useState<AnyTab>(isSolo ? 'ernaehrung' : 'kalender');
  const [showSettings, setShowSettings] = useState(false);
  const [showJoinFlow, setShowJoinFlow] = useState(false);

  const [wearable, setWearable] = useState<WearableData>(mockWearable);

  const [mealPlan, setMealPlan] = useState<DayMealPlan[]>([]);
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>([]);
  const [tips, setTips] = useState('');

  const [sessions, setSessions] = useState<Session[]>(() => loadSessions());
  const [plannedSessions, setPlannedSessions] = useState<PlannedSession[]>(() => loadPlannedSessions());

  const [foodLog, setFoodLog] = useState<FoodEntry[]>(() => loadFoodLog());
  const [forecast, setForecast] = useState<NutritionForecastData | null>(null);
  const [forecastOutdated, setForecastOutdated] = useState(false);

  const [cloudReady, setCloudReady] = useState(false);
  const deletedPlanned = useRef<Set<string>>(new Set());
  const deletedFood    = useRef<Set<string>>(new Set());

  const userId = user && !isGuest ? user.id : null;
  const today  = new Date().toISOString().split('T')[0];
  const todayEntries  = foodLog.filter(e => e.date === today);
  const pendingCount  = plannedSessions.filter(s => !s.confirmed).length;

  const autoWeeklyTrainings = Math.max(1, Math.round(
    sessions.filter(s => {
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 28);
      return new Date(s.datum) >= cutoff;
    }).length / 4
  ));
  const profileWithAutoFreq = { ...profile, weeklyTrainings: autoWeeklyTrainings };
  const acwrDataPoints  = sessions.length > 0 ? calculateACWR(sessions) : [];
  const currentACWR     = acwrDataPoints.length > 0 ? getCurrentACWR(acwrDataPoints) : null;
  const acwr            = currentACWR?.acwr ?? null;
  const tdee   = calcTDEE(profileWithAutoFreq, acwr);
  const macros = calcMacros(profileWithAutoFreq, tdee);

  // ── Cloud sync ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!userId || cloudReady) return;
    pullAllData(userId).then(({ profile: cp, sessions: cs, plannedSessions: cpl, foodLog: cf }) => {
      if (cp) { onProfileChange(cp); saveProfile(cp); }
      if (cs.length > 0)  { setSessions(cs);         saveSessions(cs); }
      if (cpl.length > 0) { setPlannedSessions(cpl); savePlannedSessions(cpl); }
      if (cf.length > 0)  { setFoodLog(cf);           saveFoodLog(cf); }
      setCloudReady(true);
    });
  }, [userId, cloudReady]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (profile.onboardingCompleted) { saveProfile(profile); if (userId) pushProfile(userId, profile); }
  }, [profile, userId]);

  useEffect(() => { saveFoodLog(foodLog);           if (userId && cloudReady) pushFoodLog(userId, foodLog); }, [foodLog, userId, cloudReady]);
  useEffect(() => { saveSessions(sessions);          if (userId && cloudReady) pushSessions(userId, sessions); }, [sessions, userId, cloudReady]);
  useEffect(() => { savePlannedSessions(plannedSessions); if (userId && cloudReady) pushPlannedSessions(userId, plannedSessions); }, [plannedSessions, userId, cloudReady]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleAddSession     = (s: Session) => setSessions(prev => [...prev, s]);
  const handleDeleteSession  = (id: string) => setSessions(prev => prev.filter(s => s.id !== id));
  const handleEditSession    = (id: string, rpe: number, dauer: number) =>
    setSessions(prev => prev.map(s => s.id === id ? { ...s, rpe, dauer, tl: rpe * dauer } : s));

  const handleAddPlanned = (newSessions: PlannedSession[]) =>
    setPlannedSessions(prev => {
      const existing = new Set(prev.map(s => `${s.datum}-${s.te}`));
      return [...prev, ...newSessions.filter(s => !existing.has(`${s.datum}-${s.te}`))];
    });

  const handleConfirmPlanned = (id: string, rpe: number, dauer: number) => {
    const ps = plannedSessions.find(s => s.id === id);
    if (!ps || ps.confirmed) return;
    setSessions(prev => [...prev, { id: `confirmed-${id}`, name: profile.name, datum: ps.datum, te: ps.te, rpe, dauer, tl: rpe * dauer }]);
    setPlannedSessions(prev => prev.map(s => s.id === id ? { ...s, confirmed: true, rpe, actualDauer: dauer } : s));
  };

  const handleUpdatePlanned  = (id: string, updates: Partial<PlannedSession>) =>
    setPlannedSessions(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));

  const handleDismissPlanned = (id: string) => {
    deletedPlanned.current.add(id);
    setPlannedSessions(prev => prev.filter(s => s.id !== id));
    if (userId) deletePlannedSession(id);
  };

  const handleAddFood    = (entry: FoodEntry) => setFoodLog(prev => [...prev, entry]);
  const handleDeleteFood = (id: string) => {
    deletedFood.current.add(id);
    setFoodLog(prev => prev.filter(e => e.id !== id));
    if (userId) deleteFoodEntry(id);
  };
  const handleProfileSave = (p: AthleteProfile) => onProfileChange({ ...p, onboardingCompleted: true });
  const handleLoadMockData = () => { setSessions(initialSessions); setPlannedSessions(initialPlannedSessions); setForecast(null); setForecastOutdated(false); };
  const handlePlanGenerated = (plan: DayMealPlan[], shopping: ShoppingItem[], tipText: string) =>
    { setMealPlan(plan); setShoppingList(shopping); setTips(tipText); };
  const handleItemToggle = (index: number) =>
    setShoppingList(prev => prev.map((item, i) => i === index ? { ...item, checked: !item.checked } : item));

  // ── Tab config — differs by mode ───────────────────────────────────────────

  const ATHLETE_TABS: TabDef[] = [
    { id: 'kalender',    label: 'Kalender',    Icon: CalendarDays },
    { id: 'team',        label: 'Team',         Icon: Users },
    { id: 'performance', label: 'Performance',  Icon: Activity,         badge: pendingCount },
    { id: 'ernaehrung',  label: 'Ernährung',    Icon: UtensilsCrossed },
    { id: 'tagebuch',    label: 'Tagebuch',     Icon: BookOpen },
  ];

  const SOLO_TABS: TabDef[] = [
    { id: 'ernaehrung',  label: 'Ernährung',    Icon: UtensilsCrossed },
    { id: 'tagebuch',    label: 'Tagebuch',     Icon: BookOpen },
    { id: 'performance', label: 'Training',     Icon: Dumbbell,         badge: pendingCount },
  ];

  const TABS = isSolo ? SOLO_TABS : ATHLETE_TABS;

  // ── Team join deep-link ────────────────────────────────────────────────────

  if (teamJoinToken && user) {
    return (
      <TeamJoinScreen
        token={teamJoinToken}
        userId={user.id}
        userName={profile.name || user.email || 'Athlet'}
        userSport={profile.sport || ''}
        onJoined={() => { onTeamJoinDone(); setActiveTab('team'); }}
        onBack={onTeamJoinDone}
      />
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0a0b0f] text-white">
      {/* Header */}
      <header className="border-b border-white/5 bg-[#0a0b0f]/80 backdrop-blur-xl sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
          <div className="flex items-center gap-2.5 flex-1">
            <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-700 rounded-xl flex items-center justify-center text-base shadow-lg shadow-violet-900/40">
              {isSolo ? '🏃' : '🥗'}
            </div>
            <div className="min-w-0">
              <span className="text-sm font-bold text-white tracking-tight">{isSolo ? 'Solo Training' : 'Club OS'}</span>
              {profile.name && <span className="text-[11px] text-gray-600 ml-2 hidden sm:inline">{profile.name}</span>}
            </div>
          </div>

          {/* Desktop tabs */}
          <nav className="hidden sm:flex gap-0.5 bg-white/5 rounded-xl p-1">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === t.id ? 'bg-violet-600 text-white shadow-sm' : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}>
                <t.Icon size={13} />
                {t.label}
                {(t.badge ?? 0) > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                    {t.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {!user && (
              <button onClick={onShowAuth}
                className="text-xs px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold transition-all">
                Anmelden
              </button>
            )}
            {user && !isGuest && (
              <>
                <button onClick={onSwitchRole}
                  className="text-xs px-3 py-1.5 rounded-xl border border-gray-700 text-gray-400 hover:border-violet-500 hover:text-violet-400 transition-all hidden sm:block">
                  Rolle wechseln
                </button>
                <button onClick={onSignOut} className="text-xs text-gray-600 hover:text-gray-400 transition-colors hidden sm:block">
                  Abmelden
                </button>
              </>
            )}
            <button onClick={() => setShowSettings(true)}
              className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-all">
              {user ? <span className="text-violet-400 text-xs">☁</span> : <span className="text-sm">👤</span>}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-4 pb-24 sm:pb-6">
        <div key={activeTab} className="page-enter space-y-4">

          {/* ── KALENDER (Athlet only) ── */}
          {activeTab === 'kalender' && !isSolo && (
            user ? (
              <UnifiedAthleteCalendar
                userId={user.id}
                personalSessions={sessions}
                plannedSessions={plannedSessions}
              />
            ) : (
              <div className="text-center py-12 space-y-3">
                <CalendarDays className="w-10 h-10 text-gray-700 mx-auto" />
                <p className="text-gray-500 text-sm">Melde dich an um deinen Teamkalender zu sehen</p>
                <button onClick={onShowAuth}
                  className="px-4 py-2 bg-violet-600 text-white rounded-xl text-sm hover:bg-violet-500 transition-colors">
                  Anmelden
                </button>
              </div>
            )
          )}

          {/* ── TEAM (Athlet only) ── */}
          {activeTab === 'team' && !isSolo && (
            user ? (
              showJoinFlow ? (
                <ClubJoinFlow
                  userId={user.id}
                  userName={profile.name || user.email || 'Athlet'}
                  userSport={profile.sport || ''}
                  onJoined={() => setShowJoinFlow(false)}
                  onBack={() => setShowJoinFlow(false)}
                />
              ) : (
              <TeamTab
                userId={user.id}
                userName={profile.name || user.email || 'Athlet'}
                onGoToJoin={() => setShowJoinFlow(true)}
              />
              )
            ) : (
              <div className="text-center py-12 space-y-3">
                <Users className="w-10 h-10 text-gray-700 mx-auto" />
                <p className="text-gray-400 text-sm">Melde dich an um Teams beizutreten</p>
                <button onClick={onShowAuth}
                  className="px-4 py-2 bg-violet-600 text-white rounded-xl text-sm hover:bg-violet-500 transition-colors">
                  Anmelden
                </button>
              </div>
            )
          )}

          {/* ── PERFORMANCE / ACWR ── */}
          {activeTab === 'performance' && (
            <ACWRSection
              sessions={sessions}
              plannedSessions={plannedSessions}
              onAddSession={handleAddSession}
              onAddPlanned={handleAddPlanned}
              onConfirmPlanned={handleConfirmPlanned}
              onUpdatePlanned={handleUpdatePlanned}
              onDismissPlanned={handleDismissPlanned}
              onDeleteSession={handleDeleteSession}
              onEditSession={handleEditSession}
              onSessionConfirmed={() => setForecastOutdated(true)}
              onLoadMockData={handleLoadMockData}
              playerName={profile.name}
              playerSport={profile.sport}
              userId={userId ?? undefined}
            />
          )}

          {/* ── ERNÄHRUNG ── */}
          {activeTab === 'ernaehrung' && (
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
                  <ShoppingList items={shoppingList} onItemToggle={handleItemToggle} onOrder={() => {}} />
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
        </div>
      </main>

      {/* Bottom nav — mobile only */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-20 bg-[#0a0b0f]/90 backdrop-blur-2xl border-t border-white/5"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex items-stretch h-[60px] px-1">
          {TABS.map(t => {
            const isActive = activeTab === t.id;
            return (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className="relative flex-1 flex flex-col items-center justify-center gap-0.5 tap-feedback">
                {isActive && <span className="absolute inset-x-1 top-1.5 bottom-1.5 rounded-2xl bg-violet-600/15 border border-violet-500/20" />}
                <t.Icon size={18} className={`relative transition-colors ${isActive ? 'text-violet-400' : 'text-gray-600'}`} />
                <span className={`relative text-[9px] font-semibold tracking-wide transition-colors ${isActive ? 'text-violet-400' : 'text-gray-600'}`}>
                  {t.label}
                </span>
                {(t.badge ?? 0) > 0 && (
                  <span className="absolute top-1.5 right-2 min-w-[14px] h-3.5 bg-orange-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold px-1">
                    {t.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {showSettings && (
        <ProfileSettings profile={profile} onSave={handleProfileSave} onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}
