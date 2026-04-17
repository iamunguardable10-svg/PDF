import { useState, useEffect } from 'react';
import { Check, X, UserPlus, Loader2 } from 'lucide-react';
import {
  loadPendingJoinRequests,
  approveJoinRequest,
  rejectJoinRequest,
} from '../../lib/attendanceStorage';
import type { JoinRequest } from '../../lib/attendanceStorage';

interface Props {
  trainerId: string;
  /** Called when a request is approved so parent can reload roster/teams. */
  onChanged: () => void;
}

export function JoinRequestsPanel({ trainerId, onChanged }: Props) {
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [acting,   setActing]   = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const data = await loadPendingJoinRequests(trainerId);
    setRequests(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, [trainerId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return null; // silent — don't show skeleton in dashboard
  if (requests.length === 0) return null; // nothing pending → don't render

  async function handleApprove(req: JoinRequest) {
    setActing(req.id);
    const ok = await approveJoinRequest(req);
    if (ok) {
      setRequests(prev => prev.filter(r => r.id !== req.id));
      onChanged();
    }
    setActing(null);
  }

  async function handleReject(req: JoinRequest) {
    setActing(req.id);
    await rejectJoinRequest(req.id);
    setRequests(prev => prev.filter(r => r.id !== req.id));
    setActing(null);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <UserPlus size={13} className="text-sky-400" />
        <p className="text-xs font-medium text-sky-300">
          {requests.length} offene Beitrittsanfrage{requests.length !== 1 ? 'n' : ''}
        </p>
      </div>

      <div className="space-y-2">
        {requests.map(req => (
          <div key={req.id}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-sky-950/30 border border-sky-800/40">
            {/* Avatar */}
            <div className="w-8 h-8 rounded-full bg-sky-900/50 border border-sky-700/40 flex items-center justify-center flex-shrink-0">
              <span className="text-sky-400 text-xs font-bold">
                {req.userName.charAt(0).toUpperCase()}
              </span>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{req.userName}</p>
              <p className="text-[11px] text-gray-500">
                {req.teamName ?? req.teamId}
                {req.userSport ? ` · ${req.userSport}` : ''}
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                onClick={() => handleApprove(req)}
                disabled={acting === req.id}
                title="Annehmen"
                className="w-7 h-7 rounded-lg bg-emerald-800/50 hover:bg-emerald-700/60 disabled:opacity-40 flex items-center justify-center text-emerald-400 transition-colors"
              >
                {acting === req.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={13} />}
              </button>
              <button
                onClick={() => handleReject(req)}
                disabled={acting === req.id}
                title="Ablehnen"
                className="w-7 h-7 rounded-lg bg-rose-900/30 hover:bg-rose-800/40 disabled:opacity-40 flex items-center justify-center text-rose-400 transition-colors"
              >
                <X size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
