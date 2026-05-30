# TeamLoad Handoff Report

Purpose:

Provide a compact synchronization context for parallel ChatGPT chats, developers, or branches.

---

# Current project identity

Repository:

```text
iamunguardable10-svg/PDF
```

Actual product identity:

```text
TeamLoad
```

Current product direction:

```text
Coach OS for team sports
```

Primary focus:

- sessions
- attendance operations
- athlete availability
- player load
- ACWR context
- organization/team management

---

# Current architecture state

Frontend:

- React 19
- TypeScript
- Vite
- Tailwind CSS
- React Router

Backend:

- Supabase

Persistence model:

```text
localStorage + optional cloud sync
```

Cloud mode is optional and controlled through env variables.

---

# Important active modes

```text
coach
athlete
solo
```

The app still contains legacy naming remnants:

```text
fitfuel
club_os
PDF
```

Recommended future standard:

```text
teamload_
```

---

# Current critical security findings

## RLS disabled

Affected tables:

```text
department_memberships
team_memberships
facility_unit_conflicts
facility_blackouts
recurrence_rules
event_teams
event_coaches
event_facility_bookings
```

Do NOT blindly enable RLS.

A dedicated security pass is required.

---

# Current operational risks

## 1. No migration history

Supabase currently reports:

```text
0 migrations
```

Schema discipline must improve.

---

## 2. Naming inconsistency

Current naming mixes:

```text
TeamLoad
FitFuel
club_os
PDF
```

---

## 3. Parallel development risk

Multiple PRs are currently open.

Avoid editing the same domains simultaneously.

---

# Active/open feature PR themes

Examples:

- athlete UX
- RPE hydration
- coach routing IA
- attendance persistence
- dashboard polish
- landing page

Meaning:

```text
Avoid interfering with:
- attendance logic
- ACWR logic
- athlete calendar flows
- coach routing
```

unless coordinated.

---

# Current stabilization branch

```text
docs/project-stabilization-audit
```

Scope:

- README
- architecture docs
- security audit
- handoff context

No product logic changes.

---

# Recommended division of responsibility

## Architecture/Stabilization

Responsible for:

- documentation
- migrations
- security
- naming cleanup
- data structure
- permission model

## UI/Product branches

Responsible for:

- dashboard UX
- athlete flows
- mobile polish
- charts
- interaction patterns

## Security branch

Responsible for:

- RLS
- RPC hardening
- auth rules
- migration rollout

---

# Immediate next priorities

## Highest priority

1. migration discipline
2. RLS rollout planning
3. naming cleanup strategy
4. centralized data layer
5. role/permission formalization

## Medium priority

1. local/demo isolation
2. analytics optimization
3. organization scaling
4. performance monitoring

---

# Important coordination rule

When multiple ChatGPT chats are working simultaneously:

```text
One chat = one responsibility domain.
```

Recommended:

| Domain | Owner |
| --- | --- |
| Architecture/security | stabilization chat |
| UI polish | frontend chat |
| ACWR/load features | performance chat |
| attendance workflows | operations chat |

This minimizes merge conflicts and architectural drift.
