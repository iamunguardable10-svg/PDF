export type FinalAttendanceMode = 'athlete_default' | 'coach_recommended' | 'coach_required';

export interface FinalAttendanceSettings {
  mode: FinalAttendanceMode;
  updatedAt: string;
}

export const FINAL_ATTENDANCE_MODE_LABELS: Record<FinalAttendanceMode, string> = {
  athlete_default: 'Athlete-reported default',
  coach_recommended: 'Coach confirmation recommended',
  coach_required: 'Coach final required',
};

const STORAGE_KEY = 'teamload_final_attendance_settings_v1';
const DEFAULT_SETTINGS: FinalAttendanceSettings = {
  mode: 'athlete_default',
  updatedAt: '',
};

export function loadFinalAttendanceSettings(): FinalAttendanceSettings {
  if (typeof localStorage === 'undefined') return DEFAULT_SETTINGS;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<FinalAttendanceSettings>;
    if (!isFinalAttendanceMode(parsed.mode)) return DEFAULT_SETTINGS;
    return {
      mode: parsed.mode,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '',
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveFinalAttendanceSettings(mode: FinalAttendanceMode): FinalAttendanceSettings {
  const settings: FinalAttendanceSettings = {
    mode,
    updatedAt: new Date().toISOString(),
  };

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }

  return settings;
}

export function finalAttendanceModeCopy(mode: FinalAttendanceMode): { eyebrow: string; title: string; body: string; actionHint: string } {
  if (mode === 'coach_required') {
    return {
      eyebrow: 'Required mode',
      title: 'Coach final required',
      body: 'Coach-final attendance is treated as the authoritative participation record for closing a session.',
      actionHint: 'Finalize all athletes or explicitly mark exceptions before treating the session as complete.',
    };
  }

  if (mode === 'coach_recommended') {
    return {
      eyebrow: 'Recommended mode',
      title: 'Coach confirmation recommended',
      body: 'Athlete reports are used first, but the coach is encouraged to confirm the session after practice.',
      actionHint: 'Use one-click confirmation for expected athletes and only correct exceptions.',
    };
  }

  return {
    eyebrow: 'Lightweight mode',
    title: 'Athlete-reported default',
    body: 'Athlete availability reports are the default signal. Coach-final attendance is optional verification.',
    actionHint: 'No need to click every athlete every day. Confirm only when it adds useful context.',
  };
}

function isFinalAttendanceMode(value: unknown): value is FinalAttendanceMode {
  return value === 'athlete_default' || value === 'coach_recommended' || value === 'coach_required';
}
