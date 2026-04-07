import type { Session, PlannedSession } from '../types/acwr';

const SESSIONS_KEY = 'fitfuel_sessions';
const PLANNED_KEY  = 'fitfuel_planned_sessions';

export function loadSessions(): Session[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    return raw ? (JSON.parse(raw) as Session[]) : [];
  } catch {
    return [];
  }
}

export function saveSessions(sessions: Session[]): void {
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  } catch {
    // localStorage-Quota überschritten — still fail
  }
}

export function loadPlannedSessions(): PlannedSession[] {
  try {
    const raw = localStorage.getItem(PLANNED_KEY);
    return raw ? (JSON.parse(raw) as PlannedSession[]) : [];
  } catch {
    return [];
  }
}

export function savePlannedSessions(sessions: PlannedSession[]): void {
  try {
    localStorage.setItem(PLANNED_KEY, JSON.stringify(sessions));
  } catch {
    // localStorage-Quota überschritten — still fail
  }
}
