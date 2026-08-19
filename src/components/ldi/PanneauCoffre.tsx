/**
 * Coffre chiffré — commande et état.
 *
 * ┌─ CE QUE CET ÉCRAN DOIT DIRE AVANT QU'ON CLIQUE ─────────────────────────┐
 * │ Trois faits, écrits avant l'action et non après :                        │
 * │   — une phrase perdue est un coffre perdu, sans recours ;                │
 * │   — recharger la page redemande la phrase ;                              │
 * │   — le chiffrement protège le SUPPORT, pas un navigateur compromis.      │
 * │                                                                          │
 * │ Un avocat qui découvre le premier point après avoir perdu six mois de    │
 * │ travail n'a pas été mal servi par la cryptographie : il a été mal servi  │
 * │ par l'interface.                                                          │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
import { useState } from 'react';

import { LONGUEUR_MIN_PHRASE } from '../../ldi/coffre';
import type { EtatConservation } from '../../ldi/stockage';
import { Reserve } from './Indicateurs';

export type ActionsCoffre = {
  /** Crée le coffre et y scelle les dossiers ouverts. */
  onActiver: (phrase: string) => Promise<string | null>;
  /** Ouvre un coffre existant ; rend un message d'échec, ou `null` si ouvert. */
  onOuvrir: (phrase: string) => Promise<string | null>;
  /** Oublie la clé, sans rien effacer. */
  onVerrouiller: () => void;
  /** Efface le coffre. N'exige pas la phrase. */
  onEffacer: () => void;
  /** Efface les restes de l'ancien stockage en clair. */
  onPurgerHeritage: () => void;
};

export function PanneauCoffre({
  conservation,
  ouvert,
  actions,
}: {
  conservation: EtatConservation;
  /** Le coffre est-il déchiffré dans cette session ? */
  ouvert: boolean;
  actions: ActionsCoffre;
}) {
  const [phrase, setPhrase] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [travaille, setTravaille] = useState(false);

  if (!conservation.disponible) {
    return (
      <div className="rounded-xl border hairline bg-white p-6 shadow-card">
        <p className="text-sm leading-relaxed text-slate-600">
          La conservation n’est pas disponible sur ce support : il manque{' '}
          <code className="font-mono text-xs">localStorage</code> ou{' '}
          <code className="font-mono text-xs">crypto.subtle</code>.{' '}
          <strong>Aucun repli en clair n’est prévu</strong> — l’atelier repart vide à chaque
          rechargement, ce qui est le comportement le plus sûr.
        </p>
      </div>
    );
  }

  async function tenter(action: () => Promise<string | null>) {
    setTravaille(true);
    setErreur(null);
    try {
      const message = await action();
      setErreur(message);
      if (message === null) {
        setPhrase('');
        setConfirmation('');
      }
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setTravaille(false);
    }
  }

  const tropCourte = phrase.length > 0 && phrase.length < LONGUEUR_MIN_PHRASE;
  const discordante = confirmation.length > 0 && confirmation !== phrase;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border hairline bg-white p-6 shadow-card">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-display text-lg font-semibold text-navy-900">
            {!conservation.active
              ? 'Aucun coffre sur ce poste'
              : ouvert
                ? 'Coffre ouvert'
                : 'Coffre verrouillé'}
          </h3>
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-slate-500">
            AES-256-GCM · PBKDF2-SHA256
          </p>
        </div>

        {conservation.active && (
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            {(conservation.octets / 1024).toFixed(1)} Ko scellés.{' '}
            {conservation.ecritLe
              ? `Dernier scellement : ${conservation.ecritLe.slice(0, 16).replace('T', ' à ')} UTC.`
              : 'Aucun scellement daté.'}{' '}
            {ouvert
              ? 'Les modifications sont scellées au fil du travail.'
              : 'Le contenu n’est pas lisible sans la phrase — y compris par cette application.'}
          </p>
        )}

        {!ouvert && (
          <form
            className="mt-5 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void tenter(() =>
                conservation.active ? actions.onOuvrir(phrase) : actions.onActiver(phrase)
              );
            }}
          >
            <div>
              <label htmlFor="phrase-coffre" className="block text-xs text-slate-500">
                Phrase de chiffrement
              </label>
              <input
                id="phrase-coffre"
                type="password"
                value={phrase}
                autoComplete="off"
                spellCheck={false}
                onChange={(e) => setPhrase(e.target.value)}
                className="mt-1 w-full max-w-md rounded-lg border hairline bg-white px-3 py-2 font-mono text-sm text-navy-900 focus:border-gold-500 focus:outline-none"
              />
              {tropCourte && (
                <p className="mt-1 text-xs text-gold-700">
                  {phrase.length} caractère(s) — il en faut au moins {LONGUEUR_MIN_PHRASE}. Une
                  phrase entière, faite de mots, vaut mieux qu’un mot de passe court et compliqué.
                </p>
              )}
            </div>

            {!conservation.active && (
              <div>
                <label htmlFor="phrase-confirmation" className="block text-xs text-slate-500">
                  Répéter la phrase
                </label>
                <input
                  id="phrase-confirmation"
                  type="password"
                  value={confirmation}
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(e) => setConfirmation(e.target.value)}
                  className="mt-1 w-full max-w-md rounded-lg border hairline bg-white px-3 py-2 font-mono text-sm text-navy-900 focus:border-gold-500 focus:outline-none"
                />
                {discordante && (
                  <p className="mt-1 text-xs text-red-700">
                    Les deux saisies diffèrent. Une faute de frappe ici scellerait le coffre avec
                    une phrase que personne ne connaît.
                  </p>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={
                travaille ||
                phrase.length < LONGUEUR_MIN_PHRASE ||
                (!conservation.active && confirmation !== phrase)
              }
              className="rounded-lg bg-navy-900 px-5 py-2.5 text-sm text-cream-50 transition-colors hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {travaille
                ? 'Dérivation de la clé…'
                : conservation.active
                  ? 'Ouvrir le coffre'
                  : 'Créer le coffre et conserver'}
            </button>

            {travaille && (
              <p className="text-xs text-slate-500">
                La dérivation prend volontairement quelques centaines de millisecondes : c’est ce
                qui rend l’essai de phrases coûteux pour qui aurait copié ce poste.
              </p>
            )}
          </form>
        )}

        {erreur && (
          <p role="alert" className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">
            {erreur}
          </p>
        )}

        <div className="mt-5 flex flex-wrap gap-3">
          {ouvert && (
            <button
              type="button"
              onClick={actions.onVerrouiller}
              className="rounded-lg border hairline bg-white px-4 py-2 text-sm text-navy-900 transition-colors hover:border-gold-500"
            >
              Verrouiller maintenant
            </button>
          )}
          {conservation.active && (
            <button
              type="button"
              onClick={actions.onEffacer}
              className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm text-red-800 transition-colors hover:bg-red-50"
            >
              Effacer le coffre
            </button>
          )}
        </div>
      </div>

      <Reserve>
        <strong>Une phrase perdue est un coffre perdu.</strong> Elle n’est écrite nulle part, ni en
        clair ni sous forme d’empreinte : il n’existe donc aucune récupération, et c’est délibéré —
        une trappe de secours est une trappe. Recharger la page redemande la phrase, et fermer le
        navigateur verrouille le coffre.
        <br />
        <br />
        Ce chiffrement protège le <strong>support</strong> : un poste volé, un profil de navigateur
        copié, un tiers qui ouvre les outils de développement sur la machine du cabinet. Il ne
        protège pas d’un navigateur compromis — une extension malveillante lit la phrase pendant
        qu’elle est frappée. Prétendre le contraire serait pire que ne rien chiffrer.
      </Reserve>

      {conservation.heritageEnClair && (
        <div className="rounded-xl border border-gold-500/50 bg-gold-500/5 p-5">
          <p className="text-sm font-medium text-navy-900">
            Des données d’une version antérieure sont présentes <strong>en clair</strong> sur ce
            poste.
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
            Elles ont été écrites avant que la conservation soit chiffrée. Elles ne sont plus lues
            par l’atelier, mais elles sont toujours là. Elles ne sont pas effacées automatiquement :
            savoir qu’un plan de travail a été conservé sans chiffrement sur ce poste peut, dans un
            cabinet, appeler autre chose qu’un clic.
          </p>
          <button
            type="button"
            onClick={actions.onPurgerHeritage}
            className="mt-4 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm text-red-800 transition-colors hover:bg-red-50"
          >
            Effacer les données en clair
          </button>
        </div>
      )}
    </div>
  );
}
