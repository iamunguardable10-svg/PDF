-- ============================================================
-- CLUB OS — COMPLETE SCHEMA
-- Run once in Supabase SQL Editor.
-- WARNING: drops and recreates all app tables (auth.users untouched).
-- ============================================================


-- ── 0. DROP EXISTING TABLES (clean slate) ────────────────────────────────────

drop table if exists att_join_requests          cascade;
drop table if exists event_facility_bookings    cascade;
drop table if exists facility_blackouts         cascade;
drop table if exists facility_units             cascade;
drop table if exists facilities                 cascade;
drop table if exists department_memberships     cascade;
drop table if exists organization_memberships   cascade;
drop table if exists departments                cascade;
drop table if exists organizations              cascade;
drop table if exists att_records                cascade;
drop table if exists att_session_athletes       cascade;
drop table if exists att_sessions               cascade;
drop table if exists att_team_members           cascade;
drop table if exists att_teams                  cascade;
drop table if exists profiles                   cascade;


-- ── 1. PROFILES ──────────────────────────────────────────────────────────────

create table profiles (
  id               text primary key,   -- = auth.uid()
  name             text,
  age              int,
  weight           numeric,
  height           numeric,
  sport            text,
  position         text,
  weekly_trainings int  default 3,
  resting_hr       int,
  max_hr           int,
  goal             text,
  onboarding_done  boolean default false,
  updated_at       timestamptz default now()
);

alter table profiles enable row level security;

create policy "Users manage own profile"
  on profiles for all
  using  (auth.uid()::text = id)
  with check (auth.uid()::text = id);


-- ── 2. ORGANIZATIONS & DEPARTMENTS ───────────────────────────────────────────

create table organizations (
  id         text primary key,
  name       text not null,
  slug       text not null unique,
  sport      text,
  created_at timestamptz default now()
);

alter table organizations enable row level security;

create policy "Anyone can read organizations"
  on organizations for select using (true);

create policy "Authenticated users can create organizations"
  on organizations for insert
  to authenticated
  with check (true);

create policy "Org owners can update"
  on organizations for update
  using (
    exists (
      select 1 from organization_memberships
      where organization_id = organizations.id
        and user_id = auth.uid()::text
        and role in ('owner','admin')
    )
  );


create table organization_memberships (
  id              text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  user_id         text not null,
  role            text not null default 'member'
                  check (role in ('owner','admin','member')),
  joined_at       timestamptz default now()
);

alter table organization_memberships enable row level security;

create policy "Users read own memberships"
  on organization_memberships for select
  using (user_id = auth.uid()::text);

create policy "Org members read all memberships"
  on organization_memberships for select
  using (
    exists (
      select 1 from organization_memberships om
      where om.organization_id = organization_memberships.organization_id
        and om.user_id = auth.uid()::text
    )
  );

create policy "Users can add themselves"
  on organization_memberships for insert
  to authenticated
  with check (user_id = auth.uid()::text);

create policy "Owners can add others"
  on organization_memberships for insert
  to authenticated
  with check (
    exists (
      select 1 from organization_memberships om
      where om.organization_id = organization_memberships.organization_id
        and om.user_id = auth.uid()::text
        and om.role in ('owner','admin')
    )
  );


create table departments (
  id              text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  name            text not null,
  sport           text,
  created_at      timestamptz default now()
);

alter table departments enable row level security;

create policy "Anyone can read departments"
  on departments for select using (true);

create policy "Org members can create departments"
  on departments for insert
  to authenticated
  with check (
    exists (
      select 1 from organization_memberships
      where organization_id = departments.organization_id
        and user_id = auth.uid()::text
    )
  );


create table department_memberships (
  id            text primary key,
  department_id text not null references departments(id) on delete cascade,
  user_id       text not null,
  role          text not null default 'member'
                check (role in ('admin','member')),
  joined_at     timestamptz default now()
);

alter table department_memberships enable row level security;

create policy "Users read own dept memberships"
  on department_memberships for select
  using (user_id = auth.uid()::text);

create policy "Users can join departments"
  on department_memberships for insert
  to authenticated
  with check (user_id = auth.uid()::text);


-- ── 3. TEAMS ─────────────────────────────────────────────────────────────────

create table att_teams (
  id              text primary key,
  trainer_id      text not null,
  name            text not null,
  sport           text not null default '',
  color           text not null default '#7c3aed',
  invite_token    text unique,
  invite_active   boolean default true,
  organization_id text references organizations(id) on delete set null,
  department_id   text references departments(id)   on delete set null,
  created_at      timestamptz default now()
);

alter table att_teams enable row level security;

create policy "Trainers manage their own teams"
  on att_teams for all
  using  (trainer_id = auth.uid()::text)
  with check (trainer_id = auth.uid()::text);

create policy "Athletes can read teams they belong to"
  on att_teams for select
  using (
    exists (
      select 1 from att_team_members
      where team_id = att_teams.id
        and athlete_user_id = auth.uid()::text
    )
  );

create policy "Anyone can read teams for invite flow"
  on att_teams for select
  using (invite_active = true);


create table att_team_members (
  id               text primary key,
  team_id          text not null references att_teams(id) on delete cascade,
  athlete_user_id  text,
  athlete_roster_id text,
  name             text not null,
  sport            text not null default '',
  joined_at        timestamptz default now()
);

alter table att_team_members enable row level security;

create policy "Trainers manage members of their teams"
  on att_team_members for all
  using (
    exists (
      select 1 from att_teams
      where id = att_team_members.team_id
        and trainer_id = auth.uid()::text
    )
  )
  with check (
    exists (
      select 1 from att_teams
      where id = att_team_members.team_id
        and trainer_id = auth.uid()::text
    )
  );

create policy "Athletes read/write their own membership"
  on att_team_members for all
  using  (athlete_user_id = auth.uid()::text)
  with check (athlete_user_id = auth.uid()::text);


-- ── 4. SESSIONS ──────────────────────────────────────────────────────────────

create table att_sessions (
  id                 text primary key,
  trainer_id         text not null,
  title              text not null default '',
  description        text not null default '',
  datum              text not null,           -- YYYY-MM-DD (legacy)
  start_time         text,                    -- HH:MM (legacy)
  end_time           text,                    -- HH:MM (legacy)
  location           text not null default '',
  lat                numeric,
  lng                numeric,
  radius_m           int  default 100,
  team_id            text references att_teams(id) on delete set null,
  training_type      text not null default '',
  coach_note         text not null default '',
  -- New model (additive)
  starts_at          timestamptz,
  ends_at            timestamptz,
  organization_id    text references organizations(id) on delete set null,
  department_id      text references departments(id)   on delete set null,
  recurrence_rule_id text,
  created_at         timestamptz default now()
);

alter table att_sessions enable row level security;

create policy "Trainers manage their sessions"
  on att_sessions for all
  using  (trainer_id = auth.uid()::text)
  with check (trainer_id = auth.uid()::text);

create policy "Athletes read sessions they are in"
  on att_sessions for select
  using (
    exists (
      select 1 from att_session_athletes
      where session_id = att_sessions.id
        and athlete_user_id = auth.uid()::text
    )
  );


create table att_session_athletes (
  id                text primary key,
  session_id        text not null references att_sessions(id) on delete cascade,
  athlete_user_id   text,
  athlete_roster_id text,
  name              text not null
);

alter table att_session_athletes enable row level security;

create policy "Trainers manage session athletes"
  on att_session_athletes for all
  using (
    exists (
      select 1 from att_sessions
      where id = att_session_athletes.session_id
        and trainer_id = auth.uid()::text
    )
  )
  with check (
    exists (
      select 1 from att_sessions
      where id = att_session_athletes.session_id
        and trainer_id = auth.uid()::text
    )
  );

create policy "Athletes read their own session entries"
  on att_session_athletes for select
  using (athlete_user_id = auth.uid()::text);


-- ── 5. ATTENDANCE RECORDS ─────────────────────────────────────────────────────

create table att_records (
  id                  text primary key,
  session_id          text not null references att_sessions(id) on delete cascade,
  athlete_user_id     text,
  athlete_roster_id   text,
  athlete_name        text not null,
  -- Athlete override (pre-session)
  override_status     text check (override_status in ('maybe','no','late')),
  absence_reason      text check (absence_reason in ('verletzt','krank','schule','arbeit','privat','sonstiges')),
  absence_note        text not null default '',
  override_at         timestamptz,
  -- GPS
  check1_at           timestamptz,
  check1_detected     boolean,
  check2_at           timestamptz,
  check2_detected     boolean,
  location_suggestion text check (location_suggestion in ('present','late','absent')),
  -- Trainer final
  final_status        text check (final_status in ('present','late','partial','excused_absent','unexcused_absent')),
  finalized_at        timestamptz
);

alter table att_records enable row level security;

create policy "Trainers manage records for their sessions"
  on att_records for all
  using (
    exists (
      select 1 from att_sessions
      where id = att_records.session_id
        and trainer_id = auth.uid()::text
    )
  )
  with check (
    exists (
      select 1 from att_sessions
      where id = att_records.session_id
        and trainer_id = auth.uid()::text
    )
  );

create policy "Athletes manage their own records"
  on att_records for all
  using  (athlete_user_id = auth.uid()::text)
  with check (athlete_user_id = auth.uid()::text);


-- ── 6. FACILITIES ─────────────────────────────────────────────────────────────

create table facilities (
  id              text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  name            text not null,
  address         text,
  created_at      timestamptz default now()
);

alter table facilities enable row level security;

create policy "Anyone can read facilities"
  on facilities for select using (true);

create policy "Org members can manage facilities"
  on facilities for all
  to authenticated
  using (
    exists (
      select 1 from organization_memberships
      where organization_id = facilities.organization_id
        and user_id = auth.uid()::text
    )
  )
  with check (
    exists (
      select 1 from organization_memberships
      where organization_id = facilities.organization_id
        and user_id = auth.uid()::text
    )
  );

-- Trainers whose teams belong to the org can also manage facilities
create policy "Trainers can manage org facilities"
  on facilities for all
  to authenticated
  using (
    exists (
      select 1 from att_teams
      where organization_id = facilities.organization_id
        and trainer_id = auth.uid()::text
    )
  )
  with check (
    exists (
      select 1 from att_teams
      where organization_id = facilities.organization_id
        and trainer_id = auth.uid()::text
    )
  );


create table facility_units (
  id          text primary key,
  facility_id text not null references facilities(id) on delete cascade,
  name        text not null,
  capacity    int,
  created_at  timestamptz default now()
);

alter table facility_units enable row level security;

create policy "Anyone can read facility units"
  on facility_units for select using (true);

create policy "Trainers can manage units of their org facilities"
  on facility_units for all
  to authenticated
  using (
    exists (
      select 1 from facilities f
      join att_teams t on t.organization_id = f.organization_id
      where f.id = facility_units.facility_id
        and t.trainer_id = auth.uid()::text
    )
  )
  with check (
    exists (
      select 1 from facilities f
      join att_teams t on t.organization_id = f.organization_id
      where f.id = facility_units.facility_id
        and t.trainer_id = auth.uid()::text
    )
  );


create table facility_blackouts (
  id               text primary key,
  facility_id      text not null references facilities(id) on delete cascade,
  facility_unit_id text references facility_units(id) on delete cascade,
  title            text not null,
  reason           text,
  blackout_type    text,
  starts_at        timestamptz not null,
  ends_at          timestamptz not null,
  created_at       timestamptz default now()
);

alter table facility_blackouts enable row level security;

create policy "Anyone can read blackouts"
  on facility_blackouts for select using (true);

create policy "Trainers can manage blackouts"
  on facility_blackouts for all
  to authenticated
  using (
    exists (
      select 1 from facilities f
      join att_teams t on t.organization_id = f.organization_id
      where f.id = facility_blackouts.facility_id
        and t.trainer_id = auth.uid()::text
    )
  )
  with check (
    exists (
      select 1 from facilities f
      join att_teams t on t.organization_id = f.organization_id
      where f.id = facility_blackouts.facility_id
        and t.trainer_id = auth.uid()::text
    )
  );


create table event_facility_bookings (
  id               text primary key default gen_random_uuid()::text,
  session_id       text not null references att_sessions(id) on delete cascade,
  facility_unit_id text not null references facility_units(id) on delete cascade,
  starts_at        timestamptz not null,
  ends_at          timestamptz not null,
  created_at       timestamptz default now(),
  unique (session_id)
);

alter table event_facility_bookings enable row level security;

create policy "Anyone can read bookings"
  on event_facility_bookings for select using (true);

create policy "Trainers manage bookings for their sessions"
  on event_facility_bookings for all
  to authenticated
  using (
    exists (
      select 1 from att_sessions
      where id = event_facility_bookings.session_id
        and trainer_id = auth.uid()::text
    )
  )
  with check (
    exists (
      select 1 from att_sessions
      where id = event_facility_bookings.session_id
        and trainer_id = auth.uid()::text
    )
  );


-- ── 7. JOIN REQUESTS ──────────────────────────────────────────────────────────

create table att_join_requests (
  id          text primary key,
  team_id     text not null references att_teams(id) on delete cascade,
  user_id     text not null,
  user_name   text not null,
  user_sport  text not null default '',
  status      text not null default 'pending'
              check (status in ('pending','approved','rejected')),
  created_at  timestamptz default now(),
  reviewed_at timestamptz
);

alter table att_join_requests enable row level security;

create policy "Athletes can send join requests"
  on att_join_requests for insert
  to authenticated
  with check (user_id = auth.uid()::text);

create policy "Athletes read own requests"
  on att_join_requests for select
  using (user_id = auth.uid()::text);

create policy "Trainers read requests for their teams"
  on att_join_requests for select
  using (
    exists (
      select 1 from att_teams
      where id = att_join_requests.team_id
        and trainer_id = auth.uid()::text
    )
  );

create policy "Trainers update requests for their teams"
  on att_join_requests for update
  using (
    exists (
      select 1 from att_teams
      where id = att_join_requests.team_id
        and trainer_id = auth.uid()::text
    )
  );


-- ── 8. INDEXES ───────────────────────────────────────────────────────────────

create index att_sessions_trainer_id_idx       on att_sessions(trainer_id);
create index att_sessions_team_id_idx          on att_sessions(team_id);
create index att_sessions_datum_idx            on att_sessions(datum);
create index att_sessions_department_id_idx    on att_sessions(department_id);
create index att_team_members_team_id_idx      on att_team_members(team_id);
create index att_team_members_user_id_idx      on att_team_members(athlete_user_id);
create index att_records_session_id_idx        on att_records(session_id);
create index att_records_user_id_idx           on att_records(athlete_user_id);
create index att_session_athletes_session_idx  on att_session_athletes(session_id);
create index att_session_athletes_user_idx     on att_session_athletes(athlete_user_id);
create index att_join_requests_team_id_idx     on att_join_requests(team_id);
create index att_join_requests_user_id_idx     on att_join_requests(user_id);
create index org_memberships_org_idx           on organization_memberships(organization_id);
create index org_memberships_user_idx          on organization_memberships(user_id);
create index facility_bookings_unit_idx        on event_facility_bookings(facility_unit_id);
create index facility_bookings_session_idx     on event_facility_bookings(session_id);
create index facility_units_facility_idx       on facility_units(facility_id);
create index facility_blackouts_facility_idx   on facility_blackouts(facility_id);


-- ── 9. RPC: roster team memberships ──────────────────────────────────────────
-- Used by loadMyTeamMemberships to find roster-linked athlete memberships.

create or replace function get_roster_team_memberships(p_user_id text)
returns setof att_team_members
language sql
security definer
as $$
  select m.*
  from att_team_members m
  join profiles p on p.id = p_user_id
  where m.athlete_roster_id is not null
    and m.athlete_user_id is null
    and m.name ilike '%' || coalesce(p.name, '') || '%'
    and coalesce(p.name, '') != '';
$$;


-- ── DONE ─────────────────────────────────────────────────────────────────────
-- All tables created. You can now use the app fresh.
