import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Onboarding } from './components/Onboarding';
import { AuthScreen } from './components/AuthScreen';
import { LandingPage } from './components/LandingPage';
import { AppTour } from './components/AppTour';
import { TrainerView } from './components/TrainerView';
import { CoachShell } from './components/coach/CoachShell';
import { AthleteShell } from './components/AthleteShell';
import { RoleSelectScreen } from './components/onboarding/RoleSelectScreen';
import { CoachSetupWizard } from './components/onboarding/CoachSetupWizard';
import { InviteAccept } from './components/InviteAccept';
import { TrainerDashboard } from './components/TrainerDashboard';
import { decodeShareData, isLiveToken } from './lib/trainerShare';
import { loadProfile, saveProfile } from './lib/profileStorage';
import { supabase, CLOUD_ENABLED } from './lib/supabase';
import { loadAppMode, saveAppMode, clearAppMode } from './types/appMode';
import type { AppMode } from './types/appMode';
import type { AthleteProfile } from './types/profile';
import type { User } from '@supabase/supabase-js';

// ── Spinner ────────────────────────────────────────────────────────────────

function LoadingSpinner() {
  return (
    <div className="min-h-screen bg-[#0a0b0f] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// ── App ────────────────────────────────────────────────────────────────────

function App() {
  const navigate   = useNavigate();
  const location   = useLocation();

  // Auth state
  const [user, setUser]           = useState<User | null | 'loading'>('loading');
  const [isGuest, setIsGuest]     = useState(() => !CLOUD_ENABLED || !!localStorage.getItem('fitfuel_guest'));
  const [, setCloudReady] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Onboarding + tour
  const [showLanding, setShowLanding] = useState(
    () => !localStorage.getItem('fitfuel_seen_landing')
  );
  const [showTour, setShowTour] = useState(() => !localStorage.getItem('fitfuel_tour_done'));
  const [profile, setProfile]   = useState<AthleteProfile>(() => loadProfile());

  // Role / mode
  const [appMode, setAppMode]   = useState<AppMode | null>(() => loadAppMode());
  // Show coach setup wizard once (first login as coach)
  const [showCoachSetup, setShowCoachSetup] = useState(
    () => !localStorage.getItem('club_os_coach_setup_done')
  );

  // ── Auth setup ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!CLOUD_ENABLED) { setUser(null); return; }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
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

  // ── Handlers ───────────────────────────────────────────────────────────────

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
    // Navigate to the right shell based on saved mode
    const mode = loadAppMode();
    if (mode === 'coach') navigate('/coach');
    else navigate('/athlete');
  };

  const handleSelectMode = (mode: AppMode) => {
    saveAppMode(mode);
    setAppMode(mode);
    // Auth gate (step 4) will fire immediately for coach/athlete if not logged in.
    // Once logged in, ModeRouter sends them to the right shell.
    if (mode === 'coach' && loggedInUser) navigate('/coach');
    else if ((mode === 'athlete' || mode === 'solo') && profile.onboardingCompleted) navigate('/athlete');
    // Otherwise fall through to auth gate / onboarding
  };

  const handleSwitchRole = () => {
    clearAppMode();
    setAppMode(null);
    navigate('/select-role');
  };

  const handleTourDone = () => {
    localStorage.setItem('fitfuel_tour_done', '1');
    setShowTour(false);
  };

  const handleOnboardingComplete = (p: AthleteProfile) => {
    setProfile(p);
    saveProfile(p);
  };

  const loggedInUser = user && user !== 'loading' ? user as User : null;
  const userId = loggedInUser && !isGuest ? loggedInUser.id : null;

  // ── Deep-link: trainer share URL (hash back-compat) ──────────────────────
  const trainerHash = location.hash.match(/^#trainer\/(.+)$/)?.[1];
  if (trainerHash) {
    if (isLiveToken(trainerHash)) return <TrainerView token={trainerHash} />;
    const trainerData = decodeShareData(trainerHash);
    if (trainerData) return <TrainerView data={trainerData} />;
  }

  // ── 1. Auth loading — brief spinner while Supabase resolves session ────────
  if (CLOUD_ENABLED && user === 'loading') {
    return <LoadingSpinner />;
  }

  const dismissLanding = () => {
    localStorage.setItem('fitfuel_seen_landing', '1');
    setShowLanding(false);
  };

  // ── 2. Landing page — shown once to brand-new visitors ────────────────────
  //    "Loslegen" → go to role select (no auth yet)
  //    "Anmelden" → open auth modal, then role select after login
  if (showLanding && !loggedInUser) {
    return (
      <>
        <LandingPage
          onStart={dismissLanding}
          onGuest={() => { dismissLanding(); handleGuestMode(); }}
        />
        {showAuthModal && CLOUD_ENABLED && (
          <AuthScreen
            onClose={() => setShowAuthModal(false)}
            onGuest={() => { dismissLanding(); handleGuestMode(); setShowAuthModal(false); }}
            onLoggedIn={() => { handleLoggedIn(); dismissLanding(); setShowAuthModal(false); }}
          />
        )}
      </>
    );
  }

  // ── 3. Role select — BEFORE login, always shown if no mode is saved ────────
  if (!appMode) {
    return <RoleSelectScreen onSelect={handleSelectMode} />;
  }

  // ── 4. Auth gate — fires after role select, only for coach / athlete ───────
  //    Solo mode can proceed without an account.
  if (CLOUD_ENABLED && !isGuest && appMode !== 'solo' && !loggedInUser) {
    return <AuthScreen onLoggedIn={handleLoggedIn} />;
  }

  // ── 5. Onboarding — profile setup for first-time users ────────────────────
  if (!profile.onboardingCompleted) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  // ── Tour overlay ───────────────────────────────────────────────────────────
  const tourOverlay = showTour && !userId ? <AppTour onDone={handleTourDone} /> : null;

  // ── Auth modal overlay (triggered from shells) ─────────────────────────────
  const authModalOverlay = showAuthModal && CLOUD_ENABLED ? (
    <AuthScreen
      onGuest={() => { handleGuestMode(); setShowAuthModal(false); }}
      onLoggedIn={() => { handleLoggedIn(); setShowAuthModal(false); }}
      onClose={() => setShowAuthModal(false)}
    />
  ) : null;

  return (
    <>
      {tourOverlay}
      {authModalOverlay}
      <Routes>

        {/* ── Trainer share view ── */}
        <Route path="/trainer/:token" element={
          <TrainerViewRoute />
        } />

        {/* ── Invite accept ── */}
        <Route path="/invite/:code" element={
          <InviteAccept
            inviteCode={location.pathname.split('/invite/')[1] ?? ''}
            user={loggedInUser}
            onLoginRequest={() => setShowAuthModal(true)}
          />
        } />

        {/* ── Hash-based invite back-compat ── */}
        {location.hash.startsWith('#invite/') && (
          <Route path="*" element={
            <InviteAccept
              inviteCode={location.hash.replace('#invite/', '')}
              user={loggedInUser}
              onLoginRequest={() => setShowAuthModal(true)}
            />
          } />
        )}

        {/* ── Role selection ── */}
        <Route path="/select-role" element={
          <RoleSelectScreen onSelect={handleSelectMode} />
        } />

        {/* ── Coach shell ── */}
        <Route path="/coach/*" element={
          loggedInUser && !isGuest ? (
            showCoachSetup ? (
              <CoachSetupWizard
                userId={loggedInUser.id}
                onDone={() => {
                  localStorage.setItem('club_os_coach_setup_done', '1');
                  setShowCoachSetup(false);
                }}
                onSkip={() => {
                  localStorage.setItem('club_os_coach_setup_done', '1');
                  setShowCoachSetup(false);
                }}
              />
            ) : (
              <CoachShell
                user={loggedInUser}
                trainerName={profile.name || loggedInUser.email || 'Trainer'}
                onBack={() => navigate('/select-role')}
              />
            )
          ) : (
            <Navigate to="/select-role" replace />
          )
        } />

        {/* ── Legacy coach hash → redirect ── */}
        {(location.hash === '#coach' || location.hash === '#coach-legacy') && (
          <Route path="*" element={<Navigate to="/coach" replace />} />
        )}

        {/* ── Athlete / Solo shell ── */}
        <Route path="/athlete" element={
          <AthleteShell
            user={loggedInUser}
            isGuest={isGuest}
            mode={appMode ?? 'athlete'}
            profile={profile}
            onProfileChange={p => { setProfile(p); saveProfile(p); }}
            onShowAuth={() => setShowAuthModal(true)}
            onSignOut={handleSignOut}
            onSwitchRole={handleSwitchRole}
            teamJoinToken={location.hash.match(/^#team-join\/([A-Za-z0-9_-]+)$/)?.[1]}
            onTeamJoinDone={() => { window.location.hash = ''; }}
          />
        } />

        {/* ── Legacy trainer dashboard ── */}
        <Route path="/trainer-legacy" element={
          loggedInUser && !isGuest ? (
            <TrainerDashboard
              user={loggedInUser}
              trainerName={profile.name || loggedInUser.email || 'Trainer'}
            />
          ) : (
            <Navigate to="/select-role" replace />
          )
        } />

        {/* ── Default: route by mode ── */}
        <Route path="/" element={<ModeRouter appMode={appMode} loggedInUser={loggedInUser} isGuest={isGuest} />} />
        <Route path="*" element={<ModeRouter appMode={appMode} loggedInUser={loggedInUser} isGuest={isGuest} />} />

      </Routes>
    </>
  );
}

// ── Helper: route to appropriate shell based on saved mode ────────────────

function ModeRouter({
  appMode,
  loggedInUser,
  isGuest,
}: {
  appMode: AppMode | null;
  loggedInUser: User | null;
  isGuest: boolean;
}) {
  if (appMode === 'coach' && loggedInUser && !isGuest) {
    return <Navigate to="/coach" replace />;
  }
  if (appMode === 'athlete' || appMode === 'solo') {
    return <Navigate to="/athlete" replace />;
  }
  return <Navigate to="/select-role" replace />;
}

// ── Helper: trainer share route ───────────────────────────────────────────

function TrainerViewRoute() {
  const location = useLocation();
  const token = location.pathname.split('/trainer/')[1] ?? '';
  if (isLiveToken(token)) return <TrainerView token={token} />;
  const data = decodeShareData(token);
  if (data) return <TrainerView data={data} />;
  return <Navigate to="/" replace />;
}

export default App;
