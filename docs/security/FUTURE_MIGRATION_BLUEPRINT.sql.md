# Future Migration Blueprint (Not Executed)

IMPORTANT:

This file is intentionally documentation-only.

Do NOT execute these statements blindly.

They are draft examples for future controlled migration work after smoke tests are prepared.

---

# Example 1 — Fix defective athlete session read policy

Potential current defective policy:

```sql
create policy "session athlete reads"
on public.att_sessions
for select
using (
  exists (
    select 1
    from att_session_athletes
    where att_session_athletes.session_id = att_session_athletes.id
      and att_session_athletes.athlete_user_id = auth.uid()::text
  )
);
```

Potential replacement:

```sql
drop policy if exists "session athlete reads" on public.att_sessions;

create policy athlete_select_assigned_sessions
on public.att_sessions
for select
using (
  exists (
    select 1
    from att_session_athletes
    where att_session_athletes.session_id = att_sessions.id
      and att_session_athletes.athlete_user_id = auth.uid()::text
  )
);
```

---

# Example 2 — Consolidate duplicate trainer-owned session policies

Potential current duplicates:

```text
trainer manages own sessions
trainer owns session
```

Potential replacement:

```sql
create policy coach_manage_own_sessions
on public.att_sessions
for all
using (
  trainer_id = auth.uid()::text
)
with check (
  trainer_id = auth.uid()::text
);
```

Only remove old policies after:

- athlete flows tested
- coach flows tested
- attendance flows tested

---

# Example 3 — Split message read vs write permissions

Avoid broad `ALL` policies.

Potential direction:

```sql
create policy session_participants_select_messages
on public.att_session_messages
for select
using (
  exists (
    select 1
    from att_session_athletes sa
    where sa.session_id = att_session_messages.session_id
      and sa.athlete_user_id = auth.uid()::text
  )
  or exists (
    select 1
    from att_sessions s
    where s.id = att_session_messages.session_id
      and s.trainer_id = auth.uid()::text
  )
);
```

```sql
create policy session_participants_insert_own_messages
on public.att_session_messages
for insert
with check (
  sender_user_id = auth.uid()::text
);
```

---

# Example 4 — Restrict broad invite reads

Potential future direction:

```sql
create policy anon_select_invite_by_token
on public.trainer_invites
for select
using (
  expires_at > now()
  and accepted = false
);
```

Future improvement:

- token-scoped views/RPCs instead of broad table reads

---

# Example 5 — Future helper authorization functions

Potential helper:

```sql
create or replace function public.is_team_coach(p_team_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from att_teams
    where id = p_team_id
      and trainer_id = auth.uid()::text
  );
$$;
```

Potential helper:

```sql
create or replace function public.is_team_member(p_team_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from att_team_members
    where team_id = p_team_id
      and athlete_user_id = auth.uid()::text
  );
$$;
```

These helpers can later simplify policies and reduce duplication.

---

# Important operational rule

Before any migration:

1. create migration file
2. run smoke tests locally/staging
3. verify athlete hydration
4. verify coach dashboards
5. verify invite/share links
6. verify attendance persistence
7. verify load calculations still hydrate correctly

Only then deploy.
