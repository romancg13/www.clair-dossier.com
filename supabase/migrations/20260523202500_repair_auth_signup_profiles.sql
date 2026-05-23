create extension if not exists pgcrypto;

alter table public.profiles add column if not exists account_type text;

alter table public.profiles drop constraint if exists profiles_role_check;
update public.profiles
set role = case role
  when 'client' then 'client_particulier'
  when 'lawyer' then 'avocat'
  when 'cabinet_admin' then 'admin_cabinet'
  when 'admin' then 'super_admin'
  when 'entreprise' then 'client_entreprise'
  when 'cabinet' then 'client_entreprise'
  else role
end
where role in ('client', 'lawyer', 'cabinet_admin', 'admin', 'entreprise', 'cabinet');
update public.profiles
set role = 'client_particulier'
where role is null
  or role not in ('client_particulier', 'client_entreprise', 'avocat', 'collaborateur', 'admin_cabinet', 'super_admin');
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('client_particulier', 'client_entreprise', 'avocat', 'collaborateur', 'admin_cabinet', 'super_admin'));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_account_type text := nullif(new.raw_user_meta_data ->> 'account_type', '');
  safe_role text := 'client_particulier';
begin
  if requested_account_type in ('client_entreprise', 'entreprise', 'cabinet') then
    safe_role := 'client_entreprise';
  end if;

  insert into public.profiles (id, email, full_name, account_type, role)
  values (
    new.id,
    new.email,
    left(nullif(new.raw_user_meta_data ->> 'full_name', ''), 120),
    requested_account_type,
    safe_role
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    account_type = coalesce(excluded.account_type, public.profiles.account_type),
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.profiles (id, email, full_name, account_type, role)
select
  users.id,
  users.email,
  left(nullif(users.raw_user_meta_data ->> 'full_name', ''), 120),
  nullif(users.raw_user_meta_data ->> 'account_type', ''),
  case
    when nullif(users.raw_user_meta_data ->> 'account_type', '') in ('client_entreprise', 'entreprise', 'cabinet') then 'client_entreprise'
    else 'client_particulier'
  end
from auth.users
where not exists (
  select 1
  from public.profiles profiles
  where profiles.id = users.id
)
on conflict (id) do nothing;
