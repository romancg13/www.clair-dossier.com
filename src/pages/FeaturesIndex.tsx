import { Link } from "react-router-dom";
import { Seo, breadcrumbSchema, ORGANIZATION_ID } from "../lib/seo";
import { useAuth } from "../lib/auth";
import { newDossierHref } from "../lib/cta";
import { Reveal } from "../components/primitives/Reveal";
import { features, featuresByGroup } from "../data/features";
import { ENTERPRISE_NOTE, planned } from "../data/product-status";
import { ArrowRightIcon } from "../components/icons";
import { SortingFlow } from "../components/features/SortingFlow";
import { FeaturesBento } from "../components/landing/FeaturesBento";
import { ChapterTimeline } from "../components/landing/ChapterTimeline";
import { ChapterTransmission } from "../components/landing/ChapterTransmission";
import { BeforeAfter } from "../components/landing/BeforeAfter";
import { AudienceSwitcher } from "../components/landing/AudienceSwitcher";

const groups = featuresByGroup();

const serviceSchemas = features.map((f) => ({
  "@context": "https://schema.org",
  "@type": "Service",
  serviceType: f.title,
  name: f.title,
  description: f.blurb,
  provider: { "@type": "Organization", "@id": ORGANIZATION_ID, name: "ClairDossier" },
}));

export function FeaturesIndex() {
  const { session } = useAuth();
  return (
    <>
      <Seo
        title="Tout pour organiser et suivre vos dossiers"
        description="Créer et nommer un dossier en 5 étapes, déposer et retrouver vos pièces dans un espace privé, suivre étapes et échéances, valider puis transmettre vous-même : les fonctionnalités ClairDossier disponibles aujourd'hui."
        path="/fonctionnalites"
        jsonLd={[
          breadcrumbSchema([
            { name: "Accueil", path: "/" },
            { name: "Fonctionnalités", path: "/fonctionnalites" },
          ]),
          ...serviceSchemas,
        ]}
      />

      {/* Hero — contenu rendu immédiatement (aucun texte masqué en attente d'animation) */}
      <section className="bg-cream-50">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 pb-12 pt-12 sm:px-8 sm:pt-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center lg:gap-14 lg:px-12 lg:pt-24">
          <div className="max-w-3xl">
            <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-700">
              Fonctionnalités
            </p>
            <h1 className="mt-4 font-display text-5xl font-semibold leading-[1.05] text-navy-900 sm:text-6xl">
              Tout pour organiser et suivre vos dossiers
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-500 sm:text-lg">
              Créez un dossier en 5 étapes, rangez-y vos pièces, suivez son
              état, puis transmettez-le vous-même. Seul ce qui est disponible
              aujourd'hui est présenté ici.
            </p>
            <nav aria-label="Les quatre besoins couverts" className="mt-8">
              <ol className="grid gap-2 sm:grid-cols-2">
                {groups.map((g, i) => (
                  <li key={g.id}>
                    <a
                      href={`#groupe-${g.id}`}
                      className="group flex items-center gap-3 rounded-xl border hairline bg-white px-4 py-3 text-sm font-medium text-navy-900 transition-colors hover:border-gold-500"
                    >
                      <span className="font-mono text-[0.7rem] text-gold-700">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="flex-1">{g.title}</span>
                      <ArrowRightIcon
                        width={13}
                        height={13}
                        strokeWidth={2}
                        className="rotate-90 text-slate-400 transition-colors group-hover:text-gold-700"
                      />
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </div>
          <SortingFlow className="w-full max-w-xl lg:justify-self-end" />
        </div>
      </section>

      {/* Quatre besoins — bento (titre court, bénéfice, limite, fiche) */}
      <FeaturesBento />

      {/* Le suivi et la transmission, en mouvement (chapitres de l'accueil) */}
      <div className="cd-cinema cd-grain text-cream-50">
        <div aria-hidden="true" className="h-24 bg-gradient-to-b from-cream-50 to-transparent" />
        <ChapterTimeline />
        <ChapterTransmission />
        <div aria-hidden="true" className="h-24 bg-gradient-to-t from-cream-50 to-transparent" />
      </div>

      <BeforeAfter />
      <AudienceSwitcher />

      {/* Disponible / offre sur devis / projets — même source que /etat-du-produit */}
      <section
        aria-labelledby="disponibilite-titre"
        className="border-t hairline bg-cream-100/40"
      >
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-16 lg:px-12">
          <h2
            id="disponibilite-titre"
            className="max-w-3xl font-display text-3xl font-semibold leading-tight text-navy-900 sm:text-4xl"
          >
            Ce qui est disponible, et ce qui ne l'est pas encore.
          </h2>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            <div className="rounded-2xl border hairline bg-white p-6">
              <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-gold-700">
                Disponible
              </p>
              <p className="mt-3 text-sm leading-relaxed text-slate-500">
                Les {features.length} fonctionnalités présentées ci-dessus, dans
                votre espace client. Les formules d'abonnement sont détaillées
                sur la page tarifs.
              </p>
              <Link
                to="/tarifs/"
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-navy-900 hover:text-gold-700"
              >
                Voir les tarifs
                <ArrowRightIcon width={14} height={14} strokeWidth={2} />
              </Link>
            </div>
            <div className="rounded-2xl border hairline bg-white p-6">
              <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-gold-700">
                Offre Entreprise, sur devis
              </p>
              <p className="mt-3 text-sm leading-relaxed text-slate-500">
                {ENTERPRISE_NOTE}
              </p>
            </div>
            <div className="rounded-2xl border hairline bg-white p-6">
              <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-gold-700">
                Projets, non disponibles aujourd'hui
              </p>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-500">
                {planned.map((p) => (
                  <li key={p.label}>
                    <span className="font-medium text-navy-900">{p.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <Link
            to="/etat-du-produit/"
            className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-navy-900 border-b hairline-gold hover:text-gold-700"
          >
            État du produit détaillé : disponible, partiel, prévu
            <ArrowRightIcon width={14} height={14} strokeWidth={2} />
          </Link>
        </div>
      </section>

      {/* CTA bas */}
      <Reveal
        as="section"
        className="border-t hairline bg-navy-900 text-cream-50"
      >
        <div className="mx-auto max-w-5xl px-5 py-20 text-center sm:px-8 lg:px-12">
          <h2 className="font-display text-4xl font-semibold leading-tight text-cream-50 sm:text-5xl">
            Plutôt voir en pratique ?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-cream-50/75">
            Trente minutes de démo. Pas de slide marketing — on ouvre
            directement un dossier type avec vous.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/rendez-vous/"
              className="sheen inline-flex items-center gap-2 rounded-full bg-gold-500 px-6 py-3.5 text-sm font-semibold text-navy-900 shadow-gold hover:-translate-y-0.5"
            >
              Demander une démo
              <ArrowRightIcon width={14} height={14} strokeWidth={2} />
            </Link>
            <Link
              to={newDossierHref(Boolean(session))}
              className="inline-flex items-center gap-2 rounded-full border border-cream-50/20 px-6 py-3.5 text-sm font-medium text-cream-50 hover:border-cream-50/50"
            >
              Créer un dossier maintenant
            </Link>
          </div>
        </div>
      </Reveal>
    </>
  );
}
