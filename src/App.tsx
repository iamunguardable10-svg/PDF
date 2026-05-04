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
import { DashboardScreen }   from './components/coach/screens/DashboardScreen';
import { TeamsScreen }        from './components/coach/screens/TeamsScreen';
import { TeamScreen }         from './components/coach/screens/TeamScreen';
import { DepartmentScreen }   from './components/coach/screens/DepartmentScreen';
import { FacilitiesScreen }   from './components/coach/screens/FacilitiesScreen';
import { FacilityScreen }     from './components/coach/screens/FacilityScreen';
import { PerformanceScreen }  from './components/coach/screens/PerformanceScreen';
import { SessionsScreen } from './components/coach/screens/SessionsScreen';
import { CalendarScreen } from './components/coach/screens/CalendarScreen';
import { PlayersScreen } from './components/coach/screens/PlayersScreen';
import { GroupsScreen } from './components/coach/screens/GroupsScreen';
import { LoadMonitorScreen } from './components/coach/screens/LoadMonitorScreen';
import { AttendanceScreen } from './components/coach/screens/AttendanceScreen';
import { AnalyticsScreen } from './components/coach/screens/AnalyticsScreen';
import { AlertsScreen } from './components/coach/screens/AlertsScreen';
import { SettingsScreen } from './components/coach/screens/SettingsScreen';
import { decodeShareData, isLiveToken } from './lib/trainerShare';
import { loadProfile, saveProfile } from './lib/profileStorage';
import { pullProfile } from './lib/cloudSync';
import { supabase, CLOUD_ENABLED } from './lib/supabase';
import { loadAppMode, saveAppMode, clearAppMode } from './types/appMode';
import type { AppMode } from './types/appMode';
import type { AthleteProfile } from './types/profile';
import type { User } from '@supabase/supabase-js';

function LoadingSpinner() {
  return (
    <div className="min-h-screen bg-[#0a0b0f] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function App() {
  const navigate   = useNavigate();
  const location   = useLocation();

  const [user, setUser]           = useState<User | null | 'loading'>('loading');
  const [isGuest, setIsGuest]     = useState(() => !CLOUD_ENABLED || !!localStorage.getItem('fitfuel_guest'));
  const [, setCloudReady] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const [showLanding, setShowLanding] = useState(() => !localStorage.getItem('fitfuel_seen_landing'));
  const [showTour, setShowTour] = useState(() => !localStorage.getItem('fitfuel_tour_done'));
  const [profile, setProfile]   = useState<AthleteProfile>(() => loadProfile());

  const [appMode, setAppMode]   = useState<AppMode | null>(() => loadAppMode());
  const [showCoachSetup, setShowCoachSetup] = useState(() => !localStorage.getItem('club_os_coach_setup_done'));

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
        pullProfile(session.user.id).then(cloudProfile => {
          if (cloudProfile) {
            const merged = { ...loadProfile(), ...cloudProfile };
            setProfile(merged);
            saveProfile(merged);
          }
        });
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
    const mode = loadAppMode();
    if (mode === 'coach') navigate('/coach/dashboard');
    else navigate('/athlete');
  };

  const handleSelectMode = (mode: AppMode) => {
    saveAppMode(mode);
    setAppMode(mode);
    if (mode === 'coach' && loggedInUser) navigate('/coach/dashboard');
    else if ((mode === 'athlete' || mode === 'solo') && profile.onboardingCompleted) navigate('/athlete');
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

  const trainerHash = location.hash.match(/^#trainer\/(.+)$/)?.[1];
  if (trainerHash) {
    if (isLiveToken(trainerHash)) return <TrainerView token={trainerHash} />;
    const trainerData = decodeShareData(trainerHash);
    if (trainerData) return <TrainerView data={trainerData} />;
  }

  if (CLOUD_ENABLED && user === 'loading') {
    return <LoadingSpinner />;
  }

  const dismissLanding = () => {
    localStorage.setItem('fitfuel_seen_landing', '1');
    setShowLanding(false);
  };

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

  if (!appMode) {
    return (
      <RoleSelectScreen
        userId={loggedInUser?.id}
        userName={profile.name || loggedInUser?.email || ''}
        userSport={profile.sport || ''}
        onSelect={handleSelectMode}
        onJoined={() => navigate('/athlete')}
      />
    );
  }

  if (CLOUD_ENABLED && !isGuest && appMode !== 'solo' && !loggedInUser) {
    return <AuthScreen onLoggedIn={handleLoggedIn} />;
  }

  if (appMode === 'solo' && !profile.onboardingCompleted) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  const tourOverlay = showTour && !userId ? <AppTour onDone={handleTourDone} /> : null;

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
        <Route path="/trainer/:token" element={<TrainerViewRoute />} />

        <Route path="/invite/:code" element={
          <InviteAccept
            inviteCode={location.pathname.split('/invite/')[1] ?? ''}
            user={loggedInUser}
            onLoginRequest={() => setShowAuthModal(true)}
          />
        } />

        {location.hash.startsWith('#invite/') && (
          <Route path="*" element={
            <InviteAccept
              inviteCode={location.hash.replace('#invite/', '')}
              user={loggedInUser}
              onLoginRequest={() => setShowAuthModal(true)}
            />
          } />
        )}

        <Route path="/select-role" element={
          <RoleSelectScreen
            userId={loggedInUser?.id}
            userName={profile.name || loggedInUser?.email || ''}
            userSport={profile.sport || ''}
            onSelect={handleSelectMode}
            onJoined={() => navigate('/athlete')}
          />
        } />

        <Route
          path="/coach"
          element={
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
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard"              element={<DashboardScreen />} />
          <Route path="sessions"               element={<SessionsScreen />} />
          <Route path="calendar"               element={<CalendarScreen />} />
          <Route path="players"                element={<PlayersScreen />} />
          <Route path="groups"                 element={<GroupsScreen />} />
          <Route path="teams"                  element={<TeamsScreen />} />
          <Route path="teams/:teamId"          element={<TeamScreen />} />
          <Route path="department"             element={<DepartmentScreen />} />
          <Route path="facilities"             element={<FacilitiesScreen />} />
          <Route path="facilities/:facilityId" element={<FacilityScreen />} />
          <Route path="performance"            element={<PerformanceScreen />} />
          <Route path="load-monitor"           element={<LoadMonitorScreen />} />
          <Route path="attendance"             element={<AttendanceScreen />} />
          <Route path="analytics"              element={<AnalyticsScreen />} />
          <Route path="alerts"                 element={<AlertsScreen />} />
          <Route path="settings"               element={<SettingsScreen />} />
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Route>

        {(location.hash === '#coach' || location.hash === '#coach-legacy') && (
          <Route path="*" element={<Navigate to="/coach" replace />} />
        )}

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

        <Route path="/" element={<ModeRouter appMode={appMode} loggedInUser={loggedInUser} isGuest={isGuest} />} />
        <Route path="*" element={<ModeRouter appMode={appMode} loggedInUser={loggedInUser} isGuest={isGuest} />} />
      </Routes>
    </>
  );
}

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
    return <Navigate to="/coach/dashboard" replace />;
  }
  if (appMode === 'athlete' || appMode === 'solo') {
    return <Navigate to="/athlete" replace />;
  }
  return <Navigate to="/select-role" replace />;
}

function TrainerViewRoute() {
  const location = useLocation();
  const token = location.pathname.split('/trainer/')[1] ?? '';
  if (isLiveToken(token)) return <TrainerView token={token} />;
  const data = decodeShareData(token);
  if (data) return <TrainerView data={data} />;
  return <Navigate to="/" replace />;
}

export default App;
