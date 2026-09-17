import { useEffect, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Seo, breadcrumbSchema } from "../lib/seo";
import { ArrowRightIcon, CheckIcon } from "../components/icons";
import {
  fetchMyEntitlement,
  hasQuotaEngine,
  sanitizeFileName,
  validateUpload,
} from "../lib/dossier-workspace";
import {
  blankDraft,
  cleanAnswers,
  isUuid,
  loadDraft,
  removeDraft,
  saveDraft,
  type TunnelDraft,
} from "../lib/drafts";
// Profils, typologies et champs du tunnel : source unique partagée avec
// l'application mobile (packages/core) — mêmes valeurs écrites en base.
import {
  CATEGORIES,
  PROFILS,
  fieldsFor,
  parseDossierEntitlement,
  parseSubmissionError,
  quotaLimitMessage,
  quotaReached,
  type Category,
  type DossierEntitlement,
  type Profil,
} from "../../packages/core/src/index";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";

type DraftAnswers = Record<string, string>;

const AI_OPTION_TEXT =
  "Obtenez un premier résumé du dossier, identifiez les pièces utiles et préparez les éléments à faire valider par un professionnel du droit.";

type Saved = { dossierId: string; alreadySaved: boolean; warning: string | null };

export function DossierFlow() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const requestedDraft = params.get("brouillon");

  // Chaque ouverture sans brouillon demandé = dossier VIERGE (nouvel identifiant).
  const [draft, setDraft] = useState<TunnelDraft>(() => {
    const resumed = requestedDraft ? loadDraft(requestedDraft) : null;
    return resumed ?? blankDraft();
  });
  const [restored, setRestored] = useState(() => Boolean(requestedDraft && loadDraft(requestedDraft)));
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [legalReview, setLegalReview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [entitlement, setEntitlement] = useState<DossierEntitlement | null>(null);
  const submittingRef = useRef(false);

  // Chaque navigation vers « nouveau dossier » (même depuis cette page) repart
  // d'un état VIERGE ; « reprendre » charge uniquement le brouillon demandé.
  // Le brouillon en cours reste sauvegardé et reprenable depuis « Mon compte ».
  const location = useLocation();
  const firstNavigation = useRef(true);
  useEffect(() => {
    if (firstNavigation.current) {
      firstNavigation.current = false;
      return;
    }
    const resumed = requestedDraft ? loadDraft(requestedDraft) : null;
    setRestored(Boolean(resumed));
    setDraft(resumed ?? blankDraft());
    setSaved(null);
    setFiles([]);
    setLegalReview(false);
    setSubmitError(null);
    setNameError(null);
    setUploadError(null);
  }, [location.key, requestedDraft]);

  // Sauvegarde automatique — uniquement CE brouillon, sous son identifiant.
  useEffect(() => {
    if (!saved) saveDraft(draft);
  }, [draft, saved]);

  // Information préventive sur le quota (la décision reste au serveur).
  useEffect(() => {
    let active = true;
    void fetchMyEntitlement().then((raw) => {
      if (active) setEntitlement(parseDossierEntitlement(raw));
    });
    return () => {
      active = false;
    };
  }, [user?.id]);

  function update(patch: Partial<TunnelDraft>) {
    setDraft((d) => ({ ...d, ...patch, updatedAt: new Date().toISOString() }));
  }

  function selectProfil(id: Profil) {
    update({ profil: id, step: 2 });
  }

  // Sélection d'une catégorie prédéfinie — reste sur l'étape 2 (le client nomme
  // ensuite son dossier juste en dessous des catégories).
  function selectCategory(id: Category) {
    update({ typology: id });
  }

  // Nom du dossier OBLIGATOIRE, saisi sous les catégories (cf. cahier directeur).
  function confirmCategory() {
    if (!draft.typology) return;
    if (!draft.title?.trim()) {
      setNameError("Donnez un nom à votre dossier pour le retrouver facilement.");
      return;
    }
    setNameError(null);
    update({ step: 3 });
  }

  function handleInfoSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const answers: DraftAnswers = {};
    data.forEach((value, key) => {
      answers[key] = String(value);
    });
    // Un champ laissé vide n'est jamais enregistré comme valeur.
    update({ answers: cleanAnswers(answers), step: 4 });
  }

  function startNewDossier() {
    navigate("/dossier/nouveau");
  }

  const profilMeta = PROFILS.find((p) => p.id === draft.profil);
  const categoryMeta = CATEGORIES.find((c) => c.id === draft.typology);
  const fields = draft.typology ? fieldsFor(draft.typology as Category) : [];
  const isPreContentieux = draft.typology === "impaye-precontentieux";

  async function uploadFiles(dossierId: string): Promise<number> {
    if (!user) return 0;
    let failures = 0;
    for (const file of files) {
      const path = `${user.id}/${dossierId}/${Date.now()}-${sanitizeFileName(file.name)}`;
      const up = await supabase.storage.from("documents").upload(path, file, { upsert: false });
      if (up.error) {
        failures++;
        continue;
      }
      const ins = await supabase.from("dossier_documents").insert({
        dossier_id: dossierId,
        user_id: user.id,
        file_path: path,
        file_name: file.name,
        size_bytes: file.size,
      });
      if (ins.error) failures++;
    }
    return failures;
  }

  // Étape 5 : validation DIRECTE dans ClairDossier. Aucun envoi e-mail/WhatsApp.
  async function submit() {
    if (!user || !draft.typology || submittingRef.current) return;
    const title = draft.title?.trim();
    if (!title) {
      setSubmitError("Donnez un nom à votre dossier avant de le valider.");
      update({ step: 2 });
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const withKey = (await hasQuotaEngine()) && isUuid(draft.id);
      const answers: DraftAnswers = {
        ...cleanAnswers(draft.answers),
        ...(draft.profil ? { profil: draft.profil } : {}),
      };
      const { data, error } = await supabase
        .from("dossiers")
        .insert({
          user_id: user.id,
          typology: draft.typology,
          title,
          answers,
          legal_review_requested: isPreContentieux && legalReview,
          status: "transmis",
          ...(withKey ? { client_request_id: draft.id } : {}),
        })
        .select("id")
        .single();

      let dossierId = (data as { id: string } | null)?.id ?? null;
      let alreadySaved = false;

      if (error) {
        const failure = parseSubmissionError(error);
        if (failure?.kind === "duplicate" && withKey) {
          // Double clic / double onglet : le dossier existe déjà, on le retrouve.
          const { data: existing } = await supabase
            .from("dossiers")
            .select("id")
            .eq("user_id", user.id)
            .eq("client_request_id", draft.id)
            .maybeSingle();
          dossierId = (existing as { id: string } | null)?.id ?? null;
          alreadySaved = true;
        } else {
          setSubmitError(
            failure?.message ??
              "Votre dossier n'a pas pu être enregistré. Vérifiez votre connexion puis réessayez.",
          );
          if (failure?.kind === "quota") {
            setEntitlement((e) => (e ? { ...e, used: Math.max(e.used, e.dossierLimit ?? e.used) } : e));
          }
          return;
        }
      }

      if (!dossierId) {
        setSubmitError("Votre dossier n'a pas pu être enregistré. Vérifiez votre connexion puis réessayez.");
        return;
      }

      const failures = alreadySaved ? 0 : await uploadFiles(dossierId);
      removeDraft(draft.id);
      setSaved({
        dossierId,
        alreadySaved,
        warning: failures
          ? `${failures} pièce(s) n'ont pas pu être déposées. Vous pourrez les ajouter depuis la page du dossier.`
          : null,
      });
    } catch {
      setSubmitError("Votre dossier n'a pas pu être enregistré. Vérifiez votre connexion puis réessayez.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  const done = Boolean(saved);
  const blockedByQuota = quotaReached(entitlement);

  return (
    <>
      <Seo
        title="Créer un dossier"
        description="Créez un dossier structuré : profil, nature du dossier, informations, documents, validation. Enregistré dans votre compte."
        path="/dossier/nouveau"
        jsonLd={breadcrumbSchema([
          { name: "Accueil", path: "/" },
          { name: "Créer un dossier", path: "/dossier/nouveau" },
        ])}
      />

      <section className="bg-cream-50">
        <div className="mx-auto max-w-4xl px-5 py-16 sm:px-8 lg:px-12">
          <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-700">
            Création dossier · {done ? "terminé" : `${draft.step} / 5`}
          </p>
          <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.05] text-navy-900 sm:text-5xl">
            {done && "Dossier enregistré."}
            {!done && draft.step === 1 && "Quel est votre profil ?"}
            {!done && draft.step === 2 && "Quelle est la nature de votre dossier ?"}
            {!done && draft.step === 3 && "Quelques informations pour structurer."}
            {!done && draft.step === 4 && "Ajoutez vos documents."}
            {!done && draft.step === 5 && "Récapitulatif avant validation."}
          </h1>

          {restored && !done && (
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border hairline-gold bg-cream-50 px-3 py-1.5 text-xs font-medium text-navy-900">
              <span className="h-1 w-1 rounded-full bg-gold-500" />
              Brouillon repris là où vous l'aviez laissé
            </div>
          )}

          {!done && (
            <div className="mt-8 flex items-center gap-3">
              {[1, 2, 3, 4, 5].map((n) => (
                <div key={n} className="flex flex-1 items-center gap-3">
                  <span
                    className={`grid h-7 w-7 place-items-center rounded-full font-mono text-[0.7rem] font-semibold transition-colors ${
                      draft.step >= n
                        ? "bg-navy-900 text-cream-50"
                        : "border hairline-strong bg-white text-slate-500"
                    }`}
                  >
                    {draft.step > n ? <CheckIcon width={12} height={12} strokeWidth={2.5} /> : n}
                  </span>
                  {n < 5 && (
                    <span
                      className={`h-px flex-1 transition-colors ${draft.step > n ? "bg-navy-900" : "bg-slate-300/40"}`}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="bg-cream-50 pb-14 sm:pb-20 lg:pb-24">
        <div className="mx-auto max-w-4xl px-5 sm:px-8 lg:px-12">
          {saved ? (
            <SuccessCard saved={saved} onNew={startNewDossier} />
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={`${draft.id}-${draft.step}`}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              >
                {draft.step === 1 && (
                  <StepProfil selected={draft.profil as Profil | undefined} onSelect={selectProfil} />
                )}
                {draft.step === 2 && (
                  <StepCategory
                    selected={draft.typology as Category | undefined}
                    title={draft.title ?? ""}
                    nameError={nameError}
                    onSelect={selectCategory}
                    onTitleChange={(v) => {
                      setNameError(null);
                      update({ title: v });
                    }}
                    onContinue={confirmCategory}
                    onBack={() => update({ step: 1 })}
                  />
                )}
                {draft.step === 3 && draft.typology && (
                  <StepInfos
                    key={`${draft.id}-${draft.typology}`}
                    category={draft.typology as Category}
                    defaults={draft.answers}
                    onSubmit={handleInfoSubmit}
                    onBack={() => update({ step: 2 })}
                  />
                )}
                {draft.step === 4 && draft.typology && (
                  <StepDocuments
                    files={files}
                    onAdd={(fl) => {
                      const rejected = fl.map(validateUpload).find(Boolean);
                      setUploadError(rejected ?? null);
                      const ok = fl.filter((f) => !validateUpload(f));
                      if (ok.length) setFiles((cur) => [...cur, ...ok]);
                    }}
                    onRemove={(i) => setFiles((cur) => cur.filter((_, idx) => idx !== i))}
                    uploadError={uploadError}
                    onBack={() => update({ step: 3 })}
                    onNext={() => update({ step: 5 })}
                  />
                )}
                {draft.step === 5 && draft.typology && (
                  <StepRecap
                    title={draft.title ?? ""}
                    profilLabel={profilMeta?.label ?? draft.profil ?? "—"}
                    categoryLabel={categoryMeta?.label ?? draft.typology}
                    fields={fields}
                    answers={draft.answers}
                    fileCount={files.length}
                    showAiOption={isPreContentieux}
                    legalReview={legalReview}
                    onToggleReview={setLegalReview}
                    submitting={submitting}
                    error={submitError}
                    quotaMessage={blockedByQuota && entitlement ? (entitlement.blockedReason ? null : quotaLimitMessage(entitlement.periodEnd)) : null}
                    onSubmit={submit}
                    onEdit={() => update({ step: 3 })}
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

function StepProfil({
  selected,
  onSelect,
}: {
  selected?: Profil;
  onSelect: (id: Profil) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {PROFILS.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onSelect(p.id)}
          className={`group flex h-full flex-col rounded-2xl border p-6 text-left transition-all duration-300 hover:-translate-y-1 ${
            selected === p.id
              ? "border-gold-500 bg-white shadow-card-hover"
              : "hairline bg-white hover:border-gold-500 hover:shadow-card"
          }`}
        >
          <p className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-gold-700">
            Profil
          </p>
          <h2 className="mt-3 font-display text-xl font-semibold leading-tight text-navy-900 sm:text-2xl">
            {p.label}
          </h2>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-500">
            {p.description}
          </p>
          <span className="mt-5 inline-flex items-center gap-1.5 self-start text-sm font-medium text-navy-900">
            Choisir
            <ArrowRightIcon
              width={14}
              height={14}
              strokeWidth={2}
              className="transition-transform group-hover:translate-x-0.5"
            />
          </span>
        </button>
      ))}
    </div>
  );
}

function StepCategory({
  selected,
  title,
  nameError,
  onSelect,
  onTitleChange,
  onContinue,
  onBack,
}: {
  selected?: Category;
  title: string;
  nameError: string | null;
  onSelect: (id: Category) => void;
  onTitleChange: (v: string) => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelect(c.id)}
            aria-pressed={selected === c.id}
            className={`group flex h-full flex-col rounded-2xl border p-6 text-left transition-all duration-300 hover:-translate-y-1 ${
              selected === c.id
                ? "border-gold-500 bg-white shadow-card-hover"
                : "hairline bg-white hover:border-gold-500 hover:shadow-card"
            }`}
          >
            <p className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-gold-700">
              Nature
            </p>
            <h2 className="mt-3 font-display text-xl font-semibold leading-tight text-navy-900 sm:text-2xl">
              {c.label}
            </h2>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-500">
              {c.description}
            </p>
            <span className="mt-5 inline-flex items-center gap-1.5 self-start text-sm font-medium text-navy-900">
              {selected === c.id ? "Sélectionné" : "Choisir"}
              {selected === c.id ? (
                <CheckIcon width={14} height={14} strokeWidth={2.5} />
              ) : (
                <ArrowRightIcon
                  width={14}
                  height={14}
                  strokeWidth={2}
                  className="transition-transform group-hover:translate-x-0.5"
                />
              )}
            </span>
          </button>
        ))}
      </div>

      {/* Sous-catégorie : le client nomme son dossier (obligatoire). */}
      <div className="mt-4 rounded-2xl border hairline bg-white p-6 shadow-card sm:p-7">
        <label className="block">
          <span className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-slate-500">
            Nom de votre dossier <span className="text-gold-700">*</span>
          </span>
          <input
            type="text"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? "dossier-name-error" : undefined}
            placeholder="Ex. Chantier Dupont — solde impayé"
            className={`mt-2 w-full rounded-xl border hairline bg-cream-50 px-4 py-3 text-sm text-navy-900 focus:border-gold-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gold-500/20 ${
              nameError
                ? "border-red-400 focus:border-red-400 focus:ring-red-400/20"
                : ""
            }`}
          />
          {nameError ? (
            <span
              id="dossier-name-error"
              className="mt-1.5 block text-xs font-medium text-red-600"
            >
              {nameError}
            </span>
          ) : (
            <span className="mt-1.5 block text-xs italic text-slate-500">
              Une sous-catégorie à vous : donnez un nom clair pour retrouver ce
              dossier dans votre compte.
            </span>
          )}
        </label>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-full bg-cream-100 px-5 py-3 text-sm font-medium text-navy-900 transition-colors hover:bg-cream-200"
        >
          ← Changer de profil
        </button>
        <button
          type="button"
          onClick={onContinue}
          disabled={!selected}
          className="sheen inline-flex items-center gap-2 rounded-full bg-gold-500 px-6 py-3.5 text-sm font-semibold text-navy-900 shadow-gold transition-all duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Continuer
          <ArrowRightIcon width={14} height={14} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

function StepInfos({
  category,
  defaults,
  onSubmit,
  onBack,
}: {
  category: Category;
  defaults: DraftAnswers;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onBack: () => void;
}) {
  const fields = fieldsFor(category);
  const inputCls =
    "mt-2 w-full rounded-xl border hairline bg-cream-50 px-4 py-3 text-sm text-navy-900 focus:border-gold-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gold-500/20";
  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border hairline bg-white p-7 shadow-card sm:p-9"
      noValidate
    >
      <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-gold-700">
        {CATEGORIES.find((c) => c.id === category)?.label}
      </p>
      <p className="mt-2 text-sm text-slate-500">
        Quelques champs structurants. Tout est conservé en brouillon.
      </p>

      <div className="mt-8 space-y-6">
        {fields.map((f) => (
          <label key={f.id} className="block">
            <span className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-slate-500">
              {f.label}
            </span>
            {f.type === "textarea" ? (
              <textarea
                name={f.id}
                defaultValue={defaults[f.id] ?? ""}
                rows={5}
                className={inputCls}
              />
            ) : (
              <input
                name={f.id}
                type={f.type ?? "text"}
                defaultValue={defaults[f.id] ?? ""}
                className={inputCls}
              />
            )}
            {f.help && (
              <span className="mt-1.5 block text-xs italic text-slate-500">
                {f.help}
              </span>
            )}
          </label>
        ))}
      </div>
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t hairline pt-6">
        <button
          type="button"
          onClick={onBack}
          className="rounded-full bg-cream-100 px-5 py-3 text-sm font-medium text-navy-900 transition-colors hover:bg-cream-200"
        >
          ← Changer la nature
        </button>
        <button
          type="submit"
          className="sheen inline-flex items-center gap-2 rounded-full bg-gold-500 px-6 py-3.5 text-sm font-semibold text-navy-900 shadow-gold transition-all duration-200 hover:-translate-y-0.5"
        >
          Ajouter des documents
          <ArrowRightIcon width={14} height={14} strokeWidth={2} />
        </button>
      </div>
    </form>
  );
}

function StepDocuments({
  files,
  onAdd,
  onRemove,
  onBack,
  onNext,
  uploadError,
}: {
  files: File[];
  onAdd: (files: File[]) => void;
  onRemove: (index: number) => void;
  onBack: () => void;
  onNext: () => void;
  uploadError?: string | null;
}) {
  return (
    <div className="rounded-2xl border hairline bg-white p-7 shadow-card sm:p-9">
      <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-gold-700">
        Pièces du dossier
      </p>
      <p className="mt-2 text-sm leading-relaxed text-slate-500">
        Déposez vos documents (contrats, courriers, factures, mises en
        demeure…). PDF, images, Word. Ils sont rattachés à votre dossier dans
        votre compte.
      </p>

      <label className="mt-7 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed hairline-strong bg-cream-50 px-6 py-12 text-center transition-colors hover:border-gold-500 hover:bg-white">
        <span className="font-display text-lg font-semibold text-navy-900">
          Cliquez pour ajouter des fichiers
        </span>
        <span className="text-xs text-slate-500">
          ou glissez-déposez · PDF, JPG, PNG, DOCX
        </span>
        <input
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.txt"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) onAdd(Array.from(e.target.files));
            e.currentTarget.value = "";
          }}
        />
      </label>

      {uploadError && (
        <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {uploadError}
        </p>
      )}

      {files.length > 0 && (
        <ul className="mt-5 space-y-2">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className="flex items-center justify-between gap-3 rounded-xl border hairline bg-cream-50 px-4 py-3 text-sm"
            >
              <span className="truncate text-navy-900">{f.name}</span>
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="shrink-0 text-xs font-medium text-slate-500 hover:text-red-600"
              >
                Retirer
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t hairline pt-6">
        <button
          type="button"
          onClick={onBack}
          className="rounded-full bg-cream-100 px-5 py-3 text-sm font-medium text-navy-900 transition-colors hover:bg-cream-200"
        >
          ← Informations
        </button>
        <button
          type="button"
          onClick={onNext}
          className="sheen inline-flex items-center gap-2 rounded-full bg-gold-500 px-6 py-3.5 text-sm font-semibold text-navy-900 shadow-gold transition-all duration-200 hover:-translate-y-0.5"
        >
          {files.length ? "Continuer" : "Passer cette étape"}
          <ArrowRightIcon width={14} height={14} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

function StepRecap({
  title,
  profilLabel,
  categoryLabel,
  fields,
  answers,
  fileCount,
  showAiOption,
  legalReview,
  onToggleReview,
  submitting,
  error,
  quotaMessage,
  onSubmit,
  onEdit,
}: {
  title: string;
  profilLabel: string;
  categoryLabel: string;
  fields: { id: string; label: string }[];
  answers: DraftAnswers;
  fileCount: number;
  showAiOption: boolean;
  legalReview: boolean;
  onToggleReview: (v: boolean) => void;
  submitting: boolean;
  error: string | null;
  quotaMessage: string | null;
  onSubmit: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="rounded-2xl border hairline bg-white p-7 shadow-card sm:p-9">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">
            {categoryLabel} · brouillon
          </p>
          <h2 className="mt-2 font-display text-2xl font-semibold leading-tight text-navy-900 sm:text-3xl">
            {title || `${categoryLabel} — synthèse`}
          </h2>
        </div>
        <span className="shrink-0 rounded-full bg-gold-500/12 px-3 py-1.5 font-mono text-[0.7rem] font-medium text-navy-900 border hairline-gold">
          Brouillon
        </span>
      </div>

      <dl className="mt-7 divide-y hairline border-y hairline">
        <div className="flex flex-col gap-1 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <dt className="text-sm font-medium text-slate-500">Nom du dossier</dt>
          <dd className="max-w-md text-sm text-navy-900 sm:text-right">
            {title || <span className="italic text-slate-500">Non renseigné</span>}
          </dd>
        </div>
        <div className="flex flex-col gap-1 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <dt className="text-sm font-medium text-slate-500">Profil</dt>
          <dd className="max-w-md text-sm text-navy-900 sm:text-right">{profilLabel}</dd>
        </div>
        {fields.map((f) => (
          <div
            key={f.id}
            className="flex flex-col gap-1 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6"
          >
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

      {/* Option : question IA préparatoire (impayé / pré-contentieux uniquement) */}
      {showAiOption && (
        <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-xl bg-cream-100 p-5">
          <input
            type="checkbox"
            checked={legalReview}
            onChange={(e) => onToggleReview(e.target.checked)}
            className="mt-1 h-4 w-4 accent-gold-500"
          />
          <span className="text-sm leading-relaxed text-navy-900">
            <span className="font-semibold">Option — question IA préparatoire</span> : {AI_OPTION_TEXT} Le
            professionnel du droit reste un validateur optionnel.
          </span>
        </label>
      )}

      <div className="mt-7 rounded-xl bg-cream-100 p-5">
        <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-gold-700">Enregistrement</p>
        <p className="mt-2 text-sm leading-relaxed text-navy-900">
          En validant, votre dossier est enregistré dans votre compte ClairDossier et notre équipe est
          informée de sa création. Rien n'est envoyé par e-mail ou WhatsApp.
        </p>
      </div>

      {quotaMessage && !error && (
        <p className="mt-5 rounded-xl border hairline-gold bg-gold-500/10 px-4 py-3 text-sm text-navy-900" role="status">
          {quotaMessage}{" "}
          <Link to="/tarifs" className="font-medium underline underline-offset-4">
            Voir les offres
          </Link>
        </p>
      )}
      {error && (
        <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <div className="mt-8 flex flex-col gap-3 border-t hairline pt-6 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={onEdit}
          className="text-sm font-medium text-navy-900 border-b hairline-gold pb-0.5 hover:text-gold-700 sm:self-center"
        >
          ← Modifier
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={onSubmit}
          className="sheen inline-flex items-center justify-center gap-2 rounded-full bg-gold-500 px-6 py-3.5 text-sm font-semibold text-navy-900 shadow-gold transition-all duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Enregistrement…" : "Valider et enregistrer mon dossier"}
          {!submitting && <ArrowRightIcon width={14} height={14} strokeWidth={2} />}
        </button>
      </div>
    </div>
  );
}

function SuccessCard({ saved, onNew }: { saved: Saved; onNew: () => void }) {
  return (
    <div className="rounded-2xl border hairline bg-white p-8 text-center shadow-card sm:p-12">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-600">
        <CheckIcon width={26} height={26} strokeWidth={2.5} />
      </span>
      <h2 className="mt-6 font-display text-2xl font-semibold text-navy-900 sm:text-3xl">
        {saved.alreadySaved ? "Votre dossier a déjà été enregistré." : "Dossier enregistré"}
      </h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-500">
        Votre dossier a bien été enregistré dans votre compte ClairDossier. Nous avons été informés de sa
        création. Vous pouvez le retrouver et suivre son évolution depuis votre espace.
      </p>
      {saved.warning && (
        <p className="mx-auto mt-4 max-w-md rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">{saved.warning}</p>
      )}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          to={`/compte/dossier/${saved.dossierId}`}
          className="sheen inline-flex items-center gap-2 rounded-full bg-gold-500 px-6 py-3.5 text-sm font-semibold text-navy-900 shadow-gold hover:-translate-y-0.5"
        >
          Voir mon dossier
          <ArrowRightIcon width={14} height={14} strokeWidth={2} />
        </Link>
        <Link
          to="/compte"
          className="rounded-full bg-cream-100 px-6 py-3.5 text-sm font-medium text-navy-900 hover:bg-cream-200"
        >
          Retour à mes dossiers
        </Link>
      </div>
      <button
        type="button"
        onClick={onNew}
        className="mt-5 text-sm font-medium text-slate-500 underline underline-offset-4 hover:text-navy-900"
      >
        Créer un autre dossier
      </button>
    </div>
  );
}
