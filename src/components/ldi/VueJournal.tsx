/**
 * Journal d'audit (M13) — consultable, filtrable, exportable. Aucun contenu
 * de dossier : identifiants, comptes, horodatages (B11).
 */
import { useState } from 'react';

import type { EntreeJournal } from '../../noyau/modele';
import { Reserve, TitreSection, Vide } from './Indicateurs';

export function VueJournal({ entrees }: { entrees: EntreeJournal[] }) {
  const [filtrePasse, setFiltrePasse] = useState('');

  const filtrees = filtrePasse ? entrees.filter((e) => e.passe === filtrePasse) : entrees;
  const passes = [...new Set(entrees.map((e) => e.passe).filter(Boolean))] as string[];

  return (
    <div className="space-y-6">
      <TitreSection surtitre="Journal" titre="Traçabilité des générations">
        <div className="flex items-center gap-2">
          <select value={filtrePasse} onChange={(e) => setFiltrePasse(e.target.value)}
            className="rounded-md border hairline bg-surface px-2 py-1.5 text-xs text-encre focus:border-laiton focus:outline-none">
            <option value="">Toutes les passes</option>
            {passes.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <button type="button"
            onClick={() => void navigator.clipboard?.writeText(JSON.stringify(entrees, null, 2))}
            className="rounded-lg border hairline bg-surface px-3 py-1.5 text-xs text-encre transition-colors hover:border-laiton">
            Exporter (copie JSON)
          </button>
        </div>
      </TitreSection>

      {filtrees.length === 0 ? (
        <Vide titre="Journal vide" explication="Chaque exécution de passe et chaque génération s’inscriront ici, avec le moteur employé." />
      ) : (
        <div className="overflow-x-auto rounded-xl border hairline bg-surface shadow-card">
          <table className="w-full min-w-[44rem] text-sm">
            <thead>
              <tr className="border-b hairline text-left">
                {['Horodatage', 'Action', 'Passe', 'Moteur', 'Entrées', 'Sorties', 'Blocages'].map((t) => (
                  <th key={t} className="px-4 py-3 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-encre-2">{t}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...filtrees].reverse().map((e) => (
                <tr key={e.id} className="border-b hairline align-top last:border-0">
                  <td className="px-4 py-2.5 font-mono text-xs text-encre-3">{e.horodatage.slice(0, 19).replace('T', ' ')}</td>
                  <td className="px-4 py-2.5 text-encre">{e.action}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-laiton-clair">{e.passe ?? '—'}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-encre-2">{e.moteur.type}{e.moteur.modele ? ` (${e.moteur.modele})` : ''}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-encre-3">{e.entrees.length}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-encre-3">{e.sorties.join(' · ')}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-alerte-clair">{e.blocages.join(' · ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Reserve>
        Le journal ne contient <strong>aucun contenu de dossier</strong> : identifiants internes, comptes et horodatages
        seulement (B11). Il peut donc s’exporter sans précaution particulière.
      </Reserve>
    </div>
  );
}
