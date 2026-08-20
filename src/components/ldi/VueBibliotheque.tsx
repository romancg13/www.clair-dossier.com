/**
 * Bibliothèque du cabinet — consignes permanentes et trames (M11).
 *
 * Ce que l'avocat dit une fois s'applique partout ensuite, et chaque
 * génération peut dire quelles consignes lui ont été appliquées. Réviser une
 * consigne conserve l'ancienne version, désactivée (B21).
 */
import { useState } from 'react';

import type { Bibliotheque } from '../../noyau/consignes';
import { Reserve, TitreSection } from './Indicateurs';

export function VueBibliotheque({
  bibliotheque,
  dossierActif,
  onConsigne,
  onReviser,
  onTrame,
}: {
  bibliotheque: Bibliotheque;
  dossierActif: string | null;
  onConsigne: (enonce: string, portee: 'cabinet' | 'dossier') => void;
  onReviser: (id: string, enonce: string) => void;
  onTrame: (intitule: string, type: string, corps: string) => void;
}) {
  const [enonce, setEnonce] = useState('');
  const [portee, setPortee] = useState<'cabinet' | 'dossier'>('cabinet');
  const [revision, setRevision] = useState<{ id: string; texte: string } | null>(null);
  const [trameIntitule, setTrameIntitule] = useState('');
  const [trameCorps, setTrameCorps] = useState('');

  const actives = bibliotheque.consignes.filter((c) => c.active);
  const historiques = bibliotheque.consignes.filter((c) => !c.active);

  return (
    <div className="space-y-10">
      <section>
        <TitreSection surtitre="Consignes permanentes" titre="Dites-le une fois" />
        <form
          className="flex flex-wrap items-end gap-3 rounded-xl border hairline bg-surface p-5 shadow-card"
          onSubmit={(e) => {
            e.preventDefault();
            if (!enonce.trim()) return;
            onConsigne(enonce.trim(), portee);
            setEnonce('');
          }}
        >
          <label htmlFor="consigne" className="min-w-64 flex-1 text-xs text-encre-2">
            Consigne (structure, formules, vocabulaire, vérifications…)
            <input id="consigne" value={enonce} onChange={(e) => setEnonce(e.target.value)}
              placeholder="Toujours citer la cote entre parenthèses après chaque fait."
              className="mt-1 w-full rounded-md border hairline bg-fond px-3 py-2 text-sm text-encre focus:border-laiton focus:outline-none" />
          </label>
          <label htmlFor="portee" className="text-xs text-encre-2">
            Portée
            <select id="portee" value={portee} onChange={(e) => setPortee(e.target.value as 'cabinet' | 'dossier')}
              className="mt-1 block rounded-md border hairline bg-surface px-2 py-2 text-sm text-encre focus:border-laiton focus:outline-none">
              <option value="cabinet">Cabinet (toutes générations)</option>
              <option value="dossier" disabled={!dossierActif}>Dossier actif{dossierActif ? ` (${dossierActif})` : ''}</option>
            </select>
          </label>
          <button type="submit" className="rounded-lg bg-laiton px-4 py-2 text-sm text-fond transition-colors hover:bg-laiton-clair">
            Enregistrer
          </button>
        </form>

        <ul className="mt-4 divide-y hairline overflow-hidden rounded-xl border hairline bg-surface shadow-card">
          {actives.length === 0 && (
            <li className="p-4 text-sm text-encre-2">Aucune consigne active. La première saisie s’appliquera à toutes les générations suivantes.</li>
          )}
          {actives.map((c) => (
            <li key={c.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-laiton-clair">
                    {c.portee}{c.dossierReference ? ` · ${c.dossierReference}` : ''} · {c.date.slice(0, 10)}
                  </p>
                  {revision?.id === c.id ? (
                    <form
                      className="mt-1.5 flex gap-2"
                      onSubmit={(e) => { e.preventDefault(); if (revision.texte.trim()) { onReviser(c.id, revision.texte.trim()); setRevision(null); } }}
                    >
                      <input value={revision.texte} onChange={(e) => setRevision({ id: c.id, texte: e.target.value })}
                        className="flex-1 rounded-md border hairline bg-fond px-3 py-1.5 text-sm text-encre focus:border-laiton focus:outline-none" />
                      <button type="submit" className="rounded-md bg-laiton px-3 py-1.5 text-xs text-fond hover:bg-laiton-clair">Réviser</button>
                    </form>
                  ) : (
                    <p className="mt-1 text-sm text-encre">{c.enonce}</p>
                  )}
                </div>
                {revision?.id !== c.id && (
                  <button type="button" onClick={() => setRevision({ id: c.id, texte: c.enonce })}
                    className="text-xs text-encre-2 underline decoration-transparent underline-offset-4 hover:text-laiton-clair hover:decoration-laiton">
                    Réviser
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>

        {historiques.length > 0 && (
          <p className="mt-2 font-mono text-[0.68rem] text-encre-3">
            {historiques.length} version(s) antérieure(s) conservée(s) — l’historique dit ce qui a été appliqué à quelle génération.
          </p>
        )}
      </section>

      <section>
        <TitreSection surtitre="Trames" titre="Trames d’écritures du cabinet" />
        <form
          className="space-y-3 rounded-xl border hairline bg-surface p-5 shadow-card"
          onSubmit={(e) => {
            e.preventDefault();
            if (!trameIntitule.trim() || !trameCorps.trim()) return;
            onTrame(trameIntitule.trim(), 'conclusions', trameCorps);
            setTrameIntitule(''); setTrameCorps('');
          }}
        >
          <input value={trameIntitule} onChange={(e) => setTrameIntitule(e.target.value)} placeholder="Intitulé de la trame"
            className="w-full max-w-md rounded-md border hairline bg-fond px-3 py-2 text-sm text-encre focus:border-laiton focus:outline-none" />
          <textarea value={trameCorps} onChange={(e) => setTrameCorps(e.target.value)} rows={4} placeholder="Corps de la trame — en-têtes, formules d’usage, dispositif type."
            className="w-full rounded-md border hairline bg-fond px-3 py-2 font-mono text-xs text-encre focus:border-laiton focus:outline-none" />
          <button type="submit" className="rounded-lg border hairline bg-surface px-4 py-2 text-sm text-encre transition-colors hover:border-laiton">
            Ajouter la trame
          </button>
        </form>
        <ul className="mt-4 space-y-2">
          {bibliotheque.trames.map((t) => (
            <li key={t.id} className="rounded-lg border hairline bg-surface p-4">
              <p className="text-sm font-medium text-encre">{t.intitule}</p>
              <p className="font-mono text-[0.68rem] text-encre-3">{t.type} · ajoutée le {t.ajouteeLe.slice(0, 10)}</p>
            </li>
          ))}
        </ul>
      </section>

      <Reserve>
        La bibliothèque est <strong>strictement séparée</strong> des dossiers (B18) : elle porte les trames et consignes
        du cabinet, jamais du contenu de dossier. Une consigne de dossier prime sur celle du cabinet, et ne s’applique
        qu’à son dossier.
      </Reserve>
    </div>
  );
}
