import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { Seo, breadcrumbSchema, orgSchema } from '../lib/seo';
import { ArrowRightIcon, CheckIcon } from '../components/icons';
import {
  CONTACT_EMAIL,
  PHONE_DISPLAY,
  PHONE_HREF,
  SIEGE_DISPLAY,
} from '../data/contact';

/**
 * /marseille — page locale unique (pas de pages satellites par ville).
 * ClairDossier est édité à Marseille (siège publié dans les mentions légales) ;
 * le service reste utilisable partout en France. Contenu réel uniquement :
 * capacités effectives du produit, coordonnées vérifiées, aucune donnée
 * locale fictive.
 */

const PUBLICS = [
  {
    title: 'TPE, PME et artisans',
    body: "Devis, factures, courriers, photos de chantier : chaque pièce déposée dans un espace privé, un dossier par affaire, les échéances que vous renseignez affichées au même endroit.",
  },
  {
    title: 'Indépendants et professions libérales',
    body: "Un dossier structuré en cinq étapes, du brouillon à la transmission — rien n'est envoyé sans votre validation explicite.",
  },
  {
    title: "Professionnels du droit et du chiffre",
    body: 'Vos clients arrivent avec un dossier ordonné : pièces nommées, chronologie claire, récapitulatif de transmission. Vous commencez sur le fond, pas sur le tri.',
  },
];

const APPORTS = [
  'Un espace privé par dossier, avec dépôt de pièces sécurisé',
  'Cinq étapes claires : création, dépôt, organisation, suivi, transmission',
  'Les échéances que vous renseignez, visibles et datées',
  'Transmission uniquement par vous, sur votre validation explicite',
];

export function Marseille() {
  return (
    <>
      <Seo
        title="ClairDossier à Marseille — dossiers administratifs et juridiques"
        description="Édité à Château-Gombert (13013 Marseille), ClairDossier aide PME et indépendants à structurer leurs dossiers administratifs et juridiques, partout en France."
        path="/marseille"
        // Organization : coordonnées (NAP) affichées sur cette page — même
        // source que les mentions légales et le pied de page (src/data/contact.ts).
        jsonLd={[
          breadcrumbSchema([
            { name: 'Accueil', path: '/' },
            { name: 'ClairDossier à Marseille', path: '/marseille' },
          ]),
          orgSchema,
        ]}
      />

      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20 lg:px-12">
        {/* En-tête */}
        <div className="max-w-3xl">
          <p className="rise-in font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-700">
            Marseille · Bouches-du-Rhône
          </p>
          <h1 className="rise-in mt-4 font-display text-4xl font-semibold leading-[1.05] text-navy-900 sm:text-5xl" style={{ '--rise-delay': '0.05s' } as CSSProperties}>
            ClairDossier à Marseille — des dossiers professionnels clairs, structurés et suivis
          </h1>
          <p className="rise-in mt-6 text-lg leading-relaxed text-slate-500" style={{ '--rise-delay': '0.1s' } as CSSProperties}>
            ClairDossier est conçu et édité à Marseille, à Château-Gombert (13ᵉ arrondissement). L'outil aide
            les entreprises et les indépendants — de Marseille et de la métropole
            Aix-Marseille-Provence comme de toute la France — à réunir leurs pièces, structurer
            leurs dossiers administratifs ou juridiques et suivre leurs échéances, sans jamais rien
            transmettre sans validation.
          </p>
          <div className="rise-in mt-8 flex flex-wrap items-center gap-3" style={{ '--rise-delay': '0.15s' } as CSSProperties}>
            <Link
              to="/inscription"
              className="sheen rounded-full bg-gold-500 px-6 py-3 text-sm font-semibold text-navy-900 shadow-gold transition-transform hover:-translate-y-0.5"
            >
              Commencer
            </Link>
            <Link
              to="/rendez-vous"
              className="rounded-full border hairline-strong bg-white px-6 py-3 text-sm font-medium text-navy-900 transition-colors hover:bg-cream-100"
            >
              Demander une démonstration
            </Link>
          </div>
        </div>

        {/* Pour qui */}
        <section className="mt-16" aria-labelledby="marseille-publics">
          <h2 id="marseille-publics" className="font-display text-2xl font-semibold text-navy-900 sm:text-3xl">
            Pensé pour les professionnels marseillais — utile partout
          </h2>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {PUBLICS.map((p) => (
              <article key={p.title} className="rounded-2xl border hairline bg-white p-6 shadow-card">
                <h3 className="font-display text-xl font-semibold leading-snug text-navy-900">{p.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-500">{p.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Ce que l'outil fait réellement */}
        <section className="mt-16 grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-start" aria-labelledby="marseille-apports">
          <div>
            <h2 id="marseille-apports" className="font-display text-2xl font-semibold text-navy-900 sm:text-3xl">
              Ce que ClairDossier apporte, concrètement
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-500">
              Dossier de chantier, litige fournisseur, contrôle administratif, préparation d'un
              rendez-vous avec un avocat ou un expert-comptable : les pièces dispersées entre
              e-mails, tiroirs et téléphones deviennent un dossier ordonné et transmissible.
            </p>
            <ul className="mt-6 space-y-3">
              {APPORTS.map((a) => (
                <li key={a} className="flex items-start gap-3 rounded-xl border hairline bg-white p-4">
                  <CheckIcon width={14} height={14} strokeWidth={2.2} className="mt-1 shrink-0 text-gold-700" />
                  <span className="text-sm leading-relaxed text-navy-900">{a}</span>
                </li>
              ))}
            </ul>
            <p className="mt-5 text-sm leading-relaxed text-slate-500">
              ClairDossier est un outil documentaire : il ne remplace pas un avocat et ne délivre
              aucune consultation juridique. Pour l'étendue exacte du service,{' '}
              <Link to="/etat-du-produit" className="font-medium text-navy-900 underline decoration-gold-500/60 underline-offset-2 hover:text-gold-700">
                consultez l'état du produit
              </Link>
              {' '}et{' '}
              <Link to="/securite" className="font-medium text-navy-900 underline decoration-gold-500/60 underline-offset-2 hover:text-gold-700">
                le centre de confiance
              </Link>
              .
            </p>
          </div>

          {/* Coordonnées locales (NAP) */}
          <aside className="rounded-2xl bg-navy-900 p-7 text-cream-50 sm:p-8" aria-label="Coordonnées ClairDossier">
            <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-gold-400">
              Nous contacter
            </p>
            <p className="mt-3 font-display text-2xl font-semibold leading-tight">ClairDossier</p>
            <address className="mt-4 space-y-2 text-sm not-italic leading-relaxed text-silver-200/90">
              <p>{SIEGE_DISPLAY}</p>
              <p>
                <a href={PHONE_HREF} className="underline decoration-gold-400/50 underline-offset-2 transition-colors hover:text-cream-50">
                  {PHONE_DISPLAY}
                </a>
              </p>
              <p>
                <a href={`mailto:${CONTACT_EMAIL}`} className="underline decoration-gold-400/50 underline-offset-2 transition-colors hover:text-cream-50">
                  {CONTACT_EMAIL}
                </a>
              </p>
            </address>
            <p className="mt-5 text-sm leading-relaxed text-silver-200/80">
              Service en ligne : l'accompagnement se fait à distance, pour Marseille comme pour
              toute la France. Siège publié dans les{' '}
              <Link to="/mentions-legales" className="underline decoration-gold-400/50 underline-offset-2 transition-colors hover:text-cream-50">
                mentions légales
              </Link>
              .
            </p>
            <Link
              to="/contact"
              className="group mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-gold-400 transition-colors hover:text-cream-50"
            >
              Page contact et démonstration
              <ArrowRightIcon width={14} height={14} strokeWidth={2} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          </aside>
        </section>

        {/* Maillage interne */}
        <section className="mt-16 rounded-2xl border hairline bg-white p-7 sm:p-9" aria-labelledby="marseille-suite">
          <h2 id="marseille-suite" className="font-display text-2xl font-semibold text-navy-900">
            Pour aller plus loin
          </h2>
          <div className="mt-6 flex flex-wrap gap-3">
            {[
              { to: '/fonctionnalites', label: 'Fonctionnalités' },
              { to: '/tarifs', label: 'Tarifs' },
              { to: '/cabinets-avocats', label: "Cabinets d'avocats" },
              { to: '/experts-comptables', label: 'Experts-comptables' },
              { to: '/blog', label: 'Journal' },
            ].map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="rounded-full border hairline-strong bg-cream-50 px-4 py-2 text-sm font-medium text-navy-900 transition-colors hover:bg-cream-100"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
