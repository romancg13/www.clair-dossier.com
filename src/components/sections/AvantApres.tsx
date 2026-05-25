import { Reveal } from '../primitives/Reveal';
import { ArrowRightIcon, CheckIcon, CrossIcon } from '../icons';

const AVANT = [
  "Pièces dispersées dans 4 emails, 2 fils WhatsApp et un dossier carton.",
  "Chronologie reconstituée à la main avant chaque consultation, recommencée à chaque rebondissement.",
  "Le client ignore où en est son dossier — il appelle pour demander.",
  "Les statuts sont dans la tête de l'avocat, pas dans un système.",
  "Validation par mail informel, signature scannée, conservation aléatoire.",
];

const AVEC = [
  "Pièces déposées une fois, renommées, indexées et reliées à la chronologie.",
  "Chronologie auto-construite depuis les pièces, éditable, exportable en PDF.",
  "Le client consulte le statut en temps réel — six statuts standardisés, traçables.",
  "Tableau de bord équipe, attribution des dossiers, charge par collaborateur visible.",
  "Validation horodatée, signature électronique, conservation conforme aux délais légaux.",
];

export function AvantApres() {
  return (
    <Reveal as="section" className="bg-cream-50">
      <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:px-12">
        <div className="grid items-stretch gap-4 lg:grid-cols-[1fr_auto_1fr] lg:gap-8">
          {/* Avant */}
          <div className="rounded-2xl border hairline bg-cream-100 p-7 sm:p-9">
            <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-slate-400">
              Avant ClairDossier
            </p>
            <h2 className="mt-3 font-display text-3xl font-semibold leading-tight text-navy-900 sm:text-4xl">
              Le dossier vit dans le désordre.
            </h2>
            <ul className="mt-7 space-y-4">
              {AVANT.map((item) => (
                <li key={item} className="flex gap-3 text-sm leading-relaxed text-slate-500">
                  <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-navy-900/8">
                    <CrossIcon width={11} height={11} strokeWidth={2} className="text-navy-700" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Connecteur */}
          <div className="hidden items-center lg:flex">
            <div className="flex flex-col items-center gap-3">
              <div className="h-12 w-px bg-gold-500/40" />
              <ArrowRightIcon width={20} height={20} className="text-gold-500" strokeWidth={1.5} />
              <div className="h-12 w-px bg-gold-500/40" />
            </div>
          </div>

          {/* Avec */}
          <div className="rounded-2xl bg-navy-900 p-7 text-cream-50 sm:p-9">
            <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-gold-500">
              Avec ClairDossier
            </p>
            <h2 className="mt-3 font-display text-3xl font-semibold leading-tight text-cream-50 sm:text-4xl">
              Le dossier vit dans l'ordre.
            </h2>
            <ul className="mt-7 space-y-4">
              {AVEC.map((item) => (
                <li key={item} className="flex gap-3 text-sm leading-relaxed text-cream-50/80">
                  <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-gold-500/20">
                    <CheckIcon width={12} height={12} strokeWidth={2.2} className="text-gold-500" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </Reveal>
  );
}
