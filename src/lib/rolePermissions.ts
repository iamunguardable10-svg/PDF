import type { AttendanceSession, AttendanceTeam } from '../types/attendance';
import type { CoachContext } from './coachRole';

export type AppRole = 'athlete' | 'assistant_coach' | 'head_coach' | 'org_admin' | 'manager';

export interface PermissionSet {
  role: AppRole;
  canViewCoachArea: boolean;
  canCreateSessions: boolean;
  canEditAssignedSessions: boolean;
  canEditAllSessions: boolean;
  canManageTeams: boolean;
  canManageDepartments: boolean;
  canManageFacilities: boolean;
  canManageCoaches: boolean;
  canFinalizeAttendance: boolean;
  canViewAnalytics: boolean;
  canViewAdminSettings: boolean;
}

export function getCoachPermissions(context: CoachContext | null): PermissionSet {
  const role = context?.role ?? 'head_coach';
  const isAdmin = role === 'org_admin';
  const isHead = role === 'head_coach';
  const isAssistant = role === 'assistant_coach';

  return {
    role,
    canViewCoachArea: true,
    canCreateSessions: isAdmin || isHead || isAssistant,
    canEditAssignedSessions: true,
    canEditAllSessions: isAdmin || isHead,
    canManageTeams: isAdmin || isHead,
    canManageDepartments: isAdmin,
    canManageFacilities: isAdmin || isHead,
    canManageCoaches: isAdmin,
    canFinalizeAttendance: isAdmin || isHead || isAssistant,
    canViewAnalytics: isAdmin || isHead || isAssistant,
    canViewAdminSettings: isAdmin,
  };
}

export function isSessionAssignedToCoach(session: AttendanceSession, teams: AttendanceTeam[], userId: string, context?: CoachContext | null) {
  const team = teams.find(item => item.id === session.teamId);
  const assignedTeamIds = new Set([...(context?.ownTeamIds ?? []), ...(context?.assignedTeamIds ?? [])]);
  return session.trainerId === userId || (session.teamId ? assignedTeamIds.has(session.teamId) : false) || team?.trainerId === userId;
}

export function canEditSession(session: AttendanceSession, teams: AttendanceTeam[], userId: string, permissions: PermissionSet, context?: CoachContext | null) {
  if (permissions.canEditAllSessions) return true;
  return permissions.canEditAssignedSessions && isSessionAssignedToCoach(session, teams, userId, context);
}

export function roleLabel(role: AppRole) {
  const labels: Record<AppRole, string> = {
    athlete: 'Athlete',
    assistant_coach: 'Assistant Coach',
    head_coach: 'Head Coach',
    org_admin: 'Club Admin',
    manager: 'Manager',
  };
  return labels[role];
}

export function roleDescription(role: AppRole) {
  const descriptions: Record<AppRole, string> = {
    athlete: 'Personal calendar, availability and performance reporting.',
    assistant_coach: 'Assigned sessions, attendance confirmation and player availability.',
    head_coach: 'Team planning, session management, attendance and load decisions.',
    org_admin: 'Club setup, departments, teams, facilities and coach permissions.',
    manager: 'Logistics, schedule overview and communication support.',
  };
  return descriptions[role];
}
