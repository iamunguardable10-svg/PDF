import { supabase, CLOUD_ENABLED } from './supabase';
import type {
  Organization, Department,
  OrganizationMembership, DepartmentMembership,
  OrgMemberRole, DeptMemberRole,
  FacilityUnit,
} from '../types/organization';

// ── Facility types ────────────────────────────────────────────────────────────

/** A facility with its units pre-loaded — used for dropdowns. */
export interface FacilityWithUnits {
  id: string;
  organizationId: string;
  name: string;
  address: string | null;
  units: FacilityUnit[];
}

// ── Row mappers ───────────────────────────────────────────────────────────────

function rowToOrg(r: Record<string, unknown>): Organization {
  return {
    id:        r.id        as string,
    name:      r.name      as string,
    slug:      r.slug      as string,
    sport:     (r.sport    as string | null) ?? null,
    createdAt: r.created_at as string,
  };
}

function rowToDept(r: Record<string, unknown>): Department {
  return {
    id:             r.id              as string,
    organizationId: r.organization_id as string,
    name:           r.name            as string,
    sport:          (r.sport          as string | null) ?? null,
    createdAt:      r.created_at      as string,
  };
}

function rowToOrgMembership(r: Record<string, unknown>): OrganizationMembership {
  return {
    id:             r.id              as string,
    organizationId: r.organization_id as string,
    userId:         r.user_id         as string,
    role:           r.role            as OrgMemberRole,
    joinedAt:       r.joined_at       as string,
  };
}

function rowToDeptMembership(r: Record<string, unknown>): DepartmentMembership {
  return {
    id:           r.id            as string,
    departmentId: r.department_id as string,
    userId:       r.user_id       as string,
    role:         r.role          as DeptMemberRole,
    joinedAt:     r.joined_at     as string,
  };
}

// ── Organizations ─────────────────────────────────────────────────────────────

/** Load a single organization by ID. Returns null if not found or offline. */
export async function loadOrganization(orgId: string): Promise<Organization | null> {
  if (!CLOUD_ENABLED) return null;
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', orgId)
    .maybeSingle();
  if (error || !data) return null;
  return rowToOrg(data as Record<string, unknown>);
}

/** Load all organizations the current user can see. */
export async function loadOrganizations(): Promise<Organization[]> {
  if (!CLOUD_ENABLED) return [];
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .order('name');
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(rowToOrg);
}

/** Load organization by slug. */
export async function loadOrganizationBySlug(slug: string): Promise<Organization | null> {
  if (!CLOUD_ENABLED) return null;
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (error || !data) return null;
  return rowToOrg(data as Record<string, unknown>);
}

// ── Departments ───────────────────────────────────────────────────────────────

/** Load all departments belonging to an organization. */
export async function loadDepartments(orgId: string): Promise<Department[]> {
  if (!CLOUD_ENABLED) return [];
  const { data, error } = await supabase
    .from('departments')
    .select('*')
    .eq('organization_id', orgId)
    .order('name');
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(rowToDept);
}

/** Load a single department by ID. Returns null if not found or offline. */
export async function loadDepartment(deptId: string): Promise<Department | null> {
  if (!CLOUD_ENABLED) return null;
  const { data, error } = await supabase
    .from('departments')
    .select('*')
    .eq('id', deptId)
    .maybeSingle();
  if (error || !data) return null;
  return rowToDept(data as Record<string, unknown>);
}

// ── Organization memberships ──────────────────────────────────────────────────

/** Load all members of an organization. */
export async function loadOrganizationMembers(orgId: string): Promise<OrganizationMembership[]> {
  if (!CLOUD_ENABLED) return [];
  const { data, error } = await supabase
    .from('organization_memberships')
    .select('*')
    .eq('organization_id', orgId)
    .order('joined_at');
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(rowToOrgMembership);
}

/** Load organizations the given user belongs to. */
export async function loadMyOrganizations(userId: string): Promise<OrganizationMembership[]> {
  if (!CLOUD_ENABLED) return [];
  const { data, error } = await supabase
    .from('organization_memberships')
    .select('*')
    .eq('user_id', userId);
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(rowToOrgMembership);
}

// ── Department memberships ────────────────────────────────────────────────────

/** Load all members of a department. */
export async function loadDepartmentMembers(deptId: string): Promise<DepartmentMembership[]> {
  if (!CLOUD_ENABLED) return [];
  const { data, error } = await supabase
    .from('department_memberships')
    .select('*')
    .eq('department_id', deptId)
    .order('joined_at');
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(rowToDeptMembership);
}

/** Load departments the given user belongs to. */
export async function loadMyDepartments(userId: string): Promise<DepartmentMembership[]> {
  if (!CLOUD_ENABLED) return [];
  const { data, error } = await supabase
    .from('department_memberships')
    .select('*')
    .eq('user_id', userId);
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(rowToDeptMembership);
}

// ── Facilities ────────────────────────────────────────────────────────────────

/**
 * Load all facilities (with their units) for an organization.
 * Returns a flat list of FacilityWithUnits suitable for building a grouped
 * dropdown (facility as optgroup, units as options).
 */
export async function loadFacilitiesWithUnits(orgId: string): Promise<FacilityWithUnits[]> {
  if (!CLOUD_ENABLED) return [];
  // Supabase nested select: facility_units are joined automatically via FK
  const { data, error } = await supabase
    .from('facilities')
    .select('id, organization_id, name, address, facility_units(id, facility_id, name, capacity, created_at)')
    .eq('organization_id', orgId)
    .order('name');
  if (error || !data) {
    console.warn('[loadFacilitiesWithUnits]', error?.message);
    return [];
  }
  return (data as Record<string, unknown>[]).map(r => ({
    id:             r.id             as string,
    organizationId: r.organization_id as string,
    name:           r.name           as string,
    address:        (r.address       as string | null) ?? null,
    units: ((r.facility_units as Record<string, unknown>[]) ?? []).map(u => ({
      id:         u.id          as string,
      facilityId: u.facility_id as string,
      name:       u.name        as string,
      capacity:   (u.capacity   as number | null) ?? null,
      createdAt:  u.created_at  as string,
    })),
  }));
}

// ── Facility Calendar query ───────────────────────────────────────────────────

/**
 * A facility blackout / Sperrzeit entry.
 * facility_unit_id = null means the blackout applies to the whole facility.
 */
export interface FacilityBlackout {
  id:             string;
  facilityId:     string;
  /** null → facility-wide blackout; non-null → unit-specific */
  facilityUnitId: string | null;
  title:          string;
  reason:         string | null;
  startsAt:       string;   // UTC ISO
  endsAt:         string;   // UTC ISO
  createdAt:      string;
  // ── Derived local time fields ────────────────────────────────────────────
  datum:          string;   // YYYY-MM-DD
  startTime:      string;   // HH:MM
  endTime:        string;   // HH:MM
}

/**
 * One entry in the Facility Calendar — a booking with denormalised session data.
 * Populated by loadBookingsByFacility().
 */
export interface FacilityBookingEntry {
  sessionId:      string;
  /** UTC ISO timestamp from event_facility_bookings.starts_at */
  startsAt:       string;
  /** UTC ISO timestamp from event_facility_bookings.ends_at */
  endsAt:         string;
  facilityUnitId: string;
  // ── Session fields ────────────────────────────────────────────────────────
  title:        string;
  trainingType: string;
  coachNote:    string;
  /** att_sessions.trainer_id — display name requires a separate profiles lookup */
  trainerId:    string | null;
  teamId:       string | null;
  /** Legacy location free-text — fallback when no facility booking label exists */
  location:     string;
  // ── Legacy time fallbacks (derived from starts_at/ends_at when absent) ────
  datum:        string;   // YYYY-MM-DD local
  startTime:    string;   // HH:MM local
  endTime:      string;   // HH:MM local
}

/**
 * Load all bookings for a specific facility unit in a date window.
 *
 * Query chain: event_facility_bookings → att_sessions (for session details).
 * Team name must be resolved client-side via the teams prop.
 * Coach name requires a profiles table lookup (not yet implemented — trainerId
 * is returned so callers can resolve it independently).
 *
 * @param unitId  - facility_units.id
 * @param from    - YYYY-MM-DD inclusive start
 * @param to      - YYYY-MM-DD inclusive end
 */
export async function loadBookingsByFacility(
  unitId: string,
  from: string,
  to: string,
): Promise<FacilityBookingEntry[]> {
  if (!CLOUD_ENABLED) return [];
  const { data, error } = await supabase
    .from('event_facility_bookings')
    .select(`
      session_id,
      starts_at,
      ends_at,
      facility_unit_id,
      att_sessions (
        id, title, training_type, coach_note,
        trainer_id, team_id, location,
        datum, start_time, end_time
      )
    `)
    .eq('facility_unit_id', unitId)
    .gte('starts_at', `${from}T00:00:00`)
    .lte('starts_at', `${to}T23:59:59`)
    .order('starts_at', { ascending: true });

  if (error) { console.warn('[loadBookingsByFacility]', error.message); return []; }

  return ((data ?? []) as Record<string, unknown>[]).map(row => {
    const s = (row.att_sessions as Record<string, unknown> | null) ?? {};
    // Derive local date/time from starts_at/ends_at as fallback
    const startsAt  = row.starts_at as string;
    const endsAt    = row.ends_at   as string;
    const datumFb   = isoToLocalDate(startsAt);
    const startFb   = isoToLocalTime(startsAt);
    const endFb     = isoToLocalTime(endsAt);
    return {
      sessionId:      row.session_id      as string,
      startsAt,
      endsAt,
      facilityUnitId: row.facility_unit_id as string,
      title:        (s.title         as string)  ?? '',
      trainingType: (s.training_type as string)  ?? '',
      coachNote:    (s.coach_note    as string)  ?? '',
      trainerId:    (s.trainer_id    as string | null) ?? null,
      teamId:       (s.team_id       as string | null) ?? null,
      location:     (s.location      as string)  ?? '',
      datum:        (s.datum         as string)  ?? datumFb,
      startTime:    (s.start_time    as string)  ?? startFb,
      endTime:      (s.end_time      as string)  ?? endFb,
    };
  });
}

/** ISO → "YYYY-MM-DD" in local timezone */
function isoToLocalDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** ISO → "HH:MM" in local timezone */
function isoToLocalTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ── Facility Blackouts ────────────────────────────────────────────────────────

/**
 * Load blackouts for a facility in a date window.
 * Returns both facility-wide blackouts (facility_unit_id = null) AND
 * unit-specific blackouts for the given unitId.
 *
 * @param facilityId - the parent facility UUID
 * @param unitId     - the selected unit UUID (to include unit-specific blackouts)
 * @param from       - YYYY-MM-DD inclusive
 * @param to         - YYYY-MM-DD inclusive
 */
export async function loadBlackoutsByFacility(
  facilityId: string,
  unitId: string,
  from: string,
  to: string,
): Promise<FacilityBlackout[]> {
  if (!CLOUD_ENABLED) return [];
  const { data, error } = await supabase
    .from('facility_blackouts')
    .select('*')
    .eq('facility_id', facilityId)
    // facility-wide (null) OR unit-specific
    .or(`facility_unit_id.is.null,facility_unit_id.eq.${unitId}`)
    .gte('starts_at', `${from}T00:00:00`)
    .lte('starts_at', `${to}T23:59:59`)
    .order('starts_at', { ascending: true });

  if (error) { console.warn('[loadBlackoutsByFacility]', error.message); return []; }

  return ((data ?? []) as Record<string, unknown>[]).map(r => {
    const startsAt = r.starts_at as string;
    const endsAt   = r.ends_at   as string;
    return {
      id:             r.id              as string,
      facilityId:     r.facility_id     as string,
      facilityUnitId: (r.facility_unit_id as string | null) ?? null,
      title:          (r.title          as string) ?? 'Sperrzeit',
      reason:         (r.reason         as string | null) ?? null,
      startsAt,
      endsAt,
      createdAt:      r.created_at      as string,
      datum:          isoToLocalDate(startsAt),
      startTime:      isoToLocalTime(startsAt),
      endTime:        isoToLocalTime(endsAt),
    };
  });
}

// ── Coach name resolution ─────────────────────────────────────────────────────

/**
 * Resolve display names for a list of user IDs from the profiles table.
 * Returns a partial map — userIds not in profiles are simply absent.
 * Callers should fall back to a truncated UUID when a userId is missing.
 */
export async function loadCoachNamesBulk(
  userIds: string[],
): Promise<Record<string, string>> {
  if (!CLOUD_ENABLED || userIds.length === 0) return {};
  const unique = [...new Set(userIds)];
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name')
    .in('id', unique);
  if (error) { console.warn('[loadCoachNamesBulk]', error.message); return {}; }
  const map: Record<string, string> = {};
  for (const row of (data ?? []) as Record<string, unknown>[]) {
    const id   = row.id   as string;
    const name = row.name as string | null;
    if (id && name) map[id] = name;
  }
  return map;
}

// ── Facility conflict check ───────────────────────────────────────────────────

/**
 * Result returned by checkFacilityConflict.
 * hasConflict = true → caller must NOT insert/update event_facility_bookings.
 */
export interface FacilityConflictResult {
  hasConflict: boolean;
  /** Human-readable description for display in the UI. null when no conflict. */
  reason: string | null;
}

/**
 * Check whether a facility unit is available for [startsAt, endsAt).
 *
 * Two checks are performed in parallel:
 *  1. Booking overlap — another event_facility_bookings row for the same unit
 *     whose [starts_at, ends_at) overlaps the requested window.
 *  2. Blackout overlap — a facility_blackouts row (facility-wide or unit-
 *     specific) whose [starts_at, ends_at) overlaps the requested window.
 *
 * For the blackout check the parent facility_id is resolved from facility_units
 * first so we can catch facility-wide blackouts (facility_unit_id IS NULL).
 *
 * @param unitId          - facility_units.id to check
 * @param startsAt        - UTC ISO start of the requested slot
 * @param endsAt          - UTC ISO end   of the requested slot
 * @param excludeSessionId - when editing an existing session, pass its id to
 *                          prevent it from conflicting with itself
 */
export async function checkFacilityConflict(
  unitId:           string,
  startsAt:         string,
  endsAt:           string,
  excludeSessionId?: string,
): Promise<FacilityConflictResult> {
  if (!CLOUD_ENABLED) return { hasConflict: false, reason: null };

  // ── 1. Booking overlap ────────────────────────────────────────────────────
  // Overlap condition: existing.starts_at < endsAt AND existing.ends_at > startsAt
  let bookingQuery = supabase
    .from('event_facility_bookings')
    .select('session_id', { count: 'exact', head: true })
    .eq('facility_unit_id', unitId)
    .lt('starts_at', endsAt)
    .gt('ends_at', startsAt);

  if (excludeSessionId) {
    bookingQuery = bookingQuery.neq('session_id', excludeSessionId);
  }

  // ── 2a. Resolve facility_id for blackout check ────────────────────────────
  const unitLookup = supabase
    .from('facility_units')
    .select('facility_id')
    .eq('id', unitId)
    .maybeSingle();

  const [bookingResult, unitResult] = await Promise.all([bookingQuery, unitLookup]);

  if ((bookingResult.count ?? 0) > 0) {
    return {
      hasConflict: true,
      reason: 'Die gewählte Einheit ist in diesem Zeitraum bereits gebucht.',
    };
  }

  // ── 2b. Blackout overlap ──────────────────────────────────────────────────
  const facilityId = (unitResult.data as Record<string, unknown> | null)?.facility_id as string | null;
  if (facilityId) {
    const { count: blackoutCount, error: blErr } = await supabase
      .from('facility_blackouts')
      .select('id', { count: 'exact', head: true })
      .eq('facility_id', facilityId)
      // facility-wide (null) OR unit-specific
      .or(`facility_unit_id.is.null,facility_unit_id.eq.${unitId}`)
      .lt('starts_at', endsAt)
      .gt('ends_at', startsAt);

    if (blErr) console.warn('[checkFacilityConflict] blackout query:', blErr.message);

    if ((blackoutCount ?? 0) > 0) {
      return {
        hasConflict: true,
        reason: 'Der gewählte Zeitraum liegt in einer Sperrzeit dieser Halle.',
      };
    }
  }

  return { hasConflict: false, reason: null };
}

/**
 * Load the currently booked facility_unit_id for a session.
 * Returns null when no booking exists or when the session has no booking yet.
 */
export async function loadSessionFacilityUnitId(sessionId: string): Promise<string | null> {
  if (!CLOUD_ENABLED) return null;
  const { data, error } = await supabase
    .from('event_facility_bookings')
    .select('facility_unit_id')
    .eq('session_id', sessionId)
    .maybeSingle();
  if (error) { console.warn('[loadSessionFacilityUnitId]', error.message); return null; }
  return (data as Record<string, unknown> | null)?.facility_unit_id as string | null ?? null;
}
