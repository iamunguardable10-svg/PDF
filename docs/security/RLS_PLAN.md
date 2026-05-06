# Supabase RLS Rollout Plan

Status: planning only.

This document intentionally does not apply database changes. It defines a safe path for hardening TeamLoad's Supabase security without breaking active product flows.

---

# Goal

Move all exposed public tables to a production-safe Row Level Security model while preserving:

- coach operations
- athlete availability
- athlete RPE submission
- team/session views
- facility scheduling
- trainer share flows
- demo/local fallback behavior

---

# Current critical issue

The Supabase advisor reports RLS disabled on:

```text
public.department_memberships
public.team_memberships
public.facility_unit_conflicts
public.facility_blackouts
public.recurrence_rules
public.event_teams
public.event_coaches
public.event_facility_bookings
```

Do not enable these tables blindly. Enabling RLS without policies will block legitimate app flows.

---

# Security principles

## 1. Deny by default

Every table should eventually have RLS enabled.

## 2. Ownership and membership based access

Access should be based on:

- user owns the row
- user belongs to the organization
- user belongs to the team
- user is assigned coach for the session
- user is the athlete represented by the row

## 3. Public access only by token

Anonymous access should be allowed only for explicitly public token-based flows such as share/invite lookups.

## 4. No blanket `USING (true)` for writes

Write policies must validate ownership, membership, or token state.

---

# Role model

| Actor | Description | Typical capabilities |
| --- | --- | --- |
| anon | not signed in | token-based invite/share only |
| athlete | signed-in player | own profile, own availability, own RPE/load |
| coach | assigned trainer/coach | assigned teams/sessions, attendance review |
| department_admin | department-level manager | department teams/sessions/facilities |
| org_admin | club/admin | organization-wide management |
| service_role | backend/admin only | unrestricted, never exposed to browser |

---

# Table groups

## User-owned personal data

```text
profiles
sessions
planned_sessions
food_log
trainer_shares
```

Policy pattern:

```text
user_id = auth.uid()
```

or for profiles:

```text
id = auth.uid()
```

---

## Team and attendance data

```text
att_teams
att_team_members
att_sessions
att_session_athletes
att_records
att_team_messages
att_session_messages
att_join_requests
team_memberships
event_teams
event_coaches
```

Policy pattern should be based on:

- trainer owns team/session
- user is athlete member of team
- user has team_memberships row
- user is listed in event_coaches
- org/department role allows management

---

## Organization data

```text
organizations
departments
organization_memberships
department_memberships
```

Policy pattern should be based on active membership.

Potential helper checks:

```text
is_org_member(org_id)
is_org_admin(org_id)
is_department_member(department_id)
is_department_admin(department_id)
```

---

## Facilities and scheduling

```text
facilities
facility_units
facility_unit_conflicts
facility_blackouts
event_facility_bookings
recurrence_rules
```

Policy pattern:

- org members can read facilities
- org/department admins can manage facilities
- assigned coaches can read bookings for their sessions

---

# Rollout phases

## Phase 0 — Inventory

- export current table definitions
- export current policies
- export functions/RPC grants
- document frontend query paths

## Phase 1 — Helper functions

Create stable authorization helpers before enabling RLS on complex tables.

Examples:

```sql
is_team_member(team_id text)
is_team_coach(team_id text)
is_session_coach(session_id text)
is_org_member(org_id uuid)
is_org_admin(org_id uuid)
```

## Phase 2 — Read policies

Add SELECT policies first and test all screens.

## Phase 3 — Write policies

Add INSERT/UPDATE/DELETE policies with explicit ownership/membership checks.

## Phase 4 — Enable RLS incrementally

Suggested order:

1. recurrence_rules
2. event_teams
3. event_coaches
4. event_facility_bookings
5. facility_unit_conflicts
6. facility_blackouts
7. team_memberships
8. department_memberships

## Phase 5 — RPC hardening

Review and restrict:

```text
att_session_trainer
att_team_trainer
get_roster_team_memberships
get_trainer_data
lookup_user_by_share_token
```

## Phase 6 — Production validation

Run the smoke tests:

- signed-out landing/demo
- sign up/sign in
- coach creates team
- athlete joins team
- coach creates session
- athlete submits availability
- coach finalizes attendance
- athlete submits RPE
- load monitor still reads expected data
- facility booking still works

---

# Non-goals for this branch

This branch does not:

- enable RLS
- modify database schema
- alter app code
- change Supabase policies
- run migrations

It only prepares a safe security plan.
