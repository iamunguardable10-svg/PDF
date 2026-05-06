# Supabase Policy Inventory

Status: generated from live Supabase metadata.

This document summarizes the current policy state and risk categories. It is intentionally descriptive, not a migration.

---

# High-risk summary

## Main risks

1. Some public tables still have RLS disabled.
2. Existing policies contain duplicates and overlapping permissions.
3. Several policies use `roles = public`, which includes both anon and authenticated users.
4. Some public-read policies may be product-intentional but are not clearly classified.
5. At least one athlete session policy appears logically defective.

---

# Personal data tables

## profiles

Current pattern:

```text
own profile
```

Uses:

```text
auth.uid() = id
```

Assessment:

Good baseline.

Recommended future name:

```text
user_manage_own_profile
```

---

## sessions

Current pattern:

```text
own sessions
```

Uses:

```text
auth.uid() = user_id
```

Assessment:

Good baseline for personal ACWR sessions.

Recommended future name:

```text
athlete_manage_own_sessions
```

---

## planned_sessions

Current pattern:

```text
own planned_sessions
```

Assessment:

Good baseline.

Recommended future name:

```text
athlete_manage_own_planned_sessions
```

---

## food_log

Current pattern:

```text
own food_log
```

Assessment:

Good baseline.

Recommended future name:

```text
athlete_manage_own_food_log
```

---

# Team / attendance tables

## att_teams

Current patterns:

```text
authenticated users read teams
public read team by invite
trainer manages own teams
trainer owns team
```

Assessment:

- trainer policies overlap
- invite read may be intentional
- authenticated broad team read should be reviewed before production

Recommended future policies:

```text
anon_select_team_by_active_invite_token
authenticated_select_joinable_teams
coach_manage_own_teams
team_member_select_own_teams
```

---

## att_team_members

Current patterns:

```text
athlete joins team
athlete reads own membership
athletes read own membership
trainer manages members
```

Assessment:

- duplicate athlete read policies
- trainer policy depends on `att_team_trainer()` SECURITY DEFINER helper

Recommended future policies:

```text
athlete_select_own_team_memberships
athlete_insert_self_team_membership
coach_manage_team_memberships
```

---

## att_sessions

Current patterns:

```text
athletes read sessions they are in
session athlete reads
trainer manages own sessions
trainer owns session
```

Assessment:

- trainer policies overlap
- `session athlete reads` appears defective
- correct athlete-read policy appears to already exist

Likely defect:

```text
att_session_athletes.session_id = att_session_athletes.id
```

Expected:

```text
att_session_athletes.session_id = att_sessions.id
```

Recommended future policies:

```text
athlete_select_assigned_sessions
coach_manage_own_sessions
```

---

## att_session_athletes

Current patterns:

```text
athlete reads own session
athletes read own session entries
trainer manages session athletes
```

Assessment:

- duplicate athlete read policies
- coach management depends on `att_session_trainer()` helper

Recommended future policies:

```text
athlete_select_own_session_assignments
coach_manage_session_assignments
```

---

## att_records

Current patterns:

```text
athlete reads own record
athlete updates own record
athlete writes own record
athletes read own records
athletes update own override
trainer manages records
```

Assessment:

- duplicate athlete read/update policies
- athlete update is broad and should be reviewed because att_records includes both availability/load and final attendance fields
- coach management depends on `att_session_trainer()` helper

Recommended future policies:

```text
athlete_select_own_att_records
athlete_insert_own_att_records
athlete_update_own_availability_and_load
coach_manage_session_att_records
```

Important:

The app should prevent athletes from editing coach-final attendance fields.

---

## att_team_messages / att_session_messages

Current patterns:

```text
team chat access
team members can chat
session chat access
session participants can chat
```

Assessment:

- overlapping ALL policies
- one set has sender validation, one does not

Recommended future direction:

Split read and write policies.

```text
team_participants_select_messages
team_participants_insert_own_messages
session_participants_select_messages
session_participants_insert_own_messages
```

---

# Organization tables

## organizations

Current patterns:

```text
Anyone can read organizations
Authenticated users can create organizations
Org owners can update
```

Assessment:

- public read may be product-intentional
- unrestricted authenticated organization creation should be reviewed before production

Recommended future direction:

```text
public_select_public_organizations
authenticated_insert_organization_with_creator_membership
org_admin_update_organization
```

---

## departments

Current patterns:

```text
Anyone can read departments
Org members can create departments
```

Assessment:

Public read may be too broad depending on product model.

Recommended future direction:

```text
org_member_select_departments
org_admin_manage_departments
```

---

## organization_memberships

Current patterns:

```text
Users read own memberships
Org members read all
Users can add themselves
Owners can add others
```

Assessment:

Reasonable base, but self-add membership should be reviewed to ensure organizations are not joinable without invite or approval unless intended.

---

# Facility tables

## facilities / facility_units

Current patterns:

```text
Anyone can read facilities
Anyone can read facility units
Trainers can manage org facilities
Trainers can manage units of their facilities
```

Assessment:

Public read is probably too broad for production unless facilities are intended as public directory data.

Recommended future direction:

```text
org_member_select_facilities
org_staff_manage_facilities
```

---

# Invite and share flows

## trainer_invites

Current patterns:

```text
public read
accept invite
trainer insert
trainer delete
```

Assessment:

- public read `true` is broad
- accept invite uses `WITH CHECK true`
- should be token-scoped and expiration-aware

Recommended future direction:

```text
anon_select_invite_by_token
invite_holder_accept_valid_invite
trainer_manage_own_invites
```

---

## trainer_shares

Current pattern:

```text
own shares
```

Assessment:

Good baseline for share token ownership.

The public share read happens through SECURITY DEFINER RPCs, not direct table policy.

---

# Immediate safe cleanup candidates

These are candidates only. Do not execute until smoke tests are ready.

1. Replace defective `att_sessions` policy.
2. Consolidate duplicate trainer-owned policies on `att_sessions` and `att_teams`.
3. Consolidate duplicate athlete-read policies on `att_records`, `att_team_members`, and `att_session_athletes`.
4. Split message policies into select vs insert with sender validation.
5. Restrict broad invite reads to token-based reads.

---

# Do not change yet

Do not change until product intent is confirmed:

- public organization reads
- public department reads
- public facility reads
- trainer share token access
- open team invite lookup behavior
