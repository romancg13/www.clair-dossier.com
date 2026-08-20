/**
 * La coquille de l'atelier — barre latérale, en-tête, mode audience.
 *
 * ┌─ CE QUE L'EN-TÊTE AFFICHE EN PERMANENCE (B19) ──────────────────────────┐
 * │ Le moteur d'inférence actif. Dans l'atelier il n'y en a qu'un possible : │
 * │ « déterministe · sur ce poste ». Ce n'est pas un détail de pied de page  │
 * │ — l'avocat doit savoir, à chaque instant, ce qui produit ce qu'il lit.   │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
import type { ReactNode } from 'react';

import { estDemonstration } from '../../ldi/demonstration';
import { CAPACITES_PREVUES, NAVIGATION, entreePour, type Vue } from './navigation';

type Props = {
  vue: Vue;
  onVue: (vue: Vue) => void;
  references: string[];
  actif: string | null;
  onActif: (reference: string | null) => void;
  demonstration: boolean;
  modeAudience: boolean;
  onModeAudience: (actif: boolean) => void;
  children: ReactNode;
};

export function AtelierShell({
  vue,
  onVue,
  references,
  actif,
  onActif,
  demonstration,
  modeAudience,
  onModeAudience,
  children,
}: Props) {
  const entree = entreePour(vue);

  return (
    <div className={`min-h-screen bg-fond ${modeAudience ? 'mode-audience' : ''} lg:grid lg:grid-cols-[16rem_1fr]`}>
      <div className={`bg-panneau ${modeAudience ? 'masque-audience' : ''}`}>
        <Sidebar vue={vue} onVue={onVue} />
      </div>

      <div className="min-w-0">
        <header className="sticky top-0 z-10 border-b hairline bg-fond/95 px-5 py-3 backdrop-blur sm:px-8">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2">
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-lg font-semibold text-encre">{entree?.intitule ?? 'Atelier'}</h1>
              <p className="truncate text-xs text-encre-2">{entree?.resume ?? ''}</p>
            </div>

            <label className="flex items-center gap-1.5 text-xs text-encre-2">
              Dossier
              <select
                value={actif ?? ''}
                onChange={(e) => onActif(e.target.value || null)}
                className="max-w-44 rounded-md border hairline bg-surface px-2 py-1.5 font-mono text-xs text-encre focus:border-laiton focus:outline-none"
              >
                <option value="">—</option>
                {references.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </label>

            {/* B19 : le moteur actif, en permanence, jamais dans un sous-menu. */}
            <p className="rounded-md border hairline bg-surface px-2.5 py-1.5 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-laiton-clair">
              moteur : déterministe · sur ce poste
            </p>

            <button
              type="button"
              onClick={() => onModeAudience(!modeAudience)}
              aria-pressed={modeAudience}
              className={`rounded-md border px-2.5 py-1.5 font-mono text-[0.62rem] uppercase tracking-[0.14em] transition-colors ${
                modeAudience ? 'border-laiton bg-laiton/10 text-laiton-clair' : 'hairline bg-surface text-encre-2 hover:border-laiton'
              }`}
            >
              audience
            </button>

            <p className="masque-audience hidden font-mono text-[0.62rem] text-encre-3 md:block">Ctrl+K</p>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
          {demonstration && (
            <p className="mb-8 rounded-lg border border-laiton/50 bg-laiton/10 p-4 text-sm text-encre" role="status">
              <strong className="font-semibold">Dossiers de démonstration, entièrement fictifs.</strong>{' '}
              Aucune de ces procédures n’existe : elles montrent ce que les contrôles relèvent sur des cas connus.
              Déposez un dossier réel depuis l’onglet Dépôt — il ne quittera pas ce poste.
            </p>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}

function Sidebar({ vue, onVue }: { vue: Vue; onVue: (vue: Vue) => void }) {
  return (
    <aside className="border-b hairline text-encre lg:sticky lg:top-0 lg:max-h-screen lg:overflow-y-auto lg:border-b-0 lg:border-r">
      <div className="px-6 pb-5 pt-6">
        <p className="font-display text-xl font-semibold tracking-tight text-encre">Defense OS</p>
        <p className="mt-1 font-mono text-[0.62rem] uppercase tracking-[0.22em] text-laiton-clair">
          hors ligne · rien ne sort du poste
        </p>
      </div>

      <nav aria-label="Navigation de l’atelier" className="px-3 pb-4">
        {NAVIGATION.map((section) => (
          <div key={section.titre} className="mb-4">
            <p className="px-3 pb-1.5 font-mono text-[0.6rem] uppercase tracking-[0.2em] text-encre-3">
              {section.titre}
            </p>
            <ul>
              {section.entrees.map((e) => (
                <li key={e.vue}>
                  <button
                    type="button"
                    onClick={() => onVue(e.vue)}
                    aria-current={vue === e.vue ? 'page' : undefined}
                    className={`w-full rounded-md px-3 py-1.5 text-left text-sm transition-colors ${
                      vue === e.vue
                        ? 'bg-laiton/15 text-laiton-clair'
                        : 'text-encre-2 hover:bg-surface hover:text-encre'
                    }`}
                  >
                    {e.intitule}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="mx-6 mb-6 rounded-lg border hairline bg-surface/60 p-4">
        <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-encre-3">Non couvert ici</p>
        <ul className="mt-2 space-y-2">
          {CAPACITES_PREVUES.map((c) => (
            <li key={c.intitule}>
              <p className="text-xs font-medium text-encre-2">{c.intitule}</p>
              <p className="mt-0.5 text-[0.68rem] leading-relaxed text-encre-3">{c.pourquoi}</p>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

export { estDemonstration };
