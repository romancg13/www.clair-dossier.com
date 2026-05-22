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
    nullif(new.raw_user_meta_data->>'full_name', ''),
    'client'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles
  for insert
  to authenticated
  with check (id = auth.uid());

drop policy if exists "admin_update_demo_requests" on public.demo_requests;
create policy "admin_update_demo_requests"
  on public.demo_requests
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admin_update_newsletter" on public.newsletter_subscribers;
create policy "admin_update_newsletter"
  on public.newsletter_subscribers
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

comment on function public.handle_new_user() is
  'Creates a minimal client profile after Supabase Auth signup; roles must be elevated by an administrator.';
