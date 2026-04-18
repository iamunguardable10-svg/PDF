import { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { ChevronRight, Plus, Trash2, Check, X, Loader2, ChevronDown } from 'lucide-react';
import {
  loadFacilitiesWithUnits,
  createFacility,
  deleteFacility,
  createFacilityUnit,
  deleteFacilityUnit,
} from '../../../lib/organizationStorage';
import type { FacilityWithUnits } from '../../../lib/organizationStorage';
import type { CoachOutletContext } from '../CoachShell';

export function FacilitiesScreen() {
  const navigate = useNavigate();
  const { org, loading: ctxLoading, coachContext } = useOutletContext<CoachOutletContext>();

  const isAdmin = !coachContext || coachContext.role === 'org_admin';

  const [facilities,  setFacilities]  = useState<FacilityWithUnits[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [expanded,    setExpanded]    = useState<Set<string>>(new Set());

  // New facility form
  const [showFacForm, setShowFacForm] = useState(false);
  const [newFacName,  setNewFacName]  = useState('');
  const [newFacAddr,  setNewFacAddr]  = useState('');
  const [savingFac,   setSavingFac]   = useState(false);

  // New unit form per facility: facilityId → { name, capacity }
  const [unitForms,  setUnitForms]  = useState<Record<string, { name: string; capacity: string }>>({});
  const [savingUnit, setSavingUnit] = useState<string | null>(null);
  const [deleting,   setDeleting]   = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  async function loadFacilities() {
    if (!org) return;
    setLoading(true);
    const data = await loadFacilitiesWithUnits(org.id);
    setFacilities(data);
    setLoading(false);
  }

  useEffect(() => { loadFacilities(); }, [org?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreateFacility() {
    if (!org || !newFacName.trim()) return;
    setSavingFac(true);
    const result = await createFacility(org.id, newFacName.trim(), newFacAddr.trim() || undefined);
    setSavingFac(false);
    if (result) {
      setFacilities(prev => [...prev, result]);
      setExpanded(prev => new Set([...prev, result.id]));
      setNewFacName(''); setNewFacAddr(''); setShowFacForm(false);
    }
  }

  async function handleDeleteFacility(facId: string) {
    setDeleting(facId);
    await deleteFacility(facId);
    setFacilities(prev => prev.filter(f => f.id !== facId));
    setDeleting(null); setConfirmDel(null);
  }

  async function handleCreateUnit(facId: string) {
    const form = unitForms[facId];
    if (!form?.name.trim()) return;
    setSavingUnit(facId);
    const cap = form.capacity ? parseInt(form.capacity) : undefined;
    const unit = await createFacilityUnit(facId, form.name.trim(), isNaN(cap ?? NaN) ? undefined : cap);
    setSavingUnit(null);
    if (unit) {
      setFacilities(prev => prev.map(f => f.id === facId ? { ...f, units: [...f.units, unit] } : f));
      setUnitForms(prev => ({ ...prev, [facId]: { name: '', capacity: '' } }));
    }
  }

  async function handleDeleteUnit(unitId: string) {
    setDeleting(unitId);
    await deleteFacilityUnit(unitId);
    setFacilities(prev => prev.map(f => ({ ...f, units: f.units.filter(u => u.id !== unitId) })));
    setDeleting(null); setConfirmDel(null);
  }

  if (!org && !ctxLoading) {
    return (
      <div className="text-center py-12 space-y-2">
        <p className="text-2xl text-gray-700">⬡</p>
        <p className="text-sm text-gray-500">Kein Verein</p>
        <p className="text-xs text-gray-600">Tritt einem Verein bei um Hallen zu verwalten.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">Hallen & Anlagen</h2>
          <p className="text-xs text-gray-500 mt-0.5">{facilities.length} Anlagen</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowFacForm(v => !v)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-teal-900/40 border border-teal-700/50 hover:bg-teal-800/50 text-teal-300 text-xs font-semibold transition-colors"
          >
            <Plus size={12} /> Neue Halle
          </button>
        )}
      </div>

      {/* Create facility form */}
      {showFacForm && (
        <div className="p-4 rounded-xl bg-gray-800/80 border border-gray-700 space-y-2">
          <p className="text-xs font-medium text-gray-400">Neue Anlage</p>
          <div className="flex gap-2">
            <input
              autoFocus
              value={newFacName}
              onChange={e => setNewFacName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreateFacility(); if (e.key === 'Escape') setShowFacForm(false); }}
              placeholder="Name der Anlage"
              className="flex-1 h-9 px-3 rounded-xl bg-gray-900 border border-gray-700 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-teal-500"
            />
            <input
              value={newFacAddr}
              onChange={e => setNewFacAddr(e.target.value)}
              placeholder="Adresse (optional)"
              className="w-40 h-9 px-3 rounded-xl bg-gray-900 border border-gray-700 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-teal-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreateFacility}
              disabled={savingFac || !newFacName.trim()}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white text-xs font-medium transition-colors"
            >
              {savingFac ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              Erstellen
            </button>
            <button onClick={() => setShowFacForm(false)} className="px-3 py-1.5 rounded-xl bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs transition-colors">
              <X size={12} />
            </button>
          </div>
        </div>
      )}

      {(loading || ctxLoading) ? (
        <div className="flex items-center gap-2 py-8 text-xs text-gray-600">
          <span className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
          Wird geladen…
        </div>
      ) : facilities.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-gray-800 rounded-xl space-y-1">
          <p className="text-sm text-gray-500">Noch keine Hallen angelegt</p>
          {isAdmin && <p className="text-xs text-gray-600">Klick auf "Neue Halle" um zu starten</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {facilities.map(fac => {
            const isExpanded  = expanded.has(fac.id);
            const unitForm    = unitForms[fac.id] ?? { name: '', capacity: '' };
            const isConfirm   = confirmDel === fac.id;

            return (
              <div key={fac.id} className="rounded-xl bg-gray-800/60 border border-gray-700/50 overflow-hidden">

                {/* Facility header */}
                <div className="flex items-center gap-3 px-4 py-3 group">
                  <button
                    onClick={() => navigate(`/coach/facilities/${fac.id}`)}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left"
                  >
                    <span className="text-xl flex-shrink-0">⬡</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{fac.name}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {fac.units.length} {fac.units.length === 1 ? 'Einheit' : 'Einheiten'}
                        {fac.address && ` · ${fac.address}`}
                      </p>
                    </div>
                  </button>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    {/* Expand/collapse units */}
                    <button
                      onClick={() => setExpanded(prev => {
                        const next = new Set(prev);
                        next.has(fac.id) ? next.delete(fac.id) : next.add(fac.id);
                        return next;
                      })}
                      className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-700 transition-colors"
                    >
                      <ChevronDown size={14} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Calendar link */}
                    <button
                      onClick={() => navigate(`/coach/facilities/${fac.id}`)}
                      className="p-1.5 rounded-lg text-gray-500 hover:text-teal-400 hover:bg-gray-700 transition-colors"
                    >
                      <ChevronRight size={14} />
                    </button>

                    {/* Delete facility — admin only */}
                    {isAdmin && (
                      isConfirm ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDeleteFacility(fac.id)}
                            disabled={deleting === fac.id}
                            className="text-[11px] px-2 py-1 rounded-lg bg-red-900/50 text-red-300 hover:bg-red-800/60 transition-colors"
                          >
                            {deleting === fac.id ? <Loader2 size={11} className="animate-spin" /> : 'Löschen'}
                          </button>
                          <button onClick={() => setConfirmDel(null)} className="text-[11px] px-2 py-1 rounded-lg bg-gray-700 text-gray-400 transition-colors">
                            Abbruch
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDel(fac.id)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-900/20 transition-all"
                        >
                          <Trash2 size={13} />
                        </button>
                      )
                    )}
                  </div>
                </div>

                {/* Expanded: units list + add unit */}
                {isExpanded && (
                  <div className="border-t border-gray-700/50 px-4 py-3 space-y-2">
                    {fac.units.map(unit => (
                      <div key={unit.id} className="flex items-center gap-2 group/unit">
                        <div className="w-1.5 h-1.5 rounded-full bg-teal-600 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-gray-300 flex-1">
                          {unit.name}
                          {unit.capacity != null && <span className="text-gray-600 ml-1">· max. {unit.capacity}</span>}
                        </p>
                        {isAdmin && confirmDel === unit.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDeleteUnit(unit.id)}
                              disabled={deleting === unit.id}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-red-900/50 text-red-300 hover:bg-red-800/60 transition-colors"
                            >
                              {deleting === unit.id ? <Loader2 size={10} className="animate-spin" /> : 'Löschen'}
                            </button>
                            <button onClick={() => setConfirmDel(null)} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-400 transition-colors">
                              Abbruch
                            </button>
                          </div>
                        ) : isAdmin ? (
                          <button
                            onClick={() => setConfirmDel(unit.id)}
                            className="opacity-0 group-hover/unit:opacity-100 p-1 rounded text-gray-600 hover:text-red-400 transition-all"
                          >
                            <Trash2 size={11} />
                          </button>
                        ) : null}
                      </div>
                    ))}

                    {/* Add unit form */}
                    {isAdmin && (
                      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-700/50">
                        <input
                          value={unitForm.name}
                          onChange={e => setUnitForms(prev => ({ ...prev, [fac.id]: { ...unitForm, name: e.target.value } }))}
                          onKeyDown={e => { if (e.key === 'Enter') handleCreateUnit(fac.id); }}
                          placeholder="Neue Einheit (z. B. Halle A)"
                          className="flex-1 h-7 px-2 rounded-lg bg-gray-900 border border-gray-700 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-teal-600"
                        />
                        <input
                          value={unitForm.capacity}
                          onChange={e => setUnitForms(prev => ({ ...prev, [fac.id]: { ...unitForm, capacity: e.target.value } }))}
                          placeholder="max."
                          type="number"
                          className="w-14 h-7 px-2 rounded-lg bg-gray-900 border border-gray-700 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-teal-600"
                        />
                        <button
                          onClick={() => handleCreateUnit(fac.id)}
                          disabled={savingUnit === fac.id || !unitForm.name.trim()}
                          className="h-7 px-2 rounded-lg bg-teal-700 hover:bg-teal-600 disabled:opacity-40 text-white transition-colors flex items-center"
                        >
                          {savingUnit === fac.id ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
