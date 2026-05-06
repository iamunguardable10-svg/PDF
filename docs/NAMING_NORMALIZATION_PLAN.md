# Naming Normalization Plan

Purpose:

Standardize the TeamLoad codebase naming system and reduce long-term confusion across:

- repository identity
- local storage keys
- database naming
- branch naming
- UI labels
- environment variables

---

# Current inconsistent naming

The current codebase mixes:

```text
PDF
TeamLoad
FitFuel
club_os
```

This creates:

- onboarding confusion
- unclear product identity
- harder debugging
- inconsistent storage keys
- unclear architecture boundaries

---

# Recommended future naming standard

## Product identity

Use:

```text
TeamLoad
```

for:

- UI branding
- documentation
- repository identity
- environment naming
- future deployment naming

---

# Recommended repository name

Current:

```text
PDF
```

Recommended future rename:

```text
teamload-app
```

Do NOT rename during active feature development.

Repository renaming should happen:

- after branch stabilization
- after PR backlog reduced
- after deployment references audited

---

# Local storage normalization

Current mixed prefixes:

```text
fitfuel_*
club_os_*
teamload_*
```

Recommended future standard:

```text
teamload_*
```

Examples:

```text
teamload_mode
teamload_guest
teamload_tour_done
teamload_last_team
```

---

# Branch naming

Recommended:

```text
feature/*
security/*
docs/*
fix/*
refactor/*
```

Avoid:

```text
random experimental names
v1-final-real
misc-updates
```

---

# Database naming

## Recommended standards

### Tables

Use:

```text
snake_case_plural
```

Examples:

```text
organization_memberships
att_session_messages
trainer_invites
```

---

### Functions

Use:

```text
verb_subject_condition
```

Examples:

```text
is_team_member
is_team_coach
lookup_user_by_share_token
```

---

### Policies

Use:

```text
actor_operation_resource
```

Examples:

```text
coach_manage_own_sessions
athlete_select_own_profile
```

---

# Environment variable naming

Current:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

These are good and should stay.

Future additions should follow:

```text
VITE_TEAMLOAD_*
```

Examples:

```text
VITE_TEAMLOAD_ENV
VITE_TEAMLOAD_ENABLE_DEMO
```

---

# UI terminology standardization

Potential future alignment:

| Current possible variants | Recommended |
| --- | --- |
| trainer | coach |
| athlete/player | athlete |
| org/club | organization |
| attendance/load status mix | attendance vs load separated |

Important:

The app architecture correctly separates:

```text
attendance
```

from:

```text
player load
```

This distinction should remain explicit throughout the UI and database.

---

# Migration strategy

Do not rename everything at once.

Recommended sequence:

## Phase 1

Documentation normalization.

## Phase 2

New code uses normalized names.

## Phase 3

Introduce compatibility layer for old localStorage keys.

## Phase 4

Gradually migrate old keys.

## Phase 5

Repository rename.

---

# Important warning

Do not perform broad search/replace operations across the project during active parallel development.

Naming cleanup should happen:

- incrementally
- with smoke tests
- after PR coordination
- with compatibility handling for persisted localStorage values
