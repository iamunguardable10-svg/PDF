// ── Organization / Department / Facility data model types ─────────────────────
// These types mirror the new Supabase tables added additively.
// Old att_teams / att_sessions types remain unchanged — new fields are optional.

// ── Organizations ─────────────────────────────────────────────────────────────

export interface Organization {
  id: string;
  name: string;
  slug: string;
  sport: string | null;
  createdAt: string;
}

export interface Department {
  id: string;
  organizationId: string;
  name: string;
  sport: string | null;
  createdAt: string;
}

// ── Memberships ───────────────────────────────────────────────────────────────

export type OrgMemberRole = 'admin' | 'head_coach' | 'assistant_coach' | 'athlete' | 'staff';
export type DeptMemberRole = 'head_coach' | 'assistant_coach' | 'athlete' | 'staff';
export type TeamMemberRole = 'head_coach' | 'assistant_coach' | 'athlete' | 'manager';

export interface OrganizationMembership {
  id: string;
  organizationId: string;
  userId: string;
  role: OrgMemberRole;
  joinedAt: string;
}

export interface DepartmentMembership {
  id: string;
  departmentId: string;
  userId: string;
  role: DeptMemberRole;
  joinedAt: string;
}

/**
 * New team_memberships table — replaces/mirrors att_team_members.
 * Populated from att_team_members during migration.
 */
export interface TeamMembership {
  id: string;
  teamId: string;
  userId: string;
  role: TeamMemberRole;
  /** Display name — may be stored as display_name in DB or joined from profile */
  displayName: string | null;
  joinedAt: string;
}

// ── Facilities ────────────────────────────────────────────────────────────────

export interface Facility {
  id: string;
  organizationId: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  createdAt: string;
}

export interface FacilityUnit {
  id: string;
  facilityId: string;
  name: string;
  capacity: number | null;
  createdAt: string;
}

// ── Recurrence ────────────────────────────────────────────────────────────────

/** RFC 5545 RRULE-based recurrence rule */
export interface RecurrenceRule {
  id: string;
  rrule: string; // e.g. "FREQ=WEEKLY;BYDAY=MO,WE,FR"
  createdAt: string;
}

// ── Event relations ───────────────────────────────────────────────────────────

/** Which team(s) participate in a session — mirrors event_teams table */
export interface EventTeam {
  id: string;
  sessionId: string;
  teamId: string;
  createdAt: string;
}

/** Which coaches are attached to a session — mirrors event_coaches table */
export interface EventCoach {
  id: string;
  sessionId: string;
  userId: string;
  role: string;
  createdAt: string;
}

/** Facility booking for a session — mirrors event_facility_bookings table */
export interface EventFacilityBooking {
  id: string;
  sessionId: string;
  facilityUnitId: string;
  startsAt: string;
  endsAt: string;
  createdAt: string;
}

// ── Department calendar view type ─────────────────────────────────────────────
// Used by loadSessionsByDepartment — combines new + old fields

export interface DepartmentCalendarSession {
  id: string;
  /** Canonical timestamp — sourced from att_sessions.starts_at */
  startsAt: string;
  /** Canonical timestamp — sourced from att_sessions.ends_at */
  endsAt: string;
  /** Derived YYYY-MM-DD (local time) for backward-compat with existing calendar components */
  datum: string;
  /** Derived "HH:MM" local time */
  startTime: string;
  /** Derived "HH:MM" local time */
  endTime: string;
  title: string;
  location: string;
  trainingType: string;
  coachNote: string;
  teamId: string | null;
  organizationId: string | null;
  departmentId: string | null;
  recurrenceRuleId: string | null;
  /** trainer / owner */
  trainerId: string | null;
  createdAt: string;
}
