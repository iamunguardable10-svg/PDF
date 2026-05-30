# Supabase Security Audit

Project:

```text
Health APP ACWR
```

Region:

```text
eu-west-1
```

Status:

```text
ACTIVE_HEALTHY
```

---

# Executive summary

The database schema is already relatively advanced and supports:

- athlete profiles
- attendance operations
- organization/team hierarchy
- facilities
- load monitoring
- scheduling
- trainer sharing

However, the current Supabase security posture is NOT production-ready.

The biggest issue:

```text
Multiple public tables still have RLS disabled.
```

Do NOT blindly enable RLS globally without tested policies.

---

# Critical findings

## 1. RLS disabled on public tables

Affected tables:

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

Risk:

- overexposed team relationships
- exposed scheduling structures
- exposed session references
- unintended write access
- broken tenancy boundaries

Recommended approach:

1. document all access flows first
2. identify coach vs athlete vs admin requirements
3. create policies table-by-table
4. test on development branch/project
5. enable RLS incrementally

---

# Sensitive exposed structures

Supabase advisor additionally flagged:

```text
session_id
```

inside:

```text
event_coaches
event_teams
event_facility_bookings
```

These tables are currently externally exposed without RLS.

---

# Overly permissive policies

## organizations

Policy:

```text
Authenticated users can create organizations
```

Issue:

```text
WITH CHECK (true)
```

This is too permissive for long-term multi-tenant security.

---

## trainer_invites

Policy:

```text
accept invite
```

Issue:

```text
WITH CHECK (true)
```

Should eventually validate:

- invite ownership
- expiration
- token state
- actor identity

---

# SECURITY DEFINER functions exposed

The following functions are executable through the API:

```text
att_session_trainer
att_team_trainer
get_roster_team_memberships
get_trainer_data
lookup_user_by_share_token
```

Risk:

Potential privilege escalation or information leakage depending on implementation.

Recommendation:

- audit each function individually
- evaluate whether SECURITY DEFINER is required
- revoke anon execution where unnecessary
- prefer SECURITY INVOKER unless elevated permissions are truly needed

---

# Authentication warning

Current warning:

```text
Leaked password protection disabled
```

Recommendation:

Enable HaveIBeenPwned password screening in Supabase Auth settings.

---

# Migration status

Current state:

```text
0 registered migrations
```

This is a major operational issue.

Risks:

- schema drift
- inconsistent environments
- difficult rollback
- unsafe collaboration
- undocumented production changes

Recommendation:

All future DDL changes should use:

```text
apply_migration
```

with versioned SQL migration history.

---

# Recommended remediation roadmap

## Phase 1 — Documentation and visibility

- inventory all policies
- inventory all RPC functions
- document role matrix
- map data ownership rules

## Phase 2 — Safe staging

- create dedicated security branch/project
- test RLS incrementally
- validate all coach and athlete flows

## Phase 3 — Production hardening

- enable RLS everywhere
- tighten RPC execution permissions
- centralize authorization helpers
- add migration discipline

---

# Important operational note

Current active feature development is happening in parallel.

Because of this:

```text
DO NOT run blanket RLS migrations during active feature work.
```

Security hardening should happen in a dedicated stabilization/security branch after flow documentation is complete.
