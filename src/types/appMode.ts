export type AppMode = 'coach' | 'athlete' | 'solo';

const STORAGE_KEY = 'club_os_mode';

export function loadAppMode(): AppMode | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === 'coach' || raw === 'athlete' || raw === 'solo') return raw;
  return null;
}

export function saveAppMode(mode: AppMode): void {
  localStorage.setItem(STORAGE_KEY, mode);
}

export function clearAppMode(): void {
  localStorage.removeItem(STORAGE_KEY);
}
