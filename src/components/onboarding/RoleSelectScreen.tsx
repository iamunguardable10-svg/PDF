import { useState } from 'react';
import { LayoutDashboard, Users, Dumbbell, ShieldCheck, ClipboardList } from 'lucide-react';
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
    <div className="min-h-screen bg-[#0a0b0f] text-white flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-4xl">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-11 h-11 bg-gradient-to-br from-violet-500 to-purple-700 rounded-2xl flex items-center justify-center text-lg font-black shadow-lg shadow-violet-900/40">
            TL
          </div>
          <div>
            <p className="text-xl font-black tracking-tight">TeamLoad</p>
            <p className="text-xs text-gray-500">Training, attendance and load decisions in one place</p>
          </div>
        </div>

        <div className="text-center mb-8 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-violet-300">Start setup</p>
          <h1 className="text-3xl sm:text-4xl font-black">What do you want to do first?</h1>
          <p className="mx-auto max-w-xl text-sm text-gray-400">
            Choose the role that matches your next action. You can switch later, but this helps TeamLoad open the right workflow.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <RoleCard
            title="Join my team"
            badge="Player"
            description="Use an invite or club search, see your personal calendar and only report maybe/no when something changes."
            Icon={Users}
            tone="sky"
            onClick={() => {
              if (userId) setShowJoinFlow(true);
              else onSelect('athlete');
            }}
          />
          <RoleCard
            title="Coach my team"
            badge="Coach"
            description="Plan sessions, manage availability, confirm attendance and monitor player load for teams assigned to you."
            Icon={LayoutDashboard}
            tone="violet"
            onClick={() => onSelect('coach')}
          />
          <RoleCard
            title="Set up a club"
            badge="Admin"
            description="Create departments, teams, facilities and permissions before coaches and players start using the system."
            Icon={ShieldCheck}
            tone="emerald"
            onClick={() => onSelect('coach')}
          />
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button
            onClick={() => onSelect('solo')}
            className="flex items-center gap-3 rounded-2xl border border-gray-800 bg-gray-950/60 px-4 py-3 text-left transition-colors hover:border-gray-700"
          >
            <Dumbbell size={18} className="text-gray-500" />
            <div>
              <p className="text-sm font-semibold text-gray-300">Solo training</p>
              <p className="text-xs text-gray-600">Use TeamLoad without a club for now.</p>
            </div>
          </button>
          <div className="flex items-center gap-3 rounded-2xl border border-gray-800 bg-gray-950/60 px-4 py-3 text-left">
            <ClipboardList size={18} className="text-gray-500" />
            <div>
              <p className="text-sm font-semibold text-gray-300">Role logic</p>
              <p className="text-xs text-gray-600">Players, coaches and admins get different calendars, actions and permissions.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RoleCard({ title, badge, description, Icon, tone, onClick }: { title: string; badge: string; description: string; Icon: typeof Users; tone: 'sky' | 'violet' | 'emerald'; onClick: () => void }) {
  const tones = {
    sky: 'border-sky-700/50 hover:border-sky-400 bg-sky-950/20 text-sky-300',
    violet: 'border-violet-700/50 hover:border-violet-400 bg-violet-950/20 text-violet-300',
    emerald: 'border-emerald-700/50 hover:border-emerald-400 bg-emerald-950/20 text-emerald-300',
  };

  return (
    <button onClick={onClick} className={`group rounded-3xl border p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-2xl ${tones[tone]}`}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-950/70">
          <Icon className="h-6 w-6" />
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-gray-300">{badge}</span>
      </div>
      <h2 className="text-lg font-black text-white">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-gray-400">{description}</p>
      <p className="mt-5 text-xs font-bold uppercase tracking-wider text-gray-500 group-hover:text-white">Continue →</p>
    </button>
  );
}
