import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

/**
 * Réception par e-mail d'un dossier (migration 20261118130000) — adresse non
 * devinable et révocable, transfert guidé en trois étapes, confirmation de
 * destination consultable (« Connecté » uniquement après une réception RÉELLE).
 *
 * Triple garde, aucun effet en production tant que tout n'est pas en place :
 *  - rendu seulement si le build pose VITE_INBOUND_EMAIL_DOMAIN (sous-domaine
 *    de réception Resend) ;
 *  - sonde d'exécution : migration absente → rien n'est affiché ;
 *  - titulaire du dossier uniquement.
 */

const DOMAIN = (import.meta.env.VITE_INBOUND_EMAIL_DOMAIN as string | undefined)?.trim() ?? "";

type AddressRow = { local_part: string; created_at: string };

const ERRORS: Record<string, string> = {
  FEATURE_NOT_INCLUDED: "La réception par e-mail est incluse à partir de l'offre Entrepreneur.",
  DOSSIER_CLOTURE: "Le dossier est clôturé : rouvrez-le pour recevoir des e-mails.",
  FORBIDDEN: "Seul le titulaire du dossier peut créer cette adresse.",
  AUTH_REQUIRED: "Connectez-vous pour continuer.",
};

export function EmailInbox({ dossierId, isOwner }: { dossierId: string; isOwner: boolean }) {
  const [available, setAvailable] = useState(false);
  const [address, setAddress] = useState<AddressRow | null>(null);
  const [received, setReceived] = useState(0);
  const [lastAt, setLastAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const a = await supabase
      .from("inbound_addresses")
      .select("local_part,created_at")
      .eq("dossier_id", dossierId)
      .is("revoked_at", null)
      .maybeSingle();
    if (a.error) {
      setAvailable(false);
      return;
    }
    setAvailable(true);
    setAddress((a.data as AddressRow | null) ?? null);
    const m = await supabase
      .from("inbound_emails")
      .select("created_at")
      .eq("dossier_id", dossierId)
      .order("created_at", { ascending: false })
      .limit(1);
    const rows = (m.data as { created_at: string }[] | null) ?? [];
    setLastAt(rows[0]?.created_at ?? null);
    const c = await supabase
      .from("inbound_emails")
      .select("id", { count: "exact", head: true })
      .eq("dossier_id", dossierId);
    setReceived(c.count ?? 0);
  }, [dossierId]);

  useEffect(() => {
    if (DOMAIN && isOwner) void load();
  }, [load, isOwner]);

  if (!DOMAIN || !isOwner || !available) return null;

  const fullAddress = address ? `${address.local_part}@${DOMAIN}` : null;

  const create = async () => {
    setBusy(true);
    setError(null);
    const { error: e } = await supabase.rpc("create_inbound_address", { p_dossier: dossierId });
    if (e) {
      const code = Object.keys(ERRORS).find((k) => e.message.includes(k));
      setError(code ? ERRORS[code] : "L'opération n'a pas abouti. Réessayez dans un instant.");
    }
    await load();
    setBusy(false);
  };

  const revoke = async () => {
    if (!window.confirm("Révoquer cette adresse ? Les e-mails qui y seront envoyés ensuite seront ignorés. Les pièces déjà reçues restent dans le dossier.")) return;
    setBusy(true);
    setError(null);
    const { error: e } = await supabase.rpc("revoke_inbound_address", { p_dossier: dossierId });
    if (e) setError("La révocation n'a pas abouti. Réessayez.");
    await load();
    setBusy(false);
  };

  const copy = async () => {
    if (!fullAddress) return;
    try {
      await navigator.clipboard.writeText(fullAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* sélection manuelle possible */
    }
  };

  return (
    <div className="mt-6 rounded-xl border hairline bg-cream-50 p-5">
      <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-gold-700">
        Recevoir des pièces par e-mail
      </p>
      {!address ? (
        <div className="mt-3 space-y-3">
          <p className="text-sm leading-relaxed text-slate-600">
            Créez une adresse de réception propre à ce dossier : les pièces jointes des e-mails que
            vous y transférerez seront déposées ici, comme un dépôt manuel. L'adresse n'est pas
            devinable et peut être révoquée à tout moment.
          </p>
          <button
            type="button"
            onClick={() => void create()}
            disabled={busy}
            className="rounded-full bg-navy-900 px-4 py-2 text-xs font-semibold text-cream-50 transition-colors hover:bg-navy-800 disabled:opacity-60"
          >
            {busy ? "Création…" : "Créer l'adresse de réception"}
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <ol className="space-y-2 text-sm leading-relaxed text-slate-600">
            <li>
              <span className="font-semibold text-navy-900">1.</span> Copiez l'adresse de ce dossier :
              <span className="mx-2 inline-block max-w-full truncate rounded-md border hairline bg-white px-2 py-1 align-middle font-mono text-xs text-navy-900">
                {fullAddress}
              </span>
              <button
                type="button"
                onClick={() => void copy()}
                className="rounded-full border hairline px-2.5 py-1 text-xs font-medium text-navy-900 hover:bg-white"
              >
                {copied ? "Copiée ✓" : "Copier"}
              </button>
            </li>
            <li>
              <span className="font-semibold text-navy-900">2.</span> Depuis votre messagerie,
              transférez-lui les e-mails utiles (factures, courriers…) : seules leurs pièces jointes
              aux formats acceptés sont déposées ; sans pièce jointe, le texte du message est
              conservé en .txt.
            </li>
            <li>
              <span className="font-semibold text-navy-900">3.</span>{" "}
              {received > 0 ? (
                <span className="text-navy-900">
                  Connecté — {received} e-mail{received > 1 ? "s" : ""} reçu{received > 1 ? "s" : ""}
                  {lastAt
                    ? `, dernier le ${new Date(lastAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}`
                    : ""}
                  .
                </span>
              ) : (
                "En attente du premier e-mail — la confirmation s'affichera ici après réception réelle."
              )}
            </li>
          </ol>
          <button
            type="button"
            onClick={() => void revoke()}
            disabled={busy}
            className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
          >
            Révoquer cette adresse
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
