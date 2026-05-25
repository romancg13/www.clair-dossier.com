import { useState, type FormEvent } from 'react';
import { Seo, breadcrumbSchema } from '../lib/seo';
import { Reveal } from '../components/primitives/Reveal';
import { CheckIcon } from '../components/icons';

type Topic = 'demo' | 'commercial' | 'support' | 'presse';

const TOPICS: { id: Topic; label: string; description: string }[] = [
  { id: 'demo', label: 'Démo produit', description: '30 minutes pour explorer ClairDossier avec votre équipe.' },
  { id: 'commercial', label: 'Question commerciale', description: 'Devis Entreprise, contrat-cadre, négociation cabinet.' },
  { id: 'support', label: 'Support technique', description: 'Compte existant, configuration, intégration API.' },
  { id: 'presse', label: 'Presse & contenu', description: 'Demande d\'interview, contribution, partenariat éditorial.' },
];

export function Contact() {
  const [submitted, setSubmitted] = useState(false);
  const [topic, setTopic] = useState<Topic>('demo');

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Showcase : pas de backend. On simule un succès optimiste.
    setSubmitted(true);
  }

  return (
    <>
      <Seo
        title="Contact"
        description="Réserver une démo ClairDossier, poser une question commerciale, contacter le support, ou écrire à l'équipe presse."
        path="/contact"
        jsonLd={breadcrumbSchema([
          { name: 'Accueil', path: '/' },
          { name: 'Contact', path: '/contact' },
        ])}
      />

      <section className="bg-cream-50">
        <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:px-12">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr]">
            {/* Left — copy */}
            <Reveal>
              <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-500">
                Contact
              </p>
              <h1 className="mt-4 font-display text-5xl font-semibold leading-[1.05] text-navy-900 sm:text-6xl">
                Une réponse sous 24 h ouvrées.
              </h1>
              <p className="mt-5 max-w-md text-base leading-relaxed text-slate-500">
                Quatre raisons d'écrire, une seule équipe. Choisissez la nature de votre demande
                pour qu'elle arrive au bon interlocuteur dès le premier message.
              </p>

              <div className="mt-10 space-y-5 border-t hairline pt-8">
                <ContactInfo label="Téléphone" value="+33 (0)1 84 88 12 — XX" detail="Du lundi au vendredi, 9 h – 19 h" />
                <ContactInfo label="Email général" value="bonjour@clair-dossier.com" />
                <ContactInfo label="Sécurité" value="security@clair-dossier.com" detail="Divulgation responsable — réponse sous 24 h" />
                <ContactInfo
                  label="Adresse"
                  value="ClairDossier — 12 rue Saint-Augustin"
                  detail="75002 Paris · France"
                />
              </div>
            </Reveal>

            {/* Right — form */}
            <Reveal delay={0.1}>
              <div className="rounded-2xl border hairline bg-white p-7 shadow-card sm:p-9">
                {submitted ? (
                  <SubmittedState onReset={() => setSubmitted(false)} />
                ) : (
                  <form onSubmit={onSubmit} className="space-y-6" noValidate>
                    <div>
                      <label className="block">
                        <span className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-slate-400">
                          Nature de la demande
                        </span>
                      </label>
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
                        .
                      </span>
                    </label>

                    <button
                      type="submit"
                      className="sheen inline-flex w-full items-center justify-center gap-2 rounded-full bg-gold-500 px-6 py-3.5 text-sm font-semibold text-navy-900 shadow-gold transition-all duration-200 hover:-translate-y-0.5"
                    >
                      Envoyer
                    </button>
                    <p className="text-center text-xs text-slate-400">
                      Réponse sous 24 h ouvrées · jamais de relance commerciale automatique.
                    </p>
                  </form>
                )}
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

function ContactInfo({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div>
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-1.5 font-medium text-navy-900">{value}</p>
      {detail && <p className="mt-0.5 text-sm text-slate-500">{detail}</p>}
    </div>
  );
}

function SubmittedState({ onReset }: { onReset: () => void }) {
  return (
    <div className="py-8 text-center">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-gold-500/15 text-gold-500">
        <CheckIcon width={28} height={28} strokeWidth={2.5} />
      </span>
      <h3 className="mt-5 font-display text-2xl font-semibold text-navy-900">
        Message bien reçu.
      </h3>
      <p className="mt-3 text-sm text-slate-500">
        Notre équipe revient vers vous sous 24 h ouvrées. Si c'est urgent, vous pouvez aussi
        appeler le numéro indiqué à gauche.
      </p>
      <button
        type="button"
        onClick={onReset}
        className="mt-6 text-sm font-medium text-navy-900 border-b hairline-gold pb-0.5 transition-colors hover:text-gold-500"
      >
        Envoyer un autre message
      </button>
    </div>
  );
}
