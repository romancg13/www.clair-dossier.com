// Mesure de CAPACITÉ de la recette, sur le serveur de recette EN MÉMOIRE (jamais la recette hébergée), sans aucun
// appel de modèle (lecture par règles), sans réseau.
//   Volet 1 — un dossier, un lot de N fichiers synthétiques (défaut 250 : PDF texte, texte, CSV, doublons, une pièce
//             illisible), par l'API réelle : dépôt, attente, extraction, premier résultat, analyse complète,
//             fabrication des six rendus, téléchargement ; accès au stockage ; doublons ; mémoire.
//   Volet 2 — capacité LOGIQUE 20 dossiers × 250 fichiers : dépôt, listage, quotas — exécuteur en pause, donc
//             AUCUNE analyse (les 5 000 lectures ne sont pas lancées).
// Usage : npx tsx scripts/recette/capacite.ts [--fichiers=250] [--latence=60-120] [--volet=1|2|tous]
//         [--dossiers=20] [--sondage=oui|non] [--json=chemin]
// --latence ajoute une latence simulée à CHAQUE accès au stockage (reproduction locale d'un stockage distant).
import { writeFileSync } from 'node:fs';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { LIMITES } from '../../recette/server/api.ts';
import { plans } from '../../src/data/pricing.ts';
import { delaiSondage } from '../../src/recette/suivi.ts';
import type { Nature } from './lib/kv-mesure.ts';
import { pause, pileMesure, type ClientMesure, type PileMesure } from './lib/pile-mesure.ts';

const arg = (n: string, d: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const N = Number(arg('fichiers', '250'));
const DOSSIERS = Number(arg('dossiers', '20'));
const VOLET = arg('volet', 'tous');
const [latMin, latMax] = arg('latence', '0').split('-').map(Number);
const LATENCE = latMin > 0 ? { minMs: latMin, maxMs: latMax || latMin } : null;
const SONDAGE = arg('sondage', 'oui') === 'oui';

const ms = (t: number) => Math.round(performance.now() - t);
/** Avancement sur la sortie d'erreur (la sortie standard ne porte que le résultat). */
const progres = (m: string) => process.stderr.write(`[capacité] ${m}\n`);
const Mo = (n: number) => Math.round((n / 1048576) * 10) / 10;
const centile = (l: number[], p: number) => (l.length ? [...l].sort((a, b) => a - b)[Math.min(l.length - 1, Math.floor((p / 100) * l.length))] : null);
const resume = (l: number[]) => ({ n: l.length, mediane_ms: centile(l, 50), p95_ms: centile(l, 95), max_ms: l.length ? Math.max(...l) : null });

/* ── Corpus synthétique (aucune donnée réelle) ─────────────────────────────── */
interface Fichier {
  nom: string;
  type: string;
  contenu: Uint8Array<ArrayBuffer>;
  genre: 'pdf' | 'texte' | 'csv' | 'doublon' | 'illisible';
}
const texte = (s: string) => new TextEncoder().encode(s);
const jour = (i: number) => `${String((i % 27) + 1).padStart(2, '0')}/${String((i % 12) + 1).padStart(2, '0')}/${2024 + (i % 3)}`;

async function pdfTexte(i: number): Promise<Uint8Array<ArrayBuffer>> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([595, 842]);
  const lignes = [
    `SCI des Verriers - Courrier n° ${i} du ${jour(i)}`,
    `Objet : régularisation de charges, appel n° ${1000 + i}.`,
    `Madame, Monsieur, nous vous adressons le décompte du trimestre ${(i % 4) + 1}.`,
    `Montant réclamé : ${1200 + i * 7},${String(i % 100).padStart(2, '0')} euros toutes taxes comprises.`,
    `Nous vous remercions de bien vouloir régler cette somme avant le ${jour(i + 40)}.`,
    `Référence du dossier : REF-${2026}-${String(i).padStart(4, '0')}.`,
  ];
  lignes.forEach((l, k) => page.drawText(l, { x: 50, y: 780 - k * 22, size: 11, font }));
  return new Uint8Array(await doc.save({ useObjectStreams: false }));
}

export async function corpus(n: number): Promise<Fichier[]> {
  const doublons = Math.max(1, Math.round(n * 0.08));
  const originaux = n - doublons - 1;
  const pdfs = Math.round(originaux * 0.44);
  const textes = Math.round(originaux * 0.35);
  const csvs = originaux - pdfs - textes;
  const out: Fichier[] = [];
  for (let i = 0; i < pdfs; i++) out.push({ nom: `courrier-${String(i).padStart(3, '0')}.pdf`, type: 'application/pdf', contenu: await pdfTexte(i), genre: 'pdf' });
  for (let i = 0; i < textes; i++) out.push({ nom: `note-${String(i).padStart(3, '0')}.txt`, type: 'text/plain', contenu: texte(`Note interne n° ${i} du ${jour(i + 3)}.\n\nAppel téléphonique avec le gestionnaire le ${jour(i + 5)} : il confirme le montant de ${800 + i * 3},00 euros.\n\nRéponse attendue avant le ${jour(i + 60)}.`), genre: 'texte' });
  for (let i = 0; i < csvs; i++) out.push({ nom: `releve-${String(i).padStart(3, '0')}.csv`, type: 'text/csv', contenu: texte(`Date,Libellé,Montant\n${jour(i)},Charges communes lot ${i},${300 + i}.50\n${jour(i + 1)},Eau froide,${40 + (i % 30)}.20\n${jour(i + 2)},Total trimestre,${340 + i + (i % 30)}.70\n`), genre: 'csv' });
  // Doublons : copies exactes d'originaux (autre nom), réparties dans le lot.
  for (let i = 0; i < doublons; i++) {
    const o = out[(i * 7) % originaux];
    out.push({ nom: `copie-${i}-de-${o.nom}`, type: o.type, contenu: o.contenu, genre: 'doublon' });
  }
  // Pièce illisible : signature PDF, contenu corrompu.
  out.push({ nom: 'scan-abime.pdf', type: 'application/pdf', contenu: texte('%PDF-1.4\n%corrompu\n1 0 obj << /Type /Catalog >>\nfin inattendue'), genre: 'illisible' });
  return out;
}

/* ── Outils de mesure ──────────────────────────────────────────────────────── */
function memoire() {
  let pic = 0;
  let picTas = 0;
  const t = setInterval(() => {
    const m = process.memoryUsage();
    pic = Math.max(pic, m.rss);
    picTas = Math.max(picTas, m.heapUsed);
  }, 200);
  const depart = process.memoryUsage();
  return {
    fin: () => {
      clearInterval(t);
      const m = process.memoryUsage();
      return { rss_depart_Mo: Mo(depart.rss), rss_pic_Mo: Mo(Math.max(pic, m.rss)), tas_depart_Mo: Mo(depart.heapUsed), tas_pic_Mo: Mo(Math.max(picTas, m.heapUsed)) };
    },
  };
}
const delta = (a: Record<string, number>, b: Record<string, number>) => Object.fromEntries(Object.keys(b).map((k) => [k, b[k] - (a[k] ?? 0)]));

async function compteAvecFormule(pile: PileMesure, c: ClientMesure, dossiers: number) {
  await c.call('POST', '/api/demo/demarrer', { scenario: 'a' });
  const moi = await c.json('GET', '/api/moi');
  // Formule couvrant le nombre de dossiers voulu (compte fictif, en mémoire) : aucune vente, aucun paiement.
  const plan = plans.find((p) => Number(p.specs.dossiers.match(/\d+/)?.[0] ?? Infinity) >= dossiers) ?? plans[plans.length - 1];
  await pile.env().store.updateSub(moi.user.id, (s) => ({ ...s, plan_id: plan.id }));
  return { userId: moi.user.id as string, plan: plan.id, limite: plan.specs.dossiers };
}

async function deposer(c: ClientMesure, dossier: string, fichiers: Fichier[], parRequete: number, enParallele: number) {
  const lot = crypto.randomUUID();
  const durees: number[] = [];
  const refus: Record<number, number> = {};
  const file: Fichier[][] = [];
  for (let i = 0; i < fichiers.length; i += parRequete) file.push(fichiers.slice(i, i + parRequete));
  await Promise.all(
    Array.from({ length: enParallele }, async () => {
      for (let g = file.shift(); g; g = file.shift()) {
        const f = new FormData();
        f.append('lot', lot);
        f.append('total', String(fichiers.length));
        for (const x of g) f.append('fichiers', new File([x.contenu], x.nom, { type: x.type }));
        const t = performance.now();
        const r = await c.call('POST', `/api/dossiers/${dossier}/pieces`, f);
        durees.push(ms(t));
        if (r.status !== 201) refus[r.status] = (refus[r.status] ?? 0) + 1;
      }
    }),
  );
  return { lot, durees, refus };
}

/* ── Volet 1 : un dossier, un lot de N fichiers, traitement complet ────────── */
async function volet1(fichiers: Fichier[]) {
  const rendu = { passages: 0, documents: 0, calcul_ms: 0, parRevision: new Map<number, number>() };
  const pile = pileMesure({
    latence: null,
    surDeps: (deps) => {
      const files = deps.renderer.files.bind(deps.renderer);
      deps.renderer.files = async (k, input, view) => {
        const t = performance.now();
        const out = await files(k, input, view);
        rendu.calcul_ms += performance.now() - t;
        rendu.documents += out.length;
        rendu.parRevision.set(input.revision, (rendu.parRevision.get(input.revision) ?? 0) + (performance.now() - t));
        progres(`volet 1 : rendu « ${k} » révision ${input.revision} en ${Math.round(performance.now() - t)} ms`);
        return out;
      };
    },
  });
  const c = pile.client();
  const compte = await compteAvecFormule(pile, c, 1);
  const id = (await c.json('GET', '/api/dossiers')).dossiers[0].id as string;
  await pile.repos();
  pile.kv.raz();
  pile.kv.latence = LATENCE;
  const mem = memoire();

  const t0 = performance.now();
  const jalons: Record<string, number> = {};
  const jalon = (k: string) => {
    if (jalons[k] === undefined) progres(`volet 1 : ${k} à ${ms(t0)} ms`);
    return (jalons[k] ??= ms(t0));
  };
  const parCle: Record<string, number> = {};
  let extractionsEcrites = 0;
  const revisions = new Map<string, number>();
  let fileOctetsMax = 0;
  const attendues = fichiers.filter((f) => f.genre !== 'doublon').length;
  pile.kv.onAcces = (nature: Nature, cle: string) => {
    const p = `${nature}:${cle.split(/[/.]/)[0]}`;
    parCle[p] = (parCle[p] ?? 0) + 1;
    if (nature === 'ecriture' && cle.startsWith('extractions/')) {
      jalon('premiere_piece_lue');
      if (++extractionsEcrites === attendues) jalon('toutes_pieces_lues');
    }
    if (nature === 'ecriture' && cle.startsWith('views/')) jalon('premier_resultat');
  };
  // Travaux : instants de mise en file, de prise et de fin (attente et durée d'extraction), taille de la file.
  const travaux = new Map<string, { cle: string; cree: number; pris?: number; fini?: number }>();
  const dernier = { analyse: 0, vue: 0, publie: 0 };
  const put = pile.kv.inner.putJson.bind(pile.kv.inner);
  pile.kv.inner.putJson = async (key, value, opts) => {
    const r = await put(key, value, opts);
    if (!r.ok) return r;
    if (key === 'queue.json') fileOctetsMax = Math.max(fileOctetsMax, JSON.stringify(value).length);
    if (key.startsWith('jobs/')) {
      const j = value as { id: string; key: string; status: string };
      const t = travaux.get(j.id) ?? { cle: j.key, cree: ms(t0) };
      if (j.status === 'running') t.pris ??= ms(t0);
      if (j.status === 'done' || j.status === 'failed' || j.status === 'cancelled') t.fini = ms(t0);
      travaux.set(j.id, t);
    }
    if (/^analyses\/.*\/r\d+\.json$/.test(key) && !revisions.has(key)) {
      revisions.set(key, (dernier.analyse = ms(t0)));
      progres(`volet 1 : analyse ${key.split('/').pop()} enregistrée à ${ms(t0)} ms (${JSON.stringify(value).length} octets)`);
    }
    if (key.startsWith('views/')) dernier.vue = ms(t0);
    if (key.startsWith('published/')) dernier.publie = ms(t0);
    return r;
  };

  // Dépôt comme l'interface : 4 envois de front, un fichier par requête. Le traitement démarre pendant le dépôt.
  const avantDepot = pile.kv.instantane();
  const d = await deposer(c, id, fichiers, 1, 4);
  jalon('depot_termine');
  const accesDepot = delta(avantDepot, pile.kv.instantane());

  // Suivi comme l'interface (facultatif) : consultation du dossier à la cadence de suivi.ts, jusqu'à « prêt ».
  const consultations: number[] = [];
  let arret = false;
  const suivi = (async () => {
    const debut = Date.now();
    while (SONDAGE && !arret) {
      const t = performance.now();
      const x = await c.json('GET', `/api/dossiers/${id}`);
      consultations.push(ms(t));
      if (x.vue) jalon('client_premier_resultat');
      if (x.statut.etat !== 'en_cours') break;
      await pause(delaiSondage(Date.now() - debut));
    }
  })();
  await pile.repos();
  arret = true;
  await suivi;
  await pile.repos();
  const finTravaux = Math.max(0, ...[...travaux.values()].map((t) => t.fini ?? 0));
  const accesTraitement = pile.kv.instantane();

  // État final, coût d'une consultation, téléchargements.
  pile.kv.raz();
  const tDetail = performance.now();
  const detail = await c.json('GET', `/api/dossiers/${id}`);
  const consultation = { ms: ms(tDetail), acces: pile.kv.instantane() };
  await pile.repos();
  pile.kv.raz();
  const tListe = performance.now();
  await c.json('GET', '/api/dossiers');
  const liste = { ms: ms(tListe), acces: pile.kv.instantane() };
  pile.kv.raz();
  const tDl = performance.now();
  let octets = 0;
  let fichiersTelecharges = 0;
  for (const r of detail.rendus as { cle: string; fichiers: { nom: string }[] }[]) {
    for (const f of r.fichiers) {
      const { url } = await c.json('POST', `/api/dossiers/${id}/lien`, { categorie: r.cle, nom: f.nom });
      const rep = await c.call('GET', url);
      if (rep.status !== 200) throw new Error(`téléchargement refusé (${rep.status})`);
      octets += (await rep.arrayBuffer()).byteLength;
      fichiersTelecharges++;
    }
  }
  const telechargement = { ms: ms(tDl), fichiers: fichiersTelecharges, octets, acces: pile.kv.instantane() };
  pile.kv.raz();
  const tZip = performance.now();
  const zip = await c.call('GET', `/api/dossiers/${id}/archive`);
  const archive = { ms: ms(tZip), statut: zip.status, octets: (await zip.arrayBuffer()).byteLength, acces: pile.kv.instantane() };

  const x = [...travaux.values()].filter((t) => t.cle.startsWith('x:'));
  const consolidations = [...travaux.values()].filter((t) => t.cle.startsWith('c:'));
  const pieces = detail.pieces as { doublon_de: string | null; lecture: { statut: string } | null }[];
  const derniereRevision = Math.max(0, ...rendu.parRevision.keys());
  return {
    parametres: { fichiers: fichiers.length, composition: Object.fromEntries(['pdf', 'texte', 'csv', 'doublon', 'illisible'].map((g) => [g, fichiers.filter((f) => f.genre === g).length])), octets_corpus: fichiers.reduce((n, f) => n + f.contenu.byteLength, 0), latence_simulee_ms: LATENCE ? [LATENCE.minMs, LATENCE.maxMs] : null, sondage_client: SONDAGE, formule: compte.plan },
    depot: { duree_ms: jalons.depot_termine, requetes: resume(d.durees), refus: d.refus, acces: accesDepot },
    attente: resume(x.filter((t) => t.pris !== undefined).map((t) => t.pris! - t.cree)),
    extraction: { par_piece: resume(x.filter((t) => t.pris !== undefined && t.fini !== undefined).map((t) => t.fini! - t.pris!)), premiere_piece_lue_ms: jalons.premiere_piece_lue ?? null, toutes_pieces_lues_ms: jalons.toutes_pieces_lues ?? null },
    premier_resultat: { serveur_ms: jalons.premier_resultat ?? null, client_ms: jalons.client_premier_resultat ?? null },
    analyse_complete: { derniere_analyse_ms: dernier.analyse, derniere_vue_ms: dernier.vue, revisions_calculees: revisions.size, consolidations_executees: consolidations.length },
    six_rendus: { derniere_publication_ms: dernier.publie, calcul_total_ms: Math.round(rendu.calcul_ms), calcul_derniere_revision_ms: Math.round(rendu.parRevision.get(derniereRevision) ?? 0), revisions_rendues: rendu.parRevision.size, documents_fabriques: rendu.documents },
    fin_du_dernier_travail_ms: finTravaux,
    telechargement,
    archive,
    etat_final: { etat: detail.statut.etat, pieces: pieces.length, lues: pieces.filter((p) => p.lecture?.statut === 'ok').length, illisibles: pieces.filter((p) => p.lecture && p.lecture.statut !== 'ok').length, doublons_detectes: pieces.filter((p) => p.doublon_de).length, doublons_attendus: fichiers.filter((f) => f.genre === 'doublon').length, rendus_disponibles: (detail.rendus as { fichiers: unknown[] }[]).filter((r) => r.fichiers.length).length, revision: detail.statut.revision },
    stockage: { acces_jusqu_a_la_fin: accesTraitement, operations: { simples: accesTraitement.lecture - accesTraitement.autorite + accesTraitement.octetsLus, avancees: accesTraitement.ecriture + accesTraitement.octetsEcrits + accesTraitement.liste + accesTraitement.autorite }, par_cle: Object.fromEntries(Object.entries(parCle).sort((a, b) => b[1] - a[1]).slice(0, 16)), file_octets_max: fileOctetsMax, parallelisme_max: pile.kv.maxEnVol },
    executeur: pile.compteurs,
    consultation_du_dossier: { ...consultation, pendant_le_traitement: resume(consultations) },
    liste_des_dossiers: liste,
    memoire: mem.fin(),
  };
}

/* ── Volet 2 : capacité logique 20 × 250 (dépôt, listage, quotas), sans analyse ─ */
async function volet2(dossiers: number, parDossier: number) {
  // Exécuteur en pause : les pièces sont déposées et mises en file, aucune n'est lue (aucune analyse lancée).
  const pile = pileMesure({ latence: null, config: { paused: true } });
  const c = pile.client();
  const compte = await compteAvecFormule(pile, c, dossiers);
  const mem = memoire();
  const tCreation = performance.now();
  const ids = [(await c.json('GET', '/api/dossiers')).dossiers[0].id as string];
  for (let i = 1; i < dossiers; i++) {
    const r = await c.call('POST', '/api/dossiers', { titre: `Dossier de capacité ${i + 1}` });
    if (r.status !== 201) throw new Error(`création du dossier ${i + 1} refusée (${r.status})`);
    ids.push((await r.json()).id);
  }
  const creation_ms = ms(tCreation);
  const enTrop = (await c.call('POST', '/api/dossiers', { titre: 'Dossier au-delà de la formule' })).status;

  // Petites pièces de texte, toutes différentes (20 par requête : plafond d'un envoi).
  const piece = (dz: number, i: number): Fichier => ({ nom: `d${dz}-piece-${i}.txt`, type: 'text/plain', contenu: texte(`Dossier ${dz}, pièce ${i} du ${jour(i)}. Montant : ${100 + i},00 euros.`), genre: 'texte' });
  pile.kv.raz();
  let fileOctetsMax = 0;
  const put = pile.kv.inner.putJson.bind(pile.kv.inner);
  pile.kv.inner.putJson = async (key, value, opts) => {
    if (key === 'queue.json') fileOctetsMax = Math.max(fileOctetsMax, JSON.stringify(value).length);
    return put(key, value, opts);
  };
  const tDepot = performance.now();
  const durees: number[] = [];
  const refus: Record<number, number> = {};
  for (let dz = 0; dz < dossiers; dz++) {
    const r = await deposer(c, ids[dz], Array.from({ length: parDossier }, (_, i) => piece(dz, i)), 20, 1);
    progres(`volet 2 : dossier ${dz + 1}/${dossiers} déposé à ${ms(tDepot)} ms`);
    durees.push(...r.durees);
    for (const [k, v] of Object.entries(r.refus)) refus[Number(k)] = (refus[Number(k)] ?? 0) + v;
  }
  await pile.repos();
  const depot = { duree_ms: ms(tDepot), requetes: resume(durees), refus, acces: pile.kv.instantane() };
  const lus = (await pile.kv.inner.list('extractions/')).length;

  pile.kv.raz();
  pile.kv.latence = { minMs: 1, maxMs: 1 }; // 1 ms : seulement pour observer le parallélisme
  const tListe = performance.now();
  const liste = await c.json('GET', '/api/dossiers');
  const listage = { ms: ms(tListe), dossiers: liste.dossiers.length, pieces_annoncees: (liste.dossiers as { pieces: number }[]).reduce((n, x) => n + x.pieces, 0), acces: pile.kv.instantane(), parallelisme_max: pile.kv.maxEnVol };
  await pile.repos();
  pile.kv.raz();
  const tDetail = performance.now();
  const detail = await c.json('GET', `/api/dossiers/${ids[dossiers - 1]}`);
  const consultation = { ms: ms(tDetail), pieces: detail.pieces.length, etat: detail.statut.etat, acces: pile.kv.instantane() };
  await pile.repos();
  pile.kv.latence = null;

  // Quotas : volume par compte (réservé avant tout stockage), plafond de la formule.
  const stockage = (await pile.kv.inner.getJson<{ n: number }>(`limites/stockage/${compte.userId}.json`))?.value.n ?? 0;
  const plafond = LIMITES.octetsParCompte;
  LIMITES.octetsParCompte = stockage + 10; // essai du refus au plafond, sans déposer 50 Mo
  const f = new FormData();
  f.append('fichiers', new File([texte('Pièce de trop : dépasse le volume du compte.')], 'de-trop.txt'));
  const auPlafond = (await c.call('POST', `/api/dossiers/${ids[0]}/pieces`, f)).status;
  LIMITES.octetsParCompte = plafond;
  const travaux = (await pile.kv.inner.getJson<{ open: string[] }>('queue.json'))?.value.open.length ?? 0;
  return {
    parametres: { dossiers, fichiers_par_dossier: parDossier, total: dossiers * parDossier, formule: compte.plan, limite_formule: compte.limite, executeur: 'en pause (aucune analyse lancée)' },
    creation_des_dossiers: { duree_ms: creation_ms, dossier_au_dela_de_la_formule: enTrop },
    depot,
    pieces_enregistrees: (await pile.kv.inner.list('pieces/')).length,
    travaux_en_file: travaux,
    analyses_lancees: lus,
    file: { octets_max: fileOctetsMax },
    listage,
    consultation_d_un_dossier: consultation,
    quotas: { octets_reserves: stockage, plafond_octets_par_compte: plafond, part_du_plafond: Math.round((stockage / plafond) * 1000) / 10, refus_au_plafond: auPlafond },
    executeur: pile.compteurs,
    memoire: mem.fin(),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  // Journaux techniques du serveur (alertes, travaux remis en file) : hors de la sortie de mesure.
  console.error = () => undefined;
  const sortie: Record<string, unknown> = { date: new Date().toISOString(), node: process.version };
  if (VOLET !== '2') {
    const t = performance.now();
    const fichiers = await corpus(N);
    sortie.preparation_du_corpus_ms = ms(t);
    sortie.volet1 = await volet1(fichiers);
  }
  if (VOLET !== '1') sortie.volet2 = await volet2(DOSSIERS, N);
  const json = JSON.stringify(sortie, null, 2);
  const chemin = arg('json', '');
  if (chemin) writeFileSync(chemin, json);
  console.log(json);
}
