import { useState, type FormEvent } from 'react';
import { Seo, breadcrumbSchema } from '../lib/seo';
import { Reveal } from '../components/primitives/Reveal';
import { ArrowRightIcon, WhatsAppIcon } from '../components/icons';
import { WHATSAPP_DISPLAY, openWhatsApp, buildWhatsAppUrl } from '../lib/whatsapp';

type Topic = 'demo' | 'commercial' | 'support' | 'presse';

const TOPICS: { id: Topic; label: string; description: string }[] = [
  { id: 'demo', label: 'Démo produit', description: '30 minutes pour explorer ClairDossier avec votre équipe.' },
  { id: 'commercial', label: 'Question commerciale', description: 'Devis Entreprise, contrat-cadre, négociation cabinet.' },
  { id: 'support', label: 'Support technique', description: 'Compte existant, configuration, intégration API.' },
  { id: 'presse', label: 'Presse & contenu', description: 'Demande d\'interview, contribution, partenariat éditorial.' },
];

export function Contact() {
  const [topic, setTopic] = useState<Topic>('demo');

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
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
            <Reveal>
              <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-500">
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
                  <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-gold-500">
                    WhatsApp
                  </p>
                  <p className="mt-1 font-display text-2xl font-semibold leading-tight text-navy-900">
                    {WHATSAPP_DISPLAY}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    Réponse en moyenne sous 1 h en journée (9 h – 19 h, lundi-vendredi).
                  </p>
                  <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-navy-900 transition-colors group-hover:text-gold-500">
                    Ouvrir une conversation
                    <ArrowRightIcon width={14} height={14} strokeWidth={2} className="transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </a>

              <div className="mt-10 space-y-5 border-t hairline pt-8">
                <ContactInfo
                  label="Email général"
                  value="contact@clair-dossier.com"
                  href="mailto:contact@clair-dossier.com"
                />
                <ContactInfo
                  label="Sécurité"
                  value="security@clair-dossier.com"
                  href="mailto:security@clair-dossier.com"
                  detail="Divulgation responsable — réponse sous 24 h"
                />
                <ContactInfo
                  label="Adresse"
                  value="ClairDossier — 12 rue Saint-Augustin"
                  detail="75002 Paris · France"
                />
              </div>
            </Reveal>

            {/* Right — form (pre-fills WhatsApp message) */}
            <Reveal delay={0.1}>
              <div className="rounded-2xl border hairline bg-white p-7 shadow-card sm:p-9">
                <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-gold-500">
                  Formulaire guidé
                </p>
                <h2 className="mt-2 font-display text-2xl font-semibold leading-tight text-navy-900 sm:text-3xl">
                  Préparez votre message en quelques champs.
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-500">
                  Au clic sur « Continuer sur WhatsApp », votre message est composé et
                  WhatsApp s'ouvre prêt à être envoyé. Vous restez maître du dernier clic.
                </p>

                <form onSubmit={onSubmit} className="mt-7 space-y-6" noValidate>
                  <div>
                    <span className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-slate-400">
                      Nature de la demande
                    </span>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {TOPICS.map((t) => (
                        <button
                          type="button"
                          key={t.id}
                          onClick={() => setTopic(t.id)}
                          className={`rounded-xl border p-3 text-left text-sm transition-colors ${
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

                  <Field id="name" label="Nom complet" required placeholder="Nom et prénom" />
                  <Field id="email" type="email" label="Email professionnel" required placeholder="vous@cabinet.fr" />
                  <Field id="organization" label="Structure" placeholder="Cabinet, entreprise, ou « particulier »" />

                  <label className="block">
                    <span className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-slate-400">
                      Votre message
                    </span>
                    <textarea
                      name="message"
                      required
                      rows={5}
                      placeholder="Quelques lignes suffisent — on vous recontacte pour creuser."
                      className="mt-2 w-full rounded-xl border hairline bg-cream-50 px-4 py-3 text-sm text-navy-900 placeholder:text-slate-400 focus:border-gold-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gold-500/20"
                    />
                  </label>

                  <label className="flex items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      required
                      className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-gold-500 focus:ring-gold-500"
                    />
                    <span className="text-slate-500 leading-relaxed">
                      J'accepte que ClairDossier traite ma demande selon la{' '}
                      <a href="/politique-confidentialite" className="border-b hairline-gold text-navy-900 hover:text-gold-500">
                        politique de confidentialité
                      </a>
                      . Le message sera envoyé via WhatsApp.
                    </span>
                  </label>

                  <button
                    type="submit"
                    className="sheen inline-flex w-full items-center justify-center gap-2 rounded-full bg-gold-500 px-6 py-3.5 text-sm font-semibold text-navy-900 shadow-gold transition-all duration-200 hover:-translate-y-0.5"
                  >
                    <WhatsAppIcon width={16} height={16} />
                    Continuer sur WhatsApp
                  </button>
                  <p className="text-center text-xs text-slate-400">
                    On vous recontacte sur le numéro WhatsApp depuis lequel vous écrivez.
                  </p>
                </form>
              </div>
            </Reveal>
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
}: {
  id: string;
  label: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-slate-400">
        {label}
        {required && <span className="ml-1 text-gold-500">*</span>}
      </span>
      <input
        id={id}
        name={id}
        type={type}
        required={required}
        placeholder={placeholder}
        className="mt-2 w-full rounded-xl border hairline bg-cream-50 px-4 py-3 text-sm text-navy-900 placeholder:text-slate-400 focus:border-gold-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gold-500/20"
      />
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
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-slate-400">{label}</p>
      {href ? (
        <a
          href={href}
          className="mt-1.5 inline-block font-medium text-navy-900 border-b hairline-gold transition-colors hover:text-gold-500"
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
