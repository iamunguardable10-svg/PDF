import { useState, useEffect } from 'react';
import type { AttendanceTeam, AttendanceTeamMember, AttendanceTrainingType } from '../../types/attendance';
import type { ManagedAthlete, AthleteGroup } from '../../types/trainerDashboard';
import { createSession } from '../../lib/attendanceStorage';
import { loadFacilitiesWithUnits } from '../../lib/organizationStorage';
import type { FacilityWithUnits } from '../../lib/organizationStorage';

const TRAINING_TYPES: AttendanceTrainingType[] = [
  'Training', 'Spiel', 'Wettkampf', 'S&C', 'Taktik', 'Videoanalyse', 'Regeneration', 'Sonstiges',
];

const COLORS: Record<string, string> = {
  Training: 'bg-violet-600', Spiel: 'bg-rose-600', Wettkampf: 'bg-orange-600',
  'S&C': 'bg-emerald-600', Taktik: 'bg-blue-600', Videoanalyse: 'bg-sky-600',
  Regeneration: 'bg-teal-600', Sonstiges: 'bg-gray-600',
};

type ParticipantMode = 'team' | 'group' | 'individual';

interface Props {
  trainerId: string;
  teams: AttendanceTeam[];
  membersByTeam: Record<string, AttendanceTeamMember[]>;
  roster: ManagedAthlete[];
  groups: AthleteGroup[];
  prefillDatum?: string;
  prefillTime?: string;
  isMock?: boolean;
  onCreated: () => void;
  onClose: () => void;
}

export function SessionPlanner({ trainerId, teams, membersByTeam, roster, groups, prefillDatum, prefillTime, isMock, onCreated, onClose }: Props) {
  const [titleCustomized, setTitleCustomized] = useState(false);
  const [title, setTitle] = useState('Training');
  const [description, setDescription] = useState('');
  const [datum, setDatum] = useState(() => prefillDatum ?? new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState(prefillTime ?? '17:00');
  const [endTime, setEndTime] = useState(() => {
    if (prefillTime) {
      const [h, m] = prefillTime.split(':').map(Number);
      return `${String(h + 2).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    return '19:00';
  });
  const [location, setLocation] = useState('');
  const [trainingType, setTrainingType] = useState<AttendanceTrainingType | ''>('Training');
  const [coachNote, setCoachNote] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState<string>(teams[0]?.id ?? '');
  const [participantMode, setParticipantMode] = useState<ParticipantMode>('team');
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [selectedGroupId, setSelectedGroupId] = useState<string>(groups[0]?.id ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [facilities, setFacilities] = useState<FacilityWithUnits[]>([]);
  const [facilityUnitId, setFacilityUnitId] = useState<string>('');

  function pickType(t: AttendanceTrainingType) {
    setTrainingType(t);
    if (!titleCustomized) setTitle(t);
  }

  const teamMembers = selectedTeamId ? (membersByTeam[selectedTeamId] ?? []) : [];
  const groupMembers = selectedGroupId
    ? roster.filter(a => a.groupIds.includes(selectedGroupId))
    : [];

  function toggleMember(id: string) {
    setSelectedMemberIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAll() { setSelectedMemberIds(new Set(teamMembers.map(m => m.id))); }
  function clearAll() { setSelectedMemberIds(new Set()); }

  // Load facilities whenever the selected team's org changes
  useEffect(() => {
    const orgId = teams.find(t => t.id === selectedTeamId)?.organizationId;
    if (!orgId) { setFacilities([]); setFacilityUnitId(''); return; }
    loadFacilitiesWithUnits(orgId).then(setFacilities);
  }, [selectedTeamId, teams]);

  function buildParticipants() {
    if (participantMode === 'team') {
      return teamMembers.map(m => ({
        id: m.id, userId: m.athleteUserId, rosterId: m.athleteRosterId, name: m.name,
      }));
    }
    if (participantMode === 'group') {
      return groupMembers.map(a => ({ id: a.id, rosterId: a.id, name: a.name }));
    }
    if (participantMode === 'individual') {
      return teamMembers
        .filter(m => selectedMemberIds.has(m.id))
        .map(m => ({ id: m.id, userId: m.athleteUserId, rosterId: m.athleteRosterId, name: m.name }));
    }
    return [];
  }

  async function handleSave() {
    if (isMock) { setError('Demo-Modus: Einheiten werden nicht gespeichert'); return; }
    if (!title.trim()) { setError('Titel fehlt'); return; }
    if (!datum) { setError('Datum fehlt'); return; }
    setSaving(true);
    setError('');
    const participants = buildParticipants();
    // Pick up org/dept from the selected team so they're dual-written to att_sessions
    const selectedTeam = teams.find(t => t.id === selectedTeamId);
    const result = await createSession({
      trainerId,
      title: title.trim(),
      description: description.trim(),
      datum,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
      location: location.trim(),
      teamId: selectedTeamId || undefined,
      trainingType: trainingType || undefined,
      coachNote: coachNote.trim(),
      organizationId: selectedTeam?.organizationId,
      departmentId:   selectedTeam?.departmentId,
      facilityUnitId: facilityUnitId || undefined,
      memberIds: participants,
    });
    setSaving(false);
    if (!result) { setError('Speichern fehlgeschlagen'); return; }
    onCreated();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-800 flex-shrink-0">
          <h2 className="text-base font-semibold text-white">Neue Einheit</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none">×</button>
        </div>

        <div className="overflow-y-auto flex-1 px-4 py-4 space-y-4">
          {/* Typ */}
          <div>
            <label className="text-xs text-gray-400 mb-2 block">Typ</label>
            <div className="flex flex-wrap gap-2">
              {TRAINING_TYPES.map(t => (
                <button key={t} onClick={() => pickType(t)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    trainingType === t
                      ? `${COLORS[t]} text-white border-transparent`
                      : 'border-gray-700 text-gray-400 hover:border-gray-500'
                  }`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Titel (optional override) */}
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Titel <span className="text-gray-600">(optional anpassen)</span></label>
            <input value={title} onChange={e => { setTitle(e.target.value); setTitleCustomized(true); }}
              placeholder="Wird aus Typ übernommen"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-violet-500" />
          </div>

          {/* Datum & Zeit */}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-3 sm:col-span-1">
              <label className="text-xs text-gray-400 mb-1 block">Datum *</label>
              <input type="date" value={datum} onChange={e => setDatum(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-violet-500 [color-scheme:dark]" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Von</label>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-violet-500 [color-scheme:dark]" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Bis</label>
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-violet-500 [color-scheme:dark]" />
            </div>
          </div>

          {/* Ort */}
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Ort / Halle</label>
            <input value={location} onChange={e => setLocation(e.target.value)}
              placeholder="z.B. Sporthalle Nord"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-violet-500" />
          </div>

          {/* Facility Unit — only shown when the selected team belongs to an org */}
          {facilities.length > 0 && (
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Halle / Platz</label>
              <select
                value={facilityUnitId}
                onChange={e => setFacilityUnitId(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-violet-500">
                <option value="">Keine Facility</option>
                {facilities.map(f => (
                  <optgroup key={f.id} label={f.name + (f.address ? ` · ${f.address}` : '')}>
                    {f.units.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name}{u.capacity != null ? ` (max. ${u.capacity})` : ''}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          )}

          {/* Team */}
          {teams.length > 0 && (
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Team</label>
              <select value={selectedTeamId} onChange={e => { setSelectedTeamId(e.target.value); setSelectedMemberIds(new Set()); }}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-violet-500">
                <option value="">Kein Team</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}

          {/* Teilnehmer-Modus */}
          <div>
            <label className="text-xs text-gray-400 mb-2 block">Teilnehmer</label>
            <div className="flex flex-wrap gap-2 mb-3">
              {selectedTeamId && (
                <button onClick={() => { setParticipantMode('team'); setSelectedMemberIds(new Set()); }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                    participantMode === 'team' ? 'bg-violet-600 text-white border-transparent' : 'border-gray-700 text-gray-400 hover:border-gray-500'
                  }`}>
                  Ganzes Team ({teamMembers.length})
                </button>
              )}
              {groups.length > 0 && (
                <button onClick={() => { setParticipantMode('group'); setSelectedMemberIds(new Set()); }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                    participantMode === 'group' ? 'bg-violet-600 text-white border-transparent' : 'border-gray-700 text-gray-400 hover:border-gray-500'
                  }`}>
                  Gruppe
                </button>
              )}
              {selectedTeamId && (
                <button onClick={() => { setParticipantMode('individual'); setSelectedMemberIds(new Set()); }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                    participantMode === 'individual' ? 'bg-violet-600 text-white border-transparent' : 'border-gray-700 text-gray-400 hover:border-gray-500'
                  }`}>
                  Auswahl
                </button>
              )}
            </div>

            {/* Gruppen-Selector */}
            {participantMode === 'group' && groups.length > 0 && (
              <div className="space-y-2">
                <select value={selectedGroupId} onChange={e => setSelectedGroupId(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-violet-500">
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name} ({roster.filter(a => a.groupIds.includes(g.id)).length} Spieler)</option>
                  ))}
                </select>
                {selectedGroupId && (
                  <div className="flex flex-wrap gap-1">
                    {groupMembers.map(a => (
                      <span key={a.id} className="px-2 py-0.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-300">
                        {a.name}
                      </span>
                    ))}
                    {groupMembers.length === 0 && (
                      <span className="text-xs text-gray-500">Keine Spieler in dieser Gruppe</span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Einzelauswahl aus Team */}
            {participantMode === 'individual' && teamMembers.length > 0 && (
              <div className="space-y-1">
                <div className="flex gap-2 mb-2">
                  <button onClick={selectAll} className="text-xs text-violet-400 hover:text-violet-300">Alle</button>
                  <span className="text-gray-600 text-xs">·</span>
                  <button onClick={clearAll} className="text-xs text-gray-500 hover:text-gray-400">Keine</button>
                  <span className="text-xs text-gray-500 ml-auto">{selectedMemberIds.size} ausgewählt</span>
                </div>
                {teamMembers.map(m => (
                  <button key={m.id} onClick={() => toggleMember(m.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-sm border transition-colors ${
                      selectedMemberIds.has(m.id)
                        ? 'border-violet-600 bg-violet-950/40 text-white'
                        : 'border-gray-800 text-gray-400 hover:border-gray-600'
                    }`}>
                    <span className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center text-xs ${
                      selectedMemberIds.has(m.id) ? 'bg-violet-600 text-white' : 'bg-gray-700'
                    }`}>
                      {selectedMemberIds.has(m.id) ? '✓' : ''}
                    </span>
                    {m.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Beschreibung */}
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Beschreibung</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              rows={2} placeholder="Optional..."
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-violet-500 resize-none" />
          </div>

          {/* Coach Note */}
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Trainer-Notiz (intern)</label>
            <textarea value={coachNote} onChange={e => setCoachNote(e.target.value)}
              rows={2} placeholder="Nur für dich sichtbar..."
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-violet-500 resize-none" />
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-4 pb-4 pt-3 border-t border-gray-800 flex-shrink-0">
          <button onClick={handleSave} disabled={saving || !title.trim() || !datum}
            className="w-full py-3 bg-violet-600 text-white rounded-xl font-medium text-sm disabled:opacity-40 hover:bg-violet-500 transition-colors">
            {saving ? 'Speichern...' : '✓ Einheit erstellen'}
          </button>
        </div>
      </div>
    </div>
  );
}
