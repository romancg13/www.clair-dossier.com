import { useState } from 'react';

import { LIBELLES_REGIME } from '../../ldi/atelier';
import { genererDocument } from '../../ldi/modules/documents';
import type { RapportLdi, TypeDocument } from '../../ldi/types';
import { Reserve, TitreSection, Vide } from './Indicateurs';

const SANS_DOSSIER = (
  <Vide
    titre="Aucun dossier actif"
    explication="Sélectionnez un dossier dans l’en-tête, ou ouvrez-en un depuis l’onglet Dossiers."
  />
);

const TON_RESULTAT: Record<string, string> = {
  anomalie: 'text-red-800',
  conforme: 'text-emerald-800',
  'non-etabli': 'text-slate-500',
};

const TON_SEVERITE: Record<string, string> = {
  critique: 'border-red-300 bg-red-50',
  majeure: 'border-gold-500/40 bg-gold-500/10',
  mineure: 'hairline bg-cream-100',
};

// ---------------------------------------------------------------------------

export function VueChronologie({ rapport }: { rapport: RapportLdi | null }) {
  if (!rapport) return SANS_DOSSIER;
  const { dossier } = rapport;

  return (
    <div className="space-y-8">
      <section>
        <TitreSection surtitre="Contradictions" titre={`${dossier.contradictions.length} relevée(s)`} />

        {dossier.contradictions.length === 0 ? (
          <Reserve>
            Aucune contradiction détectée par les contrôles automatiques. Ceux-ci ne portent que sur
            les heures, les durées et l’ordre des actes : une contradiction de fond entre deux
            déclarations leur échappe entièrement.
          </Reserve>
        ) : (
          <ul className="space-y-3">
            {dossier.contradictions.map((c, i) => (
              <li
                key={`${c.type}-${i}`}
                className={`rounded-xl border p-5 ${TON_SEVERITE[c.severite] ?? 'hairline bg-white'}`}
              >
                <p className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-slate-500">
                  {c.severite} · {c.type}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-navy-900">{c.constat}</p>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">
                  <span className="font-medium">À vérifier :</span> {c.verificationSuggeree}
                </p>
                {c.elements.length > 0 && (
                  <p className="mt-2 font-mono text-[0.68rem] text-slate-400">
                    Éléments : {c.elements.join(', ')}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <TitreSection
          surtitre="Chronologie"
          titre={`${dossier.chronologie.length} événement(s)`}
        />

        {dossier.chronologie.length === 0 ? (
          <Vide
            titre="Aucun événement saisi"
            explication="La chronologie se reconstruit à partir des événements du dossier. Sans eux, aucune durée n’est mesurable."
          />
        ) : (
          <ol className="relative space-y-0 border-l hairline pl-6">
            {dossier.chronologie.map((e) => (
              <li key={e.id} className="relative pb-6 last:pb-0">
                <span
                  className="absolute -left-[1.72rem] top-1.5 h-2 w-2 rounded-full bg-gold-500"
                  aria-hidden="true"
                />
                <p className="font-mono text-xs text-slate-500">
                  {e.horodatage.replace('T', ' à ')}
                </p>
                <p className="mt-0.5 font-medium text-navy-900">{e.nature}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{e.description}</p>
                <p className="mt-1 font-mono text-[0.68rem] text-slate-400">
                  {e.sourcePieceId ? `Pièce ${e.sourcePieceId}` : 'Aucune pièce de rattachement'}
                </p>
              </li>
            ))}
          </ol>
        )}

        {dossier.evenementsNonSources.length > 0 && (
          <div className="mt-4">
            <Reserve>
              {dossier.evenementsNonSources.length} événement(s) ne sont rattachés à aucune pièce :{' '}
              {dossier.evenementsNonSources.join(', ')}. Rien ne les établit — ils ne peuvent pas
              fonder un moyen en l’état.
            </Reserve>
          </div>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function VueControles({ rapport }: { rapport: RapportLdi | null }) {
  if (!rapport) return SANS_DOSSIER;
  const { nullites, dossier } = rapport;

  return (
    <div className="space-y-8">
      <section>
        <TitreSection
          surtitre={`${dossier.reference} · ${LIBELLES_REGIME[dossier.regime]}`}
          titre={`${nullites.points.length} points de contrôle`}
        />

        <div className="mb-5">
          <Reserve>
            Chaque point part de « non établi » et n’en sort que si le dossier fournit de quoi
            trancher. Un résultat « conforme » signifie que la mesure a pu être faite et n’a rien
            révélé — pas que la formalité est régulière au fond. Rappel du régime :{' '}
            {nullites.regimeNullite.map((r) => r.reference).join(', ')} — une irrégularité ne devient
            une nullité qu’à la double condition d’une formalité substantielle et d’un grief.
          </Reserve>
        </div>

        <ul className="divide-y hairline overflow-hidden rounded-xl border hairline bg-white shadow-card">
          {nullites.points.map((p) => (
            <li key={p.id} className="p-5">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-mono text-xs text-slate-400">{p.id}</span>
                <span
                  className={`font-mono text-[0.62rem] uppercase tracking-[0.16em] ${TON_RESULTAT[p.resultat] ?? 'text-slate-500'}`}
                >
                  {p.resultat}
                </span>
                <span className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-slate-400">
                  {p.severite}
                </span>
              </div>
              <p className="mt-1.5 font-medium text-navy-900">{p.intitule}</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{p.constat}</p>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                <span className="font-medium">Diligence :</span> {p.actionSuggeree}
              </p>
              {p.contreArgument && (
                <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                  <span className="font-medium">Objection prévisible :</span> {p.contreArgument}
                </p>
              )}
              <p className="mt-2 font-mono text-[0.68rem] text-slate-400">
                {p.fondement.reference} ({p.fondement.statut})
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function VueStrategie({ rapport }: { rapport: RapportLdi | null }) {
  if (!rapport) return SANS_DOSSIER;
  const { strategie } = rapport;

  return (
    <div className="space-y-8">
      <section>
        <TitreSection surtitre="Axes" titre={`${strategie.axes.length} axe(s) de défense`} />

        {strategie.axes.length === 0 ? (
          <Vide
            titre="Aucun axe ne se dégage des éléments fournis"
            explication="Les axes sont construits à partir des écarts relevés et des points non établis. Sans pièce, il n’y a rien à quoi les rattacher."
          />
        ) : (
          <ol className="space-y-4">
            {strategie.axes.map((a, i) => (
              <li key={a.intitule} className="rounded-xl border hairline bg-white p-6 shadow-card">
                <p className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-gold-700">
                  Axe {i + 1} · {a.solidite}
                </p>
                <h3 className="mt-1.5 font-display text-xl font-semibold text-navy-900">
                  {a.intitule}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {a.justificationSolidite}
                </p>

                <Bloc titre="Fondements">
                  {a.fondements.length === 0
                    ? '—'
                    : a.fondements.map((f) => `${f.reference} (${f.statut})`).join(' · ')}
                </Bloc>
                <Liste titre="Appuis" items={a.appuis} />
                <Liste titre="Objections prévisibles" items={a.contreArguments} />
                <Liste titre="Diligences" items={a.actes} />
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <PanneauListe titre="Risques pour le client" items={strategie.risques} />
        <PanneauListe titre="Zones d’incertitude" items={strategie.zonesIncertitude} />
      </div>

      <PanneauListe titre="Échéances procédurales" items={strategie.echeances} />

      <Reserve>
        La qualification d’un axe — étayé, plausible, exploratoire — dit sur quoi il repose, pas sa
        chance d’aboutir. Aucun pourcentage n’est produit : un chiffre donnerait à une appréciation
        l’apparence d’une mesure.
      </Reserve>
    </div>
  );
}

function Bloc({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <p className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-slate-400">{titre}</p>
      <p className="mt-1 text-sm leading-relaxed text-slate-600">{children}</p>
    </div>
  );
}

function Liste({ titre, items }: { titre: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-4">
      <p className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-slate-400">{titre}</p>
      <ul className="mt-1.5 space-y-1.5">
        {items.map((x) => (
          <li key={x} className="flex gap-2 text-sm leading-relaxed text-slate-600">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-gold-500" aria-hidden="true" />
            <span>{x}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PanneauListe({ titre, items }: { titre: string; items: string[] }) {
  return (
    <section className="rounded-xl border hairline bg-white p-6 shadow-card">
      <h3 className="font-display text-lg font-semibold text-navy-900">{titre}</h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">Néant.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((x) => (
            <li key={x} className="flex gap-2 text-sm leading-relaxed text-slate-600">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-gold-500" aria-hidden="true" />
              <span>{x}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------

const TYPES: { type: TypeDocument; intitule: string }[] = [
  { type: 'requete-nullite', intitule: 'Requête en nullité' },
  { type: 'memoire-defense', intitule: 'Mémoire en défense' },
  { type: 'demande-mise-en-liberte', intitule: 'Demande de mise en liberté' },
  { type: 'memoire-appel', intitule: 'Mémoire d’appel' },
];

export function VueDocuments({
  rapport,
  onCopier,
}: {
  rapport: RapportLdi | null;
  onCopier: (texte: string) => void;
}) {
  const [type, setType] = useState<TypeDocument>('requete-nullite');
  if (!rapport) return SANS_DOSSIER;

  const doc = genererDocument(type, rapport.dossier, rapport.strategie);

  return (
    <div className="space-y-6">
      <TitreSection surtitre="Trames" titre="Actes à préparer">
        <div className="flex flex-wrap gap-2">
          {TYPES.map((t) => (
            <button
              key={t.type}
              type="button"
              onClick={() => setType(t.type)}
              aria-pressed={t.type === type}
              className={`rounded-full border px-3.5 py-1.5 text-xs transition-colors ${
                t.type === type
                  ? 'border-gold-500 bg-gold-500/15 text-navy-900'
                  : 'hairline bg-white text-slate-500 hover:border-gold-500 hover:text-navy-900'
              }`}
            >
              {t.intitule}
            </button>
          ))}
        </div>
      </TitreSection>

      <Reserve>
        Ce n’est pas un acte, c’est une <strong>trame</strong>. {doc.aCompleter.length} emplacement(s)
        restent à compléter, et le texte doit être vérifié, complété et signé par l’avocat, qui en
        assume seul la responsabilité. Aucun numéro de pourvoi n’y figure : la jurisprudence ne peut
        venir que d’une interrogation des sources officielles.
      </Reserve>

      {doc.aCompleter.length > 0 && (
        <section className="rounded-xl border hairline bg-white p-6 shadow-card">
          <h3 className="font-display text-lg font-semibold text-navy-900">À compléter</h3>
          <ul className="mt-3 space-y-1.5">
            {doc.aCompleter.map((x) => (
              <li key={x} className="flex gap-2 text-sm leading-relaxed text-slate-600">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-gold-500" aria-hidden="true" />
                <span>{x}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div>
        <button
          type="button"
          onClick={() => onCopier(doc.corps)}
          className="mb-3 rounded-lg border hairline bg-white px-4 py-2 text-sm text-navy-900 transition-colors hover:border-gold-500"
        >
          Copier la trame
        </button>
        <pre className="max-h-[38rem] overflow-auto whitespace-pre-wrap rounded-xl border hairline bg-white p-6 font-sans text-sm leading-relaxed text-navy-900 shadow-card">
          {doc.corps}
        </pre>
      </div>
    </div>
  );
}
