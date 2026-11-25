import { useState } from "react";

/**
 * « Personnaliser mon espace » : trois options avancées, présentées en une ligne
 * chacune, détail au clic. APERÇU uniquement — tarifs provisoires, aucune vente,
 * aucun lien de paiement : rien n'est activable tant que le propriétaire n'a pas
 * validé l'offre. Affiché en démonstration, ou dans l'espace client seulement si
 * le build porte VITE_OPTIONS_PREVIEW=1.
 */
const OPTIONS = [
  { name: "Automation Pro", price: "+19 €/mois", pitch: "Vos suivis se font tout seuls.", detail: "Automatisations récurrentes et conditionnelles, enchaînements d’actions, sur plusieurs dossiers." },
  { name: "Vigilance Pro", price: "+29 €/mois", pitch: "Aucun renouvellement ne vous échappe.", detail: "Surveillance des contrats, renouvellements, comparaison de versions, rapports de vigilance." },
  { name: "Pilotage Pro", price: "+39 €/mois", pitch: "Tous vos dossiers en un coup d’œil.", detail: "Rapports multidossiers, tableaux personnalisés, bilans automatiques, exports consolidés." },
] as const;

export function PersonalizeSpace({ force = false }: { force?: boolean }) {
  const [open, setOpen] = useState(false);
  if (!force && import.meta.env.VITE_OPTIONS_PREVIEW !== "1") return null;
  return (
    <div className="text-sm">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="rounded-full border hairline-strong bg-white px-3.5 py-1.5 text-xs font-semibold text-navy-900 hover:bg-cream-100">
        Personnaliser mon espace
      </button>
      {open && (
        <div className="mt-3 rounded-2xl border hairline bg-white p-4 shadow-card">
          <ul className="divide-y divide-slate-200/70">
            {OPTIONS.map((o) => (
              <li key={o.name} className="py-2.5">
                <details>
                  <summary className="flex cursor-pointer flex-wrap items-baseline justify-between gap-x-3">
                    <span>
                      <strong className="font-semibold text-navy-900">{o.name}</strong> <span className="text-slate-600">— {o.pitch}</span>
                    </span>
                    <span className="text-xs text-slate-500">{o.price}</span>
                  </summary>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">{o.detail}</p>
                </details>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">Aperçu : options en préparation, tarifs indicatifs, non commercialisées. Ce qui est déjà compris dans votre offre n’est jamais facturé une seconde fois.</p>
        </div>
      )}
    </div>
  );
}
