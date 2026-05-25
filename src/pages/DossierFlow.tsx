import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Seo, breadcrumbSchema } from '../lib/seo';
import { ArrowRightIcon, CheckIcon } from '../components/icons';

type Typology =
  | 'prud-hommes'
  | 'divorce'
  | 'consommation'
  | 'bail'
  | 'succession'
  | 'recouvrement';

type DraftAnswers = Record<string, string>;

type Draft = {
  typology?: Typology;
  answers: DraftAnswers;
  step: 1 | 2 | 3;
  updatedAt: string;
};

const STORAGE_KEY = 'clairdossier_draft';

const TYPOLOGIES: { id: Typology; label: string; description: string }[] = [
  { id: 'prud-hommes', label: "Prud'hommes", description: "Licenciement, rupture, harcèlement, heures supplémentaires." },
  { id: 'divorce', label: 'Divorce / famille', description: "Séparation, garde, prestation compensatoire, autorité parentale." },
  { id: 'consommation', label: 'Litige consommateur', description: "Produit défectueux, service non rendu, abonnement abusif." },
  { id: 'bail', label: 'Bail & immobilier', description: "Loyer impayé, dépôt de garantie, charges, congé donné, troubles voisinage." },
  { id: 'succession', label: 'Succession', description: "Partage, héritage contesté, donations, indivision." },
  { id: 'recouvrement', label: 'Recouvrement', description: "Facture impayée, créance commerciale, mise en demeure." },
];

// Fields conditionnels par typologie
const FIELDS: Record<Typology, { id: string; label: string; help?: string; type?: 'text' | 'date' | 'textarea' }[]> = {
  'prud-hommes': [
    { id: 'employer', label: "Nom de l'employeur" },
    { id: 'contractStart', label: "Date d'embauche", type: 'date' },
    { id: 'ruptureDate', label: 'Date de la rupture', type: 'date', help: "Si elle a eu lieu — sinon laisser vide." },
    { id: 'situation', label: 'Situation actuelle', type: 'textarea', help: "Quelques phrases : ce qui s'est passé, quand, et ce que vous attendez." },
  ],
  divorce: [
    { id: 'marriageDate', label: 'Date du mariage', type: 'date' },
    { id: 'separationDate', label: "Date de séparation (de fait)", type: 'date', help: "Si applicable." },
    { id: 'children', label: 'Nombre d\'enfants concernés' },
    { id: 'situation', label: 'Contexte', type: 'textarea', help: "Sans détails identifiants tant que vous le souhaitez." },
  ],
  consommation: [
    { id: 'merchant', label: 'Vendeur / prestataire' },
    { id: 'purchaseDate', label: "Date d'achat ou de souscription", type: 'date' },
    { id: 'amount', label: 'Montant en jeu (€)' },
    { id: 'situation', label: 'Que s\'est-il passé ?', type: 'textarea' },
  ],
  bail: [
    { id: 'role', label: 'Vous êtes', help: 'Locataire ou bailleur ?' },
    { id: 'address', label: 'Adresse du logement (ville suffit pour le moment)' },
    { id: 'startDate', label: 'Date d\'entrée dans les lieux', type: 'date' },
    { id: 'situation', label: 'Litige en cours', type: 'textarea' },
  ],
  succession: [
    { id: 'deathDate', label: 'Date du décès', type: 'date' },
    { id: 'heirCount', label: 'Nombre d\'héritiers connus' },
    { id: 'situation', label: 'Nature du désaccord', type: 'textarea' },
  ],
  recouvrement: [
    { id: 'debtor', label: 'Débiteur (particulier ou société)' },
    { id: 'invoiceDate', label: 'Date de la facture', type: 'date' },
    { id: 'amount', label: 'Montant dû (€)' },
    { id: 'situation', label: 'Historique des relances', type: 'textarea' },
  ],
};

export function DossierFlow() {
  const [draft, setDraft] = useState<Draft>({ answers: {}, step: 1, updatedAt: new Date().toISOString() });
  const [restored, setRestored] = useState(false);

  // Restore from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Draft;
        if (parsed && typeof parsed === 'object') {
          setDraft({
            typology: parsed.typology,
            answers: parsed.answers ?? {},
            step: (parsed.step ?? 1) as 1 | 2 | 3,
            updatedAt: parsed.updatedAt ?? new Date().toISOString(),
          });
          setRestored(true);
        }
      }
    } catch {
      /* localStorage unavailable */
    }
  }, []);

  // Persist
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch {
      /* noop */
    }
  }, [draft]);

  function selectTypology(id: Typology) {
    setDraft((d) => ({ ...d, typology: id, step: 2, updatedAt: new Date().toISOString() }));
  }

  function handleStep2Submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const answers: DraftAnswers = {};
    data.forEach((value, key) => {
      answers[key] = String(value);
    });
    setDraft((d) => ({ ...d, answers, step: 3, updatedAt: new Date().toISOString() }));
  }

  function resetDraft() {
    setDraft({ answers: {}, step: 1, updatedAt: new Date().toISOString() });
    setRestored(false);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* noop */
    }
  }

  function backToStep1() {
    setDraft((d) => ({ ...d, step: 1, updatedAt: new Date().toISOString() }));
  }

  function backToStep2() {
    setDraft((d) => ({ ...d, step: 2, updatedAt: new Date().toISOString() }));
  }

  return (
    <>
      <Seo
        title="Créer un dossier"
        description="Créez un dossier juridique en trois étapes — typologie, informations clés, récapitulatif. Sauvegarde automatique."
        path="/dossier/nouveau"
        jsonLd={breadcrumbSchema([
          { name: 'Accueil', path: '/' },
          { name: 'Créer un dossier', path: '/dossier/nouveau' },
        ])}
      />

      <section className="bg-cream-50">
        <div className="mx-auto max-w-4xl px-5 py-16 sm:px-8 lg:px-12">
          <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-500">
            Création dossier · {draft.step} / 3
          </p>
          <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.05] text-navy-900 sm:text-5xl">
            {draft.step === 1 && "Quelle est la nature de votre dossier ?"}
            {draft.step === 2 && "Quelques informations pour structurer."}
            {draft.step === 3 && "Récapitulatif avant transmission."}
          </h1>

          {restored && draft.step === 1 && draft.typology && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-5 inline-flex items-center gap-2 rounded-full border hairline-gold bg-cream-50 px-3 py-1.5 text-xs font-medium text-navy-900"
            >
              <span className="h-1 w-1 rounded-full bg-gold-500" />
              Brouillon restauré depuis votre dernière visite
            </motion.div>
          )}

          {/* Progress */}
          <div className="mt-8 flex items-center gap-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="flex flex-1 items-center gap-3">
                <span
                  className={`grid h-7 w-7 place-items-center rounded-full font-mono text-[0.7rem] font-semibold transition-colors ${
                    draft.step >= n ? 'bg-navy-900 text-cream-50' : 'border hairline-strong bg-white text-slate-400'
                  }`}
                >
                  {draft.step > n ? <CheckIcon width={12} height={12} strokeWidth={2.5} /> : n}
                </span>
                {n < 3 && (
                  <span
                    className={`h-px flex-1 transition-colors ${
                      draft.step > n ? 'bg-navy-900' : 'bg-slate-300/40'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Step content */}
      <section className="bg-cream-50 pb-24">
        <div className="mx-auto max-w-4xl px-5 sm:px-8 lg:px-12">
          <AnimatePresence mode="wait">
            <motion.div
              key={draft.step}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              {draft.step === 1 && (
                <Step1 selected={draft.typology} onSelect={selectTypology} />
              )}
              {draft.step === 2 && draft.typology && (
                <Step2
                  typology={draft.typology}
                  defaults={draft.answers}
                  onSubmit={handleStep2Submit}
                  onBack={backToStep1}
                />
              )}
              {draft.step === 3 && draft.typology && (
                <Step3
                  typology={draft.typology}
                  answers={draft.answers}
                  onReset={resetDraft}
                  onEdit={backToStep2}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </section>
    </>
  );
}

function Step1({ selected, onSelect }: { selected?: Typology; onSelect: (id: Typology) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {TYPOLOGIES.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onSelect(t.id)}
          className={`group flex h-full flex-col rounded-2xl border p-6 text-left transition-all duration-300 hover:-translate-y-1 ${
            selected === t.id
              ? 'border-gold-500 bg-white shadow-card-hover'
              : 'hairline bg-white hover:border-gold-500 hover:shadow-card'
          }`}
        >
          <p className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-gold-500">
            Typologie
          </p>
          <h2 className="mt-3 font-display text-xl font-semibold leading-tight text-navy-900 sm:text-2xl">
            {t.label}
          </h2>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-500">{t.description}</p>
          <span className="mt-5 inline-flex items-center gap-1.5 self-start text-sm font-medium text-navy-900">
            Choisir
            <ArrowRightIcon width={14} height={14} strokeWidth={2} className="transition-transform group-hover:translate-x-0.5" />
          </span>
        </button>
      ))}
    </div>
  );
}

function Step2({
  typology,
  defaults,
  onSubmit,
  onBack,
}: {
  typology: Typology;
  defaults: DraftAnswers;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onBack: () => void;
}) {
  const fields = FIELDS[typology];
  return (
    <form onSubmit={onSubmit} className="rounded-2xl border hairline bg-white p-7 shadow-card sm:p-9" noValidate>
      <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-gold-500">
        {TYPOLOGIES.find((t) => t.id === typology)?.label}
      </p>
      <p className="mt-2 text-sm text-slate-500">
        Quelques champs structurants. Tout est conservé en brouillon — vous pouvez quitter et
        revenir.
      </p>

      <div className="mt-8 space-y-6">
        {fields.map((f) => (
          <label key={f.id} className="block">
            <span className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-slate-400">
              {f.label}
            </span>
            {f.type === 'textarea' ? (
              <textarea
                name={f.id}
                defaultValue={defaults[f.id] ?? ''}
                rows={5}
                className="mt-2 w-full rounded-xl border hairline bg-cream-50 px-4 py-3 text-sm text-navy-900 focus:border-gold-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gold-500/20"
              />
            ) : (
              <input
                name={f.id}
                type={f.type ?? 'text'}
                defaultValue={defaults[f.id] ?? ''}
                className="mt-2 w-full rounded-xl border hairline bg-cream-50 px-4 py-3 text-sm text-navy-900 focus:border-gold-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gold-500/20"
              />
            )}
            {f.help && <span className="mt-1.5 block text-xs italic text-slate-400">{f.help}</span>}
          </label>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t hairline pt-6">
        <button
          type="button"
          onClick={onBack}
          className="rounded-full bg-cream-100 px-5 py-3 text-sm font-medium text-navy-900 transition-colors hover:bg-cream-200"
        >
          ← Changer la typologie
        </button>
        <button
          type="submit"
          className="sheen inline-flex items-center gap-2 rounded-full bg-gold-500 px-6 py-3.5 text-sm font-semibold text-navy-900 shadow-gold transition-all duration-200 hover:-translate-y-0.5"
        >
          Voir le récapitulatif
          <ArrowRightIcon width={14} height={14} strokeWidth={2} />
        </button>
      </div>
    </form>
  );
}

function Step3({
  typology,
  answers,
  onReset,
  onEdit,
}: {
  typology: Typology;
  answers: DraftAnswers;
  onReset: () => void;
  onEdit: () => void;
}) {
  const typologyMeta = TYPOLOGIES.find((t) => t.id === typology);
  const fields = FIELDS[typology];

  return (
    <div className="rounded-2xl border hairline bg-white p-7 shadow-card sm:p-9">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-slate-400">
            Dossier · brouillon · #CD-2026-NEW
          </p>
          <h2 className="mt-2 font-display text-2xl font-semibold leading-tight text-navy-900 sm:text-3xl">
            {typologyMeta?.label} — synthèse
          </h2>
        </div>
        <span className="shrink-0 rounded-full bg-gold-500/12 px-3 py-1.5 font-mono text-[0.7rem] font-medium text-navy-900 border hairline-gold">
          Brouillon
        </span>
      </div>

      <dl className="mt-7 divide-y hairline border-y hairline">
        {fields.map((f) => (
          <div key={f.id} className="flex flex-col gap-1 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
            <dt className="text-sm font-medium text-slate-500">{f.label}</dt>
            <dd className="max-w-md text-sm text-navy-900 sm:text-right">
              {answers[f.id]?.trim() || <span className="italic text-slate-400">Non renseigné</span>}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-7 rounded-xl bg-cream-100 p-5">
        <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-gold-500">
          Prochaine étape
        </p>
        <p className="mt-2 text-sm leading-relaxed text-navy-900">
          Soumettre le dossier le placera en attente de prise en charge par un avocat habilité.
          Vous serez notifié dès qu'une décision est rendue — validation, demande de pièce, ou
          motivation de non prise en charge.
        </p>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onEdit}
          className="text-sm font-medium text-navy-900 border-b hairline-gold pb-0.5 hover:text-gold-500"
        >
          ← Modifier les informations
        </button>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onReset}
            className="rounded-full bg-cream-100 px-5 py-3 text-sm font-medium text-navy-900 hover:bg-cream-200"
          >
            Supprimer ce brouillon
          </button>
          <Link
            to="/contact"
            className="sheen inline-flex items-center gap-2 rounded-full bg-gold-500 px-6 py-3.5 text-sm font-semibold text-navy-900 shadow-gold transition-all duration-200 hover:-translate-y-0.5"
          >
            Soumettre à un avocat
            <ArrowRightIcon width={14} height={14} strokeWidth={2} />
          </Link>
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-slate-400">
        Showcase : aucune soumission réelle. Le brouillon reste dans votre navigateur (localStorage).
      </p>
    </div>
  );
}
