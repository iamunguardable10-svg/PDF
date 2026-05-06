# Security Smoke Tests

Purpose:

Validate that future RLS and policy changes do not silently break core TeamLoad workflows.

These tests should be executed:

- before enabling new RLS
- before removing old policies
- before deploying policy migrations
- before modifying SECURITY DEFINER functions

---

# Test accounts

Recommended staging accounts:

```text
coach_a
coach_b
athlete_a
athlete_b
org_admin
anon_user
```

Recommended staging structure:

```text
Organization Alpha
 ├── Team A
 └── Team B
```

---

# Athlete tests

## Athlete authentication

Expected:

- athlete can sign in
- athlete session persists
- athlete profile hydrates

---

## Athlete session visibility

Expected:

- athlete sees only assigned sessions
- athlete does not see unrelated team sessions
- athlete calendar hydrates correctly

Failure indicators:

- empty calendar
- missing sessions
- sessions from other teams visible

---

## Athlete attendance flow

Expected:

- athlete submits availability
- athlete edits own availability
- athlete cannot finalize coach attendance

Failure indicators:

- save rejected
- duplicate rows
- coach-only fields editable

---

## Athlete RPE/load submission

Expected:

- athlete submits RPE
- athlete submits duration
- load values persist
- ACWR-related dashboards still hydrate

Failure indicators:

- missing load records
- incorrect hydration
- coach cannot see athlete load

---

# Coach tests

## Coach authentication

Expected:

- coach signs in
- dashboard hydrates
- owned teams visible

---

## Team management

Expected:

- coach creates team
- coach edits team
- coach sees only owned teams unless org-admin

Failure indicators:

- unauthorized teams visible
- writes denied unexpectedly

---

## Session management

Expected:

- coach creates session
- coach edits session
- assigned athletes visible
- attendance records visible

Failure indicators:

- session save denied
- missing athletes
- attendance hydration failure

---

## Attendance finalization

Expected:

- coach finalizes attendance
- athlete overrides still preserved where intended
- attendance sync remains consistent

---

# Invite and share tests

## Team invite links

Expected:

- signed-out user can open invite link
- signed-in athlete can join correct team
- expired invite blocked

Failure indicators:

- unrestricted team discovery
- invalid invite accepted

---

## Trainer share tokens

Expected:

- valid token loads shared trainer view
- invalid token rejected
- expired/inactive token rejected

Failure indicators:

- unrelated user data visible
- token enumeration possible

---

# Facility tests

## Facility visibility

Expected:

- organization users see organization facilities
- unrelated users do not see private facilities if later restricted

---

## Facility booking

Expected:

- booking creation works
- scheduling conflicts still detected
- blackout periods respected

---

# Organization tests

## Membership isolation

Expected:

- users only see memberships they should access
- organization admins can manage memberships
- unrelated org data isolated

---

# Regression watchlist

Areas most likely to break after policy changes:

```text
athlete calendar hydration
attendance persistence
RPE hydration
coach dashboards
team chat
session chat
trainer share links
facility booking
```

---

# Deployment rule

No policy migration should be deployed unless:

```text
all smoke tests pass
```

for:

- anon
- athlete
- coach
- org admin
