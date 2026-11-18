import { Seo } from '../lib/seo';
import { formatEuro, plans, yearlyTotal } from '../data/pricing';

/** Comparatif de recette. Aucun paiement ni inscription sur cette route de test. */
export function PricingPreviewOnly() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-16">
      <Seo title="Comparer les formules de démonstration" description="Comparatif de recette des formules existantes par volume de dossiers, nombre d’utilisateurs et niveau de service." path="/tarifs" />
      <h1 className="font-display text-5xl font-semibold leading-tight text-navy-900 sm:text-6xl">Choisir une formule</h1>
      <p className="mt-3 max-w-2xl text-slate-500">Comparez le nombre de dossiers, les utilisateurs et l’accompagnement. Ce comparatif de démonstration permet d’explorer les formules sans paiement.</p>
      <ol className="mt-8 divide-y border-y hairline bg-white">
        {plans.map((plan) => (
          <li key={plan.id} id={plan.id} className="px-4 py-4 sm:px-6">
            <details>
              <summary className="cursor-pointer text-navy-900">
                <span className="font-semibold">{plan.name}</span>
                <span className="ml-2 inline-block font-medium text-gold-700">{plan.priceMonthly === null ? 'Sur devis' : `${formatEuro(plan.priceMonthly)} / mois`}</span>
                <span className="mt-1 block pl-4 text-sm text-slate-500">{plan.specs.dossiers} · {plan.specs.users} · {plan.specs.support}</span>
              </summary>
              <div className="mt-3 border-l-2 border-gold-500 pl-4 text-sm leading-relaxed text-navy-900">
                <p>{plan.audience}</p>
                <p>{plan.priceMonthly === null ? 'Volume et accompagnement définis sur devis.' : `Facturation annuelle disponible à ${formatEuro(yearlyTotal(plan.priceMonthly))} pour douze mois.`}</p>
              </div>
            </details>
          </li>
        ))}
      </ol>
      <a href="/recette/" className="mt-6 inline-flex min-h-11 items-center rounded-full bg-navy-900 px-5 py-3 text-sm font-semibold text-white hover:bg-navy-700">Entrer dans l’espace de recette</a>
    </div>
  );
}
