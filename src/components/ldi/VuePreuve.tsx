/**
 * Preuve — éléments à charge, portée, faiblesses, hypothèses (§5.2, M4).
 *
 * La saisie vit ici : l'analyse ne peut disséquer que ce que l'avocat a
 * saisi, et l'écran le dit. Aucune conclusion sur les faits (B15).
 */
import { useState } from 'react';

import type { AnalysePreuve } from '../../noyau/preuve';
import type { DossierPenal, ElementPreuve } from '../../noyau/modele';
import { Appuis, Reserve, TitreSection, Vide } from './Indicateurs';

export function VuePreuve({
  dossier,
  analyses,
  onAjouter,
  onAppui,
}: {
  dossier: DossierPenal | null;
  analyses: AnalysePreuve[] | null;
  onAjouter: (element: Omit<ElementPreuve, 'id'>) => void;
  /** B20 — remonter d'un clic de l'appui à la pièce (vue Documents). */
  onAppui?: (appui: string) => void;
}) {
  const [type, setType] = useState('');
  const [rattachement, setRattachement] = useState('');
  const [cotes, setCotes] = useState('');

  if (!dossier || !analyses) {
    return <Vide titre="Aucun dossier actif" explication="L’analyse de la preuve porte sur les éléments à charge du dossier sélectionné." />;
  }

  return (
    <div className="space-y-8">
      <section>
        <TitreSection surtitre="Saisie" titre="Déclarer un élément à charge" />
        <form
          className="flex flex-wrap items-end gap-3 rounded-xl border hairline bg-surface p-5 shadow-card"
          onSubmit={(e) => {
            e.preventDefault();
            if (!type.trim()) return;
            onAjouter({
              type: type.trim(),
              rattachementClient: rattachement.trim(),
              portee: '',
              faiblesses: [],
              cotes: cotes.split(',').map((c) => c.trim()).filter(Boolean),
            });
            setType(''); setRattachement(''); setCotes('');
          }}
        >
          <Champ id="pr-type" libelle="Type (ex. téléphonie — bornage, déclaration de co-mis en cause)" valeur={type} onChange={setType} large />
          <Champ id="pr-ratt" libelle="Comment il est rattaché au client" valeur={rattachement} onChange={setRattachement} large />
          <Champ id="pr-cotes" libelle="Cotes (D12, D40…)" valeur={cotes} onChange={setCotes} />
          <button type="submit" className="rounded-lg bg-laiton px-4 py-2 text-sm text-fond transition-colors hover:bg-laiton-clair">
            Analyser
          </button>
        </form>
      </section>

      <section>
        <TitreSection surtitre="Analyse" titre={`${analyses.length} élément(s) disséqué(s)`} />
        {analyses.length === 0 ? (
          <Reserve>Aucun élément saisi. L’analyse ne dissèque que ce qui est déclaré : les éléments à charge se relèvent dans les cotes, puis se saisissent ici.</Reserve>
        ) : (
          <div className="space-y-4">
            {analyses.map((a) => (
              <article key={a.elementId} className="rounded-xl border hairline bg-surface p-5 shadow-card">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-sm font-semibold text-encre">{a.type}</h3>
                  <Appuis appuis={a.appuis} onAppui={onAppui} />
                </div>
                <dl className="mt-3 space-y-2.5 text-xs leading-relaxed">
                  <Ligne t="Établit">{a.etablit}</Ligne>
                  <Ligne t="N’établit pas" ton="text-laiton-clair">{a.netablitPas}</Ligne>
                  <Ligne t="Écart d’imputation" ton="text-alerte-clair">{a.ecartImputation}</Ligne>
                  <Ligne t="Faiblesses">{a.faiblesses.join(' · ')}</Ligne>
                  <Ligne t="Hypothèses alternatives">{a.hypothesesAlternatives.join(' · ')}</Ligne>
                </dl>
              </article>
            ))}
          </div>
        )}
        <div className="mt-4">
          <Reserve>
            Ces grilles ne concluent jamais sur les faits : elles séparent ce qu’un élément établit de ce que l’accusation en tire.
            La force d’une contestation s’argumente — elle ne se chiffre pas.
          </Reserve>
        </div>
      </section>
    </div>
  );
}

function Champ({ id, libelle, valeur, onChange, large = false }: { id: string; libelle: string; valeur: string; onChange: (v: string) => void; large?: boolean }) {
  return (
    <label htmlFor={id} className={`block text-xs text-encre-2 ${large ? 'min-w-64 flex-1' : 'w-40'}`}>
      {libelle}
      <input id={id} value={valeur} onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border hairline bg-fond px-3 py-2 text-sm text-encre focus:border-laiton focus:outline-none" />
    </label>
  );
}

function Ligne({ t, ton = 'text-encre-2', children }: { t: string; ton?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[11rem_1fr]">
      <dt className={`font-mono text-[0.62rem] uppercase tracking-[0.16em] ${ton}`}>{t}</dt>
      <dd className="text-encre-2">{children}</dd>
    </div>
  );
}
