import type { PlannedSession } from '../types/acwr';
import { TE_EMOJI } from '../types/acwr';

/** Erfragt Benachrichtigungs-Berechtigung */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

/**
 * Plant eine Erinnerung für eine geplante Session.
 * Sendet die Benachrichtigung entweder:
 * - Zum konfigurierten Zeitpunkt (uhrzeit + geschaetzteDauer nach Trainingsende)
 * - Oder sofort wenn der Zeitpunkt bereits vorbei ist (für Tests)
 */
export function scheduleSessionReminder(
  session: PlannedSession,
  onNotificationClick: (sessionId: string) => void,
): number | null {
  if (Notification.permission !== 'granted') return null;

  const today = new Date().toISOString().split('T')[0];
  const sessionDate = session.datum;

  // Berechne Erinnerungszeit: Trainingsende + 15 Min
  let reminderMs: number;
  const now = Date.now();

  if (sessionDate < today) {
    // Vergangene Session → sofort erinnern (mit 2s Verzögerung)
    reminderMs = 2000;
  } else if (sessionDate === today && session.uhrzeit) {
    const [h, m] = session.uhrzeit.split(':').map(Number);
    const sessionStart = new Date();
    sessionStart.setHours(h, m, 0, 0);
    const endMs = sessionStart.getTime() + (session.geschaetzteDauer ?? 90) * 60 * 1000;
    const reminderTime = endMs + 15 * 60 * 1000; // 15 Min nach Ende
    reminderMs = Math.max(reminderTime - now, 3000);
  } else {
    // Zukünftige Session → Erinnerung am Abend des Trainingstages um 20:00
    const reminderDate = new Date(sessionDate + 'T20:00:00');
    reminderMs = Math.max(reminderDate.getTime() - now, 5000);
  }

  const emoji = TE_EMOJI[session.te] ?? '💪';
  const timeoutId = window.setTimeout(() => {
    const n = new Notification(`${emoji} Training eintragen`, {
      body: `${session.te}${session.uhrzeit ? ` (${session.uhrzeit})` : ''} — Bitte RPE und Dauer eintragen!`,
      icon: '/favicon.svg',
      tag: `session-${session.id}`,
      requireInteraction: true,
    });
    n.onclick = () => {
      window.focus();
      onNotificationClick(session.id);
      n.close();
    };
  }, reminderMs);

  return timeoutId;
}

/** Löscht eine geplante Erinnerung */
export function cancelReminder(timeoutId: number) {
  clearTimeout(timeoutId);
}

/** Sendet sofort eine Test-Benachrichtigung */
export function sendTestNotification() {
  if (Notification.permission !== 'granted') return;
  new Notification('✅ Benachrichtigungen aktiv', {
    body: 'Du wirst nach deinen Trainings an die RPE-Eingabe erinnert.',
    icon: '/favicon.svg',
  });
}
