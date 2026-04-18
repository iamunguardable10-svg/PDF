import { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { loadFacilitiesWithUnits } from '../../../lib/organizationStorage';
import type { FacilityWithUnits } from '../../../lib/organizationStorage';
import type { CoachOutletContext } from '../CoachShell';

export function FacilitiesScreen() {
  const navigate = useNavigate();
  const { org, loading: ctxLoading } = useOutletContext<CoachOutletContext>();

  const [facilities, setFacilities] = useState<FacilityWithUnits[]>([]);
  const [loading,    setLoading]    = useState(false);

  useEffect(() => {
    if (!org) return;
    setLoading(true);
    loadFacilitiesWithUnits(org.id).then(facs => {
      setFacilities(facs);
      setLoading(false);
    });
  }, [org]);

  if (!org && !ctxLoading) {
    return (
      <div className="text-center py-12 space-y-2">
        <p className="text-2xl text-gray-700">⬡</p>
        <p className="text-sm text-gray-500">Kein Verein</p>
        <p className="text-xs text-gray-600">Tritt einem Verein bei oder erstelle einen, um Hallen zu sehen.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-white">Hallen & Anlagen</h2>

      {(loading || ctxLoading) ? (
        <div className="flex items-center gap-2 py-8 text-xs text-gray-600">
          <span className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          Wird geladen…
        </div>
      ) : facilities.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-gray-800 rounded-xl space-y-1">
          <p className="text-sm text-gray-500">Noch keine Hallen angelegt</p>
          <p className="text-xs text-gray-600">Verwalte Hallen im Verein-Bereich.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {facilities.map(fac => (
            <button
              key={fac.id}
              onClick={() => navigate(`/coach/facilities/${fac.id}`)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-800/60 border border-gray-700/50 hover:border-teal-700/60 hover:bg-teal-950/20 transition-all text-left group"
            >
              <span className="text-xl flex-shrink-0">⬡</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white group-hover:text-teal-200 truncate">
                  {fac.name}
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {fac.units.length} {fac.units.length === 1 ? 'Einheit' : 'Einheiten'}
                  {fac.address && ` · ${fac.address}`}
                </p>
              </div>
              <ChevronRight size={15} className="text-gray-600 group-hover:text-teal-400 flex-shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
