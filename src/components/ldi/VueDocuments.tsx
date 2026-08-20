/**
 * Documents — pièces ingérées, empreintes, alertes B17, recherche plein texte.
 *
 * L'alerte B17 CITE le passage et sa localisation : un signalement qu'on ne
 * peut pas vérifier serait ignoré. Le passage reste dans la pièce — le
 * détecter n'est pas le supprimer.
 */
import { useMemo, useState } from 'react';

import { creerIndexLocal } from '../../ldi/ingestion/fragments';
import type { DocumentIngere } from '../../noyau/p0';
import { Reserve, TitreSection, Vide } from './Indicateurs';

const TON_INDEXATION: Record<DocumentIngere['etatIndexation'], string> = {
  indexe: 'text-encre-2',
  partiel: 'text-laiton-clair',
  quarantaine: 'text-alerte-clair',
};

export function VueDocuments({ documents }: { documents: DocumentIngere[] }) {
  const [requete, setRequete] = useState('');

  const index = useMemo(() => {
    const i = creerIndexLocal();
    for (const d of documents) i.ajouter(d.fragments);
    return i;
  }, [documents]);

  const resultats = useMemo(() => (requete.trim() ? index.chercher(requete) : []), [index, requete]);
  const alertes = documents.flatMap((d) => d.alertesInstructions.map((a) => ({ document: d.nom, ...a })));
  const nomParId = new Map(documents.map((d) => [d.id, d.nom]));

  if (documents.length === 0) {
    return <Vide titre="Aucun document ingéré" explication="Les pièces déposées dans l’onglet Dépôt apparaissent ici, avec leur empreinte et leur état d’indexation." />;
  }

  return (
    <div className="space-y-8">
      <section>
        <TitreSection surtitre="Recherche" titre="Chercher dans les pièces">
          <p className="font-mono text-[0.68rem] text-encre-3">{index.taille()} fragment(s) indexé(s)</p>
        </TitreSection>
        <input
          value={requete}
          onChange={(e) => setRequete(e.target.value)}
          placeholder="Tous les termes doivent être présents — ex. : perquisition assentiment"
          className="w-full rounded-lg border hairline bg-surface px-4 py-2.5 text-sm text-encre focus:border-laiton focus:outline-none"
        />
        {requete.trim() && (
          <ul className="mt-3 divide-y hairline overflow-hidden rounded-xl border hairline bg-surface shadow-card">
            {resultats.length === 0 && <li className="p-4 text-sm text-encre-2">Aucun fragment ne porte tous ces termes.</li>}
            {resultats.slice(0, 20).map((r) => (
              <li key={r.fragmentId} className="p-4">
                <p className="font-mono text-[0.68rem] text-encre-3">
                  {nomParId.get(r.documentId) ?? r.documentId} · p.{r.page} · {r.fragmentId}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-encre-2">{r.extrait}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {alertes.length > 0 && (
        <section>
          <TitreSection surtitre="B17" titre={`${alertes.length} passage(s) ressemblant à des consignes machine`} />
          <ul className="divide-y hairline overflow-hidden rounded-xl border border-alerte/60 bg-surface shadow-card">
            {alertes.map((a, i) => (
              <li key={i} className="p-4">
                <p className="font-mono text-[0.68rem] text-alerte-clair">
                  {a.document} · page {a.page}, position {a.position} · {a.motif}
                </p>
                <p className="mt-1.5 rounded-md bg-surface-2 p-2.5 font-mono text-xs leading-relaxed text-encre-2">« {a.passage} »</p>
              </li>
            ))}
          </ul>
          <div className="mt-3">
            <Reserve>
              Rien de tout cela n’a été exécuté, ni ne peut l’être : le contenu d’une pièce est une donnée, jamais une
              consigne (B17). Le passage reste dans la pièce — dans une écriture adverse, c’est un indice, pas un déchet.
            </Reserve>
          </div>
        </section>
      )}

      <section>
        <TitreSection surtitre="Pièces" titre={`${documents.length} document(s) ingéré(s)`} />
        <div className="overflow-x-auto rounded-xl border hairline bg-surface shadow-card">
          <table className="w-full min-w-[44rem] text-sm">
            <thead>
              <tr className="border-b hairline text-left">
                {['Document', 'Format', 'Entrée', 'Fragments', 'Indexation', 'Empreinte'].map((t) => (
                  <th key={t} className="px-4 py-3 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-encre-2">{t}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {documents.map((d) => (
                <tr key={d.id} className="border-b hairline last:border-0">
                  <td className="px-4 py-2.5 text-encre">{d.nom}</td>
                  <td className="px-4 py-2.5 text-encre-2">{d.format}</td>
                  <td className="px-4 py-2.5 text-encre-2">{d.modeEntree}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-encre-3">{d.fragments.length}</td>
                  <td className={`px-4 py-2.5 font-mono text-xs ${TON_INDEXATION[d.etatIndexation]}`}>
                    {d.etatIndexation}{d.pagesEnQuarantaine > 0 ? ` (${d.pagesEnQuarantaine} p. non lues)` : ''}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-encre-3">{d.empreinte}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3">
          <Reserve>
            L’empreinte permet de constater toute modification ultérieure d’un document : deux dépôts du même fichier
            portent la même. Le texte source est conservé intact, à l’octet près — l’ingestion conserve, elle ne trie pas.
          </Reserve>
        </div>
      </section>
    </div>
  );
}
