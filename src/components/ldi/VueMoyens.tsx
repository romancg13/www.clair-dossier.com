/**
 * Moyens — l'ordre procédural, la riposte, la contre-riposte (M6/P5).
 */
import type { Moyen } from '../../noyau/modele';
import { ORDRE_MOYENS } from '../../noyau/modele';
import { Reserve, TitreSection, Vide } from './Indicateurs';

const LIBELLES_CATEGORIE: Record<Moyen['categorie'], string> = {
  'in-limine-litis': 'In limine litis',
  nullite: 'Nullités',
  imputation: 'Contestation de l’imputation',
  requalification: 'Requalification',
  peine: 'Subsidiaire — peine',
};

export function VueMoyens({ moyens, incomplets }: { moyens: Moyen[] | null; incomplets: Moyen[] | null }) {
  if (!moyens) {
    return <Vide titre="Aucun dossier actif" explication="Les moyens se construisent depuis la grille, la preuve et la qualification du dossier sélectionné." />;
  }

  return (
    <div className="space-y-8">
      <TitreSection surtitre="Moyens" titre="Dans l’ordre où ils se soulèvent" />

      {(incomplets ?? []).length > 0 && (
        <p role="alert" className="rounded-lg border border-alerte/60 bg-alerte/10 p-4 text-sm text-alerte-clair">
          {incomplets!.length} moyen(s) sans riposte anticipée (P5) : l’export de tout livrable qui les porte est bloqué
          tant que la riposte et la contre-riposte ne sont pas formulées.
        </p>
      )}

      {moyens.length === 0 ? (
        <Vide titre="Aucun moyen construit" explication="Les moyens naissent des griefs de la grille, des écarts d’imputation et des éléments constitutifs manquants. Saisissez actes, preuves et qualifications." />
      ) : (
        ORDRE_MOYENS.map((categorie) => {
          const dansCategorie = moyens.filter((m) => m.categorie === categorie);
          if (dansCategorie.length === 0) return null;
          return (
            <section key={categorie}>
              <h3 className="mb-3 font-mono text-[0.68rem] uppercase tracking-[0.2em] text-laiton-clair">
                {LIBELLES_CATEGORIE[categorie]}
              </h3>
              <div className="space-y-3">
                {dansCategorie.map((m) => (
                  <article key={m.id} className="rounded-xl border hairline bg-surface p-5 shadow-card">
                    <p className="text-sm leading-relaxed text-encre">{m.enonce}</p>
                    <p className="mt-2 font-mono text-[0.68rem] text-encre-3">
                      appuis : {m.appuis.join(', ') || '—'} · fondement : {m.references.join(' ; ') || 'à vérifier auprès de la source officielle'}
                    </p>
                    <div className="mt-3 grid gap-3 border-t hairline pt-3 sm:grid-cols-2">
                      <div>
                        <p className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-alerte-clair">Riposte prévisible</p>
                        <p className="mt-1 text-xs leading-relaxed text-encre-2">{m.ripostePrevue}</p>
                      </div>
                      <div>
                        <p className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-laiton-clair">Contre-riposte</p>
                        <p className="mt-1 text-xs leading-relaxed text-encre-2">{m.contreRiposte}</p>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-encre-2"><span className="text-encre-3">Conséquence recherchée :</span> {m.consequenceRecherchee}</p>
                  </article>
                ))}
              </div>
            </section>
          );
        })
      )}

      <Reserve>
        L’ordre est procédural — in limine litis, nullités, imputation, requalification, peine — jamais un classement
        « par chances » : aucun score n’existe dans cet outil (B4). L’arbitrage entre moyens appartient à l’avocat.
      </Reserve>
    </div>
  );
}
