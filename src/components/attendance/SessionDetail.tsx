import { useState, useEffect, useCallback } from 'react';
import type { AttendanceSession, AttendanceRecord, FinalAttendanceStatus, EffectiveAttendanceStatus } from '../../types/attendance';
import { getEffectiveStatus } from '../../types/attendance';
import { loadSessionRecords, setFinalStatus, clearFinalStatus, deleteSession, updateSession } from '../../lib/attendanceStorage';
import { loadFacilitiesWithUnits, loadSessionFacilityUnitId } from '../../lib/organizationStorage';
import type { FacilityWithUnits } from '../../lib/organizationStorage';
import { TeamChat } from './TeamChat';

const FINAL_STATUSES: { value: FinalAttendanceStatus; label: string; color: string }[] = [
  { value: 'present',          label: 'Anwesend',            color: 'bg-emerald-600' },
  { value: 'late',             label: 'Verspätet',           color: 'bg-amber-600' },
  { value: 'partial',          label: 'Teilweise',           color: 'bg-yellow-600' },
  { value: 'excused_absent',   label: 'Entschuldigt',        color: 'bg-blue-600' },
  { value: 'unexcused_absent', label: 'Unentschuldigt',      color: 'bg-red-700' },
];

function statusBadge(status: EffectiveAttendanceStatus) {
  const map: Record<EffectiveAttendanceStatus, { label: string; cls: string }> = {
    expected:          { label: 'Erwartet',       cls: 'bg-gray-700 text-gray-300' },
    maybe:             { label: 'Unsicher',        cls: 'bg-yellow-900/60 text-yellow-300' },
    no:                { label: 'Abgesagt',        cls: 'bg-red-900/60 text-red-300' },
    present:           { label: 'Anwesend',        cls: 'bg-emerald-900/60 text-emerald-300' },
    late:              { label: 'Verspätet',       cls: 'bg-amber-900/60 text-amber-300' },
    partial:           { label: 'Teilweise',       cls: 'bg-yellow-900/60 text-yellow-300' },
    excused_absent:    { label: 'Entschuldigt',    cls: 'bg-blue-900/60 text-blue-300' },
    unexcused_absent:  { label: 'Unentschuldigt',  cls: 'bg-red-900/60 text-red-300' },
  };
  const s = map[status];
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.cls}`}>{s.label}</span>;
}

interface Props {
  session: AttendanceSession;
  trainerId: string;
  onClose: () => void;
  onDeleted: () => void;
}

type SubTab = 'attendance' | 'chat';

export function SessionDetail({ session, trainerId, onClose, onDeleted }: Props) {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [settingFinal, setSettingFinal] = useState<string | null>(null);
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [subTab, setSubTab] = useState<SubTab>('attendance');

  // Facility state
  const [facilities, setFacilities] = useState<FacilityWithUnits[]>([]);
  const [facilityUnitId, setFacilityUnitId] = useState<string>('');
  const [savingFacility, setSavingFacility] = useState(false);

  const reload = useCallback(async () => {
    const recs = await loadSessionRecords(session.id);
    setRecords(recs);
    setLoading(false);
  }, [session.id]);

  useEffect(() => { reload(); }, [reload]);

  // Load facilities + current booking when session has an organizationId
  useEffect(() => {
    if (!session.organizationId) return;
    Promise.all([
      loadFacilitiesWithUnits(session.organizationId),
      loadSessionFacilityUnitId(session.id),
    ]).then(([facs, unitId]) => {
      setFacilities(facs);
      setFacilityUnitId(unitId ?? '');
    });
  }, [session.id, session.organizationId]);

  async function handleFacilitySave(newUnitId: string) {
    setSavingFacility(true);
    // Pass empty string as null (clears booking), non-empty triggers upsert
    await updateSession(session.id, { facilityUnitId: newUnitId || undefined });
    setFacilityUnitId(newUnitId);
    setSavingFacility(false);
  }

  async function handleSetFinal(recordId: string, status: FinalAttendanceStatus | null) {
    setSettingFinal(recordId);
    if (status === null) await clearFinalStatus(recordId);
    else await setFinalStatus(recordId, status);
    await reload();
    setSettingFinal(null);
  }

  async function handleDelete() {
    await deleteSession(session.id);
    onDeleted();
  }

  const expected = records.filter(r => !r.overrideStatus).length;
  const cancelled = records.filter(r => r.overrideStatus === 'no').length;
  const maybe = records.filter(r => r.overrideStatus === 'maybe').length;
  const finalized = records.filter(r => r.finalStatus).length;

  function formatDate(d: string) {
    return new Date(d + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  const reasonLabels: Record<string, string> = {
    verletzt: 'Verletzt', krank: 'Krank', schule: 'Schule/Uni',
    arbeit: 'Arbeit', privat: 'Privat', sonstiges: 'Sonstiges',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-gray-800 flex-shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-semibold text-white truncate">{session.title}</h2>
                {session.trainingType && (
                  <span className="text-xs px-2 py-0.5 bg-violet-900/50 text-violet-300 rounded-full">{session.trainingType}</span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                {formatDate(session.datum)}
                {session.startTime && ` · ${session.startTime}${session.endTime ? `–${session.endTime}` : ''}`}
                {session.location && ` · ${session.location}`}
              </p>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none ml-2">×</button>
          </div>

          {/* Stats row */}
          <div className="flex gap-3 mt-3 text-xs text-gray-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-500 inline-block" />{expected} erwartet</span>
            {maybe > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" />{maybe} unsicher</span>}
            {cancelled > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />{cancelled} abgesagt</span>}
            {finalized > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />{finalized} final</span>}
          </div>

          {/* Sub-tabs */}
          <div className="flex gap-1 mt-3 bg-gray-800 rounded-xl p-1">
            {(['attendance', 'chat'] as SubTab[]).map(t => (
              <button key={t} onClick={() => setSubTab(t)}
                className={`flex-1 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                  subTab === t ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
                }`}>
                {t === 'attendance' ? 'Anwesenheit' : 'Chat'}
              </button>
            ))}
          </div>
        </div>

        {subTab === 'attendance' ? (
          <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2">
            {loading ? (
              <p className="text-center text-gray-500 text-sm py-6">Laden...</p>
            ) : records.length === 0 ? (
              <p className="text-center text-gray-500 text-sm py-6">Keine Teilnehmer</p>
            ) : records.map(rec => {
              const effective = getEffectiveStatus(rec);
              const isExpanded = expandedRecord === rec.id;
              return (
                <div key={rec.id} className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700">
                  <button className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
                    onClick={() => setExpandedRecord(isExpanded ? null : rec.id)}>
                    <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-xs font-medium text-gray-300 flex-shrink-0">
                      {rec.athleteName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{rec.athleteName}</p>
                      {rec.absenceReason && (
                        <p className="text-xs text-gray-500">{reasonLabels[rec.absenceReason]}</p>
                      )}
                    </div>
                    {statusBadge(effective)}
                    <span className="text-gray-600 text-xs ml-1">{isExpanded ? '▲' : '▼'}</span>
                  </button>

                  {isExpanded && (
                    <div className="px-3 pb-3 border-t border-gray-700 pt-2 space-y-2">
                      {/* Absence note */}
                      {rec.absenceNote && (
                        <div className="bg-gray-900 rounded-lg px-3 py-2">
                          <p className="text-xs text-gray-400 mb-0.5">Nachricht</p>
                          <p className="text-sm text-gray-200">"{rec.absenceNote}"</p>
                        </div>
                      )}

                      {/* Final status buttons */}
                      <div>
                        <p className="text-xs text-gray-500 mb-1.5">Finaler Status setzen:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {FINAL_STATUSES.map(fs => (
                            <button key={fs.value}
                              onClick={() => handleSetFinal(rec.id, rec.finalStatus === fs.value ? null : fs.value)}
                              disabled={settingFinal === rec.id}
                              className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                                rec.finalStatus === fs.value
                                  ? `${fs.color} text-white`
                                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                              }`}>
                              {fs.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col">
            <TeamChat
              mode={{ kind: 'session', sessionId: session.id }}
              userId={trainerId}
              userName="Trainer"
            />
          </div>
        )}

        {/* Facility section — shown only when org facilities are available */}
        {facilities.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-800 flex-shrink-0">
            <label className="text-xs text-gray-400 mb-1.5 block">Halle / Platz</label>
            <div className="flex gap-2">
              <select
                value={facilityUnitId}
                disabled={savingFacility}
                onChange={e => handleFacilitySave(e.target.value)}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-violet-500 disabled:opacity-50">
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
              {savingFacility && (
                <span className="text-xs text-gray-500 self-center">Speichern...</span>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-4 pb-4 pt-3 border-t border-gray-800 flex-shrink-0">
          {confirmDelete ? (
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(false)}
                className="flex-1 py-2 text-sm border border-gray-700 text-gray-400 rounded-xl hover:border-gray-500 transition-colors">
                Abbrechen
              </button>
              <button onClick={handleDelete}
                className="flex-1 py-2 text-sm bg-red-700 text-white rounded-xl hover:bg-red-600 transition-colors font-medium">
                Löschen
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)}
              className="w-full py-2 text-sm text-red-400 border border-gray-800 rounded-xl hover:border-red-900 transition-colors">
              Einheit löschen
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
