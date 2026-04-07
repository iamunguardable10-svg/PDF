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

-- Row-level security: each user sees only their own rows
alter table profiles        enable row level security;
alter table sessions        enable row level security;
alter table planned_sessions enable row level security;
alter table food_log        enable row level security;

create policy "own profile"          on profiles         for all using (auth.uid() = id);
create policy "own sessions"         on sessions         for all using (auth.uid() = user_id);
create policy "own planned_sessions" on planned_sessions for all using (auth.uid() = user_id);
create policy "own food_log"         on food_log         for all using (auth.uid() = user_id);
