-- Stripe webhook idempotence + RGPD droit à l'oubli
-- Fixes audit findings: SEC-01 (idempotence), PRV-01 (deletion trigger), PRV-03 (consent tracking)

-- ─── Idempotence des événements Stripe (SEC-01) ───
create table if not exists public.stripe_events_processed (
  event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);

alter table public.stripe_events_processed enable row level security;

-- Aucune politique : seul le service_role (Edge Function) y accède.
revoke all on public.stripe_events_processed from anon, authenticated;

create index if not exists stripe_events_processed_type_idx
  on public.stripe_events_processed (event_type, processed_at desc);

-- ─── Consent tracking RGPD granulaire (PRV-03) ───
alter table public.contact_requests
  add column if not exists consent_timestamp timestamptz,
  add column if not exists consent_version text,
  add column if not exists consent_ip inet;

alter table public.newsletter_subscribers
  add column if not exists consent_timestamp timestamptz,
  add column if not exists consent_version text,
  add column if not exists consent_ip inet;

alter table public.demo_requests
  add column if not exists consent_timestamp timestamptz,
  add column if not exists consent_version text,
  add column if not exists consent_ip inet;

-- ─── Trigger RGPD : anonymisation à la suppression de compte (PRV-01) ───
create or replace function public.handle_user_deletion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  anon_email text := concat('deleted-', gen_random_uuid()::text, '@anonymized.local');
  user_email text := old.email;
begin
  -- Contact requests : anonymisation des PII (email peut matcher l'utilisateur)
  if user_email is not null then
    update public.contact_requests
      set name = 'utilisateur supprimé',
          email = anon_email,
          phone = null,
          message = '[message supprimé suite à demande RGPD]'
      where lower(email) = lower(user_email);

    -- Newsletter : suppression complète (droit à l'oubli)
    delete from public.newsletter_subscribers
      where lower(email) = lower(user_email);

    -- Demo requests : anonymisation
    update public.demo_requests
      set name = 'utilisateur supprimé',
          email = anon_email,
          organization = '[supprimé]',
          message = '[supprimé RGPD]'
      where lower(email) = lower(user_email);
  end if;

  -- Case intake answers : redaction des réponses JSONB liées à des cases dont créateur supprimé
  update public.case_intake_answers cia
    set answers = jsonb_build_object(
      'redacted_at', now()::text,
      'reason', 'rgpd_user_deletion'
    )
    where exists (
      select 1 from public.cases c
      where c.id = cia.case_id and c.created_by = old.id
    );

  -- Messages : redaction des messages envoyés par l'utilisateur supprimé
  update public.messages
    set body = '[message supprimé suite à demande RGPD]'
    where sender_id = old.id;

  -- Documents : anonymisation des références (le fichier physique doit aussi être purgé via Storage hook)
  update public.documents
    set file_name = '[document supprimé RGPD]'
    where owner_id = old.id;

  -- Audit log avec hash SHA-256 de l'email (traçabilité légale sans PII)
  insert into public.audit_logs (action, entity_type, entity_id, metadata)
  values (
    'user_deleted_rgpd',
    'auth.users',
    old.id,
    jsonb_build_object(
      'email_hash', case when user_email is not null
        then encode(digest(lower(user_email), 'sha256'), 'hex')
        else null
      end,
      'deleted_at', now()
    )
  );

  return old;
end;
$$;

-- Trigger BEFORE DELETE sur auth.users
drop trigger if exists on_user_deletion_rgpd on auth.users;
create trigger on_user_deletion_rgpd
  before delete on auth.users
  for each row execute function public.handle_user_deletion();
