import { useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Reveal } from '../primitives/Reveal';
import { segmentPages } from '../../data/segments';
import { ArrowRightIcon } from '../icons';

/**
 * Pour qui — sélecteur de cas d'usage (MASTER PROMPT §29). Les trois
 * parcours professionnels reprennent mot pour mot src/data/segments.ts
 * (preuves vérifiables, aucun chiffre inventé) ; les deux premiers profils
 * décrivent l'usage réel du tunnel (profils Artisan / Indépendant / PME).
 */

type Audience = {
  id: string;
  label: string;
  surtitre: string;
  title: string;
  promesse: string;
  frictions: Array<{ title: string; body: string }>;
  link: { to: string; label: string };
};

const AUDIENCES: Audience[] = [
  {
    id: 'independant',
    label: 'Indépendant & artisan',
    surtitre: 'Indépendants, artisans, entreprises individuelles',
    title: 'Devis, factures, courriers : un dossier par client, sans rien perdre.',
    promesse:
      "Vous créez un dossier par client ou par chantier, vous y déposez le devis signé, la facture, les échanges et les justificatifs, et vous renseignez l'échéance de paiement. En cas d'impayé, le dossier est déjà prêt à être transmis à un professionnel habilité.",
    frictions: [
      {
        title: 'Les pièces d’un chantier sont réparties entre le téléphone, la boîte mail et la boîte à gants',
        body: 'Chaque justificatif manquant, au moment où il compte, coûte une demi-journée à retrouver.',
      },
      {
        title: 'Quand un client ne paie pas, il faut tout retrouver — dans l’ordre, avec les dates',
        body: 'Devis, facture, relances : le dossier se reconstitue après coup, sous pression.',
      },
    ],
    link: { to: '/fonctionnalites/creation-guidee', label: 'Voir la création guidée' },
  },
  {
    id: 'pme',
    label: 'TPE / PME',
    surtitre: 'TPE, PME, professions libérales',
    title: 'Plusieurs dossiers en parallèle, un seul espace.',
    promesse:
      "Dossier client, facture / paiement, administratif, comptable, personnel / RH : chaque dossier a sa nature, ses pièces et ses échéances. L'équipe retrouve l'avancement de chacun dans « Mes dossiers », et transmet au comptable ou au professionnel du droit quand le dossier est complet.",
    frictions: [
      {
        title: 'L’avancement des dossiers vit dans la tête de deux personnes',
        body: 'Une absence, un départ, et l’état réel des affaires en cours devient incertain.',
      },
      {
        title: 'Les pièces à transmettre au comptable ou à l’avocat sont à rassembler à chaque fois',
        body: 'La même collecte, répétée à chaque demande, avec le risque d’oublier une pièce.',
      },
    ],
    link: { to: '/fonctionnalites/suivi-statuts', label: 'Voir l’espace « Mes dossiers »' },
  },
  ...segmentPages.map<Audience>((s) => ({
    id: s.slug,
    label: s.navLabel,
    surtitre: s.surtitre,
    title: s.title,
    promesse: s.promesse,
    frictions: s.frictions.slice(0, 2),
    link: { to: `/${s.slug}`, label: 'Voir le parcours dédié' },
  })),
];

export function AudienceSwitcher() {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(AUDIENCES[0].id);
  const tabsRef = useRef<Array<HTMLButtonElement | null>>([]);
  const current = AUDIENCES.find((a) => a.id === active) ?? AUDIENCES[0];

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const idx = AUDIENCES.findIndex((a) => a.id === active);
    let next = idx;
    if (e.key === 'ArrowRight') next = (idx + 1) % AUDIENCES.length;
    else if (e.key === 'ArrowLeft') next = (idx - 1 + AUDIENCES.length) % AUDIENCES.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = AUDIENCES.length - 1;
    else return;
    e.preventDefault();
    setActive(AUDIENCES[next].id);
    tabsRef.current[next]?.focus();
  }

  return (
    <Reveal as="section" id="pour-qui" className="bg-cream-50">
      <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24 lg:px-12 lg:py-32">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-3xl">
            <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-700">Pour qui</p>
            <h2 className="mt-3 font-display text-[clamp(2.1rem,4.4vw,3.75rem)] font-semibold leading-[1.04] tracking-[-0.015em] text-navy-900">
              Le même dossier, adapté à votre métier.
            </h2>
          </div>
        </div>

        <div
          role="tablist"
          aria-label="Choisir un profil"
          onKeyDown={onKeyDown}
          className="mt-10 flex flex-wrap gap-2 rounded-full border hairline bg-white/70 p-1.5"
        >
          {AUDIENCES.map((a, i) => {
            const isActive = a.id === active;
            return (
              <button
                key={a.id}
                ref={(el) => {
                  tabsRef.current[i] = el;
                }}
                id={`audience-tab-${a.id}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`audience-panel-${a.id}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setActive(a.id)}
                className={`relative min-h-[40px] rounded-full px-4 py-2 text-[0.82rem] font-medium transition-colors sm:px-5 ${
                  isActive ? 'text-cream-50' : 'text-slate-500 hover:text-navy-900'
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="audience-active"
                    className="absolute inset-0 rounded-full bg-navy-900"
                    transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 34 }}
                  />
                )}
                <span className="relative z-10">{a.label}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-8 min-h-[320px]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={current.id}
              id={`audience-panel-${current.id}`}
              role="tabpanel"
              aria-labelledby={`audience-tab-${current.id}`}
              tabIndex={0}
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className="grid items-start gap-8 rounded-[1.5rem] border hairline bg-white p-6 shadow-card sm:p-9 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14"
            >
              <div>
                <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-gold-700">{current.surtitre}</p>
                <h3 className="mt-3 font-display text-3xl font-semibold leading-tight text-navy-900 sm:text-4xl">
                  {current.title}
                </h3>
                <p className="mt-5 text-[0.98rem] leading-relaxed text-slate-500">{current.promesse}</p>
                <Link
                  to={current.link.to}
                  className="group mt-7 inline-flex items-center gap-2 rounded-full bg-navy-900 px-5 py-3 text-sm font-medium text-cream-50 transition-colors hover:bg-navy-800"
                >
                  {current.link.label}
                  <ArrowRightIcon width={14} height={14} strokeWidth={2} className="transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>

              <ul className="space-y-3">
                {current.frictions.map((f) => (
                  <li key={f.title} className="rounded-xl border hairline bg-cream-50 p-5">
                    <p className="font-display text-lg font-semibold leading-snug text-navy-900">{f.title}</p>
                    <p className="mt-2 text-sm leading-relaxed text-slate-500">{f.body}</p>
                  </li>
                ))}
              </ul>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </Reveal>
  );
}
