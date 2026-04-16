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
