import { useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { fetchInvite, acceptInvite, getActiveShare, createLiveShare } from '../lib/trainerShare';
import { loadProfile } from '../lib/profileStorage';

interface Props {
  inviteCode: string;
  user: User | null;
  onLoginRequest: () => void;
}

type State = 'loading' | 'ready' | 'expired' | 'not_found' | 'accepting' | 'done' | 'error';

export function InviteAccept({ inviteCode, user, onLoginRequest }: Props) {
  const [state, setState] = useState<State>('loading');
  const [trainerName, setTrainerName] = useState('');

  useEffect(() => {
    fetchInvite(inviteCode).then(inv => {
      if (!inv) { setState('not_found'); return; }
      if (inv.expired) { setState('expired'); return; }
      setTrainerName(inv.trainerName);
      setState('ready');
    });
  }, [inviteCode]);

  const handleAccept = async () => {
    if (!user) { onLoginRequest(); return; }
    setState('accepting');

    // Ensure athlete has an active live token (auto-create if missing)
    let token = await getActiveShare(user.id);
    if (!token) token = await createLiveShare(user.id);
    if (!token) { setState('error'); return; }

    const profile = loadProfile();
    const name = profile.name || user.email || 'Athlet';

    const ok = await acceptInvite(inviteCode, token, name);
    setState(ok ? 'done' : 'error');
  };

  const goHome = () => { window.location.hash = ''; };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="bg-gray-900 border border-gray-800 rounded-3xl p-8 w-full max-w-sm text-center space-y-5">

        {/* Logo */}
        <div className="w-14 h-14 bg-gradient-to-br from-violet-500 to-purple-700 rounded-2xl flex items-center justify-center text-2xl mx-auto shadow-lg shadow-violet-900/40">
          🥗
        </div>

        {state === 'loading' && (
          <>
            <div className="text-gray-400 text-sm">Einladung wird geladen…</div>
            <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </>
        )}

        {state === 'not_found' && (
          <>
            <h2 className="text-white font-bold text-lg">Einladung nicht gefunden</h2>
            <p className="text-gray-500 text-sm">Dieser Link ist ungültig oder wurde bereits verwendet.</p>
            <button onClick={goHome} className="w-full py-3 rounded-xl border border-gray-700 text-gray-400 text-sm hover:bg-gray-800 transition-colors">
              Zur App
            </button>
          </>
        )}

        {state === 'expired' && (
          <>
            <h2 className="text-white font-bold text-lg">Einladung abgelaufen</h2>
            <p className="text-gray-500 text-sm">Bitte bitte deinen Trainer, dir einen neuen Link zu schicken.</p>
            <button onClick={goHome} className="w-full py-3 rounded-xl border border-gray-700 text-gray-400 text-sm hover:bg-gray-800 transition-colors">
              Zur App
            </button>
          </>
        )}

        {(state === 'ready' || state === 'accepting') && (
          <>
            <div>
              <h2 className="text-white font-bold text-lg mb-1">Trainer-Einladung</h2>
              <p className="text-gray-400 text-sm leading-relaxed">
                <span className="text-white font-semibold">{trainerName}</span> möchte deinen
                Belastungsstatus (ACWR) verfolgen.
              </p>
            </div>

            <div className="bg-gray-800/60 rounded-2xl px-4 py-3 text-xs text-gray-400 text-left space-y-1.5">
              <div className="flex items-start gap-2">
                <span className="text-green-400 shrink-0 mt-0.5">✓</span>
                <span>Dein Trainer sieht ACWR, Akutlast und Chroniklast</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-green-400 shrink-0 mt-0.5">✓</span>
                <span>Keine persönlichen Daten wie Ernährung oder Gewicht</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-green-400 shrink-0 mt-0.5">✓</span>
                <span>Verbindung jederzeit in ACWR → Trainer-Link trennbar</span>
              </div>
            </div>

            {!user ? (
              <div className="space-y-2">
                <p className="text-xs text-gray-500">Du musst angemeldet sein, um die Einladung anzunehmen.</p>
                <button onClick={onLoginRequest}
                  className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors">
                  Anmelden / Registrieren
                </button>
                <button onClick={goHome}
                  className="w-full py-3 rounded-xl border border-gray-700 text-gray-500 text-sm hover:bg-gray-800 transition-colors">
                  Abbrechen
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  onClick={handleAccept}
                  disabled={state === 'accepting'}
                  className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
                >
                  {state === 'accepting' ? 'Wird verknüpft…' : 'Akzeptieren'}
                </button>
                <button onClick={goHome}
                  className="w-full py-3 rounded-xl border border-gray-700 text-gray-500 text-sm hover:bg-gray-800 transition-colors">
                  Ablehnen
                </button>
              </div>
            )}
          </>
        )}

        {state === 'done' && (
          <>
            <div className="w-12 h-12 bg-green-900/40 border border-green-800/40 rounded-full flex items-center justify-center mx-auto text-2xl">
              ✓
            </div>
            <div>
              <h2 className="text-white font-bold text-lg mb-1">Verbunden!</h2>
              <p className="text-gray-400 text-sm">
                {trainerName} kann ab jetzt deinen Belastungsstatus sehen.
              </p>
            </div>
            <button onClick={goHome}
              className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors">
              Zur App
            </button>
          </>
        )}

        {state === 'error' && (
          <>
            <h2 className="text-white font-bold text-lg">Fehler</h2>
            <p className="text-gray-500 text-sm">Die Einladung konnte nicht angenommen werden. Bitte versuche es erneut.</p>
            <div className="flex gap-2">
              <button onClick={() => setState('ready')}
                className="flex-1 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors">
                Erneut versuchen
              </button>
              <button onClick={goHome}
                className="flex-1 py-3 rounded-xl border border-gray-700 text-gray-400 text-sm hover:bg-gray-800 transition-colors">
                Abbrechen
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
