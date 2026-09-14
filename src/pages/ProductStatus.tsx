import { Link } from 'react-router-dom';
import { Seo, breadcrumbSchema } from '../lib/seo';
import { Reveal } from '../components/primitives/Reveal';
import {
  ENTERPRISE_NOTE,
  PRODUCT_STATUS_UPDATED,
  operational,
  partial,
  planned,
  type ProductStatusEntry,
} from '../data/product-status';
import { ArrowRightIcon, CheckIcon } from '../components/icons';

/**
 * /etat-du-produit (Vague 1 — 5.4) : différenciateur de crédibilité.
 * Distingue franchement opérationnel / partiel / prévu, avec date de mise à
 * jour. Généré depuis src/data/product-status.ts (constats de code).
 */

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

function StatusSection({
  id,
  badge,
  badgeClass,
  title,
  intro,
  entries,
}: {
  id: string;
  badge: string;
  badgeClass: string;
  title: string;
  intro: string;
  entries: ProductStatusEntry[];
}) {
  return (
    <section id={id} className="mt-12 first:mt-0">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`inline-flex items-center rounded-full px-3 py-1 font-mono text-[0.68rem] font-medium uppercase tracking-[0.16em] ${badgeClass}`}>
          {badge}
        </span>
        <h2 className="font-display text-2xl font-semibold text-navy-900 sm:text-3xl">{title}</h2>
      </div>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">{intro}</p>
      <ul className="mt-6 space-y-3">
        {entries.map((e) => (
          <li key={e.label} className="rounded-xl border hairline bg-white p-5">
            <div className="flex items-start gap-3">
              <CheckIcon width={14} height={14} strokeWidth={2.2} className="mt-1 shrink-0 text-gold-700" />
              <div>
                <h3 className="font-medium text-navy-900">{e.label}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-500">{e.detail}</p>
                {e.verification && (
                  <p className="mt-2 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-gold-700">
                    Vérifiable : {e.verification}
                  </p>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ProductStatus() {
  return (
    <>
      <Seo
        title="État du produit"
        description={`Ce que ClairDossier fait aujourd'hui, ce qui est partiel et ce qui est prévu — établi depuis le code, mis à jour le ${formatDate(PRODUCT_STATUS_UPDATED)}. Pas de fonctionnalité fictive.`}
        path="/etat-du-produit"
        jsonLd={breadcrumbSchema([
          { name: 'Accueil', path: '/' },
          { name: 'État du produit', path: '/etat-du-produit' },
        ])}
      />

      <section className="bg-cream-50">
        <div className="mx-auto max-w-4xl px-5 pb-12 pt-12 sm:pt-16 lg:pt-20 sm:px-8">
          <div className="rise-in">
            <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-700">
              Transparence produit
            </p>
            <h1 className="mt-4 font-display text-5xl font-semibold leading-[1.05] text-navy-900 sm:text-6xl">
              L'état du produit, tel qu'il est.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-500 sm:text-lg">
              Cette page distingue ce qui est opérationnel, partiel et prévu.
              Elle est établie à partir de ce que le code fait réellement — pas
              de ce que le marketing voudrait — et mise à jour à chaque évolution.
            </p>
            <p className="mt-4 font-mono text-[0.7rem] uppercase tracking-[0.16em] text-slate-500">
              Dernière mise à jour : {formatDate(PRODUCT_STATUS_UPDATED)}
            </p>
          </div>
        </div>
      </section>

      <Reveal as="section" className="bg-cream-50">
        <div className="mx-auto max-w-4xl px-5 pb-16 sm:px-8">
          <StatusSection
            id="operationnel"
            badge="Opérationnel"
            badgeClass="bg-gold-500/15 text-gold-700 border hairline-gold"
            title="Disponible aujourd'hui"
            intro="Constaté dans le code et utilisable en production."
            entries={operational}
          />
          <StatusSection
            id="partiel"
            badge="Partiel"
            badgeClass="bg-navy-900/8 text-navy-900 border hairline"
            title="Existe, avec des limites connues"
            intro="Fonctionne en partie, ou livré mais pas encore activé. Les limites sont dites."
            entries={partial}
          />
          <StatusSection
            id="prevu"
            badge="Prévu"
            badgeClass="bg-cream-100 text-slate-500 border hairline"
            title="Annoncé ou à l'étude — pas encore disponible"
            intro="Rien de listé ici n'est vendu comme disponible. Chaque bascule vers « opérationnel » passe par cette page."
            entries={planned}
          />

          <div className="mt-12 rounded-2xl border hairline bg-white p-6">
            <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-gold-700">
              Offre Entreprise
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">{ENTERPRISE_NOTE}</p>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              to="/rendez-vous"
              className="sheen inline-flex items-center gap-2 rounded-full bg-gold-500 px-6 py-3.5 text-sm font-semibold text-navy-900 shadow-gold transition-all duration-300 hover:-translate-y-0.5"
            >
              Voir le produit en démonstration
              <ArrowRightIcon width={14} height={14} strokeWidth={2} />
            </Link>
            <Link to="/securite" className="text-sm font-medium text-navy-900 border-b hairline-gold hover:text-gold-700">
              Centre de confiance & sécurité
            </Link>
          </div>
        </div>
      </Reveal>
    </>
  );
}
