import { useState, useEffect, useCallback } from 'react';
import type { FacilityWithUnits, FacilityBlackout } from '../../lib/organizationStorage';
import {
  loadAllBlackoutsByFacility,
  createBlackout,
  deleteBlackout,
} from '../../lib/organizationStorage';

// ── Constants ─────────────────────────────────────────────────────────────────

const BLACKOUT_TYPES = [
  'Wartung',
  'Turnier',
  'Vermietung',
  'Feiertag',
  'Sonstiges',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convert a local date + time string to a UTC ISO string using the browser timezone. */
function localToISO(datum: string, time: string): string {
  return new Date(`${datum}T${time}:00`).toISOString();
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('de-DE', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  }) + ' · ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  /** All facilities (with units) for the current organization. */
  facilities:          FacilityWithUnits[];
  /** Pre-select this facility when the manager opens. */
  initialFacilityId?:  string;
  /** Pre-select this unit when the manager opens (empty = facility-wide). */
  initialUnitId?:      string;
  onClose:   () => void;
  /** Called after a create or delete so the parent can reload calendar data. */
  onChanged: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function BlackoutManager({
  facilities,
  initialFacilityId,
  initialUnitId,
  onClose,
  onChanged,
}: Props) {

  // ── Form state ────────────────────────────────────────────────────────────
  const today = new Date().toISOString().split('T')[0];

  const [facilityId,   setFacilityId]   = useState(initialFacilityId ?? facilities[0]?.id ?? '');
  const [unitId,       setUnitId]       = useState(initialUnitId ?? '');
  const [title,        setTitle]        = useState('');
  const [blackoutType, setBlackoutType] = useState('Sonstiges');
  const [startDate,    setStartDate]    = useState(today);
  const [startTime,    setStartTime]    = useState('08:00');
  const [endDate,      setEndDate]      = useState(today);
  const [endTime,      setEndTime]      = useState('22:00');
  const [reason,       setReason]       = useState('');
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState('');

  // ── List state ────────────────────────────────────────────────────────────
  const [blackouts,    setBlackouts]    = useState<FacilityBlackout[]>([]);
  const [loadingList,  setLoadingList]  = useState(false);
  const [deleting,     setDeleting]     = useState<string | null>(null);

  // ── Derived ────────────────────────────────────────────────────────────────
  const selectedFacility = facilities.find(f => f.id === facilityId) ?? null;
  const availableUnits   = selectedFacility?.units ?? [];

  // Reset unit when facility changes
  useEffect(() => {
    setUnitId('');
  }, [facilityId]);

  // ── Load existing blackouts whenever facilityId changes ───────────────────
  const reloadList = useCallback(async () => {
    if (!facilityId) { setBlackouts([]); return; }
    setLoadingList(true);
    const bls = await loadAllBlackoutsByFacility(facilityId);
    setBlackouts(bls);
    setLoadingList(false);
  }, [facilityId]);

  useEffect(() => { reloadList(); }, [reloadList]);

  // ── Create ────────────────────────────────────────────────────────────────
  async function handleCreate() {
    if (!facilityId)    { setError('Halle auswählen'); return; }
    if (!title.trim())  { setError('Titel fehlt'); return; }
    if (!startDate || !startTime) { setError('Startzeit fehlt'); return; }
    if (!endDate   || !endTime)   { setError('Endzeit fehlt'); return; }

    const startsAt = localToISO(startDate, startTime);
    const endsAt   = localToISO(endDate, endTime);

    if (endsAt <= startsAt) { setError('Endzeit muss nach Startzeit liegen'); return; }

    setSaving(true);
    setError('');
    const created = await createBlackout({
      facilityId,
      facilityUnitId: unitId || undefined,
      title: title.trim(),
      startsAt,
      endsAt,
      reason: reason.trim() || undefined,
      blackoutType,
    });
    setSaving(false);

    if (!created) {
      setError('Anlegen fehlgeschlagen — Verbindung prüfen');
      return;
    }

    // Reset form
    setTitle('');
    setReason('');
    setBlackoutType('Sonstiges');

    await reloadList();
    onChanged(); // signal parent to refresh calendar
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    setDeleting(id);
    await deleteBlackout(id);
    setDeleting(null);
    await reloadList();
    onChanged();
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-800 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-white">Sperrzeiten verwalten</h2>
            <p className="text-[11px] text-gray-500 mt-0.5">Blackouts anlegen und löschen</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none">×</button>
        </div>

        <div className="overflow-y-auto flex-1 px-4 py-4 space-y-5">

          {/* ── Create form ─────────────────────────────────────────────── */}
          <div className="space-y-3">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Neue Sperrzeit</p>

            {/* Facility picker */}
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Halle *</label>
              <select
                value={facilityId}
                onChange={e => setFacilityId(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-red-500">
                <option value="">— Halle wählen —</option>
                {facilities.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.name}{f.address ? ` · ${f.address}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Unit picker — optional; empty = facility-wide */}
            {availableUnits.length > 0 && (
              <div>
                <label className="text-xs text-gray-400 mb-1 block">
                  Bereich <span className="text-gray-600">(leer = gesamte Anlage)</span>
                </label>
                <select
                  value={unitId}
                  onChange={e => setUnitId(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-red-500">
                  <option value="">Gesamte Anlage</option>
                  {availableUnits.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name}{u.capacity != null ? ` (max. ${u.capacity})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Title */}
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Titel *</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="z.B. Jahresmitgliederversammlung"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-red-500" />
            </div>

            {/* Blackout type */}
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Typ</label>
              <div className="flex flex-wrap gap-2">
                {BLACKOUT_TYPES.map(t => (
                  <button
                    key={t}
                    onClick={() => setBlackoutType(t)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      blackoutType === t
                        ? 'bg-red-800/70 text-red-200 border-red-700'
                        : 'border-gray-700 text-gray-400 hover:border-gray-500'
                    }`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Date / time range */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Start — Datum *</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-red-500 [color-scheme:dark]" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Uhrzeit *</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-red-500 [color-scheme:dark]" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Ende — Datum *</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-red-500 [color-scheme:dark]" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Uhrzeit *</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-red-500 [color-scheme:dark]" />
              </div>
            </div>

            {/* Reason (optional) */}
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Grund <span className="text-gray-600">(optional)</span></label>
              <input
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="z.B. Renovierung, externer Verein…"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-red-500" />
            </div>

            {error && <p className="text-red-400 text-xs">{error}</p>}

            <button
              onClick={handleCreate}
              disabled={saving || !facilityId || !title.trim()}
              className="w-full py-2.5 bg-red-700 hover:bg-red-600 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-40">
              {saving ? 'Speichern…' : '+ Sperrzeit anlegen'}
            </button>
          </div>

          {/* ── Existing blackouts list ──────────────────────────────────── */}
          {facilityId && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                  Bestehende Sperrzeiten
                </p>
                {loadingList && (
                  <span className="w-3.5 h-3.5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                )}
              </div>

              {!loadingList && blackouts.length === 0 && (
                <p className="text-xs text-gray-600 py-2 text-center">
                  Keine Sperrzeiten für diese Halle
                </p>
              )}

              {blackouts.map(bl => (
                <div
                  key={bl.id}
                  className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 flex items-start gap-2">
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm text-white font-medium truncate">{bl.title}</span>
                      {bl.blackoutType && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-900/60 text-red-300 font-medium flex-shrink-0">
                          {bl.blackoutType}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {formatDateTime(bl.startsAt)} → {formatDateTime(bl.endsAt)}
                    </p>
                    <p className="text-[11px] text-gray-600">
                      {bl.facilityUnitId === null
                        ? 'Gesamte Anlage'
                        : (selectedFacility?.units.find(u => u.id === bl.facilityUnitId)?.name ?? bl.facilityUnitId)}
                      {bl.reason ? ` · ${bl.reason}` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(bl.id)}
                    disabled={deleting === bl.id}
                    className="flex-shrink-0 text-gray-600 hover:text-red-400 text-xs transition-colors disabled:opacity-40 pt-0.5">
                    {deleting === bl.id ? '…' : 'Löschen'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
