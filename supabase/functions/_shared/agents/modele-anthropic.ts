/**
 * Fournisseur Anthropic (API Messages) — serveur uniquement. Sortie structurée par
 * outil forcé ; température 0 ; délai et une seule nouvelle tentative sur erreur
 * transitoire (429, 5xx, coupure). La clé vient de l'environnement de l'Edge
 * Function (`ANTHROPIC_API_KEY`) et n'atteint jamais le client.
 */
import { ErreurModele, type FournisseurModele, type ReponseModele, type RequeteModele } from "./modele.ts";

const URL_MESSAGES = "https://api.anthropic.com/v1/messages";
const VERSION_API = "2023-06-01";

type BlocContenu = { type: string; name?: string; input?: unknown };
type ReponseApi = {
  model: string;
  stop_reason: string | null;
  content: BlocContenu[];
  usage?: { input_tokens?: number; output_tokens?: number };
};

export function modeleAnthropic(cle: string, options: { fetchImpl?: typeof fetch; base?: string } = {}): FournisseurModele {
  const fetchImpl = options.fetchImpl ?? fetch;
  const url = options.base ?? URL_MESSAGES;
  if (!cle) throw new ErreurModele("MODELE_NON_CONFIGURE: ANTHROPIC_API_KEY absente");

  async function appel(requete: RequeteModele): Promise<ReponseModele> {
    const controleur = new AbortController();
    const minuterie = setTimeout(() => controleur.abort(), requete.timeout_ms ?? 90_000);
    try {
      const reponse = await fetchImpl(url, {
        method: "POST",
        signal: controleur.signal,
        headers: { "content-type": "application/json", "x-api-key": cle, "anthropic-version": VERSION_API },
        body: JSON.stringify({
          model: requete.modele,
          max_tokens: requete.max_tokens ?? 4096,
          temperature: requete.temperature ?? 0,
          system: requete.systeme,
          messages: [{ role: "user", content: requete.utilisateur }],
          tools: [{ name: requete.outil.nom, description: requete.outil.description, input_schema: requete.outil.schema }],
          tool_choice: { type: "tool", name: requete.outil.nom },
        }),
      });
      if (!reponse.ok) {
        const corps = await reponse.text().catch(() => "");
        throw new ErreurModele(`API Anthropic ${reponse.status}: ${corps.slice(0, 300)}`, reponse.status, reponse.status === 429 || reponse.status >= 500);
      }
      const corps = (await reponse.json()) as ReponseApi;
      const outil = corps.content.find((b) => b.type === "tool_use" && b.name === requete.outil.nom);
      if (!outil) throw new ErreurModele("réponse sans appel d'outil structuré", undefined, false);
      return {
        modele: corps.model,
        sortie: outil.input,
        tokens_entree: corps.usage?.input_tokens ?? 0,
        tokens_sortie: corps.usage?.output_tokens ?? 0,
        arret: corps.stop_reason,
      };
    } catch (e) {
      if (e instanceof ErreurModele) throw e;
      const abandon = e instanceof Error && e.name === "AbortError";
      throw new ErreurModele(abandon ? "délai dépassé" : `appel impossible : ${String(e)}`, undefined, true);
    } finally {
      clearTimeout(minuterie);
    }
  }

  return {
    nom: "anthropic",
    async completer(requete) {
      try {
        return await appel(requete);
      } catch (e) {
        if (e instanceof ErreurModele && e.reessayable) {
          await new Promise((r) => setTimeout(r, 2000));
          return appel(requete);
        }
        throw e;
      }
    },
  };
}
