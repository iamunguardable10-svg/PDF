export type AthleteAvailabilityStatus = 'expected' | 'maybe' | 'no' | 'late';

export interface AthleteAvailabilityRecord {
  id: string;
  sessionId: string;
  athleteUserId: string;
  status: AthleteAvailabilityStatus;
  reason: string;
  lateMinutes?: number;
  updatedAt: string;
}

export interface SaveAvailabilityInput {
  sessionId: string;
  athleteUserId: string;
  status: AthleteAvailabilityStatus;
  reason?: string;
  lateMinutes?: number;
}

const STORAGE_KEY = 'teamload_availability_v1';

export function validateAvailability(input: SaveAvailabilityInput): string | null {
  if (input.status === 'expected') return null;
  if ((input.status === 'maybe' || input.status === 'no') && !input.reason?.trim()) {
    return 'Bitte gib einen Grund an.';
  }
  if (input.status === 'late') {
    const minutes = input.lateMinutes ?? 0;
    if (!Number.isFinite(minutes) || minutes < 5) return 'Bitte gib an, wie viele Minuten du zu spät kommst.';
    if (minutes > 120) return 'Verspätung darf maximal 120 Minuten betragen.';
  }
  return null;
}

export function loadAvailabilityRecords(): AthleteAvailabilityRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as AthleteAvailabilityRecord[] : [];
  } catch {
    return [];
  }
}

export function saveAvailability(input: SaveAvailabilityInput): AthleteAvailabilityRecord | null {
  const error = validateAvailability(input);
  if (error) return null;

  const all = loadAvailabilityRecords();
  const existingIndex = all.findIndex(item => item.sessionId === input.sessionId && item.athleteUserId === input.athleteUserId);
  const record: AthleteAvailabilityRecord = {
    id: existingIndex >= 0 ? all[existingIndex].id : crypto.randomUUID(),
    sessionId: input.sessionId,
    athleteUserId: input.athleteUserId,
    status: input.status,
    reason: input.reason?.trim() ?? '',
    lateMinutes: input.status === 'late' ? Math.max(5, Math.min(120, Math.round(input.lateMinutes ?? 15))) : undefined,
    updatedAt: new Date().toISOString(),
  };

  if (existingIndex >= 0) all[existingIndex] = record;
  else all.push(record);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  return record;
}

export function clearAvailability(sessionId: string, athleteUserId: string): void {
  const next = loadAvailabilityRecords().filter(item => !(item.sessionId === sessionId && item.athleteUserId === athleteUserId));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function getAvailabilityForSession(sessionId: string, athleteUserId: string): AthleteAvailabilityRecord | null {
  return loadAvailabilityRecords().find(item => item.sessionId === sessionId && item.athleteUserId === athleteUserId) ?? null;
}

export function loadAvailabilityForSessions(sessionIds: string[], athleteUserId: string): Record<string, AthleteAvailabilityRecord> {
  const idSet = new Set(sessionIds);
  return Object.fromEntries(
    loadAvailabilityRecords()
      .filter(item => item.athleteUserId === athleteUserId && idSet.has(item.sessionId))
      .map(item => [item.sessionId, item]),
  );
}

export function statusLabel(status: AthleteAvailabilityStatus): string {
  const labels: Record<AthleteAvailabilityStatus, string> = {
    expected: 'Erwartet',
    maybe: 'Unsicher',
    no: 'Absage',
    late: 'Verspätet',
  };
  return labels[status];
}

export function summarizeAvailability(record: AthleteAvailabilityRecord | null): string {
  if (!record || record.status === 'expected') return 'Erwartet / verfügbar';
  if (record.status === 'late') return `${record.lateMinutes ?? 0} Min. zu spät${record.reason ? ` · ${record.reason}` : ''}`;
  return record.reason ? `${statusLabel(record.status)} · ${record.reason}` : statusLabel(record.status);
}
