// Faux serveur « Anthropic Messages » — RECETTE LOCALE UNIQUEMENT.
//
// Le worker supabase/functions/ai-worker n'est pas modifié : le SDK officiel
// lit ANTHROPIC_BASE_URL et envoie ici ses requêtes réelles (POST /v1/messages).
// Les réponses sont DÉTERMINISTES et conformes aux schémas du worker
// (ExtractionSchema / AnalysisSchema). Tout résultat obtenu par ce serveur est
// SIMULÉ : il prouve la plomberie (file, stockage, statuts, compteurs), jamais
// la qualité d'une analyse.
//
// Le contenu des requêtes est une DONNÉE : rien n'y est interprété comme une
// instruction ; seuls les identifiants de pièces du corpus sont relus pour
// construire des références vérifiables.
import http from 'node:http';

export const FAUX_MODELE = 'claude-opus-5-5';
export const JETONS_ENTREE = 1000;
export const JETONS_SORTIE = 500;
/** Référence volontairement inconnue : le worker doit la retirer (stripped_references). */
export const PIECE_INEXISTANTE = '00000000-0000-4000-8000-000000000000';
export const ECHEANCE_SIMULEE = { titre: 'Paiement de la facture fictive', date: '2026-12-31' };

const EXTRAIT = 'Facture fictive n° RECETTE-001';

function extraction() {
  const preuve = [{ page: 1, quote: EXTRAIT }];
  return {
    document_type: 'courrier',
    language: 'fr',
    summary: 'Pièce fictive de recette locale (réponse simulée).',
    parties: [{ name: 'Société Fictive Alpha', role: 'créancier', evidence: preuve }],
    dates: [
      { date: '2026-03-15', precision: 'day', label: 'Date du courrier', kind: 'document_date', evidence: preuve },
      { date: '2026-04-30', precision: 'day', label: 'Échéance de paiement', kind: 'deadline', evidence: preuve },
    ],
    amounts: [{ amount: 1800, currency: 'EUR', label: 'Montant réclamé', evidence: preuve }],
    references: [{ value: 'RECETTE-001', label: 'Numéro de facture', evidence: preuve }],
    obligations: [],
    requests: [{ text: 'Règlement demandé sous trente jours.', evidence: preuve }],
    alleged_facts: [],
    missing_elements: [],
    quality: { readable: true, notes: 'réponse simulée (recette locale)' },
  };
}

function analyse(documentIds) {
  const premier = documentIds[0] ?? PIECE_INEXISTANTE;
  const preuve = [{ document_id: premier, page: 1, quote: EXTRAIT }];
  return {
    summary_short: 'Dossier fictif de recette : une facture de 1 800 € reste à régler.',
    summary_long: 'Résumé simulé. Les pièces fictives mentionnent une facture RECETTE-001 de 1 800 € et une échéance de paiement.',
    parties: [{ name: 'Société Fictive Alpha', role: 'créancier', evidence: preuve }],
    facts: [
      { text: 'Une facture de 1 800 € a été émise.', status: 'documented', evidence: preuve },
      // Référence hors dossier : doit être retirée par la vérification déterministe du worker.
      { text: 'Fait appuyé sur une pièce inexistante.', status: 'inferred', evidence: [{ document_id: PIECE_INEXISTANTE, page: 1, quote: 'inexistant' }] },
    ],
    deadlines: [{ title: ECHEANCE_SIMULEE.titre, date: ECHEANCE_SIMULEE.date, kind: 'mentioned', basis: 'Date écrite dans la pièce (simulée).', priority: 'haute', evidence: preuve }],
    contradictions: [],
    missing_items: [{ text: 'Preuve de réception de la facture', why: 'Non présente dans les pièces fictives.' }],
    attention_points: ['Réponse simulée : aucune analyse réelle.'],
    next_actions: ['Vérifier le règlement de la facture fictive.'],
    reminder_drafts: [{ audience: 'client', subject: 'Relance fictive', body: 'Bonjour, ceci est un projet de relance simulé.', suggested_date: null, recipient_hint: 'client' }],
  };
}

function texteDe(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((b) => (b && b.type === 'text' ? b.text : '')).join('\n');
  return '';
}

/** Identifiants de pièces du corpus compact envoyé par la consolidation. */
function idsDuCorpus(corps) {
  const texte = texteDe(corps?.messages?.[0]?.content);
  const debut = texte.indexOf('\n\n[');
  if (debut < 0) return [];
  try {
    const corpus = JSON.parse(texte.slice(debut + 2));
    return Array.isArray(corpus) ? corpus.map((c) => c?.document_id).filter((v) => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Démarre le faux serveur. `journal` reçoit une entrée par requête reçue :
 * { nature, outils, formatStructure, cleFictive, typesDeBlocs }.
 */
export function demarrerFauxAnthropic(port = 0) {
  const journal = [];
  const serveur = http.createServer((req, res) => {
    const morceaux = [];
    req.on('data', (m) => morceaux.push(m));
    req.on('end', () => {
      const repondre = (code, objet) => {
        res.writeHead(code, { 'Content-Type': 'application/json', 'request-id': `req_recette_${journal.length}` });
        res.end(JSON.stringify(objet));
      };
      if (req.method !== 'POST' || !String(req.url).includes('/v1/messages')) {
        return repondre(404, { type: 'error', error: { type: 'not_found_error', message: 'faux serveur : route inconnue' } });
      }
      let corps;
      try {
        corps = JSON.parse(Buffer.concat(morceaux).toString('utf8'));
      } catch {
        return repondre(400, { type: 'error', error: { type: 'invalid_request_error', message: 'corps illisible' } });
      }
      const systeme = texteDe(corps.system);
      const nature = systeme.includes('moteur de consolidation') ? 'consolidation' : 'extraction';
      const blocs = Array.isArray(corps?.messages?.[0]?.content) ? corps.messages[0].content.map((b) => b?.type) : ['text'];
      journal.push({
        nature,
        outils: Array.isArray(corps.tools) ? corps.tools.length : 0,
        formatStructure: Boolean(corps.output_config?.format),
        cleFictive: String(req.headers['x-api-key'] ?? ''),
        typesDeBlocs: blocs,
      });
      const sortie = nature === 'consolidation' ? analyse(idsDuCorpus(corps)) : extraction();
      repondre(200, {
        id: `msg_recette_${journal.length}`,
        type: 'message',
        role: 'assistant',
        model: FAUX_MODELE,
        content: [{ type: 'text', text: JSON.stringify(sortie) }],
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: JETONS_ENTREE, output_tokens: JETONS_SORTIE },
      });
    });
  });
  return new Promise((resolve, reject) => {
    serveur.once('error', reject);
    // 0.0.0.0 : joignable depuis le conteneur edge-runtime (host.docker.internal).
    serveur.listen(port, '0.0.0.0', () => {
      resolve({
        port: serveur.address().port,
        journal,
        arreter: () => new Promise((fin) => serveur.close(() => fin())),
      });
    });
  });
}
