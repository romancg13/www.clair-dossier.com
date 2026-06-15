import { useEffect, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { Seo, breadcrumbSchema } from '../lib/seo';
import { ArrowRightIcon, CheckIcon, WhatsAppIcon } from '../components/icons';
import { openWhatsApp } from '../lib/whatsapp';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';

type Typology =
  | 'litige-commercial'
  | 'recouvrement'
  | 'administratif'
  | 'bail'
  | 'consommation'
  | 'prud-hommes'
  | 'divorce'
  | 'succession';

type DraftAnswers = Record<string, string>;
type Step = 1 | 2 | 3 | 4;

type Draft = {
  typology?: Typology;
  answers: DraftAnswers;
  step: Step;
  updatedAt: string;
};

const STORAGE_KEY = 'clairdossier_draft';
const TEAM_EMAIL = 'contact.clairdossier@icloud.com';

const TYPOLOGIES: { id: Typology; label: string; description: string }[] = [
  { id: 'litige-commercial', label: 'Litige commercial', description: 'Contrat non honoré, prestation litigieuse, conflit entre entreprises.' },
  { id: 'recouvrement', label: 'Recouvrement', description: 'Facture impayée, créance commerciale, mise en demeure.' },
  { id: 'administratif', label: 'Dossier administratif', description: "URSSAF, impôts, contrôle, recours administratif, demande d'aide." },
  { id: 'bail', label: 'Bail & immobilier', description: 'Loyer impayé, bail commercial, charges, dépôt de garantie.' },
  { id: 'consommation', label: 'Litige client / fournisseur', description: 'Produit défectueux, service non rendu, abonnement abusif.' },
  { id: 'prud-hommes', label: "Prud'hommes", description: 'Licenciement, rupture, harcèlement, heures supplémentaires.' },
  { id: 'divorce', label: 'Divorce / famille', description: 'Séparation, garde, prestation compensatoire, autorité parentale.' },
  { id: 'succession', label: 'Succession', description: 'Partage, héritage contesté, donations, indivision.' },
];

const FIELDS: Record<Typology, { id: string; label: string; help?: string; type?: 'text' | 'date' | 'textarea' }[]> = {
  'litige-commercial': [
    { id: 'counterparty', label: 'Partie adverse (société)' },
    { id: 'contractDate', label: 'Date du contrat / de la commande', type: 'date' },
    { id: 'amount', label: 'Montant en jeu (€)' },
    { id: 'deadline', label: 'Échéance / date limite', type: 'date', help: 'Pour les relances automatiques à échéance.' },
    { id: 'situation', label: 'Que s\'est-il passé ?', type: 'textarea' },
  ],
  recouvrement: [
    { id: 'debtor', label: 'Débiteur (particulier ou société)' },
    { id: 'invoiceDate', label: 'Date de la facture', type: 'date' },
    { id: 'amount', label: 'Montant dû (€)' },
    { id: 'deadline', label: 'Échéance de paiement', type: 'date', help: 'Pour les relances automatiques à échéance.' },
    { id: 'situation', label: 'Historique des relances', type: 'textarea' },
  ],
  administratif: [
    { id: 'organisme', label: 'Organisme concerné', help: 'URSSAF, DGFiP, préfecture, mairie…' },
    { id: 'refDossier', label: 'Référence du dossier' },
    { id: 'deadline', label: 'Date limite / échéance', type: 'date', help: 'Pour ne manquer aucun délai.' },
    { id: 'situation', label: 'Nature de la demande', type: 'textarea' },
  ],
  bail: [
    { id: 'role', label: 'Vous êtes', help: 'Locataire ou bailleur ?' },
    { id: 'address', label: 'Adresse du local (ville suffit pour le moment)' },
    { id: 'startDate', label: 'Date d\'entrée dans les lieux', type: 'date' },
    { id: 'situation', label: 'Litige en cours', type: 'textarea' },
  ],
  consommation: [
    { id: 'merchant', label: 'Vendeur / prestataire / client' },
    { id: 'purchaseDate', label: 'Date d\'achat ou de souscription', type: 'date' },
    { id: 'amount', label: 'Montant en jeu (€)' },
    { id: 'situation', label: 'Que s\'est-il passé ?', type: 'textarea' },
  ],
  'prud-hommes': [
    { id: 'employer', label: "Nom de l'employeur" },
    { id: 'contractStart', label: "Date d'embauche", type: 'date' },
    { id: 'ruptureDate', label: 'Date de la rupture', type: 'date', help: 'Si elle a eu lieu — sinon laisser vide.' },
    { id: 'situation', label: 'Situation actuelle', type: 'textarea', help: "Quelques phrases : ce qui s'est passé, quand, et ce que vous attendez." },
  ],
  divorce: [
    { id: 'marriageDate', label: 'Date du mariage', type: 'date' },
    { id: 'separationDate', label: 'Date de séparation (de fait)', type: 'date', help: 'Si applicable.' },
    { id: 'children', label: 'Nombre d\'enfants concernés' },
    { id: 'situation', label: 'Contexte', type: 'textarea' },
  ],
  succession: [
    { id: 'deathDate', label: 'Date du décès', type: 'date' },
    { id: 'heirCount', label: 'Nombre d\'héritiers connus' },
    { id: 'situation', label: 'Nature du désaccord', type: 'textarea' },
  ],
};

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80);
}

export function DossierFlow() {
  const { user } = useAuth();
  const [draft, setDraft] = useState<Draft>({ answers: {}, step: 1, updatedAt: new Date().toISOString() });
  const [restored, setRestored] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [legalReview, setLegalReview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saveWarning, setSaveWarning] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Draft;
        if (parsed && typeof parsed === 'object') {
          setDraft({
            typology: parsed.typology,
            answers: parsed.answers ?? {},
            step: (parsed.step ?? 1) as Step,
            updatedAt: parsed.updatedAt ?? new Date().toISOString(),
          });
          setRestored(true);
        }
      }
    } catch {
      /* localStorage unavailable */
    }
  }, []);

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
    const data = new FormData(e.currentTarget);
    const answers: DraftAnswers = {};
    data.forEach((value, key) => {
      answers[key] = String(value);
    });
    setDraft((d) => ({ ...d, answers, step: 3, updatedAt: new Date().toISOString() }));
  }

  function resetDraft() {
    setDraft({ answers: {}, step: 1, updatedAt: new Date().toISOString() });
    setFiles([]);
    setLegalReview(false);
    setDone(false);
    setSaveWarning(null);
    setRestored(false);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* noop */
    }
  }

  const typologyMeta = TYPOLOGIES.find((t) => t.id === draft.typology);
  const fields = draft.typology ? FIELDS[draft.typology] : [];

  function buildSynthesis(): string {
    const lines = fields
      .map((f) => `• ${f.label} : ${draft.answers[f.id]?.trim() || 'Non renseigné'}`)
      .join('\n');
    const docLine = files.length ? `\nPièces jointes : ${files.length} document(s) déposé(s) dans le compte.` : '';
    const reviewLine = legalReview
      ? '\nOption demandée : préavis juridique + résumé de la situation à valider par un professionnel du droit.'
      : '';
    return (
      `Bonjour ClairDossier,\n\n` +
      `Je souhaite transmettre un dossier « ${typologyMeta?.label ?? draft.typology} ».\n\n` +
      `Synthèse :\n${lines}${docLine}${reviewLine}\n\n` +
      `Compte : ${user?.email ?? 'non précisé'}\n` +
      `Pouvez-vous me confirmer la prise en charge ? Merci.`
    );
  }

  async function persistDossier(): Promise<void> {
    if (!user || !draft.typology) return;
    setSaveWarning(null);
    try {
      const { data, error } = await supabase
        .from('dossiers')
        .insert({
          user_id: user.id,
          typology: draft.typology,
          title: typologyMeta?.label ?? draft.typology,
          answers: draft.answers,
          legal_review_requested: legalReview,
          status: 'transmis',
        })
        .select('id')
        .single();
      if (error || !data) {
        setSaveWarning("Le dossier n'a pas pu être enregistré dans votre compte, mais l'envoi a bien été préparé.");
        return;
      }
      const dossierId = data.id as string;
      for (const file of files) {
        const path = `${user.id}/${dossierId}/${Date.now()}-${sanitizeName(file.name)}`;
        const up = await supabase.storage.from('documents').upload(path, file, { upsert: false });
        if (!up.error) {
          await supabase.from('dossier_documents').insert({
            dossier_id: dossierId,
            user_id: user.id,
            file_path: path,
            file_name: file.name,
            size_bytes: file.size,
          });
        }
      }
    } catch {
      setSaveWarning("Le dossier n'a pas pu être enregistré dans votre compte, mais l'envoi a bien été préparé.");
    }
  }

  async function finalize(method: 'whatsapp' | 'email') {
    setSubmitting(true);
    await persistDossier();
    const synthesis = buildSynthesis();
    if (method === 'whatsapp') {
      openWhatsApp(synthesis);
    } else {
      const subject = `Nouveau dossier ${typologyMeta?.label ?? ''}`.trim();
      const mailto = `mailto:${TEAM_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(synthesis)}`;
      window.location.href = mailto;
    }
    setSubmitting(false);
    setDone(true);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* noop */
    }
  }

  return (
    <>
      <Seo
        title="Créer un dossier"
        description="Créez un dossier administratif ou juridique structuré : typologie, informations, documents, transmission. Sauvegardé dans votre compte."
        path="/dossier/nouveau"
        jsonLd={breadcrumbSchema([
          { name: 'Accueil', path: '/' },
          { name: 'Créer un dossier', path: '/dossier/nouveau' },
        ])}
      />

      <section className="bg-cream-50">
        <div className="mx-auto max-w-4xl px-5 py-16 sm:px-8 lg:px-12">
          <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-700">
            Création dossier · {done ? 'terminé' : `${draft.step} / 4`}
          </p>
          <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.05] text-navy-900 sm:text-5xl">
            {done && 'Dossier transmis.'}
            {!done && draft.step === 1 && 'Quelle est la nature de votre dossier ?'}
            {!done && draft.step === 2 && 'Quelques informations pour structurer.'}
            {!done && draft.step === 3 && 'Ajoutez vos documents.'}
            {!done && draft.step === 4 && 'Récapitulatif avant transmission.'}
          </h1>

          {restored && draft.step === 1 && draft.typology && !done && (
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border hairline-gold bg-cream-50 px-3 py-1.5 text-xs font-medium text-navy-900">
              <span className="h-1 w-1 rounded-full bg-gold-500" />
              Brouillon restauré depuis votre dernière visite
            </div>
          )}

          {!done && (
            <div className="mt-8 flex items-center gap-3">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="flex flex-1 items-center gap-3">
                  <span
                    className={`grid h-7 w-7 place-items-center rounded-full font-mono text-[0.7rem] font-semibold transition-colors ${
                      draft.step >= n ? 'bg-navy-900 text-cream-50' : 'border hairline-strong bg-white text-slate-500'
                    }`}
                  >
                    {draft.step > n ? <CheckIcon width={12} height={12} strokeWidth={2.5} /> : n}
                  </span>
                  {n < 4 && (
                    <span className={`h-px flex-1 transition-colors ${draft.step > n ? 'bg-navy-900' : 'bg-slate-300/40'}`} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="bg-cream-50 pb-14 sm:pb-20 lg:pb-24">
        <div className="mx-auto max-w-4xl px-5 sm:px-8 lg:px-12">
          {done ? (
            <SuccessCard onReset={resetDraft} warning={saveWarning} />
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={draft.step}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              >
                {draft.step === 1 && <Step1 selected={draft.typology} onSelect={selectTypology} />}
                {draft.step === 2 && draft.typology && (
                  <Step2
                    typology={draft.typology}
                    defaults={draft.answers}
                    onSubmit={handleStep2Submit}
                    onBack={() => setDraft((d) => ({ ...d, step: 1 }))}
                  />
                )}
                {draft.step === 3 && draft.typology && (
                  <Step3Documents
                    files={files}
                    onAdd={(fl) => setFiles((cur) => [...cur, ...fl])}
                    onRemove={(i) => setFiles((cur) => cur.filter((_, idx) => idx !== i))}
                    onBack={() => setDraft((d) => ({ ...d, step: 2 }))}
                    onNext={() => setDraft((d) => ({ ...d, step: 4, updatedAt: new Date().toISOString() }))}
                  />
                )}
                {draft.step === 4 && draft.typology && (
                  <Step4Recap
                    typologyLabel={typologyMeta?.label ?? draft.typology}
                    fields={fields}
                    answers={draft.answers}
                    fileCount={files.length}
                    legalReview={legalReview}
                    onToggleReview={setLegalReview}
                    submitting={submitting}
                    onSend={finalize}
                    onEdit={() => setDraft((d) => ({ ...d, step: 2 }))}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          )}
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
            selected === t.id ? 'border-gold-500 bg-white shadow-card-hover' : 'hairline bg-white hover:border-gold-500 hover:shadow-card'
          }`}
        >
          <p className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-gold-700">Typologie</p>
          <h2 className="mt-3 font-display text-xl font-semibold leading-tight text-navy-900 sm:text-2xl">{t.label}</h2>
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
  const inputCls =
    'mt-2 w-full rounded-xl border hairline bg-cream-50 px-4 py-3 text-sm text-navy-900 focus:border-gold-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gold-500/20';
  return (
    <form onSubmit={onSubmit} className="rounded-2xl border hairline bg-white p-7 shadow-card sm:p-9" noValidate>
      <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-gold-700">
        {TYPOLOGIES.find((t) => t.id === typology)?.label}
      </p>
      <p className="mt-2 text-sm text-slate-500">Quelques champs structurants. Tout est conservé en brouillon.</p>
      <div className="mt-8 space-y-6">
        {fields.map((f) => (
          <label key={f.id} className="block">
            <span className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-slate-500">{f.label}</span>
            {f.type === 'textarea' ? (
              <textarea name={f.id} defaultValue={defaults[f.id] ?? ''} rows={5} className={inputCls} />
            ) : (
              <input name={f.id} type={f.type ?? 'text'} defaultValue={defaults[f.id] ?? ''} className={inputCls} />
            )}
            {f.help && <span className="mt-1.5 block text-xs italic text-slate-500">{f.help}</span>}
          </label>
        ))}
      </div>
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t hairline pt-6">
        <button type="button" onClick={onBack} className="rounded-full bg-cream-100 px-5 py-3 text-sm font-medium text-navy-900 transition-colors hover:bg-cream-200">
          ← Changer la typologie
        </button>
        <button type="submit" className="sheen inline-flex items-center gap-2 rounded-full bg-gold-500 px-6 py-3.5 text-sm font-semibold text-navy-900 shadow-gold transition-all duration-200 hover:-translate-y-0.5">
          Ajouter des documents
          <ArrowRightIcon width={14} height={14} strokeWidth={2} />
        </button>
      </div>
    </form>
  );
}

function Step3Documents({
  files,
  onAdd,
  onRemove,
  onBack,
  onNext,
}: {
  files: File[];
  onAdd: (files: File[]) => void;
  onRemove: (index: number) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="rounded-2xl border hairline bg-white p-7 shadow-card sm:p-9">
      <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-gold-700">Pièces du dossier</p>
      <p className="mt-2 text-sm leading-relaxed text-slate-500">
        Déposez vos documents (contrats, courriers, factures, mises en demeure…). PDF, images,
        Word. Ils sont rattachés à votre dossier dans votre compte.
      </p>

      <label className="mt-7 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed hairline-strong bg-cream-50 px-6 py-12 text-center transition-colors hover:border-gold-500 hover:bg-white">
        <span className="font-display text-lg font-semibold text-navy-900">Cliquez pour ajouter des fichiers</span>
        <span className="text-xs text-slate-500">ou glissez-déposez · PDF, JPG, PNG, DOCX</span>
        <input
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.txt"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) onAdd(Array.from(e.target.files));
            e.currentTarget.value = '';
          }}
        />
      </label>

      {files.length > 0 && (
        <ul className="mt-5 space-y-2">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-3 rounded-xl border hairline bg-cream-50 px-4 py-3 text-sm">
              <span className="truncate text-navy-900">{f.name}</span>
              <button type="button" onClick={() => onRemove(i)} className="shrink-0 text-xs font-medium text-slate-500 hover:text-red-600">
                Retirer
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t hairline pt-6">
        <button type="button" onClick={onBack} className="rounded-full bg-cream-100 px-5 py-3 text-sm font-medium text-navy-900 transition-colors hover:bg-cream-200">
          ← Informations
        </button>
        <button type="button" onClick={onNext} className="sheen inline-flex items-center gap-2 rounded-full bg-gold-500 px-6 py-3.5 text-sm font-semibold text-navy-900 shadow-gold transition-all duration-200 hover:-translate-y-0.5">
          {files.length ? 'Continuer' : 'Passer cette étape'}
          <ArrowRightIcon width={14} height={14} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

function Step4Recap({
  typologyLabel,
  fields,
  answers,
  fileCount,
  legalReview,
  onToggleReview,
  submitting,
  onSend,
  onEdit,
}: {
  typologyLabel: string;
  fields: { id: string; label: string }[];
  answers: DraftAnswers;
  fileCount: number;
  legalReview: boolean;
  onToggleReview: (v: boolean) => void;
  submitting: boolean;
  onSend: (method: 'whatsapp' | 'email') => void;
  onEdit: () => void;
}) {
  return (
    <div className="rounded-2xl border hairline bg-white p-7 shadow-card sm:p-9">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Dossier · brouillon</p>
          <h2 className="mt-2 font-display text-2xl font-semibold leading-tight text-navy-900 sm:text-3xl">{typologyLabel} — synthèse</h2>
        </div>
        <span className="shrink-0 rounded-full bg-gold-500/12 px-3 py-1.5 font-mono text-[0.7rem] font-medium text-navy-900 border hairline-gold">Brouillon</span>
      </div>

      <dl className="mt-7 divide-y hairline border-y hairline">
        {fields.map((f) => (
          <div key={f.id} className="flex flex-col gap-1 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
            <dt className="text-sm font-medium text-slate-500">{f.label}</dt>
            <dd className="max-w-md text-sm text-navy-900 sm:text-right">
              {answers[f.id]?.trim() || <span className="italic text-slate-500">Non renseigné</span>}
            </dd>
          </div>
        ))}
        <div className="flex items-center justify-between py-4 text-sm">
          <dt className="font-medium text-slate-500">Pièces jointes</dt>
          <dd className="text-navy-900">{fileCount} document(s)</dd>
        </div>
      </dl>

      {/* Option : revue juridique */}
      <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-xl bg-cream-100 p-5">
        <input type="checkbox" checked={legalReview} onChange={(e) => onToggleReview(e.target.checked)} className="mt-1 h-4 w-4 accent-gold-500" />
        <span className="text-sm leading-relaxed text-navy-900">
          <span className="font-semibold">Option — préavis juridique</span> : recevoir un préavis
          juridique et un résumé de la situation, à valider par un professionnel du droit. Vous
          restez libre de votre suite.
        </span>
      </label>

      <div className="mt-7 rounded-xl bg-cream-100 p-5">
        <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-gold-700">Transmission</p>
        <p className="mt-2 text-sm leading-relaxed text-navy-900">
          Votre dossier est enregistré dans votre compte, puis transmis par le canal de votre choix.
          Vous gardez le dernier clic — rien ne part sans votre validation.
        </p>
      </div>

      <div className="mt-8 flex flex-col gap-3 border-t hairline pt-6 sm:flex-row sm:items-center sm:justify-between">
        <button type="button" onClick={onEdit} className="text-sm font-medium text-navy-900 border-b hairline-gold pb-0.5 hover:text-gold-700 sm:self-center">
          ← Modifier
        </button>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={submitting}
            onClick={() => onSend('email')}
            className="inline-flex items-center gap-2 rounded-full border hairline bg-white px-5 py-3.5 text-sm font-medium text-navy-900 transition-colors hover:border-navy-900 disabled:opacity-60"
          >
            <MailIcon /> E-mail
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => onSend('whatsapp')}
            className="sheen inline-flex items-center gap-2 rounded-full bg-gold-500 px-6 py-3.5 text-sm font-semibold text-navy-900 shadow-gold transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-60"
          >
            <WhatsAppIcon width={16} height={16} />
            {submitting ? 'Envoi…' : 'WhatsApp'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SuccessCard({ onReset, warning }: { onReset: () => void; warning: string | null }) {
  return (
    <div className="rounded-2xl border hairline bg-white p-8 text-center shadow-card sm:p-12">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-600">
        <CheckIcon width={26} height={26} strokeWidth={2.5} />
      </span>
      <h2 className="mt-6 font-display text-2xl font-semibold text-navy-900 sm:text-3xl">Dossier enregistré et transmis</h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-500">
        Votre dossier est sauvegardé dans votre compte. Finalisez l'envoi dans l'application qui
        vient de s'ouvrir (WhatsApp ou e-mail) pour valider la transmission à notre équipe.
      </p>
      {warning && <p className="mx-auto mt-4 max-w-md rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">{warning}</p>}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link to="/compte" className="sheen inline-flex items-center gap-2 rounded-full bg-gold-500 px-6 py-3.5 text-sm font-semibold text-navy-900 shadow-gold hover:-translate-y-0.5">
          Voir mes dossiers
          <ArrowRightIcon width={14} height={14} strokeWidth={2} />
        </Link>
        <button type="button" onClick={onReset} className="rounded-full bg-cream-100 px-6 py-3.5 text-sm font-medium text-navy-900 hover:bg-cream-200">
          Créer un autre dossier
        </button>
      </div>
    </div>
  );
}

function MailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 7 9-7" />
    </svg>
  );
}
