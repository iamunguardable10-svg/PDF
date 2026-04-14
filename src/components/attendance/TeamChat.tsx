import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, CLOUD_ENABLED } from '../../lib/supabase';
import {
  loadTeamMessages, sendTeamMessage,
  loadSessionMessages, sendSessionMessage,
} from '../../lib/attendanceStorage';
import type { TeamMessage, SessionMessage } from '../../types/attendance';

type Mode = { kind: 'team'; teamId: string } | { kind: 'session'; sessionId: string };

interface Props {
  mode: Mode;
  userId: string;
  userName: string;
}

type AnyMsg = { id: string; senderUserId: string; senderName: string; message: string; createdAt: string };

export function TeamChat({ mode, userId, userName }: Props) {
  const [messages, setMessages] = useState<AnyMsg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const toAny = useCallback((m: TeamMessage | SessionMessage): AnyMsg => ({
    id: m.id, senderUserId: m.senderUserId, senderName: m.senderName,
    message: m.message, createdAt: m.createdAt,
  }), []);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    setMessages([]);
    (async () => {
      const msgs = mode.kind === 'team'
        ? await loadTeamMessages(mode.teamId)
        : await loadSessionMessages(mode.sessionId);
      if (!cancelled) setMessages(msgs.map(toAny));
    })();
    return () => { cancelled = true; };
  }, [mode, toAny]);

  // Realtime subscription
  useEffect(() => {
    if (!CLOUD_ENABLED) return;
    const table = mode.kind === 'team' ? 'att_team_messages' : 'att_session_messages';
    const filter = mode.kind === 'team'
      ? `team_id=eq.${mode.teamId}`
      : `session_id=eq.${mode.sessionId}`;

    const channel = supabase
      .channel(`chat-${mode.kind === 'team' ? mode.teamId : mode.sessionId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table, filter },
        (payload) => {
          const r = payload.new as Record<string, unknown>;
          setMessages(prev => {
            // deduplicate
            if (prev.some(m => m.id === (r.id as string))) return prev;
            return [...prev, {
              id: r.id as string,
              senderUserId: r.sender_user_id as string,
              senderName: r.sender_name as string,
              message: r.message as string,
              createdAt: r.created_at as string,
            }];
          });
        })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [mode]);

  // Scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput('');
    if (mode.kind === 'team') {
      await sendTeamMessage(mode.teamId, userId, userName, text);
    } else {
      await sendSessionMessage(mode.sessionId, userId, userName, text);
    }
    setSending(false);
  }

  function formatTime(iso: string) {
    const d = new Date(iso);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    if (isToday) return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) + ' ' +
      d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  }

  // Group consecutive messages from same sender
  const grouped = messages.map((msg, i) => ({
    ...msg,
    showName: i === 0 || messages[i - 1].senderUserId !== msg.senderUserId,
    showTime: i === messages.length - 1 || messages[i + 1].senderUserId !== msg.senderUserId,
  }));

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5 min-h-0">
        {messages.length === 0 && (
          <p className="text-center text-gray-600 text-sm pt-8">Noch keine Nachrichten</p>
        )}
        {grouped.map(msg => {
          const isMe = msg.senderUserId === userId;
          return (
            <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} ${msg.showName ? 'mt-3' : 'mt-0.5'}`}>
              {/* Sender name */}
              {msg.showName && (
                <span className={`text-[11px] font-medium mb-0.5 px-1 ${isMe ? 'text-violet-400' : 'text-gray-400'}`}>
                  {isMe ? 'Du' : msg.senderName}
                </span>
              )}
              {/* Bubble */}
              <div className={`max-w-[78%] px-3 py-2 text-sm leading-snug break-words ${
                isMe
                  ? 'bg-violet-600 text-white rounded-2xl rounded-tr-sm'
                  : 'bg-gray-800 text-gray-100 rounded-2xl rounded-tl-sm'
              }`}>
                {msg.message}
              </div>
              {/* Timestamp (only for last in group) */}
              {msg.showTime && (
                <span className="text-[10px] text-gray-600 mt-0.5 px-1">{formatTime(msg.createdAt)}</span>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2 px-3 py-3 border-t border-gray-800 flex-shrink-0">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="Nachricht..."
          className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-violet-500"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          className="px-3 py-2 bg-violet-600 text-white rounded-xl text-sm font-medium disabled:opacity-40 hover:bg-violet-500 transition-colors flex-shrink-0"
        >
          ↑
        </button>
      </div>
    </div>
  );
}
