-- TeamLoad Supabase Persistence V1
--
-- Purpose:
-- Store athlete availability exceptions and coach-final attendance in att_records.
-- This keeps one operational record per session x athlete while preserving the
-- existing local/demo fallback in the app.
--
-- Run this in Supabase SQL editor before expecting cross-device persistence.

alter table public.att_records
  add column if not exists override_status text check (override_status in ('maybe', 'no', 'late', 'expected')),
  add column if not exists absence_reason text default '',
  add column if not exists late_minutes integer check (late_minutes is null or (late_minutes >= 1 and late_minutes <= 240)),
  add column if not exists override_at timestamptz,
  add column if not exists final_status text check (final_status in ('present', 'late', 'partial', 'excused_absent', 'unexcused_absent')),
  add column if not exists finalized_at timestamptz,
  add column if not exists final_note text default '',
  add column if not exists minutes_participated integer check (minutes_participated is null or (minutes_participated >= 1 and minutes_participated <= 240));

create index if not exists att_records_session_athlete_user_idx
  on public.att_records (session_id, athlete_user_id);

create index if not exists att_records_session_athlete_roster_idx
  on public.att_records (session_id, athlete_roster_id);

create index if not exists att_records_override_status_idx
  on public.att_records (override_status)
  where override_status is not null;

create index if not exists att_records_final_status_idx
  on public.att_records (final_status)
  where final_status is not null;

-- Optional sanity checks after migration:
-- select column_name, data_type
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name = 'att_records'
--   and column_name in (
--     'override_status', 'absence_reason', 'late_minutes', 'override_at',
--     'final_status', 'finalized_at', 'final_note', 'minutes_participated'
--   )
-- order by column_name;

-- RLS note:
-- Existing att_records RLS policies must allow:
-- 1. Athletes to update their own override_status / absence_reason / late_minutes / override_at.
-- 2. Coaches who own or manage a session/team to update final_status / finalized_at / final_note / minutes_participated.
--
-- If current policies are too restrictive, writes will fail safely in the app and localStorage fallback remains active,
-- but cross-device persistence will not work until policies are adjusted.
