import { useEffect, useMemo, useState } from 'react';

import { alertesResiduelles, minimiser } from '../../ldi/confidentialite';
import { rendreMarkdown } from '../../ldi/pipeline';
import type { EtatConservation } from '../../ldi/stockage';
import type { RapportLdi } from '../../ldi/types';
import { Reserve, TitreSection, Vide } from './Indicateurs';
import { PanneauCoffre, type ActionsCoffre } from './PanneauCoffre';

/**
 * Minimisation du rapport — et rien d'autre.
 *
 * ┌─ CET ÉCRAN N'ENVOIE RIEN ───────────────────────────────────────────────┐
 * │ L'atelier ne détient aucun code d'appel réseau (B8) et le mode distant   │
 * │ n'est pas atteignable depuis l'interface (D-3). Ce que cet écran         │
 * │ produit, c'est le rapport MINIMISÉ : pseudonymisé, contrôlé, prêt à être │
 * │ copié vers la CLI si — et seulement si — l'avocat décide d'y recourir.   │
 * │                                                                          │
 * │ L'ordre de l'écran suit l'ordre du risque : on voit d'abord ce qui       │
 * │ sortirait du poste, jamais l'inverse.                                    │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
export function VueConfidentialite({ rapport }: { rapport: RapportLdi | null }) {
  const [noms, setNoms] = useState('');
  const [copie, setCopie] = useState(false);

  const markdown = useMemo(() => (rapport ? rendreMarkdown(rapport) : ''), [rapport]);

  const minimise = useMemo(() => {
    if (!markdown) return null;
    const liste = noms.split(',').map((n) => n.trim()).filter(Boolean);
    const { texte } = minimiser(markdown, liste);
    return { texte, alertes: alertesResiduelles(texte) };
  }, [markdown, noms]);

  // Le rapport a changé : l'accusé de copie précédent devient caduc.
  useEffect(() => setCopie(false), [minimise?.texte]);

  if (!rapport || !minimise) {
    return (
      <Vide
        titre="Aucun dossier actif"
        explication="La minimisation porte sur le rapport d’un dossier. Sélectionnez-en un dans l’en-tête."
      />
    );
  }

  return (
    <div className="space-y-8">
      <section>
        <TitreSection surtitre="Avant toute sortie du poste" titre="Ce qui sortirait" />

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

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(minimise.texte);
                setCopie(true);
              }}
              className="rounded-lg border hairline bg-white px-4 py-2 text-sm text-navy-900 transition-colors hover:border-gold-500"
            >
              {copie ? 'Rapport minimisé copié' : 'Copier le rapport minimisé'}
            </button>
            <p className="text-xs text-slate-500">
              La copie reste sur ce poste : c’est un presse-papiers, pas un envoi.
            </p>
          </div>
        </div>

        <div className="mt-4">
          <Reserve>
            <strong>Cet atelier n’envoie rien.</strong> Il ne contient aucun code d’appel réseau,
            même désactivé. Si une analyse rédigée par un modèle est souhaitée, elle passe par la
            ligne de commande — moteur local par défaut, mode distant construit mais désactivé —
            et ce qui y entre est ce rapport minimisé, jamais les pièces. Voir le README, section
            « moteur d’inférence ».
          </Reserve>
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
  niveau1Actif,
  onNiveau1,
  statistiquesCache,
  onViderCache,
  nombreDossiers,
}: {
  conservation: EtatConservation;
  coffreOuvert: boolean;
  actionsCoffre: ActionsCoffre;
  niveau1Actif: boolean;
  onNiveau1: (actif: boolean) => void;
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
        <TitreSection surtitre="Ingestion" titre="Niveau d’extraction (décision D-1)" />

        <div className="rounded-xl border hairline bg-white p-6 shadow-card">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={niveau1Actif}
              onChange={(e) => onNiveau1(e.target.checked)}
              className="mt-1 h-4 w-4 shrink-0 accent-gold-500"
            />
            <span>
              <span className="block text-sm font-medium text-navy-900">
                Niveau 1 — extraire les documents à structure (PDF natif, bureautique, courriels, archives)
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-slate-500">
                Désactivé par défaut : seuls le texte collé et les fichiers texte brut
                (.txt, .md, .csv, .json) sont lus. L’extraction du niveau 1 reste locale et
                sans OCR ; une page numérisée sans couche texte part en quarantaine, comptée
                et nommée — jamais devinée. Le réglage ne survit pas à la session.
              </span>
            </span>
          </label>
        </div>
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
