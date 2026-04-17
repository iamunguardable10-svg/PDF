import { useState, useEffect } from 'react';
import { Plus, Trash2, X, ChevronDown, ChevronRight, Building2 } from 'lucide-react';
import {
  loadFacilitiesWithUnits,
  createFacility,
  deleteFacility,
  createFacilityUnit,
  deleteFacilityUnit,
} from '../../lib/organizationStorage';
import type { FacilityWithUnits } from '../../lib/organizationStorage';

interface Props {
  organizationId: string;
  onClose: () => void;
  /** Called after any create/delete so the parent can reload its facility list. */
  onChanged: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function HallenManager({ organizationId, onClose, onChanged }: Props) {
  const [facilities, setFacilities]   = useState<FacilityWithUnits[]>([]);
  const [loading, setLoading]         = useState(true);
  const [expanded, setExpanded]       = useState<Set<string>>(new Set());

  // New facility form
  const [showNewFac,   setShowNewFac]   = useState(false);
  const [newFacName,   setNewFacName]   = useState('');
  const [newFacAddr,   setNewFacAddr]   = useState('');
  const [savingFac,    setSavingFac]    = useState(false);

  // New unit form state: facilityId → { name, capacity }
  const [unitForms, setUnitForms] = useState<Record<string, { name: string; capacity: string }>>({});
  const [savingUnit, setSavingUnit] = useState<string | null>(null);

  const [deleting, setDeleting] = useState<string | null>(null);

  // ── Load ───────────────────────────────────────────────────────────────────

  async function reload() {
    setLoading(true);
    const data = await loadFacilitiesWithUnits(organizationId);
    setFacilities(data);
    setLoading(false);
  }

  useEffect(() => { reload(); }, [organizationId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Create facility ────────────────────────────────────────────────────────

  async function handleCreateFacility() {
    const name = newFacName.trim();
    if (!name) return;
    setSavingFac(true);
    const result = await createFacility(organizationId, name, newFacAddr.trim() || undefined);
    setSavingFac(false);
    if (result) {
      setFacilities(prev => [...prev, result]);
      setExpanded(prev => new Set([...prev, result.id]));
      setNewFacName(''); setNewFacAddr('');
      setShowNewFac(false);
      onChanged();
    }
  }

  // ── Delete facility ────────────────────────────────────────────────────────

  async function handleDeleteFacility(id: string) {
    if (!confirm('Halle und alle Bereiche unwiderruflich löschen?')) return;
    setDeleting(id);
    await deleteFacility(id);
    setFacilities(prev => prev.filter(f => f.id !== id));
    setDeleting(null);
    onChanged();
  }

  // ── Create unit ────────────────────────────────────────────────────────────

  async function handleCreateUnit(facilityId: string) {
    const form = unitForms[facilityId];
    const name = form?.name?.trim();
    if (!name) return;
    setSavingUnit(facilityId);
    const cap = form.capacity ? parseInt(form.capacity, 10) : undefined;
    const result = await createFacilityUnit(facilityId, name, isNaN(cap ?? NaN) ? undefined : cap);
    setSavingUnit(null);
    if (result) {
      setFacilities(prev => prev.map(f =>
        f.id === facilityId ? { ...f, units: [...f.units, result] } : f
      ));
      setUnitForms(prev => ({ ...prev, [facilityId]: { name: '', capacity: '' } }));
      onChanged();
    }
  }

  // ── Delete unit ────────────────────────────────────────────────────────────

  async function handleDeleteUnit(facilityId: string, unitId: string) {
    if (!confirm('Bereich löschen?')) return;
    setDeleting(unitId);
    await deleteFacilityUnit(unitId);
    setFacilities(prev => prev.map(f =>
      f.id === facilityId ? { ...f, units: f.units.filter(u => u.id !== unitId) } : f
    ));
    setDeleting(null);
    onChanged();
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full sm:max-w-lg bg-gray-900 border border-gray-700 rounded-t-3xl sm:rounded-2xl flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <Building2 size={18} className="text-teal-400" />
            <h2 className="text-base font-semibold text-white">Hallen verwalten</h2>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white transition-colors">
            <X size={15} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {loading ? (
            <div className="flex items-center gap-2 py-8 text-xs text-gray-600">
              <span className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
              Hallen werden geladen…
            </div>
          ) : (
            <>
              {/* Facility list */}
              {facilities.length === 0 && !showNewFac && (
                <div className="text-center py-8 space-y-1">
                  <p className="text-gray-500 text-sm">Noch keine Hallen angelegt</p>
                  <p className="text-gray-700 text-xs">Füge die erste Halle hinzu</p>
                </div>
              )}

              {facilities.map(fac => {
                const isExpanded = expanded.has(fac.id);
                const unitForm   = unitForms[fac.id] ?? { name: '', capacity: '' };
                return (
                  <div key={fac.id} className="border border-gray-700/60 rounded-xl overflow-hidden">
                    {/* Facility row */}
                    <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-800/60">
                      <button onClick={() => setExpanded(prev => {
                        const next = new Set(prev);
                        next.has(fac.id) ? next.delete(fac.id) : next.add(fac.id);
                        return next;
                      })} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                        {isExpanded ? <ChevronDown size={14} className="text-gray-500 flex-shrink-0" /> : <ChevronRight size={14} className="text-gray-500 flex-shrink-0" />}
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate">{fac.name}</p>
                          {fac.address && <p className="text-[11px] text-gray-500 truncate">{fac.address}</p>}
                        </div>
                      </button>
                      <span className="text-[11px] text-gray-600 flex-shrink-0">{fac.units.length} Bereiche</span>
                      <button
                        onClick={() => handleDeleteFacility(fac.id)}
                        disabled={deleting === fac.id}
                        className="p-1.5 rounded-lg text-gray-600 hover:text-rose-400 hover:bg-rose-900/20 transition-colors flex-shrink-0"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    {/* Units (expanded) */}
                    {isExpanded && (
                      <div className="px-3 py-2 space-y-1.5">
                        {fac.units.map(unit => (
                          <div key={unit.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-gray-800/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-teal-500 flex-shrink-0" />
                            <span className="text-xs text-gray-300 flex-1">{unit.name}</span>
                            {unit.capacity && (
                              <span className="text-[11px] text-gray-600">{unit.capacity} Pers.</span>
                            )}
                            <button
                              onClick={() => handleDeleteUnit(fac.id, unit.id)}
                              disabled={deleting === unit.id}
                              className="p-1 rounded text-gray-600 hover:text-rose-400 transition-colors"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}

                        {/* Add unit inline form */}
                        <div className="flex items-center gap-2 pt-1">
                          <input
                            value={unitForm.name}
                            onChange={e => setUnitForms(prev => ({ ...prev, [fac.id]: { ...unitForm, name: e.target.value } }))}
                            onKeyDown={e => e.key === 'Enter' && handleCreateUnit(fac.id)}
                            placeholder="Neuer Bereich (z.B. Feld A)"
                            className="flex-1 h-8 px-2.5 rounded-lg bg-gray-800 border border-gray-700 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-teal-600"
                          />
                          <input
                            value={unitForm.capacity}
                            onChange={e => setUnitForms(prev => ({ ...prev, [fac.id]: { ...unitForm, capacity: e.target.value } }))}
                            placeholder="Kap."
                            type="number"
                            min={1}
                            className="w-14 h-8 px-2 rounded-lg bg-gray-800 border border-gray-700 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-teal-600"
                          />
                          <button
                            onClick={() => handleCreateUnit(fac.id)}
                            disabled={savingUnit === fac.id || !unitForm.name.trim()}
                            className="h-8 px-2.5 rounded-lg bg-teal-800/60 hover:bg-teal-700/60 disabled:opacity-40 text-teal-300 text-xs font-medium transition-colors flex-shrink-0"
                          >
                            {savingUnit === fac.id ? '…' : <Plus size={13} />}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* New facility form */}
              {showNewFac ? (
                <div className="border border-teal-800/50 rounded-xl px-4 py-3 bg-teal-950/20 space-y-2.5">
                  <p className="text-xs font-medium text-teal-300">Neue Halle</p>
                  <input
                    autoFocus
                    value={newFacName}
                    onChange={e => setNewFacName(e.target.value)}
                    placeholder="Name (z.B. Dreifachhalle West)"
                    className="w-full h-9 px-3 rounded-xl bg-gray-800 border border-gray-700 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-teal-600"
                  />
                  <input
                    value={newFacAddr}
                    onChange={e => setNewFacAddr(e.target.value)}
                    placeholder="Adresse (optional)"
                    className="w-full h-9 px-3 rounded-xl bg-gray-800 border border-gray-700 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-teal-600"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleCreateFacility}
                      disabled={savingFac || !newFacName.trim()}
                      className="flex-1 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white text-sm font-medium transition-colors"
                    >
                      {savingFac ? 'Speichern…' : 'Halle anlegen'}
                    </button>
                    <button
                      onClick={() => { setShowNewFac(false); setNewFacName(''); setNewFacAddr(''); }}
                      className="px-3 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-400 text-sm transition-colors"
                    >
                      Abbrechen
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowNewFac(true)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-gray-700 hover:border-teal-700 text-gray-500 hover:text-teal-400 text-sm transition-colors"
                >
                  <Plus size={14} /> Neue Halle hinzufügen
                </button>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-800 flex-shrink-0">
          <button onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium transition-colors">
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
}
