-- Sprint 5 — Lock it down: auth, roles, and owner-scoped RLS.
-- Applies on top of 0001 (never edit 0001). Assumes Supabase's built-in
-- `auth` schema (auth.users, auth.uid()) exists.

-- ── Profiles + roles ─────────────────────────────────────────────────────────
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'Manager'
    check (role in ('Manager', 'Head', 'Approver', 'Reviewer', 'Admin')),
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

-- Auto-create a profile when a user signs up. Role and full_name come from the
-- signup metadata (in production these are provisioned by Admin / the IdP; the
-- demo signup form lets the user pick a role). Defaults to Manager.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    coalesce(new.raw_user_meta_data ->> 'role', 'Manager')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Role helpers (security definer, avoid RLS recursion on profiles) ─────────
create or replace function public.current_role_name()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- Roles that may read every deal (Head, Approver, Reviewer, Admin).
create or replace function public.can_read_all()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_role_name() in ('Head', 'Approver', 'Reviewer', 'Admin'), false);
$$;

create or replace function public.is_head()
returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(public.current_role_name() = 'Head', false); $$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(public.current_role_name() = 'Admin', false); $$;

-- Managers and the Head may create/edit deal data; other roles are read-only.
create or replace function public.can_edit_deals()
returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(public.current_role_name() in ('Manager', 'Head'), false); $$;

-- Owns-or-can-read-all check for a given deal id.
create or replace function public.can_access_deal(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_read_all()
    or exists (
      select 1 from public.deals d
      where d.id = target and d.user_id = auth.uid()
    );
$$;

create or replace function public.can_edit_deal(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_head()
    or (
      public.current_role_name() = 'Manager'
      and exists (
        select 1 from public.deals d
        where d.id = target and d.user_id = auth.uid()
      )
    );
$$;

-- Link deals to auth users now that we have them (still nullable: seed rows
-- from 0001 have no owner and are visible to Head/Approver/Reviewer/Admin).
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'deals_user_id_fkey' and table_name = 'deals'
  ) then
    alter table deals
      add constraint deals_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete set null;
  end if;
end $$;

-- ── Profiles policies ────────────────────────────────────────────────────────
drop policy if exists "profiles_read" on profiles;
drop policy if exists "profiles_read" on profiles;
create policy "profiles_read" on profiles for select
  using (id = auth.uid() or public.is_head() or public.is_admin());

drop policy if exists "profiles_self_insert" on profiles;
drop policy if exists "profiles_self_insert" on profiles;
create policy "profiles_self_insert" on profiles for insert
  with check (id = auth.uid());

-- Users may edit their own name; only Admin may change roles (enforced in the
-- Admin UI server action; this policy lets Admin update any profile).
drop policy if exists "profiles_self_update" on profiles;
drop policy if exists "profiles_self_update" on profiles;
create policy "profiles_self_update" on profiles for update
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- ── Replace the permissive v1 deal policies with owner-scoped ones ──────────
drop policy if exists "deals_v1_read" on deals;
drop policy if exists "deals_v1_write" on deals;

drop policy if exists "deals_read" on deals;
create policy "deals_read" on deals for select
  using (public.can_read_all() or user_id = auth.uid());

drop policy if exists "deals_insert" on deals;
create policy "deals_insert" on deals for insert
  with check (
    public.is_head()
    or (public.current_role_name() = 'Manager' and user_id = auth.uid())
  );

drop policy if exists "deals_update" on deals;
create policy "deals_update" on deals for update
  using (public.is_head() or (public.current_role_name() = 'Manager' and user_id = auth.uid()))
  with check (public.is_head() or (public.current_role_name() = 'Manager' and user_id = auth.uid()));
-- No delete policy: deals are never deleted (terminal states are Killed/Parked).

-- ── Child tables: scoped by parent deal access ──────────────────────────────
-- evidence_items
drop policy if exists "evidence_items_v1_read" on evidence_items;
drop policy if exists "evidence_items_v1_write" on evidence_items;
drop policy if exists "evidence_read" on evidence_items;
create policy "evidence_read" on evidence_items for select
  using (public.can_access_deal(deal_id));
drop policy if exists "evidence_write" on evidence_items;
create policy "evidence_write" on evidence_items for all
  using (public.can_edit_deal(deal_id))
  with check (public.can_edit_deal(deal_id));

-- stage_outputs
drop policy if exists "stage_outputs_v1_read" on stage_outputs;
drop policy if exists "stage_outputs_v1_write" on stage_outputs;
drop policy if exists "stage_outputs_read" on stage_outputs;
create policy "stage_outputs_read" on stage_outputs for select
  using (public.can_access_deal(deal_id));
drop policy if exists "stage_outputs_write" on stage_outputs;
create policy "stage_outputs_write" on stage_outputs for all
  using (public.can_edit_deal(deal_id))
  with check (public.can_edit_deal(deal_id));

-- contact_reports
drop policy if exists "contact_reports_v1_read" on contact_reports;
drop policy if exists "contact_reports_v1_write" on contact_reports;
drop policy if exists "contact_reports_read" on contact_reports;
create policy "contact_reports_read" on contact_reports for select
  using (public.can_access_deal(deal_id));
drop policy if exists "contact_reports_write" on contact_reports;
create policy "contact_reports_write" on contact_reports for all
  using (public.can_edit_deal(deal_id))
  with check (public.can_edit_deal(deal_id));

-- escalations: readable by anyone who can see the deal; Approvers (and Head)
-- resolve them. Insert allowed for deal editors + Head (auto-created on save).
drop policy if exists "escalations_v1_read" on escalations;
drop policy if exists "escalations_v1_write" on escalations;
drop policy if exists "escalations_read" on escalations;
create policy "escalations_read" on escalations for select
  using (public.can_access_deal(deal_id));
drop policy if exists "escalations_insert" on escalations;
create policy "escalations_insert" on escalations for insert
  with check (public.can_edit_deal(deal_id));
drop policy if exists "escalations_update" on escalations;
create policy "escalations_update" on escalations for update
  using (public.current_role_name() in ('Approver', 'Head'))
  with check (public.current_role_name() in ('Approver', 'Head'));

-- lessons
drop policy if exists "lessons_v1_read" on lessons;
drop policy if exists "lessons_v1_write" on lessons;
drop policy if exists "lessons_read" on lessons;
create policy "lessons_read" on lessons for select
  using (public.can_read_all() or public.can_access_deal(deal_id));
drop policy if exists "lessons_write" on lessons;
create policy "lessons_write" on lessons for all
  using (public.can_edit_deal(deal_id))
  with check (public.can_edit_deal(deal_id));

-- stall_reviews: visible with the deal; only the Head may write a decision.
drop policy if exists "stall_reviews_v1_read" on stall_reviews;
drop policy if exists "stall_reviews_v1_write" on stall_reviews;
drop policy if exists "stall_reviews_read" on stall_reviews;
create policy "stall_reviews_read" on stall_reviews for select
  using (public.can_access_deal(deal_id));
drop policy if exists "stall_reviews_insert" on stall_reviews;
create policy "stall_reviews_insert" on stall_reviews for insert
  with check (public.can_read_all());
drop policy if exists "stall_reviews_update" on stall_reviews;
create policy "stall_reviews_update" on stall_reviews for update
  using (public.is_head())
  with check (public.is_head());

-- audit_events: immutable. Readable within deal scope; insertable by any
-- authenticated actor; NO update or delete policy for any role, ever.
drop policy if exists "audit_events_v1_read" on audit_events;
drop policy if exists "audit_events_v1_write" on audit_events;
drop policy if exists "audit_events_read" on audit_events;
create policy "audit_events_read" on audit_events for select
  using (deal_id is null or public.can_access_deal(deal_id) or public.can_read_all());
drop policy if exists "audit_events_insert" on audit_events;
create policy "audit_events_insert" on audit_events for insert
  with check (auth.uid() is not null);

-- prompt_templates: everyone signed in reads the active template; only Admin
-- inserts a new version or toggles active (never overwrites — new row per edit).
drop policy if exists "prompt_templates_v1_read" on prompt_templates;
drop policy if exists "prompt_templates_v1_write" on prompt_templates;
drop policy if exists "prompt_templates_read" on prompt_templates;
create policy "prompt_templates_read" on prompt_templates for select
  using (auth.uid() is not null);
drop policy if exists "prompt_templates_insert" on prompt_templates;
create policy "prompt_templates_insert" on prompt_templates for insert
  with check (public.is_admin());
drop policy if exists "prompt_templates_update" on prompt_templates;
create policy "prompt_templates_update" on prompt_templates for update
  using (public.is_admin())
  with check (public.is_admin());
