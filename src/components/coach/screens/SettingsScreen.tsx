import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { CoachOutletContext } from '../CoachShell';
import {
  FINAL_ATTENDANCE_MODE_LABELS,
  finalAttendanceModeCopy,
  loadFinalAttendanceSettings,
  saveFinalAttendanceSettings,
} from '../../../lib/finalAttendanceSettings';
import type { FinalAttendanceMode } from '../../../lib/finalAttendanceSettings';

const FINAL_ATTENDANCE_MODES: FinalAttendanceMode[] = ['athlete_default', 'coach_recommended', 'coach_required'];

export function SettingsScreen() {
  const { org, coachContext } = useOutletContext<CoachOutletContext>();
  const [finalAttendanceSettings, setFinalAttendanceSettings] = useState(() => loadFinalAttendanceSettings());
  const copy = finalAttendanceModeCopy(finalAttendanceSettings.mode);

  function handleModeChange(mode: FinalAttendanceMode) {
    setFinalAttendanceSettings(saveFinalAttendanceSettings(mode));
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-300">TeamLoad</p>
        <h2 className="mt-1 text-2xl font-black text-white">Settings</h2>
        <p className="mt-1 text-sm text-gray-400">Club, role and workflow configuration.</p>
      </div>

      <div className="rounded-xl border border-gray-700 bg-gray-800/50 px-4 py-4">
        <p className="text-sm font-semibold text-white">{org?.name ?? 'No organization loaded'}</p>
        <p className="mt-1 text-xs text-gray-500">Current role: {coachContext?.role ?? 'Coach'}</p>
      </div>

      <section className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900/60">
        <div className="border-b border-gray-800 px-4 py-4">
          <p className="text-xs font-black uppercase tracking-wide text-green-300">Attendance workflow</p>
          <h3 className="mt-1 text-lg font-black text-white">Final attendance mode</h3>
          <p className="mt-1 text-sm text-gray-400">Choose how strict coach-final participation confirmation should be. This controls participation workflow only; load stays based on RPE x duration or validated workload data.</p>
        </div>

        <div className="grid gap-3 p-4 lg:grid-cols-3">
          {FINAL_ATTENDANCE_MODES.map(mode => {
            const modeCopy = finalAttendanceModeCopy(mode);
            const selected = mode === finalAttendanceSettings.mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => handleModeChange(mode)}
                className={`rounded-2xl border px-4 py-4 text-left transition-colors ${selected ? 'border-green-500 bg-green-950/30' : 'border-gray-800 bg-gray-950/50 hover:border-gray-600'}`}
              >
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${selected ? 'bg-green-500/20 text-green-200' : 'bg-gray-800 text-gray-400'}`}>{selected ? 'Active' : modeCopy.eyebrow}</span>
                <p className="mt-3 text-sm font-black text-white">{FINAL_ATTENDANCE_MODE_LABELS[mode]}</p>
                <p className="mt-2 text-xs leading-5 text-gray-400">{modeCopy.body}</p>
              </button>
            );
          })}
        </div>

        <div className="border-t border-gray-800 bg-gray-950/50 px-4 py-4">
          <p className="text-xs font-black uppercase tracking-wide text-gray-500">Current behavior</p>
          <p className="mt-1 text-sm font-bold text-white">{copy.title}</p>
          <p className="mt-1 text-xs leading-5 text-gray-400">{copy.actionHint}</p>
          {finalAttendanceSettings.updatedAt && <p className="mt-2 text-[11px] text-gray-600">Updated {new Date(finalAttendanceSettings.updatedAt).toLocaleString('de-DE')}</p>}
        </div>
      </section>
    </div>
  );
}
