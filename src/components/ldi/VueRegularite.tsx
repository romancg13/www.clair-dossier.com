/**
 * Régularité — les quatorze postes en tableau (§5.2).
 *
 * Chaque ligne dit son état : conforme (constat), grief ou manque. Le détail
 * déplie ce qui doit figurer / ce qui figure / ce qui manque / le grief — la
 * structure exacte du mandat, à l'écran.
 */
import { useState } from 'react';

import type { PosteRegularite } from '../../noyau/postes';
import { Appuis, Reserve, TitreSection, Vide } from './Indicateurs';

const TON: Record<PosteRegularite['synthese'], { pastille: string; texte: string; libelle: string }> = {
  constat: { pastille: 'bg-encre-3', texte: 'text-encre-2', libelle: 'constat' },
  grief: { pastille: 'bg-alerte', texte: 'text-alerte-clair', libelle: 'grief' },
  manque: { pastille: 'bg-laiton', texte: 'text-laiton-clair', libelle: 'manque' },
};

export function VueRegularite({
  postes,
  onAppui,
}: {
  postes: PosteRegularite[] | null;
  /** B20 — remonter d'un clic de l'appui à la pièce (vue Documents). */
  onAppui?: (appui: string) => void;
}) {
  const [ouvert, setOuvert] = useState<number | null>(null);

  if (!postes) {
    return <Vide titre="Aucun dossier actif" explication="La grille contrôle les quatorze postes du dossier sélectionné." />;
  }

  return (
    <div className="space-y-6">
      <TitreSection surtitre="Régularité" titre="Quatorze postes, aucun silence" />

      <div className="overflow-hidden rounded-xl border hairline bg-surface shadow-card">
        {postes.map((poste) => {
          const ton = TON[poste.synthese];
          const deplie = ouvert === poste.numero;
          return (
            <div key={poste.numero} className="border-b hairline last:border-0">
              <button
                type="button"
                onClick={() => setOuvert(deplie ? null : poste.numero)}
                aria-expanded={deplie}
                className="flex w-full items-baseline gap-4 px-5 py-3.5 text-left transition-colors hover:bg-surface-2"
              >
                <span className="w-6 shrink-0 font-mono text-xs text-encre-3">{poste.numero}</span>
                <span aria-hidden="true" className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${ton.pastille}`} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-encre">{poste.intitule}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-encre-2">{poste.constat}</span>
                </span>
                <span className={`shrink-0 font-mono text-[0.62rem] uppercase tracking-[0.16em] ${ton.texte}`}>{ton.libelle}</span>
              </button>

              {deplie && (
                <div className="space-y-4 border-t hairline bg-surface-2/50 px-5 py-4 pl-[3.75rem]">
                  <Bloc titre="Ce qui doit figurer au dossier">
                    <ul className="list-disc space-y-1 pl-4">{poste.attendu.map((a) => <li key={a}>{a}</li>)}</ul>
                  </Bloc>
                  {poste.present.length > 0 && (
                    <Bloc titre="Ce qui y figure">
                      <ul className="space-y-1.5">
                        {poste.present.map((p) => (
                          <li key={p.element}>
                            {p.element} <Appuis appuis={p.appuis} onAppui={onAppui} />
                          </li>
                        ))}
                      </ul>
                    </Bloc>
                  )}
                  {poste.griefs.length > 0 && (
                    <Bloc titre="Grief envisageable" ton="text-alerte-clair">
                      <ul className="space-y-1.5">
                        {poste.griefs.map((g) => (
                          <li key={g.enonce}>
                            {g.enonce}
                            {g.appuis.length > 0 && (
                              <span className="block">
                                <span className="font-mono text-[0.68rem] text-encre-3">appuis : </span>
                                <Appuis appuis={g.appuis} onAppui={onAppui} />
                              </span>
                            )}
                            {g.actesAffectes.length > 0 && (
                              <span className="block">
                                <span className="font-mono text-[0.68rem] text-encre-3">actes subséquents affectés : </span>
                                <Appuis appuis={g.actesAffectes} onAppui={onAppui} />
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </Bloc>
                  )}
                  {poste.manques.length > 0 && (
                    <Bloc titre="Ce qui manque" ton="text-laiton-clair">
                      <ul className="space-y-1.5">
                        {poste.manques.map((m) => (
                          <li key={m.id}>
                            {m.nature} <span className="text-encre-3">→ {m.action}</span>
                          </li>
                        ))}
                      </ul>
                    </Bloc>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Reserve>
        Un poste « constat » signifie que les éléments SAISIS n’ont rien révélé — pas que la procédure est régulière.
        Une pièce non versée est invisible pour la grille, et son absence n’y est signalée que si un poste l’attend.
      </Reserve>
    </div>
  );
}

function Bloc({ titre, ton = 'text-encre-2', children }: { titre: string; ton?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className={`font-mono text-[0.62rem] uppercase tracking-[0.18em] ${ton}`}>{titre}</p>
      <div className="mt-1.5 text-xs leading-relaxed text-encre-2">{children}</div>
    </div>
  );
}
