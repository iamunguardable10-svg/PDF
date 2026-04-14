import { useState, useEffect } from 'react';
import type { AttendanceTeam } from '../../types/attendance';
import { fetchTeamByInviteToken, joinTeamViaLink } from '../../lib/attendanceStorage';

interface Props {
  token: string;
  userId: string;
  userName: string;
  userSport: string;
  onJoined: () => void;
  onBack: () => void;
}

export function TeamJoinScreen({ token, userId, userName, userSport, onJoined, onBack }: Props) {
  const [team, setTeam] = useState<AttendanceTeam | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetchTeamByInviteToken(token).then(t => {
      setTeam(t);
      setLoading(false);
    });
  }, [token]);

  async function handleJoin() {
    if (!team) return;
    setJoining(true);
    const ok = await joinTeamViaLink(team.id, userId, userName, userSport);
    setJoining(false);
    if (ok) {
      setDone(true);
      setTimeout(onJoined, 1500);
    } else {
      setError('Beitritt fehlgeschlagen — du bist möglicherweise bereits Mitglied.');
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-sm p-6 text-center space-y-4">
        {loading ? (
          <p className="text-gray-400 text-sm">Link wird überprüft...</p>
        ) : !team ? (
          <>
            <div className="text-4xl">🔗</div>
            <h2 className="text-lg font-semibold text-white">Ungültiger Link</h2>
            <p className="text-sm text-gray-400">Dieser Einladungslink ist abgelaufen oder existiert nicht mehr.</p>
            <button onClick={onBack} className="w-full py-3 border border-gray-700 text-gray-400 rounded-xl text-sm hover:border-gray-500 transition-colors">
              Zurück
            </button>
          </>
        ) : done ? (
          <>
            <div className="text-4xl">✓</div>
            <h2 className="text-lg font-semibold text-white">Beigetreten!</h2>
            <p className="text-sm text-gray-400">Du bist jetzt Mitglied von <strong className="text-white">{team.name}</strong>.</p>
          </>
        ) : (
          <>
            <div className="w-14 h-14 rounded-2xl bg-violet-900/40 flex items-center justify-center text-2xl mx-auto">🏆</div>
            <div>
              <h2 className="text-lg font-semibold text-white">Team beitreten</h2>
              <p className="text-sm text-gray-400 mt-1">Du wurdest eingeladen, dem Team beizutreten:</p>
            </div>
            <div className="bg-gray-800 rounded-xl px-4 py-3">
              <p className="text-base font-semibold text-white">{team.name}</p>
              {team.sport && <p className="text-xs text-gray-400 mt-0.5">{team.sport}</p>}
            </div>
            <p className="text-xs text-gray-500">Als: <span className="text-gray-300">{userName}</span></p>
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <div className="space-y-2 pt-1">
              <button onClick={handleJoin} disabled={joining}
                className="w-full py-3 bg-violet-600 text-white rounded-xl font-medium text-sm disabled:opacity-40 hover:bg-violet-500 transition-colors">
                {joining ? 'Beitreten...' : 'Team beitreten'}
              </button>
              <button onClick={onBack}
                className="w-full py-2 text-sm text-gray-500 hover:text-gray-300 transition-colors">
                Abbrechen
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
