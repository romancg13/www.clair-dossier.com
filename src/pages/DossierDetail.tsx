import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Seo } from '../lib/seo';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { ArrowRightIcon, CheckIcon } from '../components/icons';

type DossierRow = {
  id: string;
  user_id: string;
  typology: string;
  title: string | null;
  status: string;
  answers: Record<string, string> | null;
  legal_review_requested: boolean;
  created_at: string;
};

type DocumentRow = {
  id: string;
  file_name: string;
  file_path: string;
};

const STATUS_LABELS: Record<string, string> = {
  brouillon: 'Brouillon',
  transmis: 'Transmis',
  'en-cours': 'En cours',
  valide: 'Validé',
  archive: 'Archivé',
};

const TYPOLOGY_LABELS: Record<string, string> = {
  'litige-commercial': 'Litige commercial',
  recouvrement: 'Recouvrement',
  administratif: 'Dossier administratif',
  bail: 'Bail & immobilier',
  consommation: 'Litige client / fournisseur',
  'prud-hommes': "Prud'hommes",
  divorce: 'Divorce / famille',
  succession: 'Succession',
};

// Frise de suivi du dossier — réutilise le visuel du stepper de création.
const TIMELINE = [
  'Création du dossier',
  'Devis, contrat ou accord',
  'Suivi du dossier',
  'Facture et paiement',
  'Option impayé / pré-contentieux',
];

// Mappe un statut de dossier à une étape atteinte dans la frise (1-indexée).
function currentStep(status: string): number {
  switch (status) {
    case 'brouillon':
      return 1;
    case 'transmis':
    case 'en-cours':
      return 3;
    case 'valide':
      return 4;
    case 'archive':
      return 5;
    default:
      return 1;
  }
}

// Étiquettes lisibles pour les clés d'answers connues (cf. DossierFlow).
const ANSWER_LABELS: Record<string, string> = {
  counterparty: 'Partie adverse',
  contractDate: 'Date du contrat',
  amount: 'Montant en jeu',
  deadline: 'Échéance',
  situation: 'Situation',
  debtor: 'Débiteur',
  invoiceDate: 'Date de la facture',
  organisme: 'Organisme concerné',
  refDossier: 'Référence du dossier',
  role: 'Rôle',
  address: 'Adresse du local',
  startDate: "Date d'entrée dans les lieux",
  merchant: 'Vendeur / prestataire / client',
  purchaseDate: "Date d'achat ou de souscription",
  employer: "Nom de l'employeur",
  contractStart: "Date d'embauche",
  ruptureDate: 'Date de la rupture',
  marriageDate: 'Date du mariage',
  separationDate: 'Date de séparation',
  children: "Nombre d'enfants concernés",
  deathDate: 'Date du décès',
  heirCount: "Nombre d'héritiers connus",
};

function labelFor(key: string): string {
  return ANSWER_LABELS[key] ?? key;
}

// Détecte les clés d'answers qui portent une date / échéance.
function isDateKey(key: string): boolean {
  return /date|deadline|echeance|échéance/i.test(key);
}

export function DossierDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [dossier, setDossier] = useState<DossierRow | null>(null);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [links, setLinks] = useState<Record<string, string>>({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [ownerEmail, setOwnerEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    (async () => {
      // La RLS limite déjà la lecture au propriétaire — le filtre id suffit.
      const { data } = await supabase
        .from('dossiers')
        .select('id,user_id,typology,title,status,answers,legal_review_requested,created_at')
        .eq('id', id)
        .maybeSingle();
      if (!active) return;
      const row = (data as DossierRow | null) ?? null;
      setDossier(row);

      // Admin : identité (e-mail) du propriétaire du dossier (réservé à l'admin).
      const { data: adminFlag } = await supabase.rpc('is_admin');
      const admin = adminFlag === true;
      if (!active) return;
      setIsAdmin(admin);
      if (admin && row) {
        if (row.user_id === user?.id) {
          setOwnerEmail(user?.email ?? null);
        } else {
          const { data: em } = await supabase.rpc('admin_user_emails');
          const found = (em as { id: string; email: string }[] | null)?.find(
            (e) => e.id === row.user_id
          );
          if (!active) return;
          setOwnerEmail(found?.email ?? null);
        }
      }

      if (row) {
        const { data: docs } = await supabase
          .from('dossier_documents')
          .select('id,file_name,file_path')
          .eq('dossier_id', id)
          .order('created_at', { ascending: true });
        if (!active) return;
        const list = (docs as DocumentRow[] | null) ?? [];
        setDocuments(list);

        // Pré-génère les URL signées (valides 1 h) pour le téléchargement.
        const signed: Record<string, string> = {};
        await Promise.all(
          list.map(async (doc) => {
            const { data: url } = await supabase.storage
              .from('documents')
              .createSignedUrl(doc.file_path, 3600);
            if (url?.signedUrl) signed[doc.id] = url.signedUrl;
          })
        );
        if (!active) return;
        setLinks(signed);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [id]);

  const answers = dossier?.answers ?? {};
  const answerEntries = Object.entries(answers).filter(([, v]) => v?.trim());
  const dateEntries = answerEntries.filter(([k]) => isDateKey(k));
  const situation = answers.situation?.trim();
  const step = dossier ? currentStep(dossier.status) : 1;

  return (
    <>
      <Seo title="Détail du dossier" description="Le détail de votre dossier ClairDossier." path="/compte" noindex />

      <section className="bg-cream-50">
        <div className="mx-auto max-w-4xl px-5 py-16 sm:px-8 lg:px-12">
          <Link
            to="/compte"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-navy-900"
          >
            ← Retour à mes dossiers
          </Link>

          {loading ? (
            <p className="mt-10 text-sm text-slate-500">Chargement…</p>
          ) : !dossier ? (
            <div className="mt-8 rounded-2xl border hairline bg-white p-8 text-center shadow-card">
              <h1 className="font-display text-2xl font-semibold text-navy-900">Dossier introuvable</h1>
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-500">
                Ce dossier n'existe pas ou ne fait pas partie de votre compte.
              </p>
              <Link
                to="/compte"
                className="sheen mt-7 inline-flex items-center gap-2 rounded-full bg-gold-500 px-6 py-3.5 text-sm font-semibold text-navy-900 shadow-gold transition-transform hover:-translate-y-0.5"
              >
                Revenir à mes dossiers
                <ArrowRightIcon width={14} height={14} strokeWidth={2} />
              </Link>
            </div>
          ) : (
            <>
              {/* ── En-tête ─────────────────────────────────────────── */}
              <div className="mt-8 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-700">
                    {TYPOLOGY_LABELS[dossier.typology] ?? dossier.typology}
                  </p>
                  <h1 className="mt-3 font-display text-4xl font-semibold leading-[1.05] text-navy-900">
                    {dossier.title || TYPOLOGY_LABELS[dossier.typology] || dossier.typology}
                  </h1>
                  <p className="mt-3 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-slate-500">
                    Catégorie · {TYPOLOGY_LABELS[dossier.typology] ?? dossier.typology}
                  </p>
                  {isAdmin && (
                    <p className="mt-1 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-gold-700">
                      Propriétaire · {ownerEmail ?? `${dossier.user_id.slice(0, 8)}…`}
                    </p>
                  )}
                  <p className="mt-1 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-slate-500">
                    Créé le{' '}
                    {new Date(dossier.created_at).toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                <span className="rounded-full bg-gold-500/12 px-3 py-1.5 font-mono text-[0.7rem] font-medium text-navy-900 border hairline-gold">
                  {STATUS_LABELS[dossier.status] ?? dossier.status}
                </span>
              </div>

              {/* ── Chronologie ─────────────────────────────────────── */}
              <div className="mt-10 rounded-2xl border hairline bg-white p-7 shadow-card sm:p-9">
                <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-gold-700">
                  Chronologie du dossier
                </p>

                <ol className="mt-7 space-y-5 sm:space-y-0 sm:flex sm:items-start sm:gap-2">
                  {TIMELINE.map((label, i) => {
                    const n = i + 1;
                    const done = step > n;
                    const active = step === n;
                    return (
                      <li key={label} className="flex items-start gap-3 sm:flex-1 sm:flex-col sm:items-stretch">
                        <div className="flex items-center gap-3 sm:w-full">
                          <span
                            className={`grid h-7 w-7 shrink-0 place-items-center rounded-full font-mono text-[0.7rem] font-semibold transition-colors ${
                              done || active
                                ? 'bg-navy-900 text-cream-50'
                                : 'border hairline-strong bg-white text-slate-500'
                            }`}
                          >
                            {done ? <CheckIcon width={12} height={12} strokeWidth={2.5} /> : n}
                          </span>
                          {i < TIMELINE.length - 1 && (
                            <span
                              className={`hidden h-px flex-1 transition-colors sm:block ${
                                step > n ? 'bg-navy-900' : 'bg-slate-300/40'
                              }`}
                            />
                          )}
                        </div>
                        <p
                          className={`text-sm leading-snug sm:mt-3 ${
                            done || active ? 'font-medium text-navy-900' : 'text-slate-500'
                          }`}
                        >
                          {label}
                        </p>
                      </li>
                    );
                  })}
                </ol>

                <p className="mt-7 border-t hairline pt-5 text-sm leading-relaxed text-slate-500">
                  En cas de contentieux, le dossier est prêt à être transmis à un professionnel du droit.
                </p>
              </div>

              {/* ── Pièces ──────────────────────────────────────────── */}
              <div className="mt-6 rounded-2xl border hairline bg-white p-7 shadow-card sm:p-9">
                <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-gold-700">
                  Pièces du dossier
                </p>
                {documents.length === 0 ? (
                  <p className="mt-4 text-sm leading-relaxed text-slate-500">
                    Aucune pièce n'a encore été déposée sur ce dossier.
                  </p>
                ) : (
                  <ul className="mt-5 space-y-2">
                    {documents.map((doc) => {
                      const href = links[doc.id];
                      return (
                        <li
                          key={doc.id}
                          className="flex items-center justify-between gap-3 rounded-xl border hairline bg-cream-50 px-4 py-3 text-sm"
                        >
                          <span className="truncate text-navy-900">{doc.file_name}</span>
                          {href ? (
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 font-medium text-navy-900 border-b hairline-gold pb-0.5 transition-colors hover:text-gold-700"
                            >
                              Télécharger
                            </a>
                          ) : (
                            <span className="shrink-0 text-xs text-slate-500">Lien indisponible</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {/* ── Échéances & suivi ───────────────────────────────── */}
              <div className="mt-6 rounded-2xl border hairline bg-white p-7 shadow-card sm:p-9">
                <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-gold-700">
                  Échéances & suivi
                </p>

                {dateEntries.length > 0 ? (
                  <dl className="mt-5 divide-y hairline border-y hairline">
                    {dateEntries.map(([key, value]) => (
                      <div
                        key={key}
                        className="flex flex-col gap-1 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6"
                      >
                        <dt className="text-sm font-medium text-slate-500">{labelFor(key)}</dt>
                        <dd className="max-w-md text-sm text-navy-900 sm:text-right">{value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="mt-4 text-sm leading-relaxed text-slate-500">
                    Aucune échéance renseignée sur ce dossier.
                  </p>
                )}

                {situation && (
                  <div className="mt-6 rounded-xl bg-cream-100 p-5">
                    <p className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-slate-500">
                      Situation
                    </p>
                    <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-navy-900">{situation}</p>
                  </div>
                )}

                {dossier.legal_review_requested && (
                  <p className="mt-6 inline-flex items-center gap-2 rounded-full border hairline-gold bg-gold-500/10 px-4 py-2 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-gold-700">
                    Préavis juridique demandé
                  </p>
                )}
              </div>

              <div className="mt-8">
                <Link
                  to="/compte"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-900 border-b hairline-gold pb-0.5 transition-colors hover:text-gold-700"
                >
                  ← Retour à mes dossiers
                </Link>
              </div>
            </>
          )}
        </div>
      </section>
    </>
  );
}
