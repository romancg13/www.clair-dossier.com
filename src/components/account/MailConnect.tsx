import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

/**
 * Connexion directe d'une messagerie (migration 20261125130000) — Gmail /
 * Google Workspace ou Outlook / Microsoft 365, en LECTURE SEULE.
 *
 * Triple garde, aucun effet tant que tout n'est pas en place :
 *  - rendu seulement si le build pose VITE_MAIL_CONNECT=1 ;
 *  - sonde d'exécution : migration absente → rien n'est affiché ;
 *  - tous les contrôles réels (offre, titulaire, jetons) sont refaits côté
 *    serveur (fonctions mail-oauth / mail-sync, RPC) — ce composant n'affiche
 *    que ce que la base lui laisse lire.
 *
 * « Connectée » n'apparaît qu'après une première réception RÉELLE.
 */

const ENABLED = (import.meta.env.VITE_MAIL_CONNECT as string | undefined)?.trim() === "1";
const DECLINED_KEY = "clairdossier-mail-connect-refus";
const LATER_KEY = "clairdossier-mail-connect-plus-tard";

type Provider = "gmail" | "microsoft";
type Status = "pending" | "connected" | "paused" | "revoked" | "error";
type Connection = {
  id: string;
  provider: Provider;
  address: string;
  status: Status;
  import_since: string;
  last_sync_at: string | null;
  last_received_at: string | null;
  last_error: string | null;
};
type Message = {
  id: string;
  connection_id: string;
  from_addr: string | null;
  subject: string | null;
  received_at: string | null;
  status: string;
  stored_count: number;
  suggested_dossier_id: string | null;
  suggestion_reason: string | null;
};
type Dossier = { id: string; title: string | null };

const PROVIDER_LABEL: Record<Provider, string> = { gmail: "Gmail / Google Workspace", microsoft: "Outlook / Microsoft 365" };
const STATUS_LABEL: Record<Status, string> = {
  pending: "En attente du premier e-mail",
  connected: "Connectée",
  paused: "En pause",
  revoked: "Déconnectée",
  error: "Erreur de synchronisation",
};
const MESSAGE_LABEL: Record<string, string> = {
  a_classer: "À classer",
  queued: "Import en cours",
  stored: "Déposé dans le dossier",
  rejected: "Aucune pièce acceptée",
  ignored: "Ignoré",
  error: "Échec de l'import",
};
const ERRORS: Record<string, string> = {
  FEATURE_NOT_INCLUDED: "La connexion d'une messagerie est incluse à partir de l'offre Entrepreneur.",
  PROVIDER_NOT_CONFIGURED: "Cette messagerie n'est pas encore disponible.",
  CONFIGURATION_INCOMPLETE: "La connexion de messagerie n'est pas encore disponible.",
  ALREADY_CONNECTED: "Une messagerie de ce type est déjà connectée à votre compte.",
  MAILBOX_ALREADY_LINKED: "Cette boîte est déjà reliée à un autre compte ClairDossier.",
  STATE_FOREIGN: "Cette autorisation a été demandée depuis un autre compte : recommencez depuis celui-ci.",
  STATE_INVALID: "L'autorisation a expiré : recommencez la connexion.",
  NO_REFRESH_TOKEN: "Le fournisseur n'a pas accordé d'accès durable : recommencez la connexion.",
  DOSSIER_CLOTURE: "Ce dossier est clôturé : rouvrez-le pour y classer un e-mail.",
  AUTH_REQUIRED: "Connectez-vous pour continuer.",
};
const RETURN_ERRORS: Record<string, string> = {
  refus: "Vous avez refusé l'accès : aucune messagerie n'a été connectée.",
  state_invalide: "L'autorisation a expiré : recommencez la connexion.",
  indisponible: "La connexion de messagerie n'est pas encore disponible.",
  echec: "Le fournisseur n'a pas confirmé l'autorisation : recommencez la connexion.",
};

function day(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }) : "—";
}

function flag(key: string, storage: () => Storage): boolean {
  try {
    return storage().getItem(key) === "1";
  } catch {
    return false;
  }
}

async function errorCode(error: unknown): Promise<string | null> {
  const ctx = (error as { context?: { json?: () => Promise<unknown> } } | null)?.context;
  try {
    const body = (await ctx?.json?.()) as { error?: unknown } | undefined;
    if (typeof body?.error === "string") return body.error;
  } catch {
    /* corps illisible */
  }
  const message = (error as { message?: string } | null)?.message ?? "";
  return Object.keys(ERRORS).find((k) => message.includes(k)) ?? null;
}

export function MailConnect() {
  const [available, setAvailable] = useState(false);
  const [included, setIncluded] = useState<boolean | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [history, setHistory] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [declined, setDeclined] = useState(() => flag(DECLINED_KEY, () => window.localStorage));
  const [later, setLater] = useState(() => flag(LATER_KEY, () => window.sessionStorage));

  const load = useCallback(async () => {
    const c = await supabase
      .from("mail_connections")
      .select("id,provider,address,status,import_since,last_sync_at,last_received_at,last_error")
      .neq("status", "revoked")
      .order("created_at", { ascending: true });
    if (c.error) {
      setAvailable(false);
      return;
    }
    setAvailable(true);
    setConnections((c.data as Connection[] | null) ?? []);
    const access = await supabase.rpc("mail_connect_access");
    setIncluded(access.error ? null : access.data === true);
    const m = await supabase
      .from("mail_messages")
      .select("id,connection_id,from_addr,subject,received_at,status,stored_count,suggested_dossier_id,suggestion_reason")
      .in("status", ["a_classer", "queued", "stored", "rejected", "ignored", "error"])
      .order("created_at", { ascending: false })
      .limit(30);
    setMessages((m.data as Message[] | null) ?? []);
    const d = await supabase.from("dossiers").select("id,title").is("deleted_at", null).order("updated_at", { ascending: false }).limit(100);
    setDossiers((d.data as Dossier[] | null) ?? []);
  }, []);

  // Retour du fournisseur : le code et le state arrivent dans le fragment ;
  // l'échange se fait côté serveur, sous l'identité du compte connecté.
  useEffect(() => {
    if (!ENABLED) return;
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const code = params.get("mail_code");
    const state = params.get("mail_state");
    const returned = params.get("mail_error");
    if (code || returned) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    void (async () => {
      if (returned) setError(RETURN_ERRORS[returned] ?? RETURN_ERRORS.echec);
      if (code && state) {
        setBusy(true);
        const { error: e } = await supabase.functions.invoke("mail-oauth", { body: { action: "finish", code, state } });
        if (e) {
          const k = await errorCode(e);
          setError((k && ERRORS[k]) || "La connexion n'a pas abouti. Recommencez dans un instant.");
        } else {
          setNotice("Autorisation enregistrée. La connexion sera confirmée ici dès la réception d'un premier e-mail.");
        }
        setBusy(false);
      }
      await load();
    })();
  }, [load]);

  if (!ENABLED || !available) return null;

  const run = async (work: () => Promise<{ error: unknown }>, fallback: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    const { error: e } = await work();
    if (e) {
      const k = await errorCode(e);
      setError((k && ERRORS[k]) || fallback);
    }
    await load();
    setBusy(false);
    return !e;
  };

  const connect = async (provider: Provider) => {
    setBusy(true);
    setError(null);
    const { data, error: e } = await supabase.functions.invoke("mail-oauth", { body: { action: "start", provider } });
    const url = (data as { url?: unknown } | null)?.url;
    // Seules les pages d'autorisation officielles sont ouvertes.
    if (!e && typeof url === "string" && /^https:\/\/(accounts\.google\.com|login\.microsoftonline\.com)\//.test(url)) {
      window.location.assign(url);
      return;
    }
    const k = e ? await errorCode(e) : null;
    setError((k && ERRORS[k]) || "La connexion n'a pas pu démarrer. Réessayez dans un instant.");
    setBusy(false);
  };

  const disconnect = async (c: Connection) => {
    if (!window.confirm("Déconnecter cette messagerie ? L'accès est révoqué et les jetons sont effacés. Les pièces déjà déposées restent dans vos dossiers.")) return;
    setBusy(true);
    setError(null);
    const viaFunction = await supabase.functions.invoke("mail-oauth", { body: { action: "disconnect", connection_id: c.id } });
    // Fonction injoignable : les jetons sont quand même effacés par la base.
    if (viaFunction.error) {
      const { error: e } = await supabase.rpc("mail_connection_disconnect", { p_connection: c.id });
      if (e) setError("La déconnexion n'a pas abouti. Réessayez.");
    }
    await load();
    setBusy(false);
  };

  const assign = async (m: Message) => {
    const dossier = choice[m.id] ?? m.suggested_dossier_id ?? "";
    if (!dossier) {
      setError("Choisissez un dossier.");
      return;
    }
    const ok = await run(async () => await supabase.rpc("mail_message_assign", { p_message: m.id, p_dossier: dossier }), "Le classement n'a pas abouti. Réessayez.");
    if (ok) {
      await supabase.functions.invoke("mail-sync", { body: { action: "import" } });
      await load();
    }
  };

  const active = connections.filter((c) => c.status !== "revoked");
  const toClassify = messages.filter((m) => m.status === "a_classer");
  const title = (id: string | null) => dossiers.find((d) => d.id === id)?.title ?? "Dossier";
  const free = (["gmail", "microsoft"] as Provider[]).filter((p) => !active.some((c) => c.provider === p));
  const hidden = active.length === 0 && (declined || later);

  const remember = (key: string, storage: () => Storage, set: (v: boolean) => void, value: boolean) => {
    try {
      if (value) storage().setItem(key, "1");
      else storage().removeItem(key);
    } catch {
      /* stockage indisponible : choix valable pour cette page */
    }
    set(value);
  };

  if (hidden) {
    return (
      <div className="mt-6 rounded-xl border hairline bg-cream-50 p-5">
        <p className="text-sm text-slate-600">
          {declined ? "Vous avez choisi de ne pas connecter de messagerie." : "Connexion d'une messagerie : remise à plus tard."}{" "}
          <button
            type="button"
            onClick={() => {
              remember(DECLINED_KEY, () => window.localStorage, setDeclined, false);
              remember(LATER_KEY, () => window.sessionStorage, setLater, false);
            }}
            className="font-medium text-navy-900 underline underline-offset-2"
          >
            Connecter une messagerie
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-xl border hairline bg-cream-50 p-5">
      <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-gold-700">Messagerie connectée</p>

      {active.map((c) => (
        <div key={c.id} className="mt-3 rounded-lg border hairline bg-white p-4">
          <p className="text-sm font-semibold text-navy-900">
            {PROVIDER_LABEL[c.provider]}
            {c.address ? <span className="ml-2 font-mono text-xs font-normal text-slate-600">{c.address}</span> : null}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            <span className={c.status === "connected" ? "font-medium text-navy-900" : c.status === "error" ? "font-medium text-red-700" : ""}>
              {STATUS_LABEL[c.status]}
            </span>
            {c.status === "pending" ? " — la confirmation s'affichera ici après une réception réelle." : null}
            {c.status === "connected" && c.last_received_at ? ` — dernier e-mail le ${day(c.last_received_at)}.` : null}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            Lecture seule. Seuls les e-mails reçus depuis le {day(c.import_since)} sont concernés — jamais votre historique
            antérieur. Aucun e-mail n'est modifié, supprimé ni envoyé.
          </p>
          {c.status === "error" && c.last_error ? (
            <p className="mt-1 text-xs text-red-700">Nouvel essai automatique en cours. Si l'erreur persiste, déconnectez puis reconnectez la messagerie.</p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {c.status === "paused" ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void run(async () => await supabase.rpc("mail_connection_resume", { p_connection: c.id }), "La reprise n'a pas abouti. Réessayez.")}
                className="rounded-full bg-navy-900 px-4 py-2 text-xs font-semibold text-cream-50 transition-colors hover:bg-navy-800 disabled:opacity-60"
              >
                Reprendre
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => void run(async () => await supabase.rpc("mail_connection_pause", { p_connection: c.id }), "La mise en pause n'a pas abouti. Réessayez.")}
                className="rounded-full border hairline px-4 py-2 text-xs font-medium text-navy-900 hover:bg-cream-50 disabled:opacity-60"
              >
                Mettre en pause
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => void disconnect(c)}
              className="rounded-full px-4 py-2 text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
            >
              Déconnecter
            </button>
          </div>
        </div>
      ))}

      {free.length > 0 ? (
        <div className="mt-3 space-y-3">
          {active.length === 0 ? (
            <p className="text-sm leading-relaxed text-slate-600">
              Connectez votre messagerie pour que les pièces jointes des e-mails reçus à partir d'aujourd'hui soient proposées
              au classement dans vos dossiers. Accès en lecture seule, révocable à tout moment ; votre historique antérieur
              n'est pas importé.
            </p>
          ) : null}
          {included === false ? (
            <p className="text-sm text-slate-600">{ERRORS.FEATURE_NOT_INCLUDED}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {free.map((p) => (
                <button
                  key={p}
                  type="button"
                  disabled={busy}
                  onClick={() => void connect(p)}
                  className="rounded-full bg-navy-900 px-4 py-2 text-xs font-semibold text-cream-50 transition-colors hover:bg-navy-800 disabled:opacity-60"
                >
                  {p === "gmail" ? "Connecter Gmail" : "Connecter Outlook"}
                </button>
              ))}
              {active.length === 0 ? (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => remember(LATER_KEY, () => window.sessionStorage, setLater, true)}
                    className="rounded-full border hairline px-4 py-2 text-xs font-medium text-navy-900 hover:bg-white disabled:opacity-60"
                  >
                    Plus tard
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => remember(DECLINED_KEY, () => window.localStorage, setDeclined, true)}
                    className="rounded-full px-4 py-2 text-xs font-medium text-slate-600 hover:text-navy-900 disabled:opacity-60"
                  >
                    Non
                  </button>
                </>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      {toClassify.length > 0 ? (
        <div className="mt-4">
          <p className="text-sm font-semibold text-navy-900">
            À classer ({toClassify.length})
          </p>
          <ul className="mt-2 space-y-2">
            {toClassify.map((m) => (
              <li key={m.id} className="rounded-lg border hairline bg-white p-3 text-sm text-slate-600">
                <p className="truncate text-navy-900">{m.subject || "(sans objet)"}</p>
                <p className="truncate text-xs">
                  {m.from_addr ?? "Expéditeur inconnu"} · {day(m.received_at)}
                </p>
                {m.suggested_dossier_id ? (
                  <p className="mt-1 text-xs">
                    Proposition : {title(m.suggested_dossier_id)}
                    {m.suggestion_reason ? ` (${m.suggestion_reason})` : ""}
                  </p>
                ) : null}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <label className="sr-only" htmlFor={`mail-dossier-${m.id}`}>
                    Dossier de destination
                  </label>
                  <select
                    id={`mail-dossier-${m.id}`}
                    value={choice[m.id] ?? m.suggested_dossier_id ?? ""}
                    onChange={(e) => setChoice((prev) => ({ ...prev, [m.id]: e.target.value }))}
                    className="max-w-full rounded-md border hairline bg-white px-2 py-1 text-xs text-navy-900"
                  >
                    <option value="">Choisir un dossier…</option>
                    {dossiers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.title || "Dossier sans titre"}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void assign(m)}
                    className="rounded-full bg-navy-900 px-3 py-1.5 text-xs font-semibold text-cream-50 hover:bg-navy-800 disabled:opacity-60"
                  >
                    Classer
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void run(async () => await supabase.rpc("mail_message_ignore", { p_message: m.id }), "L'opération n'a pas abouti. Réessayez.")}
                    className="rounded-full px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-navy-900 disabled:opacity-60"
                  >
                    Ignorer
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {messages.length > 0 ? (
        <div className="mt-4">
          <button
            type="button"
            aria-expanded={history}
            onClick={() => setHistory((v) => !v)}
            className="text-xs font-medium text-navy-900 underline underline-offset-2"
          >
            {history ? "Masquer l'historique" : "Historique des e-mails reçus"}
          </button>
          {history ? (
            <ul className="mt-2 space-y-1 text-xs text-slate-600">
              {messages.map((m) => (
                <li key={m.id} className="flex flex-wrap justify-between gap-2 border-b hairline py-1">
                  <span className="min-w-0 flex-1 truncate">
                    {day(m.received_at)} · {m.subject || "(sans objet)"}
                  </span>
                  <span>
                    {MESSAGE_LABEL[m.status] ?? m.status}
                    {m.status === "stored" ? ` (${m.stored_count} pièce${m.stored_count > 1 ? "s" : ""})` : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {notice ? (
        <p role="status" className="mt-3 text-sm text-navy-900">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
