import type { ReactNode } from 'react';

import { LIBELLES_ETAT, type FicheDossier } from '../../ldi/atelier';
import { estDemonstration } from '../../ldi/demonstration';
import { CAPACITES_PREVUES, NAVIGATION, entreePour, type Vue } from './navigation';

/** Couleur de pastille par état, alignée sur la sémantique du classement. */
export const TON_ETAT: Record<FicheDossier['etat'], string> = {
  anomalie: 'bg-red-500',
  'a-verifier': 'bg-gold-500',
  vide: 'bg-slate-300',
};

type Props = {
  vue: Vue;
  onVue: (vue: Vue) => void;
  fiches: FicheDossier[];
  actif: string | null;
  onActif: (reference: string | null) => void;
  /** Vrai tant que l'atelier ne contient que les dossiers fictifs. */
  demonstration: boolean;
  children: ReactNode;
};

export function AtelierShell({
  vue,
  onVue,
  fiches,
  actif,
  onActif,
  demonstration,
  children,
}: Props) {
  const entree = entreePour(vue);
  const ficheActive = fiches.find((f) => f.reference === actif) ?? null;

  return (
    <div className="min-h-screen bg-cream-50 lg:grid lg:grid-cols-[17rem_1fr]">
      {/*
        La colonne porte le fond, pas la barre elle-même : celle-ci est collante
        et donc haute d'un écran, si bien qu'une page longue laissait apparaître
        le fond crème sous elle.
      */}
      <div className="bg-navy-900">
        <Sidebar vue={vue} onVue={onVue} />
      </div>

      <div className="min-w-0">
        <Topbar
          vue={vue}
          resume={entree?.resume ?? ''}
          fiches={fiches}
          actif={actif}
          onActif={onActif}
          ficheActive={ficheActive}
        />

        <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
          {demonstration && (
            <p
              className="mb-8 rounded-lg border border-gold-500/40 bg-gold-500/10 p-4 text-sm text-navy-900"
              role="status"
            >
              <strong className="font-semibold">Dossiers de démonstration, entièrement fictifs.</strong>{' '}
              Aucune de ces procédures n’existe. Elles servent à montrer ce que les détecteurs
              relèvent sur des cas connus. Chargez un dossier réel depuis{' '}
              <button
                type="button"
                onClick={() => onVue('dossiers')}
                className="underline decoration-gold-500 underline-offset-2 hover:text-gold-700"
              >
                l’onglet Dossiers
              </button>{' '}
              — il ne quittera pas ce navigateur.
            </p>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}

function Sidebar({ vue, onVue }: { vue: Vue; onVue: (v: Vue) => void }) {
  return (
    <aside className="border-b border-navy-800 text-cream-50 lg:sticky lg:top-0 lg:max-h-screen lg:overflow-y-auto lg:border-b-0 lg:border-r">
      <div className="px-6 py-7">
        <p className="font-display text-2xl font-semibold leading-none">LDI</p>
        <p className="mt-1.5 font-mono text-[0.62rem] uppercase tracking-[0.22em] text-gold-400">
          Analyse de dossier pénal
        </p>
      </div>

      <nav aria-label="Sections de l’atelier" className="pb-6">
        {NAVIGATION.map((section) => (
          <div key={section.titre} className="mb-5">
            <p className="px-6 pb-2 font-mono text-[0.6rem] uppercase tracking-[0.22em] text-slate-400">
              {section.titre}
            </p>
            <ul>
              {section.entrees.map((e) => {
                const courant = e.vue === vue;
                return (
                  <li key={e.vue}>
                    <button
                      type="button"
                      onClick={() => onVue(e.vue)}
                      aria-current={courant ? 'page' : undefined}
                      className={`flex w-full items-center gap-3 border-l-2 px-6 py-2.5 text-left text-sm transition-colors ${
                        courant
                          ? 'border-gold-500 bg-navy-800 text-cream-50'
                          : 'border-transparent text-slate-300 hover:bg-navy-800/60 hover:text-cream-50'
                      }`}
                    >
                      <span className="min-w-0 flex-1 truncate">{e.intitule}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        {/*
          Le périmètre non couvert est affiché, pas masqué : une capacité qu'on
          croit active est une erreur qui se découvre au pire moment.
        */}
        <div className="mx-6 mt-2 rounded-lg border border-navy-700 bg-navy-800/60 p-4">
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.22em] text-slate-400">
            Non couvert à ce jour
          </p>
          <ul className="mt-3 space-y-2.5">
            {CAPACITES_PREVUES.map((c) => (
              <li key={c.intitule}>
                <p className="text-xs font-medium text-slate-300">{c.intitule}</p>
                <p className="mt-0.5 text-[0.7rem] leading-relaxed text-slate-400">{c.pourquoi}</p>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </aside>
  );
}

function Topbar({
  vue,
  resume,
  fiches,
  actif,
  onActif,
  ficheActive,
}: {
  vue: Vue;
  resume: string;
  fiches: FicheDossier[];
  actif: string | null;
  onActif: (r: string | null) => void;
  ficheActive: FicheDossier | null;
}) {
  const entree = entreePour(vue);

  return (
    <header className="border-b hairline bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-4 px-5 py-5 sm:px-8">
        <div className="min-w-0">
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-slate-500">
            Atelier · {entree?.intitule ?? ''}
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold leading-tight text-navy-900">
            {entree?.intitule ?? 'Atelier'}
          </h1>
          {resume && <p className="mt-1 max-w-xl text-sm text-slate-500">{resume}</p>}
        </div>

        <div className="flex items-center gap-3">
          {ficheActive && (
            <span className="hidden items-center gap-2 sm:inline-flex">
              <span
                className={`h-2 w-2 rounded-full ${TON_ETAT[ficheActive.etat]}`}
                aria-hidden="true"
              />
              <span className="text-xs text-slate-500">
                {LIBELLES_ETAT[ficheActive.etat].court}
              </span>
            </span>
          )}

          <label className="sr-only" htmlFor="dossier-actif">
            Dossier actif
          </label>
          <select
            id="dossier-actif"
            value={actif ?? ''}
            onChange={(e) => onActif(e.target.value || null)}
            className="max-w-[16rem] rounded-lg border hairline bg-cream-50 px-3 py-2 text-sm text-navy-900 focus:border-gold-500 focus:outline-none"
          >
            <option value="">Aucun dossier sélectionné</option>
            {fiches.map((f) => (
              <option key={f.reference} value={f.reference}>
                {f.reference}
                {estDemonstration(f.reference) ? ' · fictif' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>
    </header>
  );
}
