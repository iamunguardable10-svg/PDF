# Branch Coordination Rules

Purpose:

Prevent merge conflicts, architectural drift, and accidental breakage during parallel development.

---

# Core rule

```text
One branch = one responsibility domain.
```

Avoid mixing:

- UI work
- security work
- migrations
- architecture cleanup
- attendance logic
- ACWR calculations

inside the same branch.

---

# Recommended branch naming

## Documentation

```text
docs/*
```

Examples:

```text
docs/project-stabilization-audit
```

---

## Security

```text
security/*
```

Examples:

```text
security/supabase-rls-plan
security/policy-hardening
```

---

## Features

```text
feature/*
```

Examples:

```text
feature/athlete-calendar
feature/coach-dashboard
feature/acwr-logic
```

---

# Important operational rules

## Never work directly on main

Always use PRs.

---

## Avoid simultaneous file ownership

If another branch is actively modifying:

```text
src/App.tsx
```

avoid parallel edits unless coordinated.

---

## High-risk areas

Coordinate before modifying:

```text
attendance logic
RPE calculations
ACWR formulas
Supabase schema
RLS policies
routing
shared types
```

---

# Security rule

Never apply database security changes directly to production without:

1. documented plan
2. rollback strategy
3. smoke test list
4. isolated review branch

---

# Pull request guidance

Every PR should state:

- what it changes
- what it intentionally does not change
- risk level
- affected subsystems
- whether Supabase is affected

---

# Recommended development structure

| Domain | Suggested owner |
| --- | --- |
| Architecture | stabilization/security branch |
| UI polish | frontend branch |
| Load analytics | performance branch |
| Attendance ops | operations branch |
| Security | dedicated security branch |

This minimizes architectural conflicts during rapid iteration.
