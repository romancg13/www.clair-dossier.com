create or replace function public.handle_new_user_profile()
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
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    'client'
  )
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

create index if not exists idx_cases_created_by on public.cases(created_by);
create index if not exists idx_cases_assigned_lawyer on public.cases(assigned_lawyer_id);
create index if not exists idx_documents_case_owner on public.documents(case_id, owner_id);
create index if not exists idx_messages_case_participants on public.messages(case_id, sender_id, recipient_id);
create index if not exists idx_subscriptions_user_status on public.subscriptions(user_id, status);
create index if not exists idx_payments_user_created_at on public.payments(user_id, created_at desc);
