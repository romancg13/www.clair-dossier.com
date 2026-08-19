import { useEffect, useMemo, useState } from 'react';

import { alertesResiduelles, minimiser } from '../../ldi/confidentialite';
import { rendreMarkdown } from '../../ldi/pipeline';
import { referencesDuRapport } from '../../ldi/sourcage';
import type { EtatConservation } from '../../ldi/stockage';
import type { RapportLdi } from '../../ldi/types';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { Reserve, TitreSection, Vide } from './Indicateurs';
import { PanneauCoffre, type ActionsCoffre } from './PanneauCoffre';

type EtatRedigee =
  | { statut: 'inactif' }
  | { statut: 'encours' }
  | { statut: 'erreur'; message: string }
  | {
      statut: 'ok';
      texte: string;
      alertes: string[];
      cout: { appel: number; cumule: number } | null;
      avertissement: string;
    };

/**
 * Minimisation puis, éventuellement, analyse rédigée.
 *
 * L'ordre de l'écran suit l'ordre du risque : on voit d'abord ce qui partirait,
 * ensuite seulement le bouton qui l'envoie. L'inverse inviterait à cliquer
 * avant d'avoir lu.
 */
export function VueConfidentialite({ rapport }: { rapport: RapportLdi | null }) {
  const [noms, setNoms] = useState('');
  const [question, setQuestion] = useState('');
  const [redigee, setRedigee] = useState<EtatRedigee>({ statut: 'inactif' });
  const [coutEngage, setCoutEngage] = useState(0);
  // Surcharge délibérée des alertes résiduelles. Se remet à faux dès que le
  // texte change : une confirmation donnée sur un rapport ne vaut pas pour le
  // suivant.
  const [alertesAssumees, setAlertesAssumees] = useState(false);

  const markdown = useMemo(() => (rapport ? rendreMarkdown(rapport) : ''), [rapport]);

  const minimise = useMemo(() => {
    if (!markdown) return null;
    const liste = noms.split(',').map((n) => n.trim()).filter(Boolean);
    const { texte } = minimiser(markdown, liste);
    return { texte, alertes: alertesResiduelles(texte) };
  }, [markdown, noms]);

  // Le rapport a changé : toute confirmation antérieure devient caduque.
  useEffect(() => setAlertesAssumees(false), [minimise?.texte]);

  if (!rapport || !minimise) {
    return (
      <Vide
        titre="Aucun dossier actif"
        explication="La minimisation porte sur le rapport d’un dossier. Sélectionnez-en un dans l’en-tête."
      />
    );
  }

  async function demander() {
    if (!minimise || !question.trim()) return;
    setRedigee({ statut: 'encours' });

    try {
      const { data, error } = await supabase.functions.invoke('ldi-analyze', {
        body: {
          rapport: minimise.texte,
          question: question.trim(),
          referencesAutorisees: rapport ? referencesDuRapport(rapport) : [],
          // Aucun pourvoi n'est citable depuis le navigateur : il n'y détient
          // aucune clé PISTE, donc aucune décision n'a pu être obtenue.
          pourvoisAutorises: [],
          coutEngage,
        },
      });

      if (error) {
        setRedigee({ statut: 'erreur', message: error.message });
        return;
      }

      const charge = data as {
        analyse?: string;
        avertissement?: string;
        error?: string;
        verification?: { conforme: boolean; rapport: string };
        structure?: { conforme: boolean; rapport: string };
        cout?: { dollars: number; cumule: number; plafondDepasse: boolean; avertissement: string };
      };

      if (charge.error || !charge.analyse) {
        setRedigee({ statut: 'erreur', message: charge.error ?? 'Réponse vide.' });
        return;
      }

      const alertes = [
        charge.verification && !charge.verification.conforme ? charge.verification.rapport : '',
        charge.structure && !charge.structure.conforme ? charge.structure.rapport : '',
        charge.cout?.plafondDepasse ? charge.cout.avertissement : '',
      ].filter(Boolean);

      if (typeof charge.cout?.cumule === 'number') setCoutEngage(charge.cout.cumule);

      setRedigee({
        statut: 'ok',
        texte: charge.analyse,
        alertes,
        cout: charge.cout ? { appel: charge.cout.dollars, cumule: charge.cout.cumule } : null,
        avertissement: charge.avertissement ?? '',
      });
    } catch (e) {
      setRedigee({ statut: 'erreur', message: (e as Error).message });
    }
  }

  return (
    <div className="space-y-8">
      <section>
        <TitreSection surtitre="Avant tout envoi" titre="Ce qui partirait" />

        <div className="rounded-xl border hairline bg-white p-6 shadow-card">
          <label htmlFor="noms" className="block font-mono text-[0.62rem] uppercase tracking-[0.18em] text-slate-500">
            Noms à pseudonymiser
          </label>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
            Les adresses, téléphones et numéros structurés sont reconnus automatiquement. Les
            patronymes, eux, doivent être déclarés ici : aucun outil ne les reconnaît de façon
            fiable dans un texte français, et prétendre le contraire serait la promesse la plus
            dangereuse de cet écran.
          </p>
          <input
            id="noms"
            value={noms}
            onChange={(e) => setNoms(e.target.value)}
            placeholder="Jean Dupont, SARL Martin"
            className="mt-3 w-full rounded-lg border hairline bg-cream-50 p-3 text-sm text-navy-900 focus:border-gold-500 focus:outline-none"
          />

          {minimise.alertes.length > 0 && (
            <ul role="alert" className="mt-4 space-y-2">
              {minimise.alertes.map((a) => (
                <li
                  key={a}
                  className="rounded-lg border border-red-300 bg-red-50 p-3 text-xs leading-relaxed text-red-900"
                >
                  ⚠ {a}
                </li>
              ))}
            </ul>
          )}

          <p className="mt-4 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-slate-500">
            Rapport minimisé
          </p>
          <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-cream-50 p-4 font-mono text-[0.72rem] leading-relaxed text-navy-900">
            {minimise.texte}
          </pre>
        </div>
      </section>

      <section>
        <TitreSection surtitre="Analyse rédigée" titre="Demander une rédaction" />

        <div className="rounded-xl border hairline bg-white p-6 shadow-card">
          <Reserve>
            C’est la <strong>seule</strong> action de cet outil qui transmet quoi que ce soit. Ce
            qui part est le rapport minimisé ci-dessus, jamais les pièces. La réponse est contrôlée
            côté serveur — citations et structure — avant de vous être rendue.
          </Reserve>

          <label htmlFor="question" className="mt-4 block text-sm font-medium text-navy-900">
            Question
          </label>
          <textarea
            id="question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={3}
            placeholder="Quels moyens de nullité peuvent être soulevés, et dans quel ordre ?"
            className="mt-2 w-full rounded-lg border hairline bg-cream-50 p-3 text-sm text-navy-900 focus:border-gold-500 focus:outline-none"
          />

          {minimise.alertes.length > 0 && (
            <label className="mt-4 flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 p-3">
              <input
                type="checkbox"
                checked={alertesAssumees}
                onChange={(e) => setAlertesAssumees(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-red-700"
              />
              <span className="text-xs leading-relaxed text-red-900">
                J’ai lu les {minimise.alertes.length} alerte(s) ci-dessus et je confirme que ce
                rapport peut être transmis. <strong>Un envoi est irréversible</strong> : ce qui
                part ne peut pas être rappelé.
              </span>
            </label>
          )}

          <button
            type="button"
            onClick={() => void demander()}
            /*
              Blocage tant que les alertes ne sont pas assumées. Ni laisser-passer
              — l'écran signalait un risque de ré-identification et laissait
              cliquer — ni blocage sec : sans issue, l'avocat pressé exporterait
              le rapport pour le coller ailleurs, hors de tout contrôle. Une
              surcharge explicite laisse la trace du geste.
            */
            disabled={
              !isSupabaseConfigured ||
              !question.trim() ||
              redigee.statut === 'encours' ||
              (minimise.alertes.length > 0 && !alertesAssumees)
            }
            className="mt-4 rounded-lg bg-navy-900 px-5 py-2.5 text-sm text-cream-50 transition-colors hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {redigee.statut === 'encours' ? 'Analyse en cours…' : 'Demander une analyse'}
          </button>

          {!isSupabaseConfigured && (
            <p className="mt-3 text-xs text-slate-500">
              Service non configuré dans cette build : l’analyse déterministe reste disponible, la
              rédaction non.
            </p>
          )}

          {redigee.statut === 'erreur' && (
            <p role="alert" className="mt-4 text-sm text-red-800">
              {redigee.message}
            </p>
          )}

          {redigee.statut === 'ok' && (
            <div className="mt-5">
              {redigee.alertes.length > 0 && (
                <ul role="alert" className="mb-3 space-y-2">
                  {redigee.alertes.map((a) => (
                    <li
                      key={a}
                      className="rounded-lg border border-red-300 bg-red-50 p-3 text-xs leading-relaxed text-red-900"
                    >
                      ⚠ {a}
                    </li>
                  ))}
                </ul>
              )}
              <p className="rounded-lg border border-gold-500/40 bg-gold-500/10 p-3 text-xs leading-relaxed text-navy-900">
                {redigee.avertissement}
              </p>
              <pre className="mt-3 max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-lg bg-cream-50 p-4 font-sans text-sm leading-relaxed text-navy-900">
                {redigee.texte}
              </pre>
              {redigee.cout && (
                <p className="mt-2 font-mono text-[0.68rem] text-slate-500">
                  Coût estimé — cet appel {redigee.cout.appel} USD, dossier {redigee.cout.cumule}{' '}
                  USD. Estimation sur tarifs déclarés dans le code, non vérifiés : la facturation
                  réelle fait foi.
                </p>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function VueParametres({
  conservation,
  coffreOuvert,
  actionsCoffre,
  statistiquesCache,
  onViderCache,
  nombreDossiers,
}: {
  conservation: EtatConservation;
  coffreOuvert: boolean;
  actionsCoffre: ActionsCoffre;
  statistiquesCache: { entrees: number; succes: number; defauts: number };
  onViderCache: () => void;
  nombreDossiers: number;
}) {
  return (
    <div className="space-y-8">
      <section>
        <TitreSection surtitre="Confidentialité" titre="Conservation dans ce navigateur" />

        <PanneauCoffre
          conservation={conservation}
          ouvert={coffreOuvert}
          actions={actionsCoffre}
        />
      </section>

      <section>
        <TitreSection surtitre="Performance" titre="Cache d’analyse" />

        <div className="rounded-xl border hairline bg-white p-6 shadow-card">
          <p className="text-sm leading-relaxed text-slate-600">
            Une analyse est mémorisée par état de dossier — la clé est l’empreinte du dossier, celle
            qu’utilise déjà le journal. Elle change si et seulement si le dossier change, ce qui
            évite de tout réanalyser à chaque frappe dans un filtre.
          </p>

          <dl className="mt-4 grid grid-cols-3 gap-4">
            {[
              ['Entrées', statistiquesCache.entrees, `${nombreDossiers} dossier(s) ouverts`],
              ['Réutilisations', statistiquesCache.succes, 'analyses évitées'],
              ['Analyses', statistiquesCache.defauts, 'réellement exécutées'],
            ].map(([label, valeur, note]) => (
              <div key={String(label)}>
                <dt className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-slate-500">
                  {label}
                </dt>
                <dd className="mt-1 font-display text-2xl font-semibold text-navy-900">{valeur}</dd>
                <dd className="text-[0.68rem] text-slate-400">{note}</dd>
              </div>
            ))}
          </dl>

          <button
            type="button"
            onClick={onViderCache}
            className="mt-5 rounded-lg border hairline bg-white px-4 py-2 text-sm text-navy-900 transition-colors hover:border-gold-500"
          >
            Vider le cache
          </button>
        </div>
      </section>

      <section>
        <TitreSection surtitre="Périmètre" titre="Ce qui est contrôlé, et ce qui ne l’est pas" />

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border hairline bg-white p-6 shadow-card">
            <h3 className="font-display text-lg font-semibold text-navy-900">Couvert</h3>
            <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-slate-600">
              {COUVERT.map((x) => (
                <li key={x} className="flex gap-2">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
                  <span>{x}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border hairline bg-white p-6 shadow-card">
            <h3 className="font-display text-lg font-semibold text-navy-900">Non couvert</h3>
            <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-slate-600">
              {NON_COUVERT.map((x) => (
                <li key={x} className="flex gap-2">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-red-400" aria-hidden="true" />
                  <span>{x}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-4">
          <Reserve>
            Un rapport sans anomalie ne signifie donc <strong>pas</strong> que la procédure est
            régulière : il signifie que les points contrôlés n’ont rien révélé. L’analyse ne porte
            par ailleurs que sur les éléments saisis — une pièce non versée est invisible pour le
            système, et son absence n’est pas signalée.
          </Reserve>
        </div>
      </section>
    </div>
  );
}

const COUVERT = [
  'Garde à vue : placement, notification des droits, durée, prolongations, examen médical',
  'Délai de carence avant audition hors présence de l’avocat (art. 63-4-2 CPP)',
  'Contrôle d’identité et cadre des réquisitions (art. 78-2 CPP)',
  'Perquisition en enquête préliminaire',
  'Traçabilité des scellés',
  'Prescription de l’action publique',
];

const NON_COUVERT = [
  'L’instruction et les actes du juge d’instruction',
  'La détention provisoire',
  'Les interceptions et techniques spéciales d’enquête',
  'Les expertises au fond',
  'La procédure d’audience',
  'Les voies de recours',
];
