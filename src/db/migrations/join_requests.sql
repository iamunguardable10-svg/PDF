-- Join Requests: athlete requests to join a team found via club search.
-- Coach must approve before the athlete is added as a team member.
--
-- Run this once in your Supabase SQL editor.

create table if not exists att_join_requests (
  id          text        primary key,
  team_id     text        not null references att_teams(id) on delete cascade,
  user_id     text        not null,
  user_name   text        not null,
  user_sport  text        not null default '',
  status      text        not null default 'pending'
                          check (status in ('pending', 'approved', 'rejected')),
  created_at  timestamptz not null default now(),
  reviewed_at timestamptz
);

-- Index for fast trainer lookups
create index if not exists att_join_requests_team_id_idx on att_join_requests(team_id);
create index if not exists att_join_requests_user_id_idx on att_join_requests(user_id);

-- RLS: anyone authenticated can insert their own requests
alter table att_join_requests enable row level security;

create policy "Athletes can insert own requests"
  on att_join_requests for insert
  with check (auth.uid()::text = user_id);

create policy "Athletes can view own requests"
  on att_join_requests for select
  using (auth.uid()::text = user_id);

create policy "Trainers can view requests for their teams"
  on att_join_requests for select
  using (
    exists (
      select 1 from att_teams
      where att_teams.id = att_join_requests.team_id
        and att_teams.trainer_id = auth.uid()::text
    )
  );

create policy "Trainers can update requests for their teams"
  on att_join_requests for update
  using (
    exists (
      select 1 from att_teams
      where att_teams.id = att_join_requests.team_id
        and att_teams.trainer_id = auth.uid()::text
    )
  );
