do $$
begin
  if exists (select 1 from pg_constraint where conname = 'subscriptions_billing_period_check') then
    alter table public.subscriptions validate constraint subscriptions_billing_period_check;
  end if;
  if exists (select 1 from pg_constraint where conname = 'subscriptions_status_check') then
    alter table public.subscriptions validate constraint subscriptions_status_check;
  end if;
  if exists (select 1 from pg_constraint where conname = 'payments_billing_period_check') then
    alter table public.payments validate constraint payments_billing_period_check;
  end if;
end $$;
