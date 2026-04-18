-- ============================================================
-- CLUB OS v2 — Roles, Coach Assignment, RPE Tracking
-- Additive only: no data loss.
-- Run in Supabase SQL Editor.
-- ============================================================


-- ── 1. EXPAND ORGANIZATION MEMBERSHIP ROLES ──────────────────────────────────
-- Drop old constraint and replace with full role set

alter table organization_memberships
  drop constraint if exists organization_memberships_role_check;

alter table organization_memberships
  add constraint organization_memberships_role_check
  check (role in ('owner','admin','head_coach','assistant_coach','athlete','staff','member'));


-- ── 2. DEPARTMENT MEMBERSHIPS ─────────────────────────────────────────────────
-- Links users (coaches, athletes) to departments with a role

create table if not exists department_memberships (
  id            text primary key,
  department_id text not null references departments(id) on delete cascade,
  user_id       text not null,
  role          text not null default 'head_coach'
                check (role in ('head_coach','assistant_coach','athlete','staff')),
  joined_at     timestamptz default now(),
  unique(department_id, user_id)
);

alter table department_memberships enable row level security;

drop policy if exists "Anyone in org reads dept memberships" on department_memberships;
drop policy if exists "Org admin manages dept memberships"   on department_memberships;

create policy "Anyone in org reads dept memberships"
  on department_memberships for select
  using (
    exists (
      select 1 from departments d
      join organization_memberships om on om.organization_id = d.organization_id
      where d.id = department_memberships.department_id
        and om.user_id = auth.uid()::text
    )
  );

create policy "Org admin manages dept memberships"
  on department_memberships for all to authenticated
  using (
    exists (
      select 1 from departments d
      join organization_memberships om on om.organization_id = d.organization_id
      where d.id = department_memberships.department_id
        and om.user_id = auth.uid()::text
        and om.role in ('owner','admin')
    )
  )
  with check (
    exists (
      select 1 from departments d
      join organization_memberships om on om.organization_id = d.organization_id
      where d.id = department_memberships.department_id
        and om.user_id = auth.uid()::text
        and om.role in ('owner','admin')
    )
  );


-- ── 3. TEAM COACHES (multi-coach per team) ────────────────────────────────────
-- Org admin assigns coaches to teams they didn't create

create table if not exists att_team_coaches (
  id        text primary key,
  team_id   text not null references att_teams(id) on delete cascade,
  user_id   text not null,
  role      text not null default 'head_coach'
            check (role in ('head_coach','assistant_coach')),
  joined_at timestamptz default now(),
  unique(team_id, user_id)
);

alter table att_team_coaches enable row level security;

drop policy if exists "Coaches read their own team assignments"  on att_team_coaches;
drop policy if exists "Org admin manages team coaches"          on att_team_coaches;
drop policy if exists "Trainers read their team coaches"        on att_team_coaches;

create policy "Coaches read their own team assignments"
  on att_team_coaches for select
  using (user_id = auth.uid()::text);

create policy "Trainers read their team coaches"
  on att_team_coaches for select
  using (
    exists (select 1 from att_teams where id = att_team_coaches.team_id and trainer_id = auth.uid()::text)
  );

create policy "Org admin manages team coaches"
  on att_team_coaches for all to authenticated
  using (
    exists (
      select 1 from att_teams t
      join organization_memberships om on om.organization_id = t.organization_id
      where t.id = att_team_coaches.team_id
        and om.user_id = auth.uid()::text
        and om.role in ('owner','admin')
    )
  )
  with check (
    exists (
      select 1 from att_teams t
      join organization_memberships om on om.organization_id = t.organization_id
      where t.id = att_team_coaches.team_id
        and om.user_id = auth.uid()::text
        and om.role in ('owner','admin')
    )
  );

-- Allow assigned coaches to manage sessions for their assigned teams
drop policy if exists "Assigned coaches manage sessions" on att_sessions;

create policy "Assigned coaches manage sessions"
  on att_sessions for all to authenticated
  using (
    exists (
      select 1 from att_team_coaches
      where team_id = att_sessions.team_id
        and user_id = auth.uid()::text
    )
  )
  with check (
    exists (
      select 1 from att_team_coaches
      where team_id = att_sessions.team_id
        and user_id = auth.uid()::text
    )
  );


-- ── 4. ATHLETE RPE IN TEAM SESSIONS ──────────────────────────────────────────
-- Athletes enter their actual RPE and duration after team sessions

alter table att_records add column if not exists rpe              integer;
alter table att_records add column if not exists actual_duration  integer;
alter table att_records add column if not exists rpe_submitted_at timestamptz;

-- Athletes can now update their own records (to enter RPE)
drop policy if exists "Athletes update own records for RPE" on att_records;

create policy "Athletes update own records for RPE"
  on att_records for update
  using  (athlete_user_id = auth.uid()::text)
  with check (athlete_user_id = auth.uid()::text);


-- ── 5. EVENT COACHES (multiple coaches per session) ───────────────────────────

create table if not exists event_coaches (
  id         text primary key,
  session_id text not null references att_sessions(id) on delete cascade,
  user_id    text not null,
  role       text not null default 'head_coach',
  created_at timestamptz default now(),
  unique(session_id, user_id)
);

alter table event_coaches enable row level security;

drop policy if exists "Anyone reads event coaches" on event_coaches;
drop policy if exists "Trainers manage event coaches" on event_coaches;

create policy "Anyone reads event coaches"
  on event_coaches for select using (true);

create policy "Trainers manage event coaches"
  on event_coaches for all to authenticated
  using (
    exists (select 1 from att_sessions where id = event_coaches.session_id and trainer_id = auth.uid()::text)
  )
  with check (
    exists (select 1 from att_sessions where id = event_coaches.session_id and trainer_id = auth.uid()::text)
  );


-- ── 6. EVENT TEAMS (multiple teams per session) ───────────────────────────────

create table if not exists event_teams (
  id         text primary key,
  session_id text not null references att_sessions(id) on delete cascade,
  team_id    text not null references att_teams(id) on delete cascade,
  created_at timestamptz default now(),
  unique(session_id, team_id)
);

alter table event_teams enable row level security;

drop policy if exists "Anyone reads event teams" on event_teams;
drop policy if exists "Trainers manage event teams" on event_teams;

create policy "Anyone reads event teams"
  on event_teams for select using (true);

create policy "Trainers manage event teams"
  on event_teams for all to authenticated
  using (
    exists (select 1 from att_sessions where id = event_teams.session_id and trainer_id = auth.uid()::text)
  )
  with check (
    exists (select 1 from att_sessions where id = event_teams.session_id and trainer_id = auth.uid()::text)
  );


-- ── 7. RECURRENCE RULES ───────────────────────────────────────────────────────

create table if not exists recurrence_rules (
  id         text primary key,
  rrule      text not null,
  created_at timestamptz default now()
);

alter table recurrence_rules enable row level security;

create policy "Anyone reads recurrence rules"
  on recurrence_rules for select using (true);

create policy "Authenticated creates recurrence rules"
  on recurrence_rules for insert to authenticated with check (true);


-- ── 8. UPDATE ATT_SESSIONS — allow dept-members to read ──────────────────────

drop policy if exists "Dept coaches read dept sessions" on att_sessions;

create policy "Dept coaches read dept sessions"
  on att_sessions for select
  using (
    department_id is not null
    and exists (
      select 1 from department_memberships
      where department_id = att_sessions.department_id
        and user_id = auth.uid()::text
    )
  );


-- ── 9. INDEXES ────────────────────────────────────────────────────────────────

create index if not exists dept_memberships_dept_idx  on department_memberships(department_id);
create index if not exists dept_memberships_user_idx  on department_memberships(user_id);
create index if not exists team_coaches_team_idx      on att_team_coaches(team_id);
create index if not exists team_coaches_user_idx      on att_team_coaches(user_id);
create index if not exists event_coaches_session_idx  on event_coaches(session_id);
create index if not exists event_teams_session_idx    on event_teams(session_id);
create index if not exists event_teams_team_idx       on event_teams(team_id);
create index if not exists att_records_rpe_idx        on att_records(athlete_user_id) where rpe is not null;


-- ── FERTIG ────────────────────────────────────────────────────────────────────
