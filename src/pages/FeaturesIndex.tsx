import { Link } from "react-router-dom";
import { Seo, breadcrumbSchema } from "../lib/seo";
import { Reveal } from "../components/primitives/Reveal";
import { features, featuresByGroup } from "../data/features";
import { ENTERPRISE_NOTE, planned } from "../data/product-status";
import { FEATURE_ICONS, ArrowRightIcon } from "../components/icons";
import { SortingFlow } from "../components/features/SortingFlow";

const groups = featuresByGroup();

const serviceSchemas = features.map((f) => ({
  "@context": "https://schema.org",
  "@type": "Service",
  serviceType: f.title,
  name: f.title,
  description: f.blurb,
  provider: { "@type": "Organization", name: "ClairDossier" },
}));

export function FeaturesIndex() {
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
              Quatre temps, du premier document à la transmission : vous créez
              et nommez le dossier, vous y déposez vos pièces, vous suivez ses
              étapes et ses échéances, puis vous le validez et le transmettez
              vous-même. Seul ce qui est disponible aujourd'hui est présenté ici.
            </p>
            <nav aria-label="Les quatre groupes de fonctionnalités" className="mt-8">
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

      {/* Quatre groupes — chaque carte : titre → bénéfice → exemple → fiche */}
      <div className="bg-cream-50">
        <div className="mx-auto max-w-7xl space-y-16 px-5 pb-14 pt-4 sm:space-y-20 sm:px-8 sm:pb-20 lg:px-12 lg:pb-24">
          {groups.map((g, i) => (
            <section
              key={g.id}
              id={`groupe-${g.id}`}
              aria-labelledby={`groupe-${g.id}-titre`}
              className="scroll-mt-28 border-t hairline pt-10 sm:pt-12"
            >
              <div className="grid gap-8 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] lg:gap-12">
                <header>
                  <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-700">
                    {String(i + 1).padStart(2, "0")} ·{" "}
                    {g.features.length > 1
                      ? `${g.features.length} fonctionnalités`
                      : "1 fonctionnalité"}
                  </p>
                  <h2
                    id={`groupe-${g.id}-titre`}
                    className="mt-3 font-display text-3xl font-semibold leading-tight text-navy-900 sm:text-4xl"
                  >
                    {g.title}
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-slate-500 sm:text-base">
                    {g.intro}
                  </p>
                </header>

                <ul
                  className={`grid gap-5 ${g.features.length > 1 ? "md:grid-cols-2" : ""}`}
                >
                  {g.features.map((f) => {
                    const Icon = FEATURE_ICONS[f.icon];
                    return (
                      <li key={f.slug} className="min-w-0">
                        <article className="flex h-full flex-col rounded-2xl border hairline bg-white p-6 transition-colors duration-300 hover:border-gold-500 sm:p-7">
                          <div className="flex items-center gap-3">
                            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-cream-100 text-navy-900">
                              <Icon width={24} height={24} />
                            </span>
                            <h3 className="font-display text-2xl font-semibold leading-tight text-navy-900">
                              {f.title}
                            </h3>
                          </div>
                          <p className="mt-4 text-[0.95rem] font-medium leading-relaxed text-navy-900">
                            {f.benefit}
                          </p>
                          <div className="mt-4 rounded-xl bg-cream-100/70 p-4">
                            <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-gold-700">
                              Exemple
                            </p>
                            <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
                              {f.example}
                            </p>
                          </div>
                          {f.limit && (
                            <p className="mt-3 text-xs leading-relaxed text-slate-500">
                              <span className="font-semibold text-navy-900">À savoir : </span>
                              {f.limit}
                            </p>
                          )}
                          <Link
                            to={`/fonctionnalites/${f.slug}`}
                            className="group mt-auto inline-flex items-center gap-1.5 self-start pt-5 text-sm font-medium text-navy-900 transition-colors hover:text-gold-700"
                          >
                            Lire la fiche
                            <span className="sr-only"> « {f.title} »</span>
                            <ArrowRightIcon
                              width={14}
                              height={14}
                              strokeWidth={2}
                              className="transition-transform group-hover:translate-x-0.5"
                            />
                          </Link>
                        </article>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </section>
          ))}
        </div>
      </div>

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
                to="/tarifs"
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
            to="/etat-du-produit"
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
              to="/contact"
              className="sheen inline-flex items-center gap-2 rounded-full bg-gold-500 px-6 py-3.5 text-sm font-semibold text-navy-900 shadow-gold hover:-translate-y-0.5"
            >
              Demander une démo
              <ArrowRightIcon width={14} height={14} strokeWidth={2} />
            </Link>
            <Link
              to="/dossier/nouveau"
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
