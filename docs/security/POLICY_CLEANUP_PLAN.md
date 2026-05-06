# Supabase Policy Cleanup Plan

Status: planning only.

This document maps current policy risks and defines a safe cleanup direction before any destructive or production-impacting database change is made.

---

# Goals

1. Reduce duplicated and overlapping RLS policies.
2. Standardize policy naming.
3. Separate public token flows from authenticated app flows.
4. Fix obvious policy logic defects.
5. Prepare future migration scripts with low regression risk.

---

# Current high-level findings

## Policy sprawl

Several tables have duplicated or overlapping policies with similar intent.

Examples:

```text
att_sessions
att_records
att_session_athletes
att_team_members
att_team_messages
```

This increases debugging and security risk because multiple policies may grant access through different paths.

---

## Public role usage

Many policies use:

```text
roles = public
```

In Postgres/Supabase this includes both:

```text
anon
authenticated
```

This is acceptable only when intentional, e.g. invite-token reads. Authenticated-only app flows should prefer the `authenticated` role.

---

## Broad public reads

Policies currently allow broad reads for some tables:

```text
organizations
departments
facilities
facility_units
trainer_invites
```

These may be product-intentional, but they should be explicitly classified as:

- public directory data
- invite-token data
- authenticated workspace data

---

# Suspected logic defect

## att_sessions: `session athlete reads`

Current condition appears to compare:

```text
att_session_athletes.session_id = att_session_athletes.id
```

Expected condition is likely:

```text
att_session_athletes.session_id = att_sessions.id
```

Risk:

- athletes may not see sessions they should see
- policy may be functionally ineffective
- a duplicate correct policy may be masking the bug

Recommended fix:

- keep the already-correct policy if present
- drop or replace the defective policy in a dedicated migration
- test athlete calendar/session visibility

---

# Duplicate / overlapping policy groups

## att_sessions

Overlapping policies:

```text
trainer manages own sessions
trainer owns session
```

Both grant trainer full access based on `trainer_id = auth.uid()`.

Recommended direction:

Use one standard policy name:

```text
coach_manage_own_sessions
```

---

## att_records

Overlapping policies:

```text
athlete reads own record
athletes read own records
athlete updates own record
athletes update own override
athlete writes own record
trainer manages records
```

Recommended direction:

Split into explicit policies:

```text
athlete_select_own_att_records
athlete_insert_own_att_records
athlete_update_own_load_fields
coach_manage_session_att_records
```

Important:

Athlete update should ideally be column-limited at application or RPC level if Postgres column policies are not used.

---

## att_session_athletes

Overlapping policies:

```text
athlete reads own session
athletes read own session entries
trainer manages session athletes
```

Recommended direction:

```text
athlete_select_own_session_assignments
coach_manage_session_assignments
```

---

## att_team_members

Overlapping policies:

```text
athlete reads own membership
athletes read own membership
trainer manages members
athlete joins team
```

Recommended direction:

```text
athlete_select_own_team_memberships
athlete_insert_self_membership
coach_manage_team_memberships
```

---

## att_team_messages / att_session_messages

Overlapping policies:

```text
team chat access
team members can chat
session chat access
session participants can chat
```

Recommended direction:

Prefer stricter policies with sender validation:

```text
team_participants_select_messages
team_participants_insert_own_messages
session_participants_select_messages
session_participants_insert_own_messages
```

Avoid `ALL` policies when read/write requirements differ.

---

# Policy naming standard

Use this format:

```text
<actor>_<operation>_<resource>[_condition]
```

Examples:

```text
athlete_select_own_profile
coach_manage_own_sessions
org_admin_manage_departments
team_member_select_team_messages
anon_select_invite_by_token
```

Avoid names like:

```text
Anyone can read ...
trainer owns ...
public read
accept invite
```

because they do not clearly express actor, operation, and condition.

---

# Recommended policy categories

## Public token policies

Only for token-driven flows:

```text
anon_select_team_invite_by_token
anon_select_trainer_share_by_token
```

Must validate:

- token exists
- token active
- token not expired if expiration exists
- returned columns are safe

---

## Authenticated self policies

For personal data:

```text
user_id = auth.uid()
id = auth.uid()
```

---

## Coach-owned policies

For owned teams/sessions:

```text
trainer_id = auth.uid()::text
```

---

## Membership policies

For team/org access:

```text
exists membership row where user_id = auth.uid()
```

---

# Safe cleanup phases

## Phase 1 — No-op documentation

Current branch.

- document existing policies
- identify duplicates
- propose names
- identify likely broken policy

## Phase 2 — Non-destructive additions

Add helper functions if needed.

Do not drop old policies yet.

## Phase 3 — Add replacement policies

Add new standardized policies alongside old ones.

Test app behavior.

## Phase 4 — Remove duplicate policies

Drop redundant policies only after replacement policies pass tests.

## Phase 5 — Enable missing RLS tables

Enable RLS table by table with policies already in place.

---

# First candidate migration: safe policy bug cleanup

Potentially safe first cleanup:

- inspect `att_sessions` policies
- confirm correct athlete-read policy exists
- remove or replace defective `session athlete reads` policy

Do not execute until smoke tests are ready.

---

# Smoke tests required before any policy cleanup

## Athlete flow

- login as athlete
- view athlete calendar
- view own team sessions
- submit availability
- submit RPE/duration
- reload and confirm persisted values hydrate

## Coach flow

- login as coach
- view own teams
- view sessions
- create/edit session
- view attendance records
- finalize attendance
- view load monitor

## Invite/share flow

- open invite link signed out
- join team signed in
- open trainer share token

## Facility flow

- view facilities
- create facility/session booking where supported

---

# Do not do yet

Do not:

- drop public reads without product decision
- revoke RPC execution blindly
- enable RLS on missing tables without policies
- change `get_trainer_data` without testing share links
- remove duplicate policies before replacement policies are verified
