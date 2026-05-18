import { useState } from 'react';
import { LayoutDashboard, Users, Dumbbell, ShieldCheck, ClipboardList, CheckCircle2, Activity, CalendarDays, ArrowLeft } from 'lucide-react';
import { ClubJoinFlow } from './ClubJoinFlow';
import type { AppMode } from '../../types/appMode';

interface Props {
  userId?: string;
  userName?: string;
  userSport?: string;
  onSelect: (mode: AppMode) => void;
  onJoined?: () => void;
  onBackToLanding?: () => void;
}

const PRODUCT_STEPS = [
  { title: 'Plan sessions', text: 'Coach creates practices, games and team events.', Icon: CalendarDays },
  { title: 'Collect exceptions', text: 'Players only answer when they are late, unsure or out.', Icon: ClipboardList },
  { title: 'Finalize attendance', text: 'Coach confirms what really happened after the session.', Icon: CheckCircle2 },
  { title: 'Read load context', text: 'Attendance and participation become useful workload signals.', Icon: Activity },
];

export function RoleSelectScreen({ userId, userName = '', userSport = '', onSelect, onJoined, onBackToLanding }: Props) {
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
      <div className="w-full max-w-5xl">
        <div className="mb-5 flex items-center justify-between gap-3">
          {onBackToLanding ? (
            <button onClick={onBackToLanding} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-800 bg-gray-950/70 px-3 py-2 text-xs font-bold text-gray-400 transition-colors hover:border-violet-700 hover:text-white">
              <ArrowLeft size={14} /> Zur Startseite
            </button>
          ) : <span />}
          <span className="rounded-xl border border-gray-800 bg-gray-950/70 px-3 py-2 text-xs text-gray-600">Role setup</span>
        </div>

        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-11 h-11 bg-gradient-to-br from-violet-500 to-purple-700 rounded-2xl flex items-center justify-center text-lg font-black shadow-lg shadow-violet-900/40">
            TL
          </div>
          <div>
            <p className="text-xl font-black tracking-tight">TeamLoad</p>
            <p className="text-xs text-gray-500">Coach OS for sessions, availability, attendance and load</p>
          </div>
        </div>

        <div className="text-center mb-7 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-violet-300">Start here</p>
          <h1 className="text-3xl sm:text-4xl font-black">TeamLoad turns team chaos into one coach workflow.</h1>
          <p className="mx-auto max-w-2xl text-sm leading-6 text-gray-400">
            The app is built around one practical loop: plan the session, let athletes report only exceptions, finalize attendance and use that context for load decisions.
          </p>
        </div>

        <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PRODUCT_STEPS.map(step => (
            <div key={step.title} className="rounded-2xl border border-gray-800 bg-gray-950/70 p-4">
              <step.Icon size={18} className="text-violet-300" />
              <p className="mt-3 text-sm font-black text-white">{step.title}</p>
              <p className="mt-1 text-xs leading-5 text-gray-500">{step.text}</p>
            </div>
          ))}
        </div>

        <div className="mb-4 rounded-2xl border border-violet-800/60 bg-violet-950/20 px-4 py-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black text-white">Recommended path right now</p>
              <p className="mt-1 text-xs leading-5 text-violet-100/70">
                Open the coach workspace first. It contains the newest TeamLoad flows: demo workspace, sessions, availability, final attendance and load monitor.
              </p>
            </div>
            <span className="w-fit rounded-full border border-violet-700 bg-violet-900/40 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-violet-200">Best demo path</span>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <RoleCard
            title="Coach my team"
            badge="Recommended"
            description="Use the main TeamLoad workspace: sessions, athlete exceptions, final attendance and load decisions."
            Icon={LayoutDashboard}
            tone="violet"
            primary
            onClick={() => onSelect('coach')}
          />
          <RoleCard
            title="Join my team"
            badge="Player"
            description="Join by invite, see your calendar and only report exceptions when you are late, unsure or out."
            Icon={Users}
            tone="sky"
            onClick={() => {
              if (userId) setShowJoinFlow(true);
              else onSelect('athlete');
            }}
          />
          <RoleCard
            title="Set up a club"
            badge="Admin"
            description="Prepare departments, teams and permissions. Useful later, but not required to inspect the main coach demo."
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
              <p className="text-sm font-semibold text-gray-300">Solo/local training</p>
              <p className="text-xs text-gray-600">Older personal mode. Useful for testing, not the main TeamLoad club workflow.</p>
            </div>
          </button>
          <div className="flex items-center gap-3 rounded-2xl border border-gray-800 bg-gray-950/60 px-4 py-3 text-left">
            <ClipboardList size={18} className="text-gray-500" />
            <div>
              <p className="text-sm font-semibold text-gray-300">What matters most</p>
              <p className="text-xs text-gray-600">Sessions, availability exceptions and coach-final attendance are the core product. Everything else supports that.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RoleCard({ title, badge, description, Icon, tone, primary, onClick }: { title: string; badge: string; description: string; Icon: typeof Users; tone: 'sky' | 'violet' | 'emerald'; primary?: boolean; onClick: () => void }) {
  const tones = {
    sky: 'border-sky-700/50 hover:border-sky-400 bg-sky-950/20 text-sky-300',
    violet: 'border-violet-700/50 hover:border-violet-400 bg-violet-950/20 text-violet-300',
    emerald: 'border-emerald-700/50 hover:border-emerald-400 bg-emerald-950/20 text-emerald-300',
  };

  return (
    <button onClick={onClick} className={`group relative rounded-3xl border p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-2xl ${tones[tone]} ${primary ? 'ring-1 ring-violet-400/40' : ''}`}>
      {primary && <span className="absolute right-4 top-4 rounded-full bg-violet-500 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">Start</span>}
      <div className="mb-5 flex items-center justify-between gap-3 pr-12">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-950/70">
          <Icon className="h-6 w-6" />
        </div>
        {!primary && <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-gray-300">{badge}</span>}
      </div>
      <h2 className="text-lg font-black text-white">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-gray-400">{description}</p>
      <p className="mt-5 text-xs font-bold uppercase tracking-wider text-gray-500 group-hover:text-white">Continue →</p>
    </button>
  );
}
