-- Retour arrière de 20261118130000_reception_email_entrante.sql (manuel).
-- Niveau 1, sans perte : les RPC disparaissent (plus de création d'adresse) et
-- toutes les adresses actives sont révoquées — la fonction email-inbound ne
-- route plus rien. Journaux et adresses (historique) CONSERVÉS ; leur
-- suppression (niveau 2, commentée) reste une décision manuelle séparée.
-- Retirer aussi le webhook et le MX côté Resend, et la fonction email-inbound.
update public.inbound_addresses set revoked_at = now() where revoked_at is null;
drop function if exists public.revoke_inbound_address(uuid);
drop function if exists public.create_inbound_address(uuid);
drop function if exists public.email_inbound_included(uuid);

-- Niveau 2 (perte de l'historique et des réglages — décommenter sciemment) :
-- drop table if exists public.inbound_emails;
-- drop table if exists public.inbound_addresses;
-- alter table public.entitlement_overrides drop column if exists email_inbound;
-- alter table public.plan_entitlements drop column if exists email_inbound;
