import {
  anomaliesRegroupees,
  LIBELLES_ETAT,
  LIBELLES_REGIME,
  ordonner,
  totaux,
  type FicheDossier,
} from '../../ldi/atelier';
import type { RapportLdi } from '../../ldi/types';
import { TON_ETAT } from './AtelierShell';
import { GrilleTuiles, Reserve, TitreSection, Tuile, Vide } from './Indicateurs';
import type { Vue } from './navigation';

const SEVERITE_TON: Record<string, string> = {
  critique: 'text-red-800',
  majeure: 'text-gold-700',
  mineure: 'text-slate-500',
};

export function VueTableauDeBord({
  fiches,
  rapports,
  actif,
  onActif,
  onVue,
}: {
  fiches: FicheDossier[];
  rapports: RapportLdi[];
  actif: string | null;
  onActif: (r: string) => void;
  onVue: (v: Vue) => void;
}) {
  const t = totaux(fiches);
  const anomalies = anomaliesRegroupees(rapports);
  const aTraiter = ordonner(fiches).slice(0, 4);

  if (fiches.length === 0) {
    return (
      <Vide
        titre="Aucun dossier dans l’atelier"
        explication="Chargez un dossier au format JSON depuis l’onglet Dossiers. L’analyse s’exécute entièrement dans ce navigateur : rien n’est transmis."
      />
    );
  }

  return (
    <div className="space-y-10">
      <section aria-labelledby="comptes">
        <TitreSection surtitre="Atelier" titre="Ce que contiennent les dossiers" />
        <h2 id="comptes" className="sr-only">
          Comptes de l’atelier
        </h2>

        <GrilleTuiles>
          <Tuile
            valeur={t.dossiers}
            intitule="Dossiers"
            precision={`${t.pieces} pièce(s) versée(s) au total`}
          />
          <Tuile
            valeur={t.evenementsDates}
            intitule="Événements datés"
            precision={
              t.evenements > t.evenementsDates
                ? `${t.evenements - t.evenementsDates} sans heure exploitable : hors des mesures de durée`
                : 'Tous portent une heure exploitable'
            }
          />
          <Tuile
            valeur={t.contradictions}
            intitule="Contradictions"
            ton={t.contradictionsCritiques > 0 ? 'alerte' : 'neutre'}
            precision={`dont ${t.contradictionsCritiques} critique(s)`}
          />
          <Tuile
            valeur={t.anomalies}
            intitule="Points en anomalie"
            ton={t.anomalies > 0 ? 'alerte' : 'neutre'}
            precision={`sur ${t.pointsControles} points contrôlés · ${t.nonEtablis} non établi(s)`}
          />
        </GrilleTuiles>

        <div className="mt-4">
          <Reserve>
            Ces chiffres sont des <strong>comptes</strong>, pas des indices de solidité. Un dossier
            sans anomalie relevée n’est pas un dossier régulier : il n’a rien révélé sur les dix
            points contrôlés. Les points « non établis » sont ceux que le dossier fourni ne permet
            pas de trancher — ce sont eux qui indiquent les pièces à réclamer.
          </Reserve>
        </div>
      </section>

      <section aria-labelledby="a-traiter">
        <TitreSection surtitre="Priorité de lecture" titre="Dossiers à examiner d’abord">
          <button
            type="button"
            onClick={() => onVue('dossiers')}
            className="text-sm text-gold-700 underline decoration-gold-500 underline-offset-4 hover:text-navy-900"
          >
            Voir le classement complet
          </button>
        </TitreSection>
        <h2 id="a-traiter" className="sr-only">
          Dossiers à examiner
        </h2>

        <ul className="grid gap-3 sm:grid-cols-2">
          {aTraiter.map((f) => (
            <li key={f.reference}>
              <button
                type="button"
                onClick={() => {
                  onActif(f.reference);
                  onVue('controles');
                }}
                className={`h-full w-full rounded-xl border bg-white p-5 text-left shadow-card transition-colors hover:border-gold-500 ${
                  f.reference === actif ? 'border-gold-500' : 'hairline'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${TON_ETAT[f.etat]}`} aria-hidden="true" />
                  <span className="font-mono text-xs text-slate-500">{f.reference}</span>
                </span>
                <span className="mt-2 block font-display text-lg font-semibold text-navy-900">
                  {LIBELLES_ETAT[f.etat].court}
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-slate-500">
                  {LIBELLES_REGIME[f.regime]} ·{' '}
                  {f.qualifications.join(', ') || 'qualification non renseignée'}
                </span>
                <span className="mt-3 block text-xs text-slate-500">
                  {f.indicateurs.anomalies} anomalie(s) · {f.indicateurs.nonEtablis} point(s) non
                  établi(s) · {f.indicateurs.pieces} pièce(s)
                </span>
              </button>
            </li>
          ))}
        </ul>

        <p className="mt-3 text-xs text-slate-500">
          L’ordre suit le nombre d’écarts relevés. Ce n’est pas un ordre de travail : quel moyen
          mérite d’être soulevé, et dans quel ordre, relève de l’avocat, sur pièces.
        </p>
      </section>

      <section aria-labelledby="anomalies">
        <TitreSection surtitre="Tous dossiers" titre="Écarts relevés" />
        <h2 id="anomalies" className="sr-only">
          Écarts relevés
        </h2>

        {anomalies.length === 0 ? (
          <Vide
            titre="Aucun écart relevé sur les points contrôlés"
            explication="Les contrôles portent sur la garde à vue, le contrôle d’identité, la perquisition en enquête préliminaire, la traçabilité des scellés et la prescription. Ils ne couvrent ni l’instruction, ni la détention provisoire, ni les interceptions, ni la procédure d’audience."
          />
        ) : (
          <ul className="divide-y hairline overflow-hidden rounded-xl border hairline bg-white shadow-card">
            {anomalies.map((a) => (
              <li key={`${a.reference}-${a.id}`} className="p-5">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      onActif(a.reference);
                      onVue('controles');
                    }}
                    className="font-mono text-xs text-gold-700 underline decoration-gold-500/50 underline-offset-2 hover:text-navy-900"
                  >
                    {a.reference}
                  </button>
                  <span className="font-mono text-xs text-slate-400">{a.id}</span>
                  <span
                    className={`font-mono text-[0.62rem] uppercase tracking-[0.16em] ${SEVERITE_TON[a.severite] ?? 'text-slate-500'}`}
                  >
                    {a.severite}
                  </span>
                </div>
                <p className="mt-1.5 font-medium text-navy-900">{a.intitule}</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{a.constat}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="cadre">
        <TitreSection surtitre="Cadre de confiance" titre="Ce que l’outil s’interdit" />
        <h2 id="cadre" className="sr-only">
          Cadre de confiance
        </h2>

        <ul className="grid gap-3 sm:grid-cols-2">
          {PRINCIPES.map((p) => (
            <li key={p.titre} className="rounded-xl border hairline bg-white p-5 shadow-card">
              <p className="font-medium text-navy-900">{p.titre}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{p.detail}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/**
 * Ces quatre principes ne sont pas un argumentaire : chacun correspond à un
 * mécanisme exécuté, et chacun est verrouillé par des tests. Les afficher ici
 * permet à l'avocat de savoir ce qu'il peut opposer à une sortie de l'outil.
 */
const PRINCIPES = [
  {
    titre: 'Aucune jurisprudence produite de mémoire',
    detail:
      "Le noyau ne contient aucune base d'arrêts et n'en déduit aucun. Une décision ne peut venir que d'une réponse d'API officielle, obtenue pendant l'exécution.",
  },
  {
    titre: 'Aucun pronostic chiffré',
    detail:
      "Ni pourcentage de succès, ni score de risque. Un moyen est dit étayé, plausible ou exploratoire, avec la raison — pas avec un nombre qui n'en est pas un.",
  },
  {
    titre: 'L’incertitude reste visible',
    detail:
      "Un texte non confronté à sa source reste marqué « à vérifier ». Aucun statut n'est promu, et un point que le dossier ne permet pas de trancher est dit non établi.",
  },
  {
    titre: 'Rien ne sort sans décision explicite',
    detail:
      "L'analyse s'exécute dans ce navigateur. Aucune donnée n'est transmise tant qu'une analyse rédigée n'est pas demandée, et le rapport est alors pseudonymisé.",
  },
];
