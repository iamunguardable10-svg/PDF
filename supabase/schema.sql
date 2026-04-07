-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query)

-- Profiles (extends auth.users 1:1)
create table if not exists profiles (
  id                   uuid primary key references auth.users on delete cascade,
  name                 text,
  sport                text,
  level                text,
  weight               numeric,
  height               numeric,
  age                  integer,
  gender               text,
  weekly_trainings     integer,
  primary_goal         text,
  dietary_preferences  text,
  onboarding_completed boolean default false,
  updated_at           timestamptz default now()
);

-- Sessions (completed workouts)
create table if not exists sessions (
  id         text primary key,
  user_id    uuid not null references auth.users on delete cascade,
  name       text,
  datum      date not null,
  te         text not null,
  rpe        integer,
  dauer      integer,
  tl         integer,
  created_at timestamptz default now()
);

-- Planned sessions (future / unconfirmed)
create table if not exists planned_sessions (
  id                  text primary key,
  user_id             uuid not null references auth.users on delete cascade,
  datum               date not null,
  te                  text not null,
  uhrzeit             text,
  geschaetzte_dauer   integer,
  notiz               text,
  confirmed           boolean default false,
  reminder_scheduled  boolean default false,
  rpe                 integer,
  actual_dauer        integer,
  created_at          timestamptz default now()
);

-- Food log entries
create table if not exists food_log (
  id         text primary key,
  user_id    uuid not null references auth.users on delete cascade,
  date       date not null,
  is_drink   boolean default false,
  meal_type  text,
  drink_type text,
  name       text not null,
  calories   numeric,
  protein    numeric,
  carbs      numeric,
  fat        numeric,
  amount     text,
  source     text,
  barcode    text,
  created_at timestamptz default now()
);

-- Trainer shares — live read-only access for coaches
create table if not exists trainer_shares (
  id         text primary key,       -- random token used in URL
  user_id    uuid not null references auth.users on delete cascade,
  created_at timestamptz default now(),
  is_active  boolean default true
);

-- Row-level security: each user sees only their own rows
alter table profiles         enable row level security;
alter table sessions         enable row level security;
alter table planned_sessions enable row level security;
alter table food_log         enable row level security;
alter table trainer_shares   enable row level security;

create policy "own profile"          on profiles         for all using (auth.uid() = id);
create policy "own sessions"         on sessions         for all using (auth.uid() = user_id);
create policy "own planned_sessions" on planned_sessions for all using (auth.uid() = user_id);
create policy "own food_log"         on food_log         for all using (auth.uid() = user_id);
create policy "own shares"           on trainer_shares   for all using (auth.uid() = user_id);

-- RPC: trainers call this with their token — SECURITY DEFINER bypasses RLS
-- so a trainer (unauthenticated anon) can read the athlete's data via valid token.
create or replace function get_trainer_data(share_token text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  result    json;
begin
  -- Validate token
  select user_id into v_user_id
  from trainer_shares
  where id = share_token and is_active = true;

  if v_user_id is null then
    return null;
  end if;

  select json_build_object(
    'profile',
      (select row_to_json(p) from profiles p where p.id = v_user_id),
    'sessions',
      coalesce(
        (select json_agg(s order by s.datum desc)
         from sessions s where s.user_id = v_user_id),
        '[]'::json
      ),
    'plannedSessions',
      coalesce(
        (select json_agg(ps order by ps.datum)
         from planned_sessions ps
         where ps.user_id = v_user_id and ps.confirmed = false),
        '[]'::json
      )
  ) into result;

  return result;
end;
$$;

-- Allow unauthenticated (trainer) access to this function
grant execute on function get_trainer_data(text) to anon;
