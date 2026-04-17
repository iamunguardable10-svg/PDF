import { useState } from 'react';
import { LayoutDashboard, Users, Dumbbell } from 'lucide-react';
import { ClubJoinFlow } from './ClubJoinFlow';
import type { AppMode } from '../../types/appMode';

interface Props {
  userId?: string;
  userName?: string;
  userSport?: string;
  onSelect: (mode: AppMode) => void;
  onJoined?: () => void;
}

export function RoleSelectScreen({ userId, userName = '', userSport = '', onSelect, onJoined }: Props) {
  const [showJoinFlow, setShowJoinFlow] = useState(false);

  if (showJoinFlow && userId) {
    return (
      <ClubJoinFlow
        userId={userId}
        userName={userName}
        userSport={userSport}
        onJoined={() => {
          onSelect('athlete');
          onJoined?.();
        }}
        onBack={() => setShowJoinFlow(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0b0f] text-white flex flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-10">
        <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-700 rounded-2xl flex items-center justify-center text-xl shadow-lg shadow-violet-900/40">
          🏟
        </div>
        <span className="text-xl font-bold tracking-tight">Club OS</span>
      </div>

      <div className="w-full max-w-sm space-y-3">
        <div className="text-center mb-6 space-y-1">
          <h1 className="text-2xl font-bold">Wie nutzt du die App?</h1>
          <p className="text-sm text-gray-500">Wähle eine Option — du kannst sie später ändern.</p>
        </div>

        {/* ── Team beitreten — PRIMÄR ── */}
        <button
          onClick={() => {
            if (userId) {
              setShowJoinFlow(true);
            } else {
              // Not logged in yet — still set mode, auth gate will fire
              onSelect('athlete');
            }
          }}
          className="w-full flex items-start gap-4 p-4 rounded-2xl border border-sky-700/50 hover:border-sky-500/70 bg-gray-900/50 text-left transition-all duration-150 group"
        >
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-sky-900/40 text-sky-400">
            <Users className="w-7 h-7" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-sky-400">Team beitreten</p>
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
              Vereinssuche, Trainingskalender, Anwesenheit &amp; Belastungssteuerung im Team.
            </p>
          </div>
          <span className="text-gray-600 group-hover:text-sky-500 transition-colors flex-shrink-0 mt-0.5">→</span>
        </button>

        {/* ── Verein gründen / Coach ── */}
        <button
          onClick={() => onSelect('coach')}
          className="w-full flex items-start gap-4 p-4 rounded-2xl border border-violet-700/50 hover:border-violet-500/70 bg-gray-900/50 text-left transition-all duration-150 group"
        >
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-violet-900/40 text-violet-400">
            <LayoutDashboard className="w-7 h-7" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-violet-400">Verein gründen / Trainer</p>
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
              Teams anlegen, Trainingsplanung, Anwesenheit und Performance verwalten.
            </p>
          </div>
          <span className="text-gray-600 group-hover:text-violet-500 transition-colors flex-shrink-0 mt-0.5">→</span>
        </button>

        {/* ── Solo — sekundär, weniger prominent ── */}
        <button
          onClick={() => onSelect('solo')}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border border-gray-800 hover:border-gray-700 bg-transparent text-left transition-colors"
        >
          <Dumbbell size={16} className="text-gray-600 flex-shrink-0" />
          <div className="flex-1">
            <span className="text-sm text-gray-500">Solo trainieren</span>
            <span className="text-xs text-gray-700 ml-2">ohne Verein</span>
          </div>
          <span className="text-gray-700 text-xs">→</span>
        </button>
      </div>
    </div>
  );
}
