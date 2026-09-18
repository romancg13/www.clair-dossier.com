-- Audit serveur de la corbeille des dossiers (2026-09-18) — MIGRATION ADDITIVE,
-- idempotente et rejouable. À appliquer APRÈS 20260918100000.
--
-- Faille constatée (chantier 13, tests PGlite) : la mise à la corbeille et la
-- restauration d'un dossier n'étaient journalisées QUE par le navigateur
-- (logAudit, meilleur effort, jamais bloquant). Un appel direct à l'API par
-- une session super admin AAL2 — ou un onglet fermé entre l'écriture et le
-- journal — faisait sortir un dossier client des listes SANS aucune trace
-- dans audit_logs.
--
-- Correctif : un déclencheur AFTER UPDATE journalise, dans la MÊME
-- transaction, toute entrée en corbeille et toute restauration. Si l'écriture
-- du journal échoue, la mise à la corbeille est annulée : pas d'action sans
-- trace.
--
-- Rien d'autre ne change : qui peut mettre à la corbeille (super admin en
-- AAL2, imposé par dossiers_guard), pièces, échéances, registre de quota
-- (aucun recrédit), notifications (aucune à la restauration), suppression
-- définitive. Aucune donnée existante modifiée, aucune policy touchée.

create or replace function public.dossiers_audit_corbeille()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
begin
  -- Sans utilisateur authentifié (maintenance serveur), dossiers_guard
  -- empêche déjà toute modification de deleted_at : rien à journaliser.
  if v_actor is null then
    return null;
  end if;
  v_role := case when coalesce(public.is_super_admin(), false) then 'super_admin' else 'admin' end;

  if old.deleted_at is null and new.deleted_at is not null then
    insert into public.audit_logs (actor_id, actor_role, action, resource_type, resource_id, target_user_id, metadata)
    values (
      v_actor, v_role, 'dossier_corbeille', 'dossier', new.id::text, new.user_id,
      jsonb_build_object('source', 'base', 'motif', coalesce(new.delete_reason, ''))
    );
  elsif old.deleted_at is not null and new.deleted_at is null then
    insert into public.audit_logs (actor_id, actor_role, action, resource_type, resource_id, target_user_id, metadata)
    values (
      v_actor, v_role, 'dossier_restaure', 'dossier', new.id::text, new.user_id,
      jsonb_build_object('source', 'base')
    );
  end if;
  return null;
end;
$$;
revoke all on function public.dossiers_audit_corbeille() from public, anon, authenticated;

drop trigger if exists dossiers_audit_corbeille on public.dossiers;
create trigger dossiers_audit_corbeille
  after update on public.dossiers
  for each row
  when (old.deleted_at is distinct from new.deleted_at)
  execute function public.dossiers_audit_corbeille();
