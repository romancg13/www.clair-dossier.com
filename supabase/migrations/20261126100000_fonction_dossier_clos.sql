-- Fonction interne `dossier_is_closed`, installable SEULE (sans le moteur IA).
-- Constat production du 26/11 : absente (définie seulement dans 20261023120000, non installée), alors que
-- 20261118130000 (e-mail entrant) et 20261125130000 (messagerie directe) l'appellent.
-- Définition IDENTIQUE à 20261023120000 : rejouable, sans effet si le moteur IA l'a déjà créée.
-- Ne lit que dossier_events et dossiers ; aucun droit pour anon / authenticated (usage interne).
create or replace function public.dossier_is_closed(p_dossier uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select e.type = 'dossier_cloture' from public.dossier_events e
      where e.dossier_id = p_dossier and e.type in ('dossier_cloture', 'dossier_rouvert')
      order by e.created_at desc limit 1),
    (select d.status = 'archive' from public.dossiers d where d.id = p_dossier),
    false)
$$;
revoke execute on function public.dossier_is_closed(uuid) from public, anon, authenticated;
