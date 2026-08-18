import { useMemo, useState } from 'react';

import {
  classer,
  filtrer,
  LIBELLES_AXE,
  LIBELLES_ETAT,
  LIBELLES_REGIME,
  ordonner,
  type AxeClassement,
  type FicheDossier,
} from '../../ldi/atelier';
import { estDemonstration } from '../../ldi/demonstration';
import { TON_ETAT } from './AtelierShell';
import { Reserve, TitreSection, Vide } from './Indicateurs';
import type { Vue } from './navigation';

const AXES: AxeClassement[] = ['etat', 'regime', 'qualification'];

export function VueDossiers({
  fiches,
  actif,
  onActif,
  onVue,
  onImporter,
  onRetirer,
  erreurImport,
}: {
  fiches: FicheDossier[];
  actif: string | null;
  onActif: (r: string) => void;
  onVue: (v: Vue) => void;
  onImporter: (json: string) => void;
  onRetirer: (reference: string) => void;
  erreurImport: string | null;
}) {
  const [axe, setAxe] = useState<AxeClassement>('etat');
  const [requete, setRequete] = useState('');
  const [saisie, setSaisie] = useState('');

  // Le classement est recalculé au changement d'axe ou de filtre seulement —
  // les fiches, elles, viennent déjà d'analyses mémorisées par empreinte.
  const groupes = useMemo(
    () => classer(ordonner(filtrer(fiches, requete)), axe),
    [fiches, requete, axe]
  );

  const visibles = groupes.reduce((n, g) => n + g.fiches.length, 0);

  return (
    <div className="space-y-8">
      <section>
        <TitreSection surtitre="Classement" titre={LIBELLES_AXE[axe]}>
          <div className="flex flex-wrap items-center gap-2">
            {AXES.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAxe(a)}
                aria-pressed={a === axe}
                className={`rounded-full border px-3.5 py-1.5 text-xs transition-colors ${
                  a === axe
                    ? 'border-gold-500 bg-gold-500/15 text-navy-900'
                    : 'hairline bg-white text-slate-500 hover:border-gold-500 hover:text-navy-900'
                }`}
              >
                {LIBELLES_AXE[a]}
              </button>
            ))}
          </div>
        </TitreSection>

        <div className="mb-5 flex flex-wrap items-center gap-3">
          <label className="sr-only" htmlFor="recherche-dossier">
            Filtrer les dossiers
          </label>
          <input
            id="recherche-dossier"
            value={requete}
            onChange={(e) => setRequete(e.target.value)}
            placeholder="Filtrer par référence, régime ou qualification"
            className="w-full max-w-sm rounded-lg border hairline bg-white px-3.5 py-2.5 text-sm text-navy-900 focus:border-gold-500 focus:outline-none"
          />
          <span className="text-xs text-slate-500">
            {visibles} dossier(s) affiché(s) sur {fiches.length}
          </span>
        </div>

        {axe === 'qualification' && (
          <div className="mb-5">
            <Reserve>
              Les qualifications sont reprises <strong>telles qu’elles sont écrites</strong> dans
              chaque dossier : « CP, art. 313-1 » et « article 313-1 du code pénal » restent deux
              entrées distinctes. Les rapprocher supposerait une équivalence que rien ici ne
              vérifie. Un dossier portant plusieurs qualifications apparaît dans plusieurs groupes.
            </Reserve>
          </div>
        )}

        {groupes.length === 0 ? (
          <Vide
            titre="Aucun dossier ne correspond"
            explication={
              fiches.length === 0
                ? 'L’atelier est vide. Chargez un dossier au format JSON ci-dessous.'
                : 'Aucun dossier ne correspond à ce filtre. Le filtre porte sur la référence, le régime et les qualifications — pas sur le contenu des pièces.'
            }
          />
        ) : (
          <div className="space-y-8">
            {groupes.map((g) => (
              <section key={g.cle} aria-label={g.intitule}>
                <div className="mb-3 border-b hairline pb-2">
                  <h3 className="font-display text-lg font-semibold text-navy-900">
                    {g.intitule}{' '}
                    <span className="font-sans text-sm font-normal text-slate-500">
                      · {g.fiches.length}
                    </span>
                  </h3>
                  {g.precision && (
                    <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500">
                      {g.precision}
                    </p>
                  )}
                </div>

                <ul className="grid gap-3 md:grid-cols-2">
                  {g.fiches.map((f) => (
                    <CarteDossier
                      key={`${g.cle}-${f.reference}`}
                      fiche={f}
                      actif={f.reference === actif}
                      onOuvrir={() => {
                        onActif(f.reference);
                        onVue('controles');
                      }}
                      onSelectionner={() => onActif(f.reference)}
                      onRetirer={() => onRetirer(f.reference)}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </section>

      <section>
        <TitreSection surtitre="Ajouter" titre="Charger un dossier" />
        <div className="rounded-xl border hairline bg-white p-6 shadow-card">
          <p className="text-sm leading-relaxed text-slate-600">
            Collez un dossier au format JSON. Il est analysé <strong>dans ce navigateur</strong> :
            aucune donnée n’est transmise. Par défaut, il n’est pas non plus conservé — la
            conservation s’active dans <button type="button" onClick={() => onVue('parametres')} className="underline decoration-gold-500 underline-offset-2 hover:text-gold-700">Paramètres</button>.
          </p>

          <label className="sr-only" htmlFor="import-dossier">
            Dossier au format JSON
          </label>
          <textarea
            id="import-dossier"
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            rows={6}
            spellCheck={false}
            placeholder='{ "reference": "…", "qualifications": [], "regime": "droit-commun", "pieces": [], "evenements": [] }'
            className="mt-4 w-full rounded-lg border hairline bg-cream-50 p-3 font-mono text-xs text-navy-900 focus:border-gold-500 focus:outline-none"
          />

          {erreurImport && (
            <p role="alert" className="mt-3 text-sm text-red-800">
              {erreurImport}
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                onImporter(saisie);
                setSaisie('');
              }}
              disabled={saisie.trim() === ''}
              className="rounded-lg bg-navy-900 px-5 py-2.5 text-sm text-cream-50 transition-colors hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Ajouter à l’atelier
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function CarteDossier({
  fiche,
  actif,
  onOuvrir,
  onSelectionner,
  onRetirer,
}: {
  fiche: FicheDossier;
  actif: boolean;
  onOuvrir: () => void;
  onSelectionner: () => void;
  onRetirer: () => void;
}) {
  const i = fiche.indicateurs;

  return (
    <li
      className={`rounded-xl border bg-white p-5 shadow-card transition-colors ${
        actif ? 'border-gold-500' : 'hairline'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2">
            <span className={`h-2 w-2 shrink-0 rounded-full ${TON_ETAT[fiche.etat]}`} aria-hidden="true" />
            <button
              type="button"
              onClick={onOuvrir}
              className="truncate font-mono text-sm text-navy-900 underline decoration-transparent underline-offset-4 hover:decoration-gold-500"
            >
              {fiche.reference}
            </button>
            {estDemonstration(fiche.reference) && (
              <span className="shrink-0 rounded-full border hairline-gold bg-gold-500/10 px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-gold-700">
                fictif
              </span>
            )}
          </p>
          <p className="mt-1.5 text-sm text-slate-600">
            {LIBELLES_REGIME[fiche.regime]}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {fiche.qualifications.join(' · ') || 'Qualification non renseignée'}
          </p>
        </div>

        {!actif && (
          <button
            type="button"
            onClick={onSelectionner}
            className="shrink-0 rounded-full border hairline px-3 py-1 text-[0.7rem] text-slate-500 transition-colors hover:border-gold-500 hover:text-navy-900"
          >
            Activer
          </button>
        )}
      </div>

      <p className="mt-3 text-xs leading-relaxed text-slate-500">
        {LIBELLES_ETAT[fiche.etat].court} — {i.pieces} pièce(s), {i.evenements} événement(s),{' '}
        {i.anomalies} anomalie(s), {i.nonEtablis} point(s) non établi(s).
        {i.piecesOrphelines > 0 &&
          ` ${i.piecesOrphelines} pièce(s) non rattachée(s) à la chronologie.`}
      </p>

      {fiche.periode && (
        <p className="mt-1.5 font-mono text-[0.68rem] text-slate-400">
          {fiche.periode.debut.slice(0, 16).replace('T', ' ')} →{' '}
          {fiche.periode.fin.slice(0, 16).replace('T', ' ')}
        </p>
      )}

      <div className="mt-4 flex items-center justify-between">
        <button
          type="button"
          onClick={onOuvrir}
          className="text-xs text-gold-700 underline decoration-gold-500 underline-offset-4 hover:text-navy-900"
        >
          Ouvrir les points de contrôle
        </button>
        <button
          type="button"
          onClick={onRetirer}
          className="text-xs text-slate-400 underline decoration-transparent underline-offset-4 hover:text-red-800 hover:decoration-red-800"
        >
          Retirer de l’atelier
        </button>
      </div>
    </li>
  );
}
