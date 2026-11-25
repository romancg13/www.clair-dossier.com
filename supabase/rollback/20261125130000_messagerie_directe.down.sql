-- Retour arrière de 20261125130000_messagerie_directe.sql (manuel).
-- Niveau 1, sans perte d'historique : TOUS les jetons sont effacés (plus aucun
-- accès possible aux boîtes), toutes les connexions sont révoquées, les RPC
-- disparaissent (plus de pause/reprise/classement). Connexions, messages et
-- journal (historique) CONSERVÉS ; leur suppression (niveau 2, commentée) reste
-- une décision manuelle séparée.
-- À faire aussi côté fournisseurs : retirer les fonctions mail-oauth et
-- mail-sync, l'abonnement Pub/Sub, et — pour une révocation effective chez
-- Google/Microsoft — supprimer les secrets clients OAuth (les jetons effacés ici
-- ne sont plus utilisables par ClairDossier, mais l'autorisation reste visible
-- dans le compte de l'utilisateur tant qu'elle n'est pas révoquée là-bas).
delete from public.mail_connection_tokens;
update public.mail_connections
   set status = 'revoked', revoked_at = now(),
       sync_cursor = null, subscription_id = null, watch_expires_at = null
 where status <> 'revoked';
drop function if exists public.mail_message_ignore(uuid);
drop function if exists public.mail_message_assign(uuid, uuid);
drop function if exists public.mail_connection_disconnect(uuid);
drop function if exists public.mail_connection_resume(uuid);
drop function if exists public.mail_connection_pause(uuid);
drop function if exists public.mail_connect_access();
drop function if exists public.mail_connect_included(uuid);

-- Niveau 2 (perte de l'historique et des réglages — décommenter sciemment) :
-- drop trigger if exists mail_connections_guard on public.mail_connections;
-- drop table if exists public.mail_connection_events;
-- drop table if exists public.mail_messages;
-- drop table if exists public.mail_connection_tokens;
-- drop table if exists public.mail_connections;
-- drop function if exists public.mail_connections_guard();
-- drop function if exists public.mail_connection_has_reception(uuid);
-- alter table public.entitlement_overrides drop column if exists mail_connect;
-- alter table public.plan_entitlements drop column if exists mail_connect;
