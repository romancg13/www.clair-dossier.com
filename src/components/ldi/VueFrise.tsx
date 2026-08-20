/**
 * La frise de régularité — l'élément signature du design system (§8.4).
 *
 * Une colonne verticale des actes dans l'ordre chronologique. Quand un grief
 * est envisagé sur un acte, le trait descendant change d'état et les nœuds
 * contaminés se distinguent — c'est la propagation rendue visible. Seul
 * endroit de l'interface qui bouge, brièvement, et la préférence système de
 * réduction d'animation est respectée (index.css).
 */
import { useMemo } from 'react';

import { actesContamines, type DossierPenal } from '../../noyau/modele';
import type { ResultatChaine } from '../../noyau/orchestrateur';
import { Reserve, TitreSection, Vide } from './Indicateurs';

type Noeud = {
  id: string;
  date: string | null;
  intitule: string;
  detail: string;
  /** `source` : le grief part d'ici. `contamine` : atteint par propagation. */
  etat: 'sain' | 'source' | 'contamine';
  griefs: string[];
};

export function VueFrise({ dossier, chaine }: { dossier: DossierPenal | null; chaine: ResultatChaine | null }) {
  const noeuds = useMemo<Noeud[]>(() => {
    if (!dossier || !chaine) return [];

    // Les griefs de la grille : actes visés et actes atteints par propagation.
    const sources = new Set<string>();
    const contamines = new Set<string>();
    const griefsParActe = new Map<string, string[]>();

    for (const poste of chaine.postes) {
      for (const grief of poste.griefs) {
        for (const appui of grief.appuis) {
          if (dossier.actes.some((a) => a.id === appui)) {
            sources.add(appui);
            griefsParActe.set(appui, [...(griefsParActe.get(appui) ?? []), grief.enonce]);
            for (const atteint of actesContamines(dossier, { id: 'tmp', acteViseId: appui, irregularite: '', interetAAgir: '', cotesAffectees: [], actesSubsequentsContamines: [], forclusionEventuelle: null, appuis: [] })) {
              if (atteint !== appui) contamines.add(atteint);
            }
          }
        }
      }
    }

    const actes: Noeud[] = dossier.actes.map((a) => ({
      id: a.id,
      date: a.dateHeure,
      intitule: a.type,
      detail: `${a.autoritePrescriptrice}${a.cotes.length ? ` · ${a.cotes.join(', ')}` : ''} · autorisation : ${a.autorisationPrealable}`,
      etat: sources.has(a.id) ? 'source' : contamines.has(a.id) ? 'contamine' : 'sain',
      griefs: griefsParActe.get(a.id) ?? [],
    }));

    // Les événements complètent la colonne : la frise montre la procédure
    // entière, pas seulement les actes formalisés.
    const evenements: Noeud[] = dossier.evenements.map((e) => ({
      id: e.id,
      date: e.horodatage,
      intitule: e.description,
      detail: e.nature,
      etat: 'sain',
      griefs: [],
    }));

    return [...actes, ...evenements].sort((a, b) => {
      if (a.date === null) return 1;
      if (b.date === null) return -1;
      return a.date < b.date ? -1 : 1;
    });
  }, [dossier, chaine]);

  if (!dossier || !chaine) {
    return <Vide titre="Aucun dossier actif" explication="La frise se construit sur les actes et événements du dossier sélectionné." />;
  }
  if (noeuds.length === 0) {
    return <Vide titre="Aucun acte daté" explication="Saisissez les actes de procédure (interpellation, perquisition, mesures) : la frise matérialisera la chronologie et la propagation des griefs." />;
  }

  const enGrief = noeuds.filter((n) => n.etat !== 'sain').length;

  return (
    <div className="space-y-6">
      <TitreSection surtitre="Frise" titre="La procédure, acte par acte" />

      <ol className="relative ml-3 border-l-2 hairline-strong pl-6">
        {noeuds.map((noeud) => (
          <li key={noeud.id} className="relative pb-7 last:pb-0">
            {/* Le trait de propagation : il descend depuis un nœud en grief. */}
            {noeud.etat !== 'sain' && (
              <span aria-hidden="true" className="frise-propagation absolute -left-[calc(1.5rem+2px)] top-2 h-full w-0.5 bg-alerte/70" />
            )}
            <span
              aria-hidden="true"
              className={`absolute -left-[calc(1.5rem+7px)] top-1.5 h-3 w-3 rounded-full border-2 ${
                noeud.etat === 'source'
                  ? 'border-alerte bg-alerte'
                  : noeud.etat === 'contamine'
                    ? 'border-alerte bg-fond'
                    : 'border-encre-3 bg-surface'
              }`}
            />
            <p className="font-mono text-xs text-encre-3">{noeud.date ? noeud.date.replace('T', ' · ') : '[non daté]'}</p>
            <p className={`mt-0.5 text-sm font-medium ${noeud.etat === 'sain' ? 'text-encre' : 'text-alerte-clair'}`}>
              {noeud.intitule}
              {noeud.etat === 'source' && <span className="ml-2 font-mono text-[0.62rem] uppercase tracking-[0.14em]">grief</span>}
              {noeud.etat === 'contamine' && <span className="ml-2 font-mono text-[0.62rem] uppercase tracking-[0.14em]">acte subséquent</span>}
            </p>
            <p className="mt-0.5 text-xs text-encre-2">{noeud.detail}</p>
            {noeud.griefs.map((g) => (
              <p key={g} className="mt-1.5 border-l-2 border-alerte/60 pl-2 text-xs leading-relaxed text-encre-2">{g}</p>
            ))}
          </li>
        ))}
      </ol>

      <Reserve>
        {enGrief > 0
          ? `${enGrief} nœud(s) marqués : le grief part du nœud plein et le trait rouge suit les actes qui en découlent. La propagation figure ce qui TOMBERAIT si le grief prospère — elle ne préjuge pas de son succès.`
          : 'Aucun grief envisagé sur les actes saisis. La frise reste une lecture : elle montre l’ordre, pas la régularité.'}
      </Reserve>
    </div>
  );
}
