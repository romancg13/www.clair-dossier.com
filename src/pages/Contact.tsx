import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Seo, breadcrumbSchema } from '../lib/seo';
import { ArrowRightIcon, CheckIcon, WhatsAppIcon } from '../components/icons';
import { WHATSAPP_DISPLAY, openWhatsApp, buildWhatsAppUrl } from '../lib/whatsapp';
import {
  EMAIL_RE,
  PARTNER_TYPES,
  PARTNER_TYPE_LABELS,
  newRequestId,
  normalizeSiteUrl,
  prospectCaptureEnabled,
  submitProspect,
  toSegment,
  type PartnerType,
} from '../lib/prospects';
import { CONTACT_EMAIL, PHONE_DISPLAY, PHONE_HREF } from '../data/contact';
import { trackEvent } from '../lib/analytics';

type Topic = 'demo' | 'commercial' | 'support' | 'presse' | 'partenariat';

const TOPICS: { id: Topic; label: string; description: string }[] = [
  { id: 'demo', label: 'Démo produit', description: '30 minutes pour explorer ClairDossier avec votre équipe.' },
  { id: 'commercial', label: 'Question commerciale', description: 'Devis Entreprise, contrat-cadre, négociation cabinet.' },
  { id: 'support', label: 'Support technique', description: 'Compte existant, configuration, intégration API.' },
  { id: 'presse', label: 'Presse & contenu', description: 'Demande d\'interview, contribution, partenariat éditorial.' },
  { id: 'partenariat', label: 'Devenir partenaire', description: 'Présentez votre activité et votre projet de collaboration.' },
];

/* ── « Devenir partenaire » (chantier 14) ─────────────────────────────────
 * Envoi explicite (« Envoyer ma demande »), jamais d'ouverture automatique de
 * WhatsApp. « Demande enregistrée » n'apparaît QUE si le serveur a confirmé
 * l'enregistrement ; sinon (capture non activée, fonction absente, délai
 * dépassé…) un message honnête propose e-mail, téléphone ou WhatsApp, avec
 * le texte saisi repris. Aucune pièce jointe, aucune promesse de commission,
 * d'acceptation ni de délai, aucun consentement marketing. */

type PartnerField = 'name' | 'email' | 'organization' | 'partner_type' | 'site_url' | 'message';
type PartnerErrors = Partial<Record<PartnerField, string>>;
type PartnerDraft = {
  name: string;
  email: string;
  organization: string;
  partnerType: string;
  site: string;
  message: string;
};
type PartnerState =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'stored'; ref: string | null }
  | { kind: 'unavailable' }
  | { kind: 'failed'; reason: 'validation' | 'rate_limit' | 'unconfirmed' };

const PARTNER_FIELD_ORDER: PartnerField[] = ['name', 'email', 'organization', 'partner_type', 'site_url', 'message'];
const PARTNER_ERROR_TEXT: Record<PartnerField, string> = {
  name: 'Indiquez votre nom (2 caractères au moins).',
  email: 'Indiquez une adresse e-mail valide.',
  organization: 'Nom de structure trop long (160 caractères au plus).',
  partner_type: 'Choisissez un type de partenariat.',
  site_url: 'Adresse de site invalide — exemple : https://www.exemple.fr',
  message: 'Présentez votre activité et votre projet (10 caractères au moins).',
};
/** Champs d'erreur renvoyés par le serveur → champs du formulaire. */
const SERVER_FIELD: Record<string, PartnerField> = {
  full_name: 'name',
  email: 'email',
  organization: 'organization',
  partner_type: 'partner_type',
  site_url: 'site_url',
  message: 'message',
};

function isPartnerType(v: string): v is PartnerType {
  return (PARTNER_TYPES as readonly string[]).includes(v);
}

function checkPartnerDraft(d: PartnerDraft): PartnerErrors {
  const errors: PartnerErrors = {};
  if (d.name.length < 2 || d.name.length > 120) errors.name = PARTNER_ERROR_TEXT.name;
  if (d.email.length > 254 || !EMAIL_RE.test(d.email.toLowerCase())) errors.email = PARTNER_ERROR_TEXT.email;
  if (d.organization.length > 160) errors.organization = PARTNER_ERROR_TEXT.organization;
  if (!isPartnerType(d.partnerType)) errors.partner_type = PARTNER_ERROR_TEXT.partner_type;
  if (!normalizeSiteUrl(d.site).ok) errors.site_url = PARTNER_ERROR_TEXT.site_url;
  if (d.message.length < 10) errors.message = PARTNER_ERROR_TEXT.message;
  return errors;
}

function composePartnerText(d: PartnerDraft): string {
  return (
    `Bonjour ClairDossier,\n\n` +
    `Nature de la demande : Devenir partenaire\n` +
    (isPartnerType(d.partnerType) ? `Type de partenariat : ${PARTNER_TYPE_LABELS[d.partnerType]}\n` : '') +
    `Nom : ${d.name}\n` +
    `Email : ${d.email}\n` +
    (d.organization ? `Structure : ${d.organization}\n` : '') +
    (d.site ? `Site web : ${d.site}\n` : '') +
    `\n${d.message}`
  );
}

export function Contact() {
  const [topic, setTopic] = useState<Topic>('demo');
  const location = useLocation();
  const [searchParams] = useSearchParams();
  // Anti-robot : durée entre affichage et soumission (voir lib/prospects).
  const mountedAt = useRef(Date.now());
  // Idempotence : un identifiant par demande, conservé entre les nouvelles
  // tentatives (un renvoi ne crée pas de doublon), renouvelé après succès.
  const requestId = useRef(newRequestId());
  const [partner, setPartner] = useState<PartnerState>({ kind: 'idle' });
  const [partnerErrors, setPartnerErrors] = useState<PartnerErrors>({});
  const [partnerDraft, setPartnerDraft] = useState<PartnerDraft | null>(null);
  const confirmRef = useRef<HTMLHeadingElement>(null);
  const isPartner = topic === 'partenariat';

  useEffect(() => {
    if (partner.kind === 'stored') confirmRef.current?.focus();
  }, [partner.kind]);

  function resetPartner() {
    requestId.current = newRequestId();
    mountedAt.current = Date.now();
    setPartnerErrors({});
    setPartnerDraft(null);
    setPartner({ kind: 'idle' });
  }

  async function onSubmitPartner(form: HTMLFormElement) {
    if (partner.kind === 'sending') return;
    const data = new FormData(form);
    const draft: PartnerDraft = {
      name: String(data.get('name') ?? '').trim(),
      email: String(data.get('email') ?? '').trim(),
      organization: String(data.get('organization') ?? '').trim(),
      partnerType: String(data.get('partner_type') ?? ''),
      site: String(data.get('site_url') ?? '').trim(),
      message: String(data.get('message') ?? '').trim(),
    };
    const errors = checkPartnerDraft(draft);
    setPartnerErrors(errors);
    const firstInvalid = PARTNER_FIELD_ORDER.find((f) => errors[f]);
    if (firstInvalid) {
      setPartner({ kind: 'idle' });
      form.querySelector<HTMLElement>(`[name="${firstInvalid}"]`)?.focus();
      return;
    }
    setPartnerDraft(draft);
    if (!prospectCaptureEnabled) {
      // Capture non activée : RIEN n'est transmis — on le dit.
      setPartner({ kind: 'unavailable' });
      return;
    }
    setPartner({ kind: 'sending' });
    const res = await submitProspect(
      {
        full_name: draft.name,
        email: draft.email,
        organization: draft.organization || undefined,
        segment: toSegment(searchParams.get('segment')),
        topic: 'partenariat',
        partner_type: draft.partnerType,
        site_url: draft.site || undefined,
        message: draft.message,
        source_page: `${location.pathname}${location.search}`,
        referrer: document.referrer || undefined,
        elapsed_ms: Date.now() - mountedAt.current,
        website: String(data.get('website') ?? ''),
        request_id: requestId.current,
      },
      { timeoutMs: 12000 },
    );
    if (res.ok) {
      setPartner({ kind: 'stored', ref: res.ref });
      return;
    }
    if (res.reason === 'disabled') {
      setPartner({ kind: 'unavailable' });
      return;
    }
    if (res.reason === 'validation') {
      const serverErrors: PartnerErrors = {};
      for (const f of res.fields) {
        const field = SERVER_FIELD[f];
        if (field) serverErrors[field] = PARTNER_ERROR_TEXT[field];
      }
      setPartnerErrors(serverErrors);
    }
    setPartner({ kind: 'failed', reason: res.reason });
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (topic === 'partenariat') {
      await onSubmitPartner(form);
      return;
    }
    const data = new FormData(form);
    const name = String(data.get('name') ?? '').trim();
    const email = String(data.get('email') ?? '').trim();
    const organization = String(data.get('organization') ?? '').trim();
    const message = String(data.get('message') ?? '').trim();
    const topicLabel = TOPICS.find((t) => t.id === topic)?.label ?? topic;

    const text =
      `Bonjour ClairDossier,\n\n` +
      `Nature de la demande : ${topicLabel}\n` +
      `Nom : ${name}\n` +
      `Email : ${email}\n` +
      (organization ? `Structure : ${organization}\n` : '') +
      `\n${message}`;

    // Capture côté serveur AVANT l'ouverture de WhatsApp (Lot 2.2) — la
    // demande n'est plus perdue si le visiteur n'achève pas le passage.
    // Silencieuse et non bloquante : en cas d'échec, WhatsApp s'ouvre
    // exactement comme avant.
    const surMesure = searchParams.get('plan') === 'sur-mesure';
    await submitProspect(
      {
        full_name: name,
        email,
        organization: organization || undefined,
        // Paramètre d'URL non fiable : hors liste fermée → « autre » (sinon la
        // capture serait refusée par le serveur).
        segment: toSegment(searchParams.get('segment')),
        topic: surMesure ? 'devis' : topic,
        message,
        source_page: `${location.pathname}${location.search}`,
        referrer: document.referrer || undefined,
        elapsed_ms: Date.now() - mountedAt.current,
        website: String(data.get('website') ?? ''),
        request_id: requestId.current,
      },
      { timeoutMs: 2500 },
    );
    requestId.current = newRequestId();

    if (surMesure) trackEvent('devis_grand_compte', { canal: 'formulaire' });
    else if (topic === 'demo') trackEvent('demande_demo', { canal: 'formulaire' });

    openWhatsApp(text);
  }

  return (
    <>
      <Seo
        title="Contact"
        description="Réserver une démo ClairDossier, poser une question commerciale, contacter le support, ou écrire à l'équipe presse. Échanges directs via WhatsApp."
        path="/contact"
        jsonLd={breadcrumbSchema([
          { name: 'Accueil', path: '/' },
          { name: 'Contact', path: '/contact' },
        ])}
      />

      <section className="bg-cream-50">
        <div className="mx-auto max-w-7xl px-5 py-14 sm:py-20 lg:py-24 sm:px-8 lg:px-12">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr]">
            {/* Left — copy + WhatsApp CTA */}
            <div className="rise-in">
              <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-700">
                Contact
              </p>
              <h1 className="mt-4 font-display text-5xl font-semibold leading-[1.05] text-navy-900 sm:text-6xl">
                Une réponse sur WhatsApp, dans l'heure.
              </h1>
              <p className="mt-5 max-w-md text-base leading-relaxed text-slate-500">
                Pas de formulaire en file d'attente, pas de tickets perdus. Vous écrivez,
                on lit, on répond — directement sur WhatsApp.
              </p>

              {/* WhatsApp card */}
              <a
                href={buildWhatsAppUrl('Bonjour ClairDossier, j\'aimerais vous poser une question.')}
                target="_blank"
                rel="noopener noreferrer"
                className="group mt-8 flex items-start gap-4 rounded-2xl border hairline bg-white p-6 transition-colors hover:border-gold-500"
              >
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#25D366]/12 text-[#25D366]">
                  <WhatsAppIcon width={26} height={26} />
                </span>
                <div className="flex-1">
                  <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-gold-700">
                    WhatsApp
                  </p>
                  <p className="mt-1 font-display text-2xl font-semibold leading-tight text-navy-900">
                    {WHATSAPP_DISPLAY}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    Réponse en moyenne sous 1 h en journée (9 h – 19 h, lundi-vendredi).
                  </p>
                  <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-navy-900 transition-colors group-hover:text-gold-700">
                    Ouvrir une conversation
                    <ArrowRightIcon width={14} height={14} strokeWidth={2} className="transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </a>

              <div className="mt-10 space-y-5 border-t hairline pt-8">
                <ContactInfo
                  label="Téléphone"
                  value={PHONE_DISPLAY}
                  href={PHONE_HREF}
                  detail="Service Assistance ClairDossier, 9 h – 19 h, lundi-vendredi"
                />
                <ContactInfo
                  label="Email"
                  value="contact.clairdossier@icloud.com"
                  href="mailto:contact.clairdossier@icloud.com"
                  detail="Demandes générales, devis, et divulgation responsable de vulnérabilités — réponse sous 24 h ouvrées"
                />
                <ContactInfo
                  label="Siège"
                  value="Château-Gombert, 13013 Marseille"
                  detail="Voir les mentions légales pour les coordonnées complètes"
                />
              </div>
            </div>

            {/* Right — form (pre-fills WhatsApp message) */}
            <div className="rise-in" style={{ '--rise-delay': '0.1s' } as CSSProperties}>
              <div className="rounded-2xl border hairline bg-white p-7 shadow-card sm:p-9">
                {isPartner && partner.kind === 'stored' ? (
                  <div role="status" className="py-8 text-center">
                    <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-gold-500/15 text-gold-700">
                      <CheckIcon width={22} height={22} strokeWidth={2.2} />
                    </span>
                    <h2
                      ref={confirmRef}
                      tabIndex={-1}
                      className="mt-5 font-display text-2xl font-semibold text-navy-900 focus:outline-none"
                    >
                      Demande enregistrée.
                    </h2>
                    {partner.ref && (
                      <p className="mt-2 font-mono text-[0.7rem] uppercase tracking-[0.16em] text-slate-500">
                        Référence : {partner.ref}
                      </p>
                    )}
                    <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-slate-500">
                      Votre demande de partenariat est enregistrée sur notre serveur ; l'équipe
                      l'examinera. Cet enregistrement ne vaut ni acceptation ni engagement.
                    </p>
                    <button
                      type="button"
                      onClick={resetPartner}
                      className="mt-6 inline-flex items-center justify-center rounded-full border hairline-strong bg-white px-5 py-2.5 text-sm font-medium text-navy-900 transition-colors hover:bg-cream-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
                    >
                      Envoyer une autre demande
                    </button>
                  </div>
                ) : (
                <>
                <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-gold-700">
                  Formulaire guidé
                </p>
                <h2 className="mt-2 font-display text-2xl font-semibold leading-tight text-navy-900 sm:text-3xl">
                  Préparez votre message en quelques champs.
                </h2>
                {isPartner ? (
                  <p className="mt-3 text-sm leading-relaxed text-slate-500">
                    {prospectCaptureEnabled
                      ? "Au clic sur « Envoyer ma demande », votre demande est transmise à l'équipe. La confirmation ne s'affiche qu'une fois l'enregistrement confirmé par notre serveur."
                      : "L'envoi en ligne n'est pas encore activé : votre texte vous sera proposé par e-mail ou WhatsApp, à envoyer vous-même — ou appelez-nous."}
                  </p>
                ) : (
                <p className="mt-3 text-sm leading-relaxed text-slate-500">
                  Au clic sur « Continuer sur WhatsApp », votre message est composé et
                  WhatsApp s'ouvre prêt à être envoyé. Vous restez maître du dernier clic.
                </p>
                )}

                <form onSubmit={onSubmit} className="mt-7 space-y-6" noValidate aria-busy={partner.kind === 'sending'}>
                  {/* Champ leurre anti-robot : invisible, doit rester vide. */}
                  <div className="hidden" aria-hidden="true">
                    <label>
                      Ne pas remplir ce champ
                      <input type="text" name="website" tabIndex={-1} autoComplete="off" />
                    </label>
                  </div>
                  <div>
                    <span className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-slate-500">
                      Nature de la demande
                    </span>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2" role="group" aria-label="Nature de la demande">
                      {TOPICS.map((t) => (
                        <button
                          type="button"
                          key={t.id}
                          onClick={() => setTopic(t.id)}
                          aria-pressed={topic === t.id}
                          className={`rounded-xl border p-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 ${
                            t.id === 'partenariat' ? 'sm:col-span-2 ' : ''
                          }${
                            topic === t.id
                              ? 'border-gold-500 bg-cream-50'
                              : 'hairline bg-white hover:border-slate-300'
                          }`}
                        >
                          <span className="block font-medium text-navy-900">{t.label}</span>
                          <span className="mt-1 block text-xs text-slate-500">{t.description}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <Field id="name" label="Nom complet" required placeholder="Nom et prénom" error={isPartner ? partnerErrors.name : undefined} />
                  <Field id="email" type="email" label="Email professionnel" required placeholder="vous@cabinet.fr" error={isPartner ? partnerErrors.email : undefined} />
                  <Field id="organization" label="Structure" placeholder="Cabinet, entreprise, ou « particulier »" error={isPartner ? partnerErrors.organization : undefined} />

                  {isPartner && (
                    <>
                      <label className="block">
                        <span className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-slate-500">
                          Type de partenariat<span className="ml-1 text-gold-700">*</span>
                        </span>
                        <select
                          name="partner_type"
                          required
                          defaultValue=""
                          aria-invalid={partnerErrors.partner_type ? true : undefined}
                          aria-describedby={partnerErrors.partner_type ? 'partner_type-erreur' : undefined}
                          className="mt-2 w-full rounded-xl border hairline bg-cream-50 px-4 py-3 text-sm text-navy-900 focus:border-gold-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gold-500/20"
                        >
                          <option value="" disabled>
                            Choisir…
                          </option>
                          {PARTNER_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {PARTNER_TYPE_LABELS[t]}
                            </option>
                          ))}
                        </select>
                        {partnerErrors.partner_type && (
                          <span id="partner_type-erreur" className="mt-1.5 block text-xs text-red-700">
                            {partnerErrors.partner_type}
                          </span>
                        )}
                      </label>
                      <Field id="site_url" type="url" label="Site web (facultatif)" placeholder="https://www.exemple.fr" error={partnerErrors.site_url} />
                    </>
                  )}

                  <label className="block">
                    <span className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-slate-500">
                      {isPartner ? 'Votre activité et votre projet' : 'Votre message'}
                    </span>
                    <textarea
                      name="message"
                      required
                      rows={5}
                      aria-invalid={isPartner && partnerErrors.message ? true : undefined}
                      aria-describedby={isPartner && partnerErrors.message ? 'message-erreur' : undefined}
                      placeholder={
                        isPartner
                          ? 'Votre activité, vos clients, la collaboration envisagée. Aucune pièce ni information confidentielle.'
                          : 'Quelques lignes suffisent — on vous recontacte pour creuser.'
                      }
                      className="mt-2 w-full rounded-xl border hairline bg-cream-50 px-4 py-3 text-sm text-navy-900 placeholder:text-slate-500 focus:border-gold-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gold-500/20"
                    />
                    {isPartner && partnerErrors.message && (
                      <span id="message-erreur" className="mt-1.5 block text-xs text-red-700">
                        {partnerErrors.message}
                      </span>
                    )}
                  </label>

                  <label className="flex items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      required
                      className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-gold-700 focus:ring-gold-500"
                    />
                    <span className="text-slate-500 leading-relaxed">
                      J'accepte que ClairDossier traite ma demande selon la{' '}
                      <a href="/politique-confidentialite" className="border-b hairline-gold text-navy-900 hover:text-gold-700">
                        politique de confidentialité
                      </a>
                      .{' '}
                      {isPartner
                        ? "Votre demande sert uniquement à l'examen du partenariat ; aucune inscription à une lettre d'information."
                        : 'Le message sera envoyé via WhatsApp.'}
                    </span>
                  </label>

                  {isPartner && (partner.kind === 'unavailable' || partner.kind === 'failed') && partnerDraft && (
                    <div role="alert" className="rounded-xl border border-gold-500/40 bg-cream-50 p-4 text-sm leading-relaxed text-navy-900">
                      <p className="font-medium">
                        {partner.kind === 'unavailable'
                          ? "Votre demande n'a pas été envoyée : l'envoi en ligne n'est pas encore activé."
                          : partner.reason === 'rate_limit'
                            ? "Votre demande n'a pas été envoyée : trop de demandes récentes, réessayez plus tard."
                            : partner.reason === 'validation'
                              ? "Votre demande n'a pas été envoyée : vérifiez les champs signalés."
                              : "Nous n'avons pas pu confirmer l'enregistrement : votre demande est peut-être perdue. Réessayez ou utilisez un autre canal."}
                      </p>
                      <p className="mt-2 text-slate-500">Envoyez-la vous-même par le canal de votre choix — votre texte est repris :</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <a
                          href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Devenir partenaire')}&body=${encodeURIComponent(composePartnerText(partnerDraft))}`}
                          className="rounded-full border hairline-strong bg-white px-4 py-2 font-medium hover:bg-cream-100"
                        >
                          Envoyer par e-mail
                        </a>
                        <a href={PHONE_HREF} className="rounded-full border hairline-strong bg-white px-4 py-2 font-medium hover:bg-cream-100">
                          Appeler le {PHONE_DISPLAY}
                        </a>
                        <a
                          href={buildWhatsAppUrl(composePartnerText(partnerDraft))}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-full border hairline-strong bg-white px-4 py-2 font-medium hover:bg-cream-100"
                        >
                          <WhatsAppIcon width={14} height={14} /> Ouvrir WhatsApp
                        </a>
                      </div>
                      <p className="mt-2 text-xs text-slate-500">
                        Ouvrir WhatsApp ou votre messagerie n'envoie rien : la demande n'est reçue qu'une fois votre message envoyé.
                      </p>
                    </div>
                  )}

                  {isPartner ? (
                    <button
                      type="submit"
                      disabled={partner.kind === 'sending'}
                      className="sheen inline-flex w-full items-center justify-center gap-2 rounded-full bg-gold-500 px-6 py-3.5 text-sm font-semibold text-navy-900 shadow-gold transition-all duration-200 hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-70"
                    >
                      {partner.kind === 'sending' ? 'Envoi en cours…' : 'Envoyer ma demande'}
                    </button>
                  ) : (
                    <button
                      type="submit"
                      className="sheen inline-flex w-full items-center justify-center gap-2 rounded-full bg-gold-500 px-6 py-3.5 text-sm font-semibold text-navy-900 shadow-gold transition-all duration-200 hover:-translate-y-0.5"
                    >
                      <WhatsAppIcon width={16} height={16} />
                      Continuer sur WhatsApp
                    </button>
                  )}
                  <p className="text-center text-xs text-slate-500">
                    {isPartner
                      ? "Pas de pièce jointe ni d'information confidentielle. L'envoi ne vaut ni acceptation ni engagement."
                      : 'On vous recontacte sur le numéro WhatsApp depuis lequel vous écrivez.'}
                  </p>
                </form>
                </>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function Field({
  id,
  label,
  type = 'text',
  required,
  placeholder,
  error,
}: {
  id: string;
  label: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  error?: string;
}) {
  return (
    <label className="block">
      <span className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-slate-500">
        {label}
        {required && <span className="ml-1 text-gold-700">*</span>}
      </span>
      <input
        id={id}
        name={id}
        type={type}
        required={required}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-erreur` : undefined}
        className="mt-2 w-full rounded-xl border hairline bg-cream-50 px-4 py-3 text-sm text-navy-900 placeholder:text-slate-500 focus:border-gold-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gold-500/20"
      />
      {error && (
        <span id={`${id}-erreur`} className="mt-1.5 block text-xs text-red-700">
          {error}
        </span>
      )}
    </label>
  );
}

function ContactInfo({
  label,
  value,
  detail,
  href,
}: {
  label: string;
  value: string;
  detail?: string;
  href?: string;
}) {
  return (
    <div>
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-slate-500">{label}</p>
      {href ? (
        <a
          href={href}
          className="mt-1.5 inline-block font-medium text-navy-900 border-b hairline-gold transition-colors hover:text-gold-700"
        >
          {value}
        </a>
      ) : (
        <p className="mt-1.5 font-medium text-navy-900">{value}</p>
      )}
      {detail && <p className="mt-0.5 text-sm text-slate-500">{detail}</p>}
    </div>
  );
}
