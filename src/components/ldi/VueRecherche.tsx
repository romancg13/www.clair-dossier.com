/**
 * Recherche juridique — jurisprudence associée aux textes du corpus.
 *
 * ┌─ IL N'Y A PAS DE CHAMP DE RECHERCHE LIBRE, ET C'EST VOULU ──────────────┐
 * │ On choisit des articles dans une liste. On ne tape pas une phrase.       │
 * │                                                                          │
 * │ Un champ libre laisserait partir « garde à vue Dupont 14 mars            │
 * │ stupéfiants » vers un serveur, puis vers une API de l'État. Ce que       │
 * │ l'écran envoie ici — « CPP, art. 63-4-2 » — ne désigne ni le client, ni  │
 * │ le dossier, ni les faits.                                                │
 * │                                                                          │
 * │ La contrainte est dans le code, pas dans une consigne d'usage : il       │
 * │ n'existe aucun chemin par lequel une phrase saisie pourrait sortir.      │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
import { useMemo, useState } from 'react';

import {
  REFERENCES_MAX_CLIENT,
  chercherDecisions,
  type ReponseRecherche,
} from '../../ldi/jurisprudence';
import { referencesDuRapport } from '../../ldi/sourcage';
import type { RapportLdi } from '../../ldi/types';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { Reserve, TitreSection, Vide } from './Indicateurs';

type Etat =
  | { statut: 'inactif' }
  | { statut: 'encours' }
  | { statut: 'fait'; reponse: ReponseRecherche };

export function VueRecherche({ rapport }: { rapport: RapportLdi | null }) {
  const [etat, setEtat] = useState<Etat>({ statut: 'inactif' });
  const [choisies, setChoisies] = useState<string[]>([]);

  // Les références du dossier actif, pas tout le corpus : chercher les vingt-
  // trois articles quand le dossier en met six en jeu consomme un quota pour
  // rien et noie ce qui compte.
  const proposees = useMemo(
    () => (rapport ? referencesDuRapport(rapport) : []),
    [rapport]
  );

  if (!rapport) {
    return (
      <Vide
        titre="Aucun dossier actif"
        explication="La recherche porte sur les articles mis en jeu par le dossier analysé. Sélectionnez un dossier pour voir lesquels."
      />
    );
  }

  function basculer(reference: string) {
    setChoisies((liste) =>
      liste.includes(reference)
        ? liste.filter((r) => r !== reference)
        : liste.length >= REFERENCES_MAX_CLIENT
          ? liste
          : [...liste, reference]
    );
  }

  async function lancer() {
    setEtat({ statut: 'encours' });
    const reponse = await chercherDecisions(choisies, (nom, options) =>
      // `body` est typé `unknown` côté noyau pour que le module reste testable
      // sans le client Supabase : c'est ici, au seul point de contact, que le
      // type concret du client est réintroduit.
      supabase.functions.invoke(nom, { body: options.body as Record<string, unknown> })
    );
    setEtat({ statut: 'fait', reponse });
  }

  return (
    <div className="space-y-8">
      <section>
        <TitreSection surtitre="Recherche" titre="Jurisprudence sur les textes du dossier" />

        {proposees.length === 0 ? (
          <Vide
            titre="Aucun texte mis en jeu"
            explication="Le dossier analysé ne met en jeu aucun article du corpus : il n'y a rien à rechercher."
          />
        ) : (
          <>
            <ul className="flex flex-wrap gap-2">
              {proposees.map((reference) => {
                const active = choisies.includes(reference);
                return (
                  <li key={reference}>
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => basculer(reference)}
                      className={`rounded-full border px-3.5 py-1.5 font-mono text-xs transition-colors ${
                        active
                          ? 'border-gold-500 bg-gold-500/10 text-navy-900'
                          : 'hairline bg-white text-slate-600 hover:border-gold-500'
                      }`}
                    >
                      {reference}
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={choisies.length === 0 || etat.statut === 'encours' || !isSupabaseConfigured}
                onClick={() => void lancer()}
                className="rounded-lg bg-navy-900 px-5 py-2.5 text-sm text-cream-50 transition-colors hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {etat.statut === 'encours'
                  ? 'Interrogation de Judilibre…'
                  : `Rechercher (${choisies.length}/${REFERENCES_MAX_CLIENT})`}
              </button>
              {!isSupabaseConfigured && (
                <p className="text-xs text-slate-500">
                  Le relais exige une session authentifiée, qui n’est pas configurée sur ce
                  déploiement.
                </p>
              )}
            </div>
          </>
        )}

        <div className="mt-5">
          <Reserve>
            Il n’y a <strong>pas de champ de recherche libre</strong>, et ce n’est pas un oubli :
            une phrase saisie ferait sortir du poste des éléments du dossier. Ce qui part d’ici est
            une référence d’article — <code className="font-mono">CPP, art. 63-4-2</code> — qui ne
            désigne ni le client, ni les faits. Le serveur revérifie cette liste de son côté.
          </Reserve>
        </div>
      </section>

      {etat.statut === 'fait' && <Resultats reponse={etat.reponse} />}
    </div>
  );
}

function Resultats({ reponse }: { reponse: ReponseRecherche }) {
  if (!reponse.ok) {
    return (
      <section>
        <div
          role="status"
          className={`rounded-xl border p-5 ${
            reponse.configuree ? 'border-red-300 bg-red-50' : 'border-gold-500/50 bg-gold-500/5'
          }`}
        >
          <p className="text-sm font-medium text-navy-900">
            {reponse.configuree ? 'La recherche a échoué' : 'Source officielle non configurée'}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{reponse.message}</p>
        </div>
      </section>
    );
  }

  const total = reponse.resultats.reduce((n, r) => n + r.decisions.length, 0);

  return (
    <>
      <section>
        <TitreSection
          surtitre="Résultat"
          titre={total > 0 ? `${total} décision(s) restituée(s)` : 'Aucune décision restituée'}
        />

        <p className="mb-4 font-mono text-[0.68rem] text-slate-500">
          {reponse.origine}
          {reponse.consulteLe ? ` · consulté le ${reponse.consulteLe}` : ''}
        </p>

        <div className="space-y-5">
          {reponse.resultats.map((resultat) => (
            <div key={resultat.reference} className="rounded-xl border hairline bg-white p-6 shadow-card">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-mono text-sm font-semibold text-navy-900">
                  {resultat.reference}
                </h3>
                <span className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-slate-500">
                  {resultat.interrogee ? 'source interrogée' : 'source non interrogée'}
                </span>
              </div>

              {resultat.avertissement && (
                <p className="mt-2 text-xs leading-relaxed text-gold-700">{resultat.avertissement}</p>
              )}

              {resultat.decisions.length > 0 && (
                <ul className="mt-4 divide-y hairline">
                  {resultat.decisions.map((d) => (
                    <li key={`${resultat.reference}-${d.numero}`} className="py-3 first:pt-0 last:pb-0">
                      <p className="font-mono text-xs text-navy-900">
                        {d.numero} · {d.date}
                      </p>
                      <p className="mt-0.5 text-sm text-slate-600">
                        {[d.juridiction, d.chambre].filter(Boolean).join(', ')}
                      </p>
                      <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{d.sommaire}</p>
                      {d.url && (
                        <a
                          href={d.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="mt-1.5 inline-block font-mono text-xs text-gold-700 underline decoration-gold-500/40 underline-offset-2"
                        >
                          Lire la décision
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>

      {reponse.ecartees.length > 0 && (
        <section>
          <TitreSection surtitre="Écartées" titre="Références refusées par le serveur" />
          <ul className="flex flex-wrap gap-2">
            {reponse.ecartees.map((r) => (
              <li
                key={r}
                className="rounded-full border border-red-300 bg-white px-3.5 py-1.5 font-mono text-xs text-red-800"
              >
                {r}
              </li>
            ))}
          </ul>
        </section>
      )}

      {reponse.reserve && (
        <div>
          <Reserve>{reponse.reserve}</Reserve>
        </div>
      )}
    </>
  );
}
