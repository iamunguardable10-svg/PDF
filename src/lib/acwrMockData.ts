import type { Session, PlannedSession } from '../types/acwr';

// ── 4 Wochen Testdaten (realistisches Basketballteam-Szenario) ──────────────
// Woche 1 (10.–16. Mär): Normaler Aufbau
// Woche 2 (17.–23. Mär): Belastungsspitze, 2× Spiel (ACWR > 1.3)
// Woche 3 (24.–30. Mär): Regeneration (ACWR sinkt)
// Woche 4 (31. Mär – 6. Apr): Wiederaufbau → optimale Zone

export const initialSessions: Session[] = [
  // ── Woche 1 ──
  { id: 's-w1-01', name: 'Athlet', datum: '2026-03-09', te: 'S&C',        rpe: 6, dauer: 60,  tl: 360 },
  { id: 's-w1-02', name: 'Athlet', datum: '2026-03-10', te: 'Team',       rpe: 7, dauer: 90,  tl: 630 },
  { id: 's-w1-03', name: 'Athlet', datum: '2026-03-11', te: 'Prävention', rpe: 3, dauer: 40,  tl: 120 },
  { id: 's-w1-04', name: 'Athlet', datum: '2026-03-12', te: 'Team',       rpe: 7, dauer: 90,  tl: 630 },
  { id: 's-w1-05', name: 'Athlet', datum: '2026-03-13', te: 'S&C',        rpe: 6, dauer: 60,  tl: 360 },
  { id: 's-w1-06', name: 'Athlet', datum: '2026-03-14', te: 'Team',       rpe: 7, dauer: 90,  tl: 630 },
  { id: 's-w1-07', name: 'Athlet', datum: '2026-03-15', te: 'Aufwärmen',  rpe: 5, dauer: 30,  tl: 150 },
  { id: 's-w1-08', name: 'Athlet', datum: '2026-03-15', te: 'Spiel',      rpe: 8, dauer: 90,  tl: 720 },

  // ── Woche 2: Belastungsspitze ──
  { id: 's-w2-01', name: 'Athlet', datum: '2026-03-17', te: 'Team',       rpe: 8, dauer: 90,  tl: 720 },
  { id: 's-w2-02', name: 'Athlet', datum: '2026-03-17', te: 'S&C',        rpe: 7, dauer: 60,  tl: 420 },
  { id: 's-w2-03', name: 'Athlet', datum: '2026-03-18', te: 'Indi',       rpe: 6, dauer: 45,  tl: 270 },
  { id: 's-w2-04', name: 'Athlet', datum: '2026-03-19', te: 'Team',       rpe: 8, dauer: 90,  tl: 720 },
  { id: 's-w2-05', name: 'Athlet', datum: '2026-03-20', te: 'S&C',        rpe: 7, dauer: 60,  tl: 420 },
  { id: 's-w2-06', name: 'Athlet', datum: '2026-03-21', te: 'Aufwärmen',  rpe: 5, dauer: 30,  tl: 150 },
  { id: 's-w2-07', name: 'Athlet', datum: '2026-03-21', te: 'Spiel',      rpe: 9, dauer: 90,  tl: 810 },
  { id: 's-w2-08', name: 'Athlet', datum: '2026-03-22', te: 'Aufwärmen',  rpe: 5, dauer: 30,  tl: 150 },
  { id: 's-w2-09', name: 'Athlet', datum: '2026-03-22', te: 'Spiel',      rpe: 8, dauer: 90,  tl: 720 },

  // ── Woche 3: Regeneration ──
  { id: 's-w3-01', name: 'Athlet', datum: '2026-03-24', te: 'Prävention', rpe: 3, dauer: 45,  tl: 135 },
  { id: 's-w3-02', name: 'Athlet', datum: '2026-03-25', te: 'Team',       rpe: 5, dauer: 75,  tl: 375 },
  { id: 's-w3-03', name: 'Athlet', datum: '2026-03-26', te: 'S&C',        rpe: 5, dauer: 45,  tl: 225 },
  { id: 's-w3-04', name: 'Athlet', datum: '2026-03-27', te: 'Team',       rpe: 5, dauer: 75,  tl: 375 },
  { id: 's-w3-05', name: 'Athlet', datum: '2026-03-28', te: 'Indi',       rpe: 5, dauer: 40,  tl: 200 },
  { id: 's-w3-06', name: 'Athlet', datum: '2026-03-29', te: 'Aufwärmen',  rpe: 4, dauer: 30,  tl: 120 },
  { id: 's-w3-07', name: 'Athlet', datum: '2026-03-29', te: 'Spiel',      rpe: 7, dauer: 90,  tl: 630 },

  // ── Woche 4: Wiederaufbau → optimale Zone ──
  { id: 's-w4-01', name: 'Athlet', datum: '2026-03-31', te: 'Team',       rpe: 7, dauer: 90,  tl: 630 },
  { id: 's-w4-02', name: 'Athlet', datum: '2026-03-31', te: 'S&C',        rpe: 6, dauer: 60,  tl: 360 },
  { id: 's-w4-03', name: 'Athlet', datum: '2026-04-01', te: 'Indi',       rpe: 6, dauer: 45,  tl: 270 },
  { id: 's-w4-04', name: 'Athlet', datum: '2026-04-02', te: 'Team',       rpe: 7, dauer: 90,  tl: 630 },
  { id: 's-w4-05', name: 'Athlet', datum: '2026-04-03', te: 'S&C',        rpe: 7, dauer: 60,  tl: 420 },
  { id: 's-w4-06', name: 'Athlet', datum: '2026-04-04', te: 'Team',       rpe: 7, dauer: 90,  tl: 630 },
  { id: 's-w4-07', name: 'Athlet', datum: '2026-04-05', te: 'Aufwärmen',  rpe: 5, dauer: 30,  tl: 150 },
  { id: 's-w4-08', name: 'Athlet', datum: '2026-04-05', te: 'Spiel',      rpe: 8, dauer: 90,  tl: 720 },
  { id: 's-w4-09', name: 'Athlet', datum: '2026-04-06', te: 'Prävention', rpe: 3, dauer: 30,  tl:  90 },
];

export const initialPlannedSessions: PlannedSession[] = [
  // Kommende Woche (ab 7. April) — zum Testen der Prognose
  {
    id: 'plan-2026-04-07-Team',
    datum: '2026-04-07', te: 'Team',
    uhrzeit: '17:00', geschaetzteDauer: 90,
    reminderScheduled: false, confirmed: false,
  },
  {
    id: 'plan-2026-04-08-SC',
    datum: '2026-04-08', te: 'S&C',
    uhrzeit: '09:00', geschaetzteDauer: 60,
    reminderScheduled: false, confirmed: false,
  },
  {
    id: 'plan-2026-04-09-Team',
    datum: '2026-04-09', te: 'Team',
    uhrzeit: '17:00', geschaetzteDauer: 90,
    reminderScheduled: false, confirmed: false,
  },
  {
    id: 'plan-2026-04-10-SC',
    datum: '2026-04-10', te: 'S&C',
    uhrzeit: '09:00', geschaetzteDauer: 60,
    reminderScheduled: false, confirmed: false,
  },
  {
    id: 'plan-2026-04-11-Team',
    datum: '2026-04-11', te: 'Team',
    uhrzeit: '17:00', geschaetzteDauer: 90,
    reminderScheduled: false, confirmed: false,
  },
  {
    id: 'plan-2026-04-12-Aufwaermen',
    datum: '2026-04-12', te: 'Aufwärmen',
    uhrzeit: '13:30', geschaetzteDauer: 30,
    notiz: 'Automatisch vor Spiel eingefügt',
    reminderScheduled: false, confirmed: false,
  },
  {
    id: 'plan-2026-04-12-Spiel',
    datum: '2026-04-12', te: 'Spiel',
    uhrzeit: '14:00', geschaetzteDauer: 90,
    reminderScheduled: false, confirmed: false,
  },
];
