-- RLS policies for organizations, departments, and organization_memberships.
-- Run once in Supabase SQL Editor if org creation fails with permission errors.

-- ── Organizations ────────────────────────────────────────────────────────────

-- Any authenticated user can create an organization
create policy if not exists "Authenticated users can create organizations"
  on organizations for insert
  to authenticated
  with check (true);

-- Anyone can read organizations (needed for search)
create policy if not exists "Anyone can read organizations"
  on organizations for select
  using (true);

-- Only org owners/admins can update their org
create policy if not exists "Org owners can update"
  on organizations for update
  using (
    exists (
      select 1 from organization_memberships
      where organization_memberships.organization_id = organizations.id
        and organization_memberships.user_id = auth.uid()::text
        and organization_memberships.role in ('owner', 'admin')
    )
  );

-- ── Organization Memberships ─────────────────────────────────────────────────

-- Users can insert their own membership (needed when creating org)
create policy if not exists "Users can add themselves as member"
  on organization_memberships for insert
  to authenticated
  with check (user_id = auth.uid()::text);

-- Owners/admins can add other members
create policy if not exists "Owners can add members"
  on organization_memberships for insert
  to authenticated
  with check (
    exists (
      select 1 from organization_memberships om
      where om.organization_id = organization_memberships.organization_id
        and om.user_id = auth.uid()::text
        and om.role in ('owner', 'admin')
    )
  );

-- Members can read memberships of orgs they belong to
create policy if not exists "Members can read org memberships"
  on organization_memberships for select
  using (
    user_id = auth.uid()::text
    or exists (
      select 1 from organization_memberships om
      where om.organization_id = organization_memberships.organization_id
        and om.user_id = auth.uid()::text
    )
  );

-- ── Departments ──────────────────────────────────────────────────────────────

-- Org owners/admins can create departments
create policy if not exists "Org admins can create departments"
  on departments for insert
  to authenticated
  with check (
    exists (
      select 1 from organization_memberships
      where organization_memberships.organization_id = departments.organization_id
        and organization_memberships.user_id = auth.uid()::text
        and organization_memberships.role in ('owner', 'admin')
    )
  );

-- Anyone can read departments (needed for calendar views)
create policy if not exists "Anyone can read departments"
  on departments for select
  using (true);

-- ── Facilities ───────────────────────────────────────────────────────────────

create policy if not exists "Org members can create facilities"
  on facilities for insert
  to authenticated
  with check (
    exists (
      select 1 from organization_memberships
      where organization_memberships.organization_id = facilities.organization_id
        and organization_memberships.user_id = auth.uid()::text
    )
  );

create policy if not exists "Anyone can read facilities"
  on facilities for select
  using (true);

create policy if not exists "Org members can create facility units"
  on facility_units for insert
  to authenticated
  with check (
    exists (
      select 1 from facilities f
      join organization_memberships om on om.organization_id = f.organization_id
      where f.id = facility_units.facility_id
        and om.user_id = auth.uid()::text
    )
  );

create policy if not exists "Anyone can read facility units"
  on facility_units for select
  using (true);
