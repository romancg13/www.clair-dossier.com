do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'subscriptions_status_check'
  ) then
    alter table public.subscriptions drop constraint subscriptions_status_check;
  end if;

  alter table public.subscriptions
    add constraint subscriptions_status_check
    check (status in ('active', 'canceled', 'incomplete', 'past_due', 'expired')) not valid;
end $$;
