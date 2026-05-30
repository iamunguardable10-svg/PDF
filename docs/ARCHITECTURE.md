# TeamLoad Architecture

## Overview

TeamLoad is a frontend-heavy React application with optional Supabase synchronization.

The application currently mixes:

- local-first demo logic
- authenticated cloud logic
- coach operations
- athlete workflows
- attendance operations
- load analytics
- facility scheduling

The product direction is evolving toward a multi-role Coach OS for team sports.

---

# Frontend architecture

## Core technologies

| Area | Technology |
| --- | --- |
| UI | React 19 |
| Language | TypeScript |
| Build system | Vite |
| Styling | Tailwind CSS |
| Navigation | React Router |
| Charts | Recharts |
| Cloud SDK | Supabase JS |

---

# Application modes

## coach

Primary operational workspace.

Main domains:

- dashboard
- sessions
- attendance
- load monitor
- analytics
- teams
- departments
- facilities
- alerts
- settings

## athlete

Athlete-facing workflow.

Main domains:

- calendar
- RPE submission
- planned sessions
- attendance availability
- profile
- nutrition

## solo

Legacy/local individual mode.

Should eventually become:

- either deprecated
- or isolated from the main TeamLoad coach ecosystem

---

# Current routing structure

Main application routing is centralized in:

```text
src/App.tsx
```

Coach shell:

```text
src/components/coach/
```

Important screens:

```text
coach/screens/
athlete/
trainer/
```

---

# Data architecture

## Current persistence model

The app currently uses a hybrid persistence strategy:

| Layer | Purpose |
| --- | --- |
| localStorage | immediate UI state/demo fallback |
| Supabase | cloud sync/auth/shared team state |

Cloud mode is optional.

`CLOUD_ENABLED` becomes active only when:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

are configured.

---

# Major data domains

## Profiles

User profile and athlete metadata.

Table:

```text
profiles
```

Contains:

- sport
- level
- body metrics
- onboarding state
- training frequency
- nutrition metadata

---

## Sessions and load

Tables:

```text
sessions
planned_sessions
```

Core metrics:

```text
RPE × duration = training load
```

The app also computes ACWR-related context.

---

## Attendance operations

Main operational tables:

```text
att_sessions
att_records
att_teams
att_team_members
```

This is currently the strongest product area.

The attendance model separates:

- availability intent
- attendance finalization
- player load

This separation is architecturally correct and should be preserved.

---

## Organization model

Tables:

```text
organizations
departments
organization_memberships
team_memberships
```

The app is evolving toward:

```text
Organization
  -> Department
      -> Team
          -> Session
```

---

## Facilities

Tables:

```text
facilities
facility_units
facility_blackouts
```

This subsystem is already more advanced than typical youth-team apps.

---

# Security architecture risks

## Current critical issue

Several public tables still have:

```text
RLS disabled
```

This means authenticated and potentially anonymous API consumers may access rows too broadly.

See:

```text
docs/SUPABASE_SECURITY_AUDIT.md
```

---

# Naming inconsistencies

Current naming mixes:

```text
fitfuel
teamload
club_os
PDF
```

Recommended future standard:

```text
Product name: TeamLoad
Storage prefix: teamload_
Repository name: teamload-app
```

This should be handled in a dedicated cleanup branch, not during active feature work.

---

# Recommended engineering structure

## Recommended branch separation

```text
feature/ui-*
feature/load-*
feature/attendance-*
feature/facility-*
docs/*
security/*
```

## Recommended responsibilities

| Area | Owner type |
| --- | --- |
| Architecture | dedicated stabilization chat/dev |
| UI polish | separate frontend branch |
| ACWR/load logic | isolated feature branch |
| Security/RLS | dedicated security branch |

---

# Immediate stabilization priorities

## Priority 1

- document architecture
- document Supabase state
- normalize README
- introduce migration discipline
- audit RLS and policies

## Priority 2

- standardize naming
- isolate local/demo mode
- reduce localStorage coupling
- centralize data access layer

## Priority 3

- scale organization/team model
- harden permissions
- optimize analytics/performance
