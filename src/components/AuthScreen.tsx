import { useState } from 'react';
import { supabase } from '../lib/supabase';

interface Props {
  onGuest: () => void;
  onLoggedIn: () => void;
}

type Mode = 'login' | 'register';

export function AuthScreen({ onGuest, onLoggedIn }: Props) {
  const [mode, setMode]         = useState<Mode>('login');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [success, setSuccess]   = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (mode === 'register') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setSuccess('Bestätigungsmail gesendet — bitte E-Mail prüfen.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onLoggedIn();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unbekannter Fehler';
      // German-friendly error messages
      if (msg.includes('Invalid login')) setError('E-Mail oder Passwort falsch.');
      else if (msg.includes('already registered')) setError('Diese E-Mail ist bereits registriert.');
      else if (msg.includes('Password should')) setError('Passwort muss mindestens 6 Zeichen haben.');
      else setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0b0f] flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">

        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-purple-700 rounded-3xl flex items-center justify-center text-3xl mx-auto shadow-lg shadow-violet-900/40">
            🥗
          </div>
          <h1 className="text-2xl font-bold text-white">FitFuel</h1>
          <p className="text-sm text-gray-500">KI-Gesundheitsassistent für Athleten</p>
        </div>

        {/* Card */}
        <div className="bg-gray-900/80 rounded-3xl border border-gray-800 overflow-hidden">

          {/* Tab switcher */}
          <div className="flex border-b border-gray-800">
            {(['login', 'register'] as Mode[]).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(null); setSuccess(null); }}
                className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${
                  mode === m
                    ? 'text-white border-b-2 border-violet-500'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {m === 'login' ? 'Anmelden' : 'Registrieren'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1.5">E-Mail</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="max@beispiel.de"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500 transition-colors"
              />
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-1.5">Passwort</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Mindestens 6 Zeichen"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500 transition-colors"
              />
            </div>

            {error && (
              <div className="text-xs text-red-400 bg-red-900/20 border border-red-800/60 rounded-xl px-3 py-2.5">
                {error}
              </div>
            )}
            {success && (
              <div className="text-xs text-green-400 bg-green-900/20 border border-green-800/60 rounded-xl px-3 py-2.5">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-2xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold text-sm transition-colors"
            >
              {loading ? '…' : mode === 'login' ? 'Anmelden' : 'Konto erstellen'}
            </button>
          </form>
        </div>

        {/* Guest option */}
        <div className="text-center">
          <button
            onClick={onGuest}
            className="text-sm text-gray-600 hover:text-gray-400 transition-colors"
          >
            Als Gast fortfahren →
          </button>
          <p className="text-xs text-gray-700 mt-1">Daten werden nur lokal gespeichert</p>
        </div>
      </div>
    </div>
  );
}
