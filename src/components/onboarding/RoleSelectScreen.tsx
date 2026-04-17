import { useState } from 'react';
import { LayoutDashboard, User, Dumbbell } from 'lucide-react';
import type { AppMode } from '../../types/appMode';

interface Props {
  onSelect: (mode: AppMode) => void;
}

interface RoleCard {
  mode: AppMode;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  accent: string;
  border: string;
  iconBg: string;
}

const ROLES: RoleCard[] = [
  {
    mode: 'coach',
    icon: <LayoutDashboard className="w-7 h-7" />,
    title: 'Trainer / Coach',
    subtitle: 'Teams verwalten, Trainingsplanung, Anwesenheit und Performance für deinen Verein.',
    accent: 'text-violet-400',
    border: 'border-violet-700/50 hover:border-violet-500/70',
    iconBg: 'bg-violet-900/40 text-violet-400',
  },
  {
    mode: 'athlete',
    icon: <User className="w-7 h-7" />,
    title: 'Athlet',
    subtitle: 'Deinem Team beitreten, Training verfolgen, Belastungssteuerung und Ernährung.',
    accent: 'text-sky-400',
    border: 'border-sky-700/50 hover:border-sky-500/70',
    iconBg: 'bg-sky-900/40 text-sky-400',
  },
  {
    mode: 'solo',
    icon: <Dumbbell className="w-7 h-7" />,
    title: 'Solo-Training',
    subtitle: 'Individuelles Training ohne Verein — Trainingslog, ACWR und Ernährungsplanung.',
    accent: 'text-emerald-400',
    border: 'border-emerald-700/50 hover:border-emerald-500/70',
    iconBg: 'bg-emerald-900/40 text-emerald-400',
  },
];

export function RoleSelectScreen({ onSelect }: Props) {
  const [selected, setSelected] = useState<AppMode | null>(null);

  const handleConfirm = () => {
    if (selected) onSelect(selected);
  };

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
          <p className="text-sm text-gray-500">Wähle eine Rolle — du kannst sie später ändern.</p>
        </div>

        {ROLES.map(r => (
          <button
            key={r.mode}
            onClick={() => setSelected(r.mode)}
            className={`w-full flex items-start gap-4 p-4 rounded-2xl border bg-gray-900/50 text-left transition-all duration-150 ${r.border} ${
              selected === r.mode ? 'ring-2 ring-offset-1 ring-offset-[#0a0b0f] ring-violet-500/60' : ''
            }`}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${r.iconBg}`}>
              {r.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`font-semibold text-sm ${r.accent}`}>{r.title}</p>
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{r.subtitle}</p>
            </div>
            <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 transition-all ${
              selected === r.mode ? 'border-violet-400 bg-violet-500' : 'border-gray-700'
            }`} />
          </button>
        ))}

        <button
          onClick={handleConfirm}
          disabled={!selected}
          className="w-full mt-4 py-3.5 rounded-2xl bg-violet-600 hover:bg-violet-500 disabled:bg-gray-800 disabled:text-gray-600 text-white font-semibold text-sm transition-all"
        >
          Weiter
        </button>
      </div>
    </div>
  );
}
