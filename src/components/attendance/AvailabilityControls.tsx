import { useState } from 'react';
import { Check, HelpCircle, Timer, X } from 'lucide-react';
import type { AthleteAvailabilityRecord, AthleteAvailabilityStatus } from '../../lib/availability';
import { validateAvailability } from '../../lib/availability';

interface Props {
  sessionId: string;
  athleteUserId: string;
  value: AthleteAvailabilityRecord | null;
  saving?: boolean;
  onSubmit: (input: { status: AthleteAvailabilityStatus; reason?: string; lateMinutes?: number }) => Promise<void> | void;
}

export function AvailabilityControls({ sessionId, athleteUserId, value, saving = false, onSubmit }: Props) {
  const [draftStatus, setDraftStatus] = useState<AthleteAvailabilityStatus>(value?.status ?? 'expected');
  const [reason, setReason] = useState(value?.reason ?? '');
  const [lateMinutes, setLateMinutes] = useState(value?.lateMinutes ?? 15);
  const [error, setError] = useState<string | null>(null);

  async function submit(status = draftStatus) {
    const input = {
      sessionId,
      athleteUserId,
      status,
      reason: status === 'expected' ? '' : reason,
      lateMinutes: status === 'late' ? lateMinutes : undefined,
    };
    const validation = validateAvailability(input);
    if (validation) {
      setError(validation);
      return;
    }
    setError(null);
    await onSubmit({ status, reason: input.reason, lateMinutes: input.lateMinutes });
  }

  const needsReason = draftStatus === 'maybe' || draftStatus === 'no';
  const isLate = draftStatus === 'late';

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[11px] text-gray-500 mb-1.5">Verfuegbarkeit</p>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          <ChoiceButton active={draftStatus === 'expected'} disabled={saving} onClick={() => { setDraftStatus('expected'); setReason(''); submit('expected'); }} tone="green" icon={<Check size={12} />} label="Komme" />
          <ChoiceButton active={draftStatus === 'late'} disabled={saving} onClick={() => setDraftStatus('late')} tone="amber" icon={<Timer size={12} />} label="Spaeter" />
          <ChoiceButton active={draftStatus === 'maybe'} disabled={saving} onClick={() => setDraftStatus('maybe')} tone="gray" icon={<HelpCircle size={12} />} label="Unsicher" />
          <ChoiceButton active={draftStatus === 'no'} disabled={saving} onClick={() => setDraftStatus('no')} tone="red" icon={<X size={12} />} label="Absage" />
        </div>
      </div>

      {isLate && (
        <div className="rounded-xl border border-amber-900/50 bg-amber-950/10 p-3 space-y-3">
          <div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-amber-200 font-semibold">Wie viel zu spaet?</span>
              <span className="rounded-lg bg-amber-900/40 px-2 py-0.5 font-black text-amber-100">{lateMinutes} Min.</span>
            </div>
            <input type="range" min={5} max={120} step={5} value={lateMinutes} onChange={event => setLateMinutes(Number(event.target.value))} className="mt-2 w-full accent-amber-500" />
            <div className="mt-1 flex justify-between text-[10px] text-gray-600"><span>5 Min.</span><span>60 Min.</span><span>120 Min.</span></div>
          </div>
          <input value={reason} onChange={event => setReason(event.target.value)} placeholder="Optional: Stau, Schule, Bahn verspaetet" className="w-full rounded-xl border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white outline-none focus:border-amber-500" />
          <button onClick={() => submit('late')} disabled={saving} className="w-full rounded-xl bg-amber-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-amber-500 disabled:opacity-50">{saving ? 'Speichern...' : 'Verspaetung speichern'}</button>
        </div>
      )}

      {needsReason && (
        <div className="rounded-xl border border-gray-800 bg-gray-950/50 p-3 space-y-2">
          <textarea value={reason} onChange={event => setReason(event.target.value)} placeholder={draftStatus === 'maybe' ? 'Grund erforderlich, z.B. Schule bis 18:00' : 'Grund erforderlich, z.B. krank, verletzt, Schule'} className="min-h-[74px] w-full rounded-xl border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white outline-none focus:border-violet-500" />
          <button onClick={() => submit(draftStatus)} disabled={saving} className="w-full rounded-xl bg-violet-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-violet-500 disabled:opacity-50">{saving ? 'Speichern...' : 'Speichern'}</button>
        </div>
      )}

      {error && <p className="rounded-xl border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs text-red-200">{error}</p>}
    </div>
  );
}

function ChoiceButton({ active, disabled, onClick, tone, icon, label }: { active: boolean; disabled: boolean; onClick: () => void; tone: 'green' | 'amber' | 'gray' | 'red'; icon: React.ReactNode; label: string }) {
  const activeTones = {
    green: 'border-emerald-600 bg-emerald-700/50 text-emerald-100',
    amber: 'border-amber-600 bg-amber-700/50 text-amber-100',
    gray: 'border-gray-600 bg-gray-700/70 text-gray-100',
    red: 'border-rose-600 bg-rose-700/50 text-rose-100',
  };
  return <button onClick={onClick} disabled={disabled} className={`flex items-center justify-center gap-1.5 rounded-xl border px-2.5 py-2 text-[11px] font-bold transition-all disabled:opacity-50 ${active ? activeTones[tone] : 'border-gray-700 bg-gray-800/60 text-gray-500 hover:border-gray-600 hover:text-gray-300'}`}>{icon}{label}</button>;
}
