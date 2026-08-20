/**
 * Écritures — les neuf livrables, générés puis passés par la gate (M8/M9).
 *
 * Deux registres : l'atelier (sombre) pour choisir et lire le verdict, le
 * DOCUMENT (papier) pour lire l'écriture elle-même — le basculement est le
 * contraste voulu par le design system (§8.1). L'impression ne sort que la
 * zone document, jamais l'interface.
 */
import { useMemo, useState } from 'react';

import { genererLivrable, LIBELLES_LIVRABLE, type TypeLivrable } from '../../noyau/livrables';
import type { ResultatChaine } from '../../noyau/orchestrateur';
import type { Consigne } from '../../noyau/modele';
import type { TrameCabinet } from '../../noyau/consignes';
import type { SourceRecuperee } from '../../noyau/sources';
import { rendreVerdict } from '../../noyau/gate';
import { Reserve, TitreSection, Vide } from './Indicateurs';

const TYPES: TypeLivrable[] = [
  'synthese', 'grille', 'requete-nullite', 'conclusions', 'plaidoirie',
  'mise-en-liberte', 'actes-a-solliciter', 'questionnaire-client', 'rapport-ancrage',
];

export function VueEcritures({
  chaine,
  sources,
  consignes,
  trames = [],
  onGeneration,
}: {
  chaine: ResultatChaine | null;
  sources: SourceRecuperee[];
  consignes: Consigne[];
  /** Trames du cabinet — la plus récente du type habille le livrable. */
  trames?: TrameCabinet[];
  /** Journalisation M13 : type généré, verdict — identifiants seulement. */
  onGeneration: (type: TypeLivrable, autorise: boolean) => void;
}) {
  const [type, setType] = useState<TypeLivrable>('synthese');
  const [copie, setCopie] = useState(false);

  const livrable = useMemo(() => {
    if (!chaine) return null;
    const resultat = genererLivrable(type, chaine, { sources, consignes, trames });
    return resultat;
  }, [chaine, type, sources, consignes, trames]);

  if (!chaine) {
    return <Vide titre="Aucun dossier actif" explication="Les écritures se génèrent depuis l’analyse du dossier sélectionné." />;
  }

  return (
    <div className="space-y-6">
      <TitreSection surtitre="Écritures" titre="Générer un livrable">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => { window.print(); }}
            disabled={!livrable || !livrable.verdict.autorise}
            className="rounded-lg border hairline bg-surface px-4 py-2 text-sm text-encre transition-colors hover:border-laiton disabled:cursor-not-allowed disabled:opacity-40"
          >
            Imprimer
          </button>
          <button
            type="button"
            onClick={() => {
              if (!livrable || !livrable.verdict.autorise) return;
              void navigator.clipboard?.writeText(livrable.corps);
              setCopie(true);
            }}
            disabled={!livrable || !livrable.verdict.autorise}
            className="rounded-lg bg-laiton px-4 py-2 text-sm text-fond transition-colors hover:bg-laiton-clair disabled:cursor-not-allowed disabled:opacity-40"
          >
            {copie ? 'Copié' : 'Copier'}
          </button>
        </div>
      </TitreSection>

      <div className="flex flex-wrap gap-2">
        {TYPES.map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={type === t}
            onClick={() => { setType(t); setCopie(false); if (chaine) { const g = genererLivrable(t, chaine, { sources, consignes, trames }); onGeneration(t, g.verdict.autorise); } }}
            className={`rounded-full border px-3.5 py-1.5 text-xs transition-colors ${
              type === t ? 'border-laiton bg-laiton/10 text-encre' : 'hairline bg-surface text-encre-2 hover:border-laiton'
            }`}
          >
            {LIBELLES_LIVRABLE[t]}
          </button>
        ))}
      </div>

      {livrable && !livrable.verdict.autorise && (
        <div role="alert" className="rounded-xl border border-alerte/60 bg-alerte/10 p-5">
          <p className="text-sm font-semibold text-alerte-clair">Export bloqué par la gate — le blocage n’est pas contournable.</p>
          <pre className="mt-3 overflow-x-auto whitespace-pre-wrap font-mono text-xs leading-relaxed text-encre-2">
            {rendreVerdict(livrable.verdict)}
          </pre>
          <p className="mt-3 text-xs text-encre-2">
            La seule issue est de corriger ce qui est nommé, au chemin indiqué. Il n’existe pas de case « exporter quand même ».
          </p>
        </div>
      )}

      {livrable && (
        <div className={livrable.verdict.autorise ? '' : 'opacity-60'}>
          <div className="registre-document imprimable overflow-hidden rounded-xl border hairline shadow-card">
            <pre className="whitespace-pre-wrap px-8 py-10 font-[inherit] text-[0.95rem] leading-relaxed sm:px-12">
              {livrable.corps}
            </pre>
          </div>
        </div>
      )}

      <div className="masque-audience">
        <Reserve>
          Chaque livrable est un <strong>projet</strong> : il le porte en tête et en pied, et se termine par les
          vérifications indispensables avant dépôt. Le rapport d’ancrage est une annexe de contrôle — il ne se dépose pas.
          {consignes.length > 0 && ` Consignes appliquées à cette génération : ${consignes.length}.`}
          {livrable?.trameEmployee && ` Trame employée : « ${livrable.trameEmployee.intitule} » (${livrable.trameEmployee.id}).`}
        </Reserve>
      </div>
    </div>
  );
}
