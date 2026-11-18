/**
 * Dossier de DÉMONSTRATION — entièrement fictif (personnes, sociétés, montants,
 * dates, pièces). Aucune donnée client, aucun appel réseau : la démo applique
 * le même code de chronologie et de génération que le worker de production
 * (supabase/functions/_shared/deliverables.ts) à ces données synthétiques.
 */
import { buildChronology, type AnalysisData, type PieceRef } from "../../supabase/functions/_shared/analysis-model.ts";

export const DEMO_TITLE = "Facture impayée — chantier « Maison Témoin » (dossier fictif)";

type Dt = { date: string; precision: "day" | "month" | "year" | "unknown"; label: string; kind: "document_date" | "event_date"; page: number; quote: string };

const BASE: { id: string; file: string; at: string; dates: Dt[] }[] = [
  { id: "p01", file: "Devis D-2026-041 signé.pdf", at: "2026-06-02T09:12:00Z", dates: [
    { date: "2026-06-02", precision: "day", kind: "document_date", label: "Devis D-2026-041 émis — 18 400 € TTC", page: 1, quote: "Devis n° D-2026-041 du 2 juin 2026 — Total TTC : 18 400,00 €" },
    { date: "2026-06-04", precision: "day", kind: "event_date", label: "Signature du devis par le client", page: 2, quote: "Bon pour accord, le 4 juin 2026" },
  ] },
  { id: "p02", file: "Bon de commande BC-118.pdf", at: "2026-06-05T14:03:00Z", dates: [
    { date: "2026-06-05", precision: "day", kind: "document_date", label: "Bon de commande BC-118", page: 1, quote: "Bon de commande BC-118 — 5 juin 2026" },
  ] },
  { id: "p03", file: "Relevé bancaire — acompte.pdf", at: "2026-06-12T08:40:00Z", dates: [
    { date: "2026-06-12", precision: "day", kind: "event_date", label: "Versement d'un acompte de 5 520 €", page: 1, quote: "12/06/2026 VIR SOCIETE FICTIVE IMMO ACOMPTE 5 520,00" },
  ] },
  { id: "p04", file: "PV de réception des travaux.pdf", at: "2026-08-28T16:20:00Z", dates: [
    { date: "2026-08-28", precision: "day", kind: "event_date", label: "Réception des travaux sans réserve", page: 1, quote: "Les travaux sont réceptionnés sans réserve ce 28 août 2026" },
  ] },
  { id: "p05", file: "Facture F-2026-077.pdf", at: "2026-08-31T10:00:00Z", dates: [
    { date: "2026-08-31", precision: "day", kind: "document_date", label: "Facture F-2026-077 — solde de 12 880 € TTC", page: 1, quote: "Facture F-2026-077 du 31/08/2026 — Net à payer : 12 880,00 € TTC" },
  ] },
  { id: "p06", file: "E-mail — première relance.eml", at: "2026-09-20T07:55:00Z", dates: [
    { date: "2026-09-20", precision: "day", kind: "event_date", label: "Première relance amiable par e-mail", page: 1, quote: "Nous nous permettons de vous rappeler que la facture F-2026-077…" },
  ] },
  { id: "p07", file: "Courrier de contestation du client.pdf", at: "2026-09-29T11:30:00Z", dates: [
    { date: "2026-09-29", precision: "day", kind: "event_date", label: "Contestation : défaut de finition allégué par le client", page: 1, quote: "nous constatons des défauts de finition sur les menuiseries de l'étage" },
  ] },
  { id: "p08", file: "Photos fin de chantier.jpg", at: "2026-08-28T16:25:00Z", dates: [
    { date: "2026-08-28", precision: "day", kind: "document_date", label: "Photos de fin de chantier (horodatées)", page: 1, quote: "Horodatage : 28/08/2026 16:05" },
  ] },
  { id: "p09", file: "Conditions générales de vente.pdf", at: "2026-01-15T09:00:00Z", dates: [
    { date: "2026-01", precision: "month", kind: "document_date", label: "Conditions générales de vente (version janvier 2026)", page: 1, quote: "Version en vigueur au 1er janvier 2026" },
  ] },
  { id: "p10", file: "E-mail — deuxième relance.eml", at: "2026-10-10T08:15:00Z", dates: [
    { date: "2026-10-10", precision: "day", kind: "event_date", label: "Deuxième relance : règlement demandé sous 30 jours", page: 1, quote: "Nous vous remercions de procéder au règlement sous 30 jours" },
    { date: "2026-09", precision: "month", kind: "event_date", label: "Promesse de règlement évoquée par téléphone (déclaration)", page: 1, quote: "comme convenu lors de notre échange téléphonique de septembre" },
  ] },
  { id: "p11", file: "Attestation d'assurance décennale.pdf", at: "2026-02-01T09:00:00Z", dates: [
    { date: "2026-02-01", precision: "day", kind: "document_date", label: "Attestation d'assurance décennale", page: 1, quote: "Attestation valable du 01/02/2026 au 31/01/2027" },
  ] },
];

export const DEMO_UNSUPPORTED: PieceRef = { id: "p12", file_name: "Note vocale du client.heic", created_at: "2026-10-12T18:02:00Z" };
export const DEMO_FAILED: PieceRef = { id: "p13", file_name: "Relevé scanné illisible.pdf", created_at: "2026-10-12T18:05:00Z" };

export const DEMO_PIECES: PieceRef[] = BASE.map((b) => ({ id: b.id, file_name: b.file, created_at: b.at }));

type Extraction = { document_id: string; data: { dates: (Omit<Dt, "page" | "quote"> & { evidence: { page: number; quote: string }[] })[] } };
const toExtraction = (b: (typeof BASE)[number]): Extraction => ({
  document_id: b.id,
  data: { dates: b.dates.map(({ page, quote, ...d }) => ({ ...d, evidence: [{ page, quote }] })) },
});

/** Dossier volumineux : 179 bons de livraison fictifs ajoutés aux 11 pièces de base (190 pièces). */
export function bulkPieces(): { pieces: PieceRef[]; extractions: Extraction[] } {
  const pieces: PieceRef[] = [];
  const extractions: Extraction[] = [];
  for (let i = 1; i <= 179; i++) {
    const id = `bl${String(i).padStart(3, "0")}`;
    const day = new Date(Date.UTC(2025, 9, 1) + i * 2 * 86_400_000).toISOString().slice(0, 10);
    pieces.push({ id, file_name: `Bon de livraison BL-${String(i).padStart(4, "0")}.pdf`, created_at: `${day}T08:00:00Z` });
    extractions.push({ document_id: id, data: { dates: [{ date: day, precision: "day", kind: "event_date", label: `Livraison BL-${String(i).padStart(4, "0")}`, evidence: [{ page: 1, quote: `Livré le ${day.split("-").reverse().join("/")}` }] }] } });
  }
  return { pieces, extractions };
}

const ev = (id: string, page: number, quote: string) => ({ document_id: id, page, quote });

export function demoAnalysis(bulk = false): AnalysisData {
  const extra = bulk ? bulkPieces().extractions : [];
  return {
    summary_short:
      "Atelier Démo Menuiserie réclame à Société Fictive Immo SAS le solde de 12 880 € TTC de la facture F-2026-077 (travaux réceptionnés le 28/08/2026). Deux relances amiables sont restées sans paiement ; le client invoque un défaut de finition, alors que le PV de réception ne mentionne aucune réserve.",
    summary_long:
      "Le devis D-2026-041 (18 400 € TTC) a été signé le 4 juin 2026, puis un acompte de 5 520 € versé le 12 juin. Les travaux ont été réceptionnés sans réserve le 28 août 2026 (PV signé, photos horodatées du même jour). La facture de solde F-2026-077 du 31 août 2026 (12 880 € TTC) était payable au 30 septembre 2026. Après une première relance le 20 septembre, le client a contesté la finition par courrier du 29 septembre ; une deuxième relance du 10 octobre demande le règlement sous 30 jours. Les pièces ne contiennent ni preuve d'envoi de la facture ni réponse écrite à la contestation." +
      (bulk ? " Le dossier comprend en outre 179 bons de livraison, intégrés à la chronologie." : ""),
    parties: [
      { name: "Atelier Démo Menuiserie", role: "Prestataire, titulaire du dossier", evidence: [ev("p01", 1, "Atelier Démo Menuiserie — SIRET 000 000 000 00000")] },
      { name: "Société Fictive Immo SAS", role: "Client, débiteur du solde", evidence: [ev("p05", 1, "Client : Société Fictive Immo SAS")] },
    ],
    facts: [
      { text: "Le devis D-2026-041 de 18 400 € TTC a été accepté le 4 juin 2026.", status: "documented", evidence: [ev("p01", 2, "Bon pour accord, le 4 juin 2026")] },
      { text: "Un acompte de 5 520 € a été versé le 12 juin 2026.", status: "documented", evidence: [ev("p03", 1, "ACOMPTE 5 520,00")] },
      { text: "Les travaux ont été réceptionnés sans réserve le 28 août 2026.", status: "documented", evidence: [ev("p04", 1, "réceptionnés sans réserve ce 28 août 2026")] },
      { text: "Le client invoque des défauts de finition sur les menuiseries de l'étage.", status: "asserted_by_party", evidence: [ev("p07", 1, "défauts de finition sur les menuiseries de l'étage")] },
      { text: "Une promesse de règlement aurait été faite par téléphone en septembre.", status: "asserted_by_party", evidence: [ev("p10", 1, "comme convenu lors de notre échange téléphonique de septembre")] },
      { text: "Aucune preuve d'envoi de la facture n'a été déposée.", status: "missing", evidence: [] },
    ],
    deadlines: [
      { title: "Échéance de paiement de la facture F-2026-077", date: "2026-09-30", kind: "mentioned", basis: "Date d'échéance indiquée sur la facture", priority: "haute", evidence: [ev("p05", 1, "Échéance : 30/09/2026")] },
      { title: "Fin du délai laissé par la deuxième relance", date: "2026-11-09", kind: "computed", basis: "10 octobre 2026 + 30 jours (délai indiqué dans la relance)", priority: "haute", evidence: [ev("p10", 1, "règlement sous 30 jours")] },
      { title: "Point sur l'opportunité d'une mise en demeure", date: "2026-11-16", kind: "hypothesis", basis: "Étape usuelle après des relances amiables — à confirmer par un professionnel", priority: "normale", evidence: [] },
      { title: "Fin de validité de l'attestation décennale", date: "2027-01-31", kind: "mentioned", basis: "Période de validité indiquée sur l'attestation", priority: "basse", evidence: [ev("p11", 1, "valable du 01/02/2026 au 31/01/2027")] },
    ],
    contradictions: [
      { text: "Le PV du 28/08/2026 indique une réception sans réserve, alors que le courrier du 29/09/2026 invoque un défaut de finition.", evidence: [ev("p04", 1, "sans réserve"), ev("p07", 1, "défauts de finition")] },
    ],
    missing_items: [
      { text: "Preuve de l'envoi de la facture F-2026-077", why: "utile pour dater le point de départ des relances" },
      { text: "Réponse écrite à la contestation du 29/09/2026", why: "aucune réponse ne figure au dossier" },
    ],
    attention_points: [
      "La facture est échue depuis le 30/09/2026 : 12 880 € TTC restent dus selon les pièces.",
      "La contestation porte sur la finition : les photos horodatées du 28/08 et le PV sans réserve sont les pièces clés.",
      "La promesse de règlement par téléphone n'est qu'une déclaration : aucune pièce ne la confirme.",
      ...(bulk ? ["179 bons de livraison intégrés : vérifier qu'ils concernent bien ce chantier."] : []),
    ],
    next_actions: [
      "Répondre par écrit à la contestation en joignant le PV de réception et les photos.",
      "Retrouver et déposer la preuve d'envoi de la facture.",
      "Après le 09/11/2026, envisager avec un professionnel l'envoi d'une mise en demeure (projet fourni, à valider).",
    ],
    reminder_drafts: [
      { audience: "client", subject: "Rappel : fin du délai de la deuxième relance", body: "Le délai de 30 jours laissé à Société Fictive Immo SAS par la relance du 10/10/2026 arrive à échéance le 09/11/2026. Pensez à vérifier l'encaissement avant d'envisager l'étape suivante.", suggested_date: "2026-11-06", recipient_hint: "Vous (titulaire du dossier)" },
      { audience: "third_party", subject: "Facture F-2026-077 — réponse à votre courrier du 29 septembre", body: "Madame, Monsieur,\n\nNous avons bien reçu votre courrier du 29 septembre 2026. Nous vous rappelons que les travaux ont été réceptionnés sans réserve le 28 août 2026 (procès-verbal ci-joint) et restons disponibles pour constater ensemble les points évoqués.\n\nNous vous remercions de bien vouloir régler le solde de 12 880 € TTC de la facture F-2026-077.\n\nCordialement,\nAtelier Démo Menuiserie", suggested_date: "2026-10-27", recipient_hint: "Société Fictive Immo SAS — adresse à confirmer depuis vos contacts" },
      { audience: "third_party", subject: "PROJET — Mise en demeure de payer (à valider par un professionnel)", body: "[Projet à compléter et à faire valider avant tout envoi]\n\nPar la présente, nous vous mettons en demeure de régler la somme de 12 880 € TTC correspondant à la facture F-2026-077 du 31 août 2026, dans un délai de [à définir] à compter de la réception de ce courrier.", suggested_date: null, recipient_hint: "Société Fictive Immo SAS — envoi recommandé, à valider" },
    ],
    events: buildChronology([...BASE.map(toExtraction), ...extra]),
  };
}
