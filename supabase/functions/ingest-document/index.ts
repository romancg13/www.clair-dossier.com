// Edge Function : ingest-document
// Consomme la file de travaux « ingestion » (table public.travaux) : pour chaque
// pièce déposée, exécute les étapes 1 à 5 du pipeline (réception, empreinte,
// stockage, extraction, qualité) avec le rôle de service. Réveillée par le
// trigger pg_net à chaque mise en file ; peut aussi être appelée par un cron.
// Elle n'accepte aucune donnée d'entrée : un appel superflu ne fait que vider
// une file déjà vide. Les journaux ne portent que des identifiants (PARTIE 11).
import { createClient } from "@supabase/supabase-js";
import { modeleAnthropic } from "../_shared/agents/modele-anthropic.ts";
import { executerFile } from "../_shared/pipeline/ingestion.ts";
import { creerStockageSupabase, creerStoreSupabase } from "../_shared/pipeline/store-supabase.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
// Clé Anthropic : secret de l'Edge Function uniquement (jamais côté client). Sans elle,
// les agents n'exécutent que leurs extractions déterministes et le disent.
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const MODELE_EXTRACTION = Deno.env.get("MODELE_EXTRACTION") || undefined;
const MODELE_CLASSIFICATION = Deno.env.get("MODELE_CLASSIFICATION") || undefined;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST attendu" }, 405);
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ error: "configuration serveur incomplète" }, 500);

  const client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const executant = `edge-${crypto.randomUUID().slice(0, 8)}`;
  try {
    const bilan = await executerFile(creerStoreSupabase(client), creerStockageSupabase(client), {
      executant,
      maxTravaux: 20,
      dureeMaxMs: 50_000,
      ocr: null, // aucun fournisseur OCR configuré (D-007)
      modele: ANTHROPIC_API_KEY ? modeleAnthropic(ANTHROPIC_API_KEY) : null,
      nomModeleExtraction: MODELE_EXTRACTION,
      nomModeleClassification: MODELE_CLASSIFICATION,
    });
    console.log(JSON.stringify({ evenement: "ingestion.file", ...bilan }));
    return json(bilan);
  } catch (e) {
    console.error(JSON.stringify({ evenement: "ingestion.erreur", executant, erreur: String(e) }));
    return json({ error: "échec de l'exécutant", executant }, 500);
  }
});
