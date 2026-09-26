import { useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Seo, breadcrumbSchema } from '../lib/seo';
import { ArrowRightIcon, CheckIcon, WhatsAppIcon } from '../components/icons';
import { WHATSAPP_DISPLAY, buildWhatsAppUrl } from '../lib/whatsapp';
import { prospectCaptureEnabled, submitProspect } from '../lib/prospects';
import { trackEvent } from '../lib/analytics';

/**
 * /rendez-vous (Vague 1 — 5.5) : chemin principal des segments à forte
 * valeur. La demande est enregistrée côté serveur (accusé de réception par
 * e-mail) ; WhatsApp devient un canal secondaire. Si un outil de réservation
 * externe est configuré (VITE_BOOKING_URL — décision humaine), il devient le
 * chemin principal, sans script tiers ni cookie sur ce site (simple lien).
 */

const BOOKING_URL = import.meta.env.VITE_BOOKING_URL as string | undefined;

const SEGMENT_OPTIONS = [
  { value: 'cabinet-avocats', label: "Cabinet d'avocats" },
  { value: 'expert-comptable', label: "Cabinet d'expertise comptable" },
  { value: 'grand-compte', label: 'Grand compte / structure à fort volume' },
  { value: 'pme', label: 'PME / TPE' },
  { value: 'profession-liberale', label: 'Profession libérale' },
  { value: 'artisan', label: 'Artisan' },
  { value: 'independant', label: 'Indépendant / EI' },
  { value: 'autre', label: 'Autre' },
] as const;

const WHATSAPP_RDV_MESSAGE =
  'Bonjour ClairDossier, je souhaite réserver une démonstration (30 min). Mes disponibilités : ';

export function RendezVous() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const mountedAt = useRef(Date.now());
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');

  const preselected = searchParams.get('segment') ?? '';
  const defaultSegment = SEGMENT_OPTIONS.some((o) => o.value === preselected)
    ? preselected
    : 'autre';

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state === 'sending' || state === 'done') return;
    const data = new FormData(e.currentTarget);
    setState('sending');
    const res = await submitProspect({
      full_name: String(data.get('name') ?? '').trim(),
      email: String(data.get('email') ?? '').trim(),
      organization: String(data.get('organization') ?? '').trim() || undefined,
      segment: String(data.get('segment') ?? 'autre'),
      topic: 'rendez-vous',
      message: String(data.get('message') ?? '').trim() || 'Demande de démonstration (30 min).',
      creneaux: String(data.get('creneaux') ?? '').trim() || undefined,
      source_page: `${location.pathname}${location.search}`,
      referrer: document.referrer || undefined,
      elapsed_ms: Date.now() - mountedAt.current,
      website: String(data.get('website') ?? ''),
    });
    if (res.ok) {
      trackEvent('demande_demo', { canal: 'rendez-vous' });
      setState('done');
    } else {
      setState('error');
    }
  }

  return (
    <>
      <Seo
        title="Prendre rendez-vous"
        description="Réservez une démonstration ClairDossier de 30 minutes : cabinets d'avocats, experts-comptables, structures à fort volume documentaire. Sans engagement."
        path="/rendez-vous"
        jsonLd={breadcrumbSchema([
          { name: 'Accueil', path: '/' },
          { name: 'Prendre rendez-vous', path: '/rendez-vous' },
        ])}
      />

      <section className="bg-cream-50">
        <div className="mx-auto max-w-7xl px-5 py-14 sm:py-20 sm:px-8 lg:px-12">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr]">
            {/* Gauche — promesse (éléments critiques sans JS) */}
            <div className="rise-in">
              <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-700">
                Démonstration
              </p>
              <h1 className="mt-4 font-display text-5xl font-semibold leading-[1.05] text-navy-900 sm:text-6xl">
                30 minutes, sur vos cas réels.
              </h1>
              <p className="mt-5 max-w-md text-base leading-relaxed text-slate-500">
                Vous amenez un cas type — un dossier client, une collecte de
                pièces, un litige fournisseur. On montre exactement ce que le
                produit fait aujourd'hui, et ce qu'il ne fait pas encore
                (l'état du produit est public).
              </p>

              {BOOKING_URL && (
                <a
                  href={BOOKING_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="sheen mt-8 inline-flex items-center gap-2 rounded-full bg-gold-500 px-6 py-3.5 text-sm font-semibold text-navy-900 shadow-gold transition-all duration-300 hover:-translate-y-0.5"
                >
                  Choisir un créneau en ligne
                  <ArrowRightIcon width={14} height={14} strokeWidth={2} />
                </a>
              )}

              <div className="mt-10 space-y-4 border-t hairline pt-8">
                <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-slate-500">
                  Canaux secondaires
                </p>
                <a
                  href={buildWhatsAppUrl(WHATSAPP_RDV_MESSAGE)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-3 text-sm font-medium text-navy-900"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#25D366]/12 text-[#25D366]">
                    <WhatsAppIcon width={18} height={18} />
                  </span>
                  WhatsApp · {WHATSAPP_DISPLAY}
                  <ArrowRightIcon width={13} height={13} strokeWidth={2} className="transition-transform group-hover:translate-x-0.5" />
                </a>
                <p className="text-sm text-slate-500">
                  Ou par e-mail :{' '}
                  <a href="mailto:contact.clairdossier@icloud.com" className="border-b hairline-gold text-navy-900 hover:text-gold-700">
                    contact.clairdossier@icloud.com
                  </a>
                </p>
              </div>
            </div>

            {/* Droite — demande de créneaux */}
            <div className="rise-in" style={{ '--rise-delay': '0.1s' } as CSSProperties}>
              <div className="rounded-2xl border hairline bg-white p-7 shadow-card sm:p-9">
                {prospectCaptureEnabled ? (
                  state === 'done' ? (
                    <div role="status" className="py-8 text-center">
                      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-gold-500/15 text-gold-700">
                        <CheckIcon width={22} height={22} strokeWidth={2.2} />
                      </span>
                      <h2 className="mt-5 font-display text-2xl font-semibold text-navy-900">
                        Demande enregistrée.
                      </h2>
                      <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-slate-500">
                        Un accusé de réception vient de vous être envoyé par
                        e-mail. On revient vers vous rapidement pour confirmer
                        un créneau.
                      </p>
                    </div>
                  ) : (
                    <>
                      <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-gold-700">
                        Demande de créneau
                      </p>
                      <h2 className="mt-2 font-display text-2xl font-semibold leading-tight text-navy-900 sm:text-3xl">
                        Proposez vos disponibilités.
                      </h2>
                      <p className="mt-3 text-sm leading-relaxed text-slate-500">
                        Votre demande est enregistrée immédiatement et vous
                        recevez un accusé de réception par e-mail — pas de
                        ticket perdu.
                      </p>
                      <form onSubmit={onSubmit} className="mt-7 space-y-5" noValidate>
                        <div className="hidden" aria-hidden="true">
                          <label>
                            Ne pas remplir ce champ
                            <input type="text" name="website" tabIndex={-1} autoComplete="off" />
                          </label>
                        </div>
                        <RdvField id="name" label="Nom complet" required placeholder="Nom et prénom" />
                        <RdvField id="email" type="email" label="Email professionnel" required placeholder="vous@structure.fr" />
                        <RdvField id="organization" label="Structure" placeholder="Cabinet, entreprise, collectivité…" />
                        <label className="block">
                          <span className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-slate-500">
                            Vous êtes
                          </span>
                          <select
                            name="segment"
                            defaultValue={defaultSegment}
                            className="mt-2 w-full rounded-xl border hairline bg-cream-50 px-4 py-3 text-sm text-navy-900 focus:border-gold-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gold-500/20"
                          >
                            {SEGMENT_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </label>
                        <label className="block">
                          <span className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-slate-500">
                            Vos disponibilités <span className="text-gold-700">*</span>
                          </span>
                          <textarea
                            name="creneaux"
                            required
                            rows={3}
                            placeholder="Deux ou trois créneaux qui vous arrangent (jours, heures)."
                            className="mt-2 w-full rounded-xl border hairline bg-cream-50 px-4 py-3 text-sm text-navy-900 placeholder:text-slate-500 focus:border-gold-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gold-500/20"
                          />
                        </label>
                        <label className="block">
                          <span className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-slate-500">
                            Votre contexte (facultatif)
                          </span>
                          <textarea
                            name="message"
                            rows={3}
                            placeholder="Le cas que vous aimeriez voir traité en démonstration."
                            className="mt-2 w-full rounded-xl border hairline bg-cream-50 px-4 py-3 text-sm text-navy-900 placeholder:text-slate-500 focus:border-gold-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gold-500/20"
                          />
                        </label>
                        {state === 'error' && (
                          <p role="alert" className="rounded-xl border border-gold-500/40 bg-gold-500/10 px-4 py-3 text-sm text-navy-900">
                            L'enregistrement n'a pas abouti. Réessayez dans un
                            instant, ou écrivez-nous directement sur WhatsApp
                            ou par e-mail (canaux ci-contre).
                          </p>
                        )}
                        <button
                          type="submit"
                          disabled={state === 'sending'}
                          className="sheen inline-flex w-full items-center justify-center gap-2 rounded-full bg-gold-500 px-6 py-3.5 text-sm font-semibold text-navy-900 shadow-gold transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-60"
                        >
                          {state === 'sending' ? 'Enregistrement…' : 'Demander ce rendez-vous'}
                          <ArrowRightIcon width={14} height={14} strokeWidth={2} />
                        </button>
                        <p className="text-center text-xs text-slate-500">
                          Demande traitée selon la{' '}
                          <a href="/politique-confidentialite" className="border-b hairline-gold text-navy-900 hover:text-gold-700">
                            politique de confidentialité
                          </a>
                          . Sans engagement.
                        </p>
                      </form>
                    </>
                  )
                ) : (
                  <>
                    <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-gold-700">
                      Réserver un créneau
                    </p>
                    <h2 className="mt-2 font-display text-2xl font-semibold leading-tight text-navy-900 sm:text-3xl">
                      Proposez vos disponibilités.
                    </h2>
                    <p className="mt-3 text-sm leading-relaxed text-slate-500">
                      Écrivez-nous avec deux ou trois créneaux qui vous
                      arrangent — on confirme rapidement, en journée.
                    </p>
                    <a
                      href={buildWhatsAppUrl(WHATSAPP_RDV_MESSAGE)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="sheen mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gold-500 px-6 py-3.5 text-sm font-semibold text-navy-900 shadow-gold transition-all duration-200 hover:-translate-y-0.5"
                    >
                      <WhatsAppIcon width={16} height={16} />
                      Proposer mes créneaux sur WhatsApp
                    </a>
                    <a
                      href={`mailto:contact.clairdossier@icloud.com?subject=${encodeURIComponent('Demande de démonstration ClairDossier')}&body=${encodeURIComponent(WHATSAPP_RDV_MESSAGE)}`}
                      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-navy-900 px-6 py-3.5 text-sm font-medium text-cream-50 transition-colors hover:bg-navy-800"
                    >
                      Proposer mes créneaux par e-mail
                    </a>
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

function RdvField({
  id,
  label,
  type = 'text',
  required,
  placeholder,
}: {
  id: string;
  label: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
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
        className="mt-2 w-full rounded-xl border hairline bg-cream-50 px-4 py-3 text-sm text-navy-900 placeholder:text-slate-500 focus:border-gold-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gold-500/20"
      />
    </label>
  );
}
