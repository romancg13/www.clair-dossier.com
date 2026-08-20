/**
 * Registre des demandes (M12) — rien ne se perd, rien ne disparaît (B21).
 */
import { useState } from 'react';

import type { Demande } from '../../noyau/modele';
import { Reserve, TitreSection, Vide } from './Indicateurs';

const TON_ETAT: Record<Demande['etat'], string> = {
  ouverte: 'text-laiton-clair',
  traitee: 'text-encre',
  'a-verifier': 'text-laiton-clair',
  close: 'text-encre-3',
};

export function VueRegistre({
  demandes,
  dossierActif,
  onCreer,
  onClore,
}: {
  demandes: Demande[];
  dossierActif: string | null;
  onCreer: (enonce: string) => void;
  onClore: (id: string) => void;
}) {
  const [enonce, setEnonce] = useState('');

  return (
    <div className="space-y-8">
      <section>
        <TitreSection surtitre="Registre" titre="Poser une demande" />
        <form
          className="flex flex-wrap items-end gap-3 rounded-xl border hairline bg-surface p-5 shadow-card"
          onSubmit={(e) => {
            e.preventDefault();
            if (!enonce.trim() || !dossierActif) return;
            onCreer(enonce.trim());
            setEnonce('');
          }}
        >
          <label htmlFor="demande" className="min-w-64 flex-1 text-xs text-encre-2">
            Demande {dossierActif ? `— dossier ${dossierActif}` : '(sélectionner un dossier)'}
            <input
              id="demande"
              value={enonce}
              onChange={(e) => setEnonce(e.target.value)}
              placeholder="Prépare la requête en nullité sur la perquisition."
              className="mt-1 w-full rounded-md border hairline bg-fond px-3 py-2 text-sm text-encre focus:border-laiton focus:outline-none"
            />
          </label>
          <button type="submit" disabled={!dossierActif} className="rounded-lg bg-laiton px-4 py-2 text-sm text-fond transition-colors hover:bg-laiton-clair disabled:cursor-not-allowed disabled:opacity-40">
            Enregistrer
          </button>
        </form>
      </section>

      <section>
        <TitreSection surtitre="Suivi" titre={`${demandes.length} demande(s) au registre`} />
        {demandes.length === 0 ? (
          <Vide titre="Registre vide" explication="Toute demande posée ici est tracée jusqu’à sa clôture — elle ne peut pas disparaître." />
        ) : (
          <ul className="divide-y hairline overflow-hidden rounded-xl border hairline bg-surface shadow-card">
            {[...demandes].reverse().map((d) => (
              <li key={d.id} className="flex flex-wrap items-start gap-x-4 gap-y-1 p-4">
                <span className={`w-20 shrink-0 font-mono text-[0.62rem] uppercase tracking-[0.14em] ${TON_ETAT[d.etat]}`}>{d.etat}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-encre">{d.enonce}</p>
                  <p className="mt-0.5 font-mono text-[0.68rem] text-encre-3">
                    {d.dossierReference} · {d.date.slice(0, 16).replace('T', ' ')}
                    {d.passesDeclenchees.length > 0 && ` · passes : ${d.passesDeclenchees.join(', ')}`}
                    {d.sortieProduite && ` · sortie : ${d.sortieProduite}`}
                  </p>
                  {d.resteAFaire.length > 0 && (
                    <p className="mt-1 text-xs text-laiton-clair">Reste à faire : {d.resteAFaire.join(' · ')}</p>
                  )}
                </div>
                {d.etat !== 'close' && (
                  <button type="button" onClick={() => onClore(d.id)} className="text-xs text-encre-2 underline decoration-transparent underline-offset-4 hover:text-laiton-clair hover:decoration-laiton">
                    Vérifiée, clore
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4">
          <Reserve>
            Une demande ne se supprime pas : elle se clôt, après vérification. Une demande partiellement traitée reste
            ouverte, avec la liste explicite de ce qui manque pour l’achever (B21).
          </Reserve>
        </div>
      </section>
    </div>
  );
}
