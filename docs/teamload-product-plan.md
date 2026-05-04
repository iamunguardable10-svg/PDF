# TeamLoad Product Plan

## Product direction

TeamLoad should become a coach operations system for teams and clubs, not just an ACWR dashboard.

The app should answer three questions every day:

1. Who is available today?
2. What sessions, teams and facilities need attention?
3. Which athletes require load, attendance or communication decisions?

## Core user roles

### Coach

Primary daily operator.

Needs:

- Today/next session overview
- Assigned sessions highlighted before general club/team sessions
- Availability and absence reasons
- Attendance confirmation
- Load risk summary
- Team and group planning
- Calendar planning
- Alerts and action items

### Athlete

Primary self-reporting user.

Needs:

- Personal calendar
- Simple availability response: default available, only mark maybe/no when needed
- Required reason for maybe/no
- Session reminders and notes
- Personal load/performance view

### Admin

Club-level setup and control.

Needs:

- Organization setup
- Departments
- Teams
- Coaches and permissions
- Facilities
- Data/privacy settings

### Future manager role

Optional later role for logistics and communication.

Needs:

- Schedules
- Availability
- Facility conflicts
- Announcements

## Navigation architecture

### Coach shell

Primary sections:

1. Dashboard
2. Sessions
3. Calendar
4. Players
5. Groups
6. Teams
7. Departments
8. Facilities
9. Load
10. Attendance
11. Analytics
12. Alerts
13. Settings

### Dashboard purpose

The dashboard is not a report page. It is the daily command center.

It should show:

- Assigned today/next session as the primary focus
- Other relevant team/club sessions as secondary context
- Available / unsure / unavailable
- Missing reasons
- At-risk athletes
- Alerts
- Next sessions
- Quick actions

### Calendar purpose

Calendar should be the main planning surface.

Where calendars should appear:

- Coach Calendar: global planning view with assigned sessions visually highlighted
- Dashboard: compact today/next mini-calendar focused first on assigned sessions
- Team Screen: team-specific calendar
- Department Screen: department-wide calendar
- Athlete Shell: personal calendar
- Future Player Detail: player-specific attendance/load calendar

The existing CalendarView should be reused where possible because it already includes drag-and-drop rescheduling logic.

## Session priority model

A coach should never have to search for the sessions they personally need to run.

Session priority for coach-facing views:

1. Assigned sessions where the current coach is explicitly linked as head coach or assistant coach
2. Sessions for teams/groups the coach is responsible for
3. Sessions in the coach's department
4. Other organization sessions, shown only as secondary context if the role allows it

Visual treatment:

- Assigned sessions should be highlighted with a stronger border/accent
- Secondary sessions should remain visible but visually quieter
- Dashboard should show assigned today/next session first
- Calendar should include filters: My sessions, Team, Department, All
- Mobile view should prioritize My sessions by default

## Feature roadmap

### Phase 1: Foundation - done

- Coach OS navigation
- Starter screens
- Demo dashboard
- Athlete-to-coach testing shortcut
- No database migration

### Phase 2: Availability + Calendar v1

Goal: make the daily coach workflow real.

Build:

- Coach Calendar screen using existing calendar components where safe
- Assigned coach sessions highlighted in Dashboard and Calendar
- Dashboard mini-calendar / today-next-session card
- Sessions screen with clearer list and session focus
- Availability model preparation
- Demo/live separation

Availability rules:

- Default player state: expected / available
- Athlete only acts when maybe or unavailable
- maybe/no require a reason
- Session remains visible even when unavailable
- Coach sees summary by session

Reason categories:

- injury
- illness
- school/university
- work
- private
- travel
- load management
- other

### Phase 3: Attendance v1

Goal: coach can finalize actual attendance.

Build:

- Session detail attendance table
- Coach final status override
- present
- late
- partial
- excused_absent
- unexcused_absent
- No-show detection: expected, not cancelled, coach marks absent

### Phase 4: Load Monitor v2

Goal: integrate ACWR as decision support.

Build:

- Replace embedded legacy dashboard with coach-specific load monitor
- Team risk overview
- Athlete risk table
- EWMA default
- Rolling average toggle
- Risk zones:
  - under 0.8: undertraining
  - 0.8-1.3: optimal
  - 1.3-1.5: elevated
  - over 1.5: high

### Phase 5: Alerts v1

Goal: turn data into actions.

Alerts:

- low session availability
- athlete marked unavailable
- repeated late
- repeated absence
- no-show
- elevated/high load risk
- important session affected by low availability

### Phase 6: Analytics v1

Goal: reporting for coaches and clubs.

Metrics:

- Attendance rate
- Late rate
- Excused absence rate
- Unexcused absence rate
- Override rate
- Team availability trend
- Load risk trend

### Phase 7: Design polish

Only after core workflows are stable.

Direction:

- Light SaaS dashboard option
- Better cards
- More calendar density
- Player detail pages
- Admin setup polish
- Mobile PWA optimization

## Data model direction

Separate layers:

1. Planned participation
2. Athlete availability override
3. Location verification signals later, optional
4. Coach final attendance confirmation

Do not mix athlete response and final attendance into one status.

Session assignment should be explicit and queryable:

- head coach
- assistant coach
- responsible team/group
- department
- facility

## Safety and privacy principles

- No background location tracking
- Location verification only later and only event-based
- Manual alternative always required
- Availability and health/load data should be treated as sensitive
- Data minimization and deletion should be planned

## Build strategy

Use small PRs.

Each PR should change one product area:

- Availability + Calendar
- Attendance
- Load Monitor
- Alerts
- Analytics
- Design polish

Avoid large rewrites of App.tsx and CoachShell unless necessary.
