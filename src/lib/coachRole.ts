/**
 * Coach role detection and context loading.
 * Determines what a coach can see and do based on their memberships.
 */
import { supabase, CLOUD_ENABLED } from './supabase';
import type { Organization, Department } from '../types/organization';
import { loadOrganization, loadDepartments } from './organizationStorage';

// ── Types ─────────────────────────────────────────────────────────────────────

export type CoachRole = 'org_admin' | 'head_coach' | 'assistant_coach';

export interface CoachContext {
  /** Highest applicable role for this user */
  role: CoachRole;
  org: Organization | null;
  departments: Department[];
  /**
   * Dept IDs this coach belongs to (via department_memberships).
   * Empty for org_admin (they see all depts anyway).
   */
  deptIds: string[];
  /**
   * Team IDs this coach created (trainer_id) — full management rights.
   */
  ownTeamIds: string[];
  /**
   * Team IDs this coach was assigned to by org admin (att_team_coaches).
   */
  assignedTeamIds: string[];
}

// ── Main loader ───────────────────────────────────────────────────────────────

/**
 * Load the full coaching context for a user.
 * Returns null when the user has no coaching role in any org.
 */
export async function loadMyCoachContext(userId: string): Promise<CoachContext | null> {
  if (!CLOUD_ENABLED) return null;

  // Run all queries in parallel
  const [orgMemberRows, ownTeamRows, assignedTeamRows, deptMemberRows] = await Promise.all([
    supabase
      .from('organization_memberships')
      .select('organization_id, role')
      .eq('user_id', userId),
    supabase
      .from('att_teams')
      .select('id, organization_id, department_id')
      .eq('trainer_id', userId),
    supabase
      .from('att_team_coaches')
      .select('team_id, role')
      .eq('user_id', userId),
    supabase
      .from('department_memberships')
      .select('department_id, role')
      .eq('user_id', userId),
  ]);

  const orgRows     = (orgMemberRows.data ?? []) as { organization_id: string; role: string }[];
  const ownTeams    = (ownTeamRows.data ?? [])    as { id: string; organization_id: string | null; department_id: string | null }[];
  const assignedRows = (assignedTeamRows.data ?? []) as { team_id: string; role: string }[];
  const deptRows    = (deptMemberRows.data ?? []) as { department_id: string; role: string }[];

  // Determine role — org admin beats everything
  const isOrgAdmin = orgRows.some(r => r.role === 'owner' || r.role === 'admin');
  const isAssistant = assignedRows.every(r => r.role === 'assistant_coach') &&
                      deptRows.every(r => r.role === 'assistant_coach') &&
                      ownTeams.length === 0 &&
                      assignedRows.length > 0;

  const role: CoachRole = isOrgAdmin
    ? 'org_admin'
    : isAssistant
      ? 'assistant_coach'
      : 'head_coach';

  // If no org membership and no own/assigned teams → not a coach at all
  const hasAnyAccess = orgRows.length > 0 || ownTeams.length > 0 || assignedRows.length > 0;
  if (!hasAnyAccess) return null;

  // Resolve org — prefer explicit membership, fall back to team's org
  let org: Organization | null = null;
  const adminOrgId = orgRows.find(r => r.role === 'owner' || r.role === 'admin')?.organization_id;
  const anyOrgId   = orgRows[0]?.organization_id ?? ownTeams.find(t => t.organization_id)?.organization_id ?? null;
  const orgId      = adminOrgId ?? anyOrgId;

  if (orgId) {
    org = await loadOrganization(orgId);
  }

  // Load departments
  let departments: Department[] = [];
  if (orgId) {
    departments = await loadDepartments(orgId);
  }

  // Filter departments for non-admin coaches
  const deptIds = deptRows.map(r => r.department_id);

  // If coach has teams but no dept assignment, derive dept from their teams
  if (!isOrgAdmin && deptIds.length === 0) {
    const teamDeptIds = ownTeams
      .map(t => t.department_id)
      .filter((d): d is string => !!d);
    deptIds.push(...teamDeptIds.filter(id => !deptIds.includes(id)));
  }

  return {
    role,
    org,
    departments,
    deptIds,
    ownTeamIds: ownTeams.map(t => t.id),
    assignedTeamIds: assignedRows.map(r => r.team_id),
  };
}

// ── Team assignment (org admin only) ─────────────────────────────────────────

export interface TeamCoachRow {
  id: string;
  teamId: string;
  userId: string;
  role: 'head_coach' | 'assistant_coach';
  joinedAt: string;
}

/** Load all coach assignments for a team. */
export async function loadTeamCoaches(teamId: string): Promise<TeamCoachRow[]> {
  if (!CLOUD_ENABLED) return [];
  const { data, error } = await supabase
    .from('att_team_coaches')
    .select('*')
    .eq('team_id', teamId)
    .order('joined_at');
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(r => ({
    id:       r.id       as string,
    teamId:   r.team_id  as string,
    userId:   r.user_id  as string,
    role:     r.role     as 'head_coach' | 'assistant_coach',
    joinedAt: r.joined_at as string,
  }));
}

/** Assign a coach to a team (org admin action). */
export async function addCoachToTeam(
  teamId: string,
  userId: string,
  role: 'head_coach' | 'assistant_coach' = 'head_coach',
): Promise<boolean> {
  if (!CLOUD_ENABLED) return false;
  const { error } = await supabase
    .from('att_team_coaches')
    .upsert({ id: crypto.randomUUID(), team_id: teamId, user_id: userId, role });
  if (error) { console.error('[addCoachToTeam]', error.message); return false; }
  return true;
}

/** Remove a coach assignment from a team. */
export async function removeCoachFromTeam(teamId: string, userId: string): Promise<boolean> {
  if (!CLOUD_ENABLED) return false;
  const { error } = await supabase
    .from('att_team_coaches')
    .delete()
    .eq('team_id', teamId)
    .eq('user_id', userId);
  if (error) { console.error('[removeCoachFromTeam]', error.message); return false; }
  return true;
}

/** Load all teams a coach can access (own + assigned). */
export async function loadAllCoachTeamIds(userId: string): Promise<string[]> {
  if (!CLOUD_ENABLED) return [];
  const [ownRows, assignedRows] = await Promise.all([
    supabase.from('att_teams').select('id').eq('trainer_id', userId),
    supabase.from('att_team_coaches').select('team_id').eq('user_id', userId),
  ]);
  const own      = ((ownRows.data ?? []) as { id: string }[]).map(r => r.id);
  const assigned = ((assignedRows.data ?? []) as { team_id: string }[]).map(r => r.team_id);
  return [...new Set([...own, ...assigned])];
}

// ── Department membership (org admin) ─────────────────────────────────────────

/** Add a coach to a department. */
export async function addCoachToDepartment(
  deptId: string,
  userId: string,
  role: 'head_coach' | 'assistant_coach' = 'head_coach',
): Promise<boolean> {
  if (!CLOUD_ENABLED) return false;
  const { error } = await supabase
    .from('department_memberships')
    .upsert({ id: crypto.randomUUID(), department_id: deptId, user_id: userId, role });
  if (error) { console.error('[addCoachToDepartment]', error.message); return false; }
  return true;
}
