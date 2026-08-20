/**
 * Sources — le pack produit par la CLI, importé dans l'atelier (§9.2).
 *
 * L'atelier n'interroge rien : ce qui s'affiche ici a été récupéré par la
 * CLI, avec ses cinq métadonnées (B3). Une entrée incomplète est rejetée et
 * NOMMÉE — jamais complétée.
 */
import { useState } from 'react';

import { lirePack, type SourceRecuperee } from '../../noyau/sources';
import { Reserve, TitreSection, Vide } from './Indicateurs';

export function VueSources({
  sources,
  rejetees,
  onImport,
}: {
  sources: SourceRecuperee[];
  rejetees: { identifiant: string; motif: string }[];
  onImport: (sources: SourceRecuperee[], rejetees: { identifiant: string; motif: string }[]) => void;
}) {
  const [erreur, setErreur] = useState<string | null>(null);

  function importer(texte: string) {
    const resultat = lirePack(texte);
    if (!resultat.ok) {
      setErreur(resultat.message);
      return;
    }
    setErreur(null);
    onImport(resultat.sources, resultat.rejetees);
  }

  return (
    <div className="space-y-8">
      <section>
        <TitreSection surtitre="Pack" titre="Importer un pack de sources" />
        <div className="rounded-xl border hairline bg-surface p-5 shadow-card">
          <p className="text-sm leading-relaxed text-encre-2">
            Le pack se produit en ligne de commande — <code className="font-mono text-xs">npm run ldi -- pack-sources</code> —
            là où vivent les identifiants des API officielles. L’atelier, lui, n’émet aucune requête.
          </p>
          <label className="mt-4 inline-block cursor-pointer rounded-lg bg-laiton px-4 py-2 text-sm text-fond transition-colors hover:bg-laiton-clair">
            Choisir un fichier pack…
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const fichier = e.target.files?.[0];
                if (!fichier) return;
                void fichier.text().then(importer);
                e.target.value = '';
              }}
            />
          </label>
          {erreur && <p role="alert" className="mt-3 text-sm text-alerte-clair">{erreur}</p>}
        </div>
      </section>

      {rejetees.length > 0 && (
        <section>
          <TitreSection surtitre="Rejetées" titre={`${rejetees.length} entrée(s) non affichables (B3)`} />
          <ul className="divide-y hairline overflow-hidden rounded-xl border border-alerte/60 bg-surface shadow-card">
            {rejetees.map((r) => (
              <li key={r.identifiant + r.motif} className="p-4">
                <p className="font-mono text-xs text-alerte-clair">{r.identifiant}</p>
                <p className="mt-1 text-xs text-encre-2">{r.motif}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <TitreSection surtitre="Récupérées" titre={`${sources.length} source(s) importée(s)`} />
        {sources.length === 0 ? (
          <Vide titre="Aucune source" explication="Sans pack importé, toute référence des écritures porte « fondement à vérifier auprès de la source officielle » — jamais un texte de mémoire." />
        ) : (
          <div className="space-y-3">
            {sources.map((s) => (
              <article key={s.identifiant + s.recupereLe} className="rounded-xl border hairline bg-surface p-5 shadow-card">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-mono text-sm font-semibold text-encre">{s.identifiant}</h3>
                  <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-encre-3">
                    {s.type}{s.depuisCache ? ' · depuis cache' : ''}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-encre-2">{s.contenu || '(énoncé non fourni par la source)'}</p>
                <p className="mt-2 font-mono text-[0.68rem] text-encre-3">
                  {s.source} · {s.date} · récupéré le {s.recupereLe} ·{' '}
                  <a href={s.url} target="_blank" rel="noreferrer noopener" className="text-laiton-clair underline decoration-laiton/50 underline-offset-2">
                    source officielle
                  </a>
                </p>
              </article>
            ))}
          </div>
        )}
      </section>

      <Reserve>
        Une source servie depuis le cache de la CLI garde sa date de récupération d’origine : ce que vous lisez date de
        ce jour-là, pas d’aujourd’hui.
      </Reserve>
    </div>
  );
}
