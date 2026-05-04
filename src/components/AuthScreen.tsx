import { useState } from 'react';
import type { FormEvent } from 'react';
import { supabase } from '../lib/supabase';

interface Props {
  onGuest?: () => void;
  onLoggedIn: () => void;
  onClose?: () => void;
}

type Mode = 'login' | 'register';

export function AuthScreen({ onGuest, onLoggedIn, onClose }: Props) {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (mode === 'register') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setSuccess('Check your email to confirm the account. After that, sign in and choose your role.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onLoggedIn();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message.includes('Invalid login')) setError('Email or password is incorrect.');
      else if (message.includes('already registered')) setError('This email is already registered. Try signing in instead.');
      else if (message.includes('Password should')) setError('Password must contain at least 6 characters.');
      else setError(message);
    } finally {
      setLoading(false);
    }
  }

  const inner = (
    <div className="w-full max-w-md space-y-6">
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-500 to-cyan-500 text-xl font-black text-white shadow-lg shadow-violet-950/40">
          TL
        </div>
        <h1 className="mt-4 text-2xl font-black text-white">Welcome to TeamLoad</h1>
        <p className="mt-1 text-sm text-gray-500">Sign in to sync teams, sessions, availability and attendance.</p>
      </div>

      <div className="overflow-hidden rounded-3xl border border-gray-800 bg-gray-900/80 shadow-2xl shadow-black/30">
        <div className="grid grid-cols-2 border-b border-gray-800 bg-gray-950/40">
          {(['login', 'register'] as Mode[]).map(item => (
            <button
              key={item}
              onClick={() => { setMode(item); setError(null); setSuccess(null); }}
              className={`py-3.5 text-sm font-bold transition-colors ${
                mode === item
                  ? 'border-b-2 border-violet-500 text-white'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {item === 'login' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div className="rounded-2xl border border-violet-500/20 bg-violet-500/10 px-4 py-3">
            <p className="text-xs font-semibold leading-5 text-violet-100">
              Coaches should use a real account. Demo mode is useful for testing, but club data needs cloud sync.
            </p>
          </div>

          <label className="block text-xs font-semibold text-gray-500">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={event => setEmail(event.target.value)}
              placeholder="coach@example.com"
              className="mt-1.5 w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none transition-colors focus:border-violet-500"
            />
          </label>

          <label className="block text-xs font-semibold text-gray-500">
            Password
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={event => setPassword(event.target.value)}
              placeholder="At least 6 characters"
              className="mt-1.5 w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none transition-colors focus:border-violet-500"
            />
          </label>

          {error && (
            <div className="rounded-xl border border-rose-800/60 bg-rose-950/30 px-3 py-2.5 text-xs font-semibold text-rose-300">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-xl border border-emerald-800/60 bg-emerald-950/30 px-3 py-2.5 text-xs font-semibold text-emerald-300">
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-violet-600 py-3 text-sm font-black text-white transition-colors hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Working...' : mode === 'login' ? 'Sign in to TeamLoad' : 'Create TeamLoad account'}
          </button>
        </form>
      </div>

      <div className="text-center">
        {onClose ? (
          <button onClick={onClose} className="text-sm font-semibold text-gray-600 transition-colors hover:text-gray-400">
            Cancel
          </button>
        ) : onGuest ? (
          <div>
            <button onClick={onGuest} className="text-sm font-semibold text-gray-600 transition-colors hover:text-gray-400">
              Continue in local demo mode
            </button>
            <p className="mt-1 text-xs text-gray-700">Demo data stays on this device.</p>
          </div>
        ) : null}
      </div>
    </div>
  );

  if (onClose) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        onClick={event => { if (event.target === event.currentTarget) onClose(); }}
      >
        {inner}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0b0f] p-4">
      {inner}
    </div>
  );
}
