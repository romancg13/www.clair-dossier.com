alter table public.payments add column if not exists stripe_invoice_id text;
alter table public.payments add column if not exists hosted_invoice_url text;
alter table public.payments add column if not exists invoice_pdf text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'payments_stripe_invoice_unique') then
    alter table public.payments add constraint payments_stripe_invoice_unique unique (stripe_invoice_id);
  end if;
end $$;
