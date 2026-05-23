alter table public.profiles alter column role set default 'client_particulier';

create index if not exists cases_created_by_created_at_idx on public.cases (created_by, created_at desc);
create index if not exists cases_assigned_lawyer_created_at_idx on public.cases (assigned_lawyer_id, created_at desc);
create index if not exists documents_case_id_created_at_idx on public.documents (case_id, created_at desc);
create index if not exists messages_case_id_created_at_idx on public.messages (case_id, created_at desc);
create index if not exists payments_user_id_created_at_idx on public.payments (user_id, created_at desc);
create index if not exists subscriptions_user_id_updated_at_idx on public.subscriptions (user_id, updated_at desc);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'demo_requests_users_count_positive') then
    alter table public.demo_requests
      add constraint demo_requests_users_count_positive
      check (users_count is null or users_count > 0) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'messages_body_length_check') then
    alter table public.messages
      add constraint messages_body_length_check
      check (length(body) between 1 and 5000) not valid;
  end if;
end $$;
