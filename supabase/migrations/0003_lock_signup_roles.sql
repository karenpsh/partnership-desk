-- Lock down signup role self-assignment (security hardening).
--
-- Before this, handle_new_user() trusted a `role` value in the signup metadata,
-- so anyone could self-assign Admin/Head — including by calling Supabase Auth's
-- signup endpoint directly with the anon key, bypassing the app entirely.
--
-- Now the database decides the role authoritatively: the very first account
-- bootstraps as Admin; every subsequent signup is a Manager. Client-supplied
-- role metadata is ignored. Roles are elevated only via the Admin UI thereafter
-- (which runs through the service role / is_admin() policy).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assigned_role text;
begin
  if not exists (select 1 from public.profiles) then
    assigned_role := 'Admin';    -- bootstrap the first user
  else
    assigned_role := 'Manager';  -- everyone else; elevate via the Admin page
  end if;

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    assigned_role
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
