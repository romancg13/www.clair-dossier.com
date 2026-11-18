-- Revenus : montants des abonnements, recopiés depuis Stripe par le webhook
-- (supabase/functions/stripe-webhook) et par scripts/sync-stripe-subscriptions.ts.
-- Additive et idempotente. Stripe reste la source de vérité : ces colonnes ne sont
-- jamais saisies à la main ; la RLS existante s'applique (titulaire + administration).
alter table public.subscriptions
  add column if not exists unit_amount integer check (unit_amount is null or unit_amount >= 0),
  add column if not exists currency text check (currency is null or currency ~ '^[a-z]{3}$'),
  add column if not exists billing_interval text check (billing_interval is null or billing_interval in ('day', 'week', 'month', 'year')),
  add column if not exists interval_count integer check (interval_count is null or interval_count > 0),
  add column if not exists quantity integer check (quantity is null or quantity > 0);

comment on column public.subscriptions.unit_amount is 'Prix unitaire en centimes (Stripe price.unit_amount).';
comment on column public.subscriptions.billing_interval is 'Périodicité Stripe (price.recurring.interval).';
