import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { FacilityCalendar } from '../../attendance/FacilityCalendar';
import type { CoachOutletContext } from '../CoachShell';

export function FacilityScreen() {
  const { facilityId } = useParams<{ facilityId: string }>();
  const navigate       = useNavigate();
  const { org, teams } = useOutletContext<CoachOutletContext>();

  if (!org) {
    return (
      <div className="text-center py-12 space-y-2">
        <p className="text-gray-500 text-sm">Kein Verein verknüpft</p>
        <button onClick={() => navigate('/coach/facilities')} className="text-xs text-violet-400 hover:text-violet-300">
          Zurück
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/coach/facilities')}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          <ChevronLeft size={14} /> Hallen
        </button>
        <h2 className="text-base font-semibold text-white">Hallenkalender</h2>
      </div>

      {/*
        FacilityCalendar handles all loading internally (units, bookings, blackouts,
        conflict detection). It accepts organizationId + teams for team-name resolution.
        The facilityId param is used here to pre-select the right facility in the dropdown.
        FacilityCalendar currently picks the first unit — future: pass initialFacilityId.
      */}
      <FacilityCalendar organizationId={org.id} teams={teams} />
    </div>
  );
}
