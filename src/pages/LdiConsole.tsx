/**
 * Console LDI — outil interne, accessible aux comptes authentifiés.
 *
 * L'analyse déterministe tourne intégralement dans le navigateur : tant que
 * l'avocat ne demande pas explicitement une analyse rédigée, aucune donnée du
 * dossier ne quitte la machine. C'est le comportement par défaut, et l'écran le
 * dit à l'utilisateur plutôt que de le laisser supposer.
 */
import { useMemo, useState } from 'react';

import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { alertesResiduelles, minimiser } from '../ldi/confidentialite';
import { analyser, rendreMarkdown } from '../ldi/pipeline';
import type { Dossier, RapportLdi, Severite } from '../ldi/types';
import { Seo } from '../lib/seo';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const GABARIT = `{
  "reference": "CAB-2026-001",
  "qualifications": ["CP, art. 222-37"],
  "regime": "droit-commun",
  "pieces": [
    { "id": "P1", "cote": "D1", "nature": "proces-verbal", "intitule": "PV de placement", "date": "2026-03-14" }
  ],
  "evenements": [
    { "id": "E1", "nature": "debut-garde-a-vue", "horodatage": "2026-03-14T08:00", "description": "Placement", "sourcePieceId": "P1" },
    { "id": "E2", "nature": "notification-droits", "horodatage": "2026-03-14T09:20", "description": "Notification des droits", "sourcePieceId": "P1" }
  ]
}`;

const COULEUR_SEVERITE: Record<Severite, string> = {
  critique: 'bg-red-50 text-red-900 border-red-200',
  majeure: 'bg-amber-50 text-amber-900 border-amber-200',
  mineure: 'bg-cream-100 text-navy-900 border-transparent',
};

const COULEUR_RESULTAT: Record<string, string> = {
  anomalie: 'text-red-800',
  conforme: 'text-emerald-800',
  'non-etabli': 'text-slate-500',
};

type EtatAnalyseRedigee =
  | { statut: 'inactif' }
  | { statut: 'encours' }
  | { statut: 'erreur'; message: string }
  | { statut: 'ok'; texte: string; avertissement: string };

export function LdiConsole() {
  const [saisie, setSaisie] = useState(GABARIT);
  const [erreur, setErreur] = useState<string | null>(null);
  const [rapport, setRapport] = useState<RapportLdi | null>(null);
  const [noms, setNoms] = useState('');
  const [question, setQuestion] = useState('');
  const [redigee, setRedigee] = useState<EtatAnalyseRedigee>({ statut: 'inactif' });

  const markdown = useMemo(() => (rapport ? rendreMarkdown(rapport) : ''), [rapport]);

  const minimise = useMemo(() => {
    if (!markdown) return null;
    const listeNoms = noms.split(',').map((n) => n.trim()).filter(Boolean);
    const { texte } = minimiser(markdown, listeNoms);
    return { texte, alertes: alertesResiduelles(texte) };
  }, [markdown, noms]);

  function lancerAnalyse() {
    setRedigee({ statut: 'inactif' });
    let dossier: Dossier;
    try {
      dossier = JSON.parse(saisie) as Dossier;
    } catch (e) {
      setErreur(`JSON invalide — ${(e as Error).message}`);
      setRapport(null);
      return;
    }
    if (!dossier.reference || !Array.isArray(dossier.evenements) || !Array.isArray(dossier.pieces)) {
      setErreur('Le dossier doit comporter « reference », « evenements » et « pieces ».');
      setRapport(null);
      return;
    }
    setErreur(null);
    setRapport(analyser(dossier));
  }

  async function demanderAnalyseRedigee() {
    if (!minimise || !question.trim()) return;
    setRedigee({ statut: 'encours' });

    try {
      const { data, error } = await supabase.functions.invoke('ldi-analyze', {
        body: { rapport: minimise.texte, question: question.trim() },
      });
      if (error) {
        setRedigee({ statut: 'erreur', message: error.message });
        return;
      }
      const charge = data as { analyse?: string; avertissement?: string; error?: string };
      if (charge.error || !charge.analyse) {
        setRedigee({ statut: 'erreur', message: charge.error ?? 'Réponse vide.' });
        return;
      }
      setRedigee({
        statut: 'ok',
        texte: charge.analyse,
        avertissement: charge.avertissement ?? '',
      });
    } catch (e) {
      setRedigee({ statut: 'erreur', message: (e as Error).message });
    }
  }

  return (
    <>
      <Seo
        title="Console LDI"
        description="Outil interne d'analyse de dossier."
        path="/ldi"
        noindex
      />

      <section className="bg-cream-50">
        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 lg:px-12">
          <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-700">
            Outil interne
          </p>
          <h1 className="mt-3 font-display text-4xl font-semibold leading-tight text-navy-900 sm:text-5xl">
            Console d'analyse LDI
          </h1>
          <p className="mt-4 max-w-3xl text-slate-600">
            L'analyse ci-dessous s'exécute entièrement dans votre navigateur. Aucune donnée du
            dossier n'est transmise tant que vous ne demandez pas explicitement une analyse
            rédigée — et, dans ce cas, seul le rapport pseudonymisé est envoyé.
          </p>

          <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,420px)_1fr]">
            {/* Saisie */}
            <div className="space-y-4">
              <Card>
                <label
                  htmlFor="dossier"
                  className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-slate-500"
                >
                  Dossier (JSON)
                </label>
                <textarea
                  id="dossier"
                  value={saisie}
                  onChange={(e) => setSaisie(e.target.value)}
                  spellCheck={false}
                  rows={18}
                  className="mt-3 w-full rounded-lg border hairline bg-cream-50 p-3 font-mono text-xs leading-relaxed text-navy-900 focus:border-gold-500 focus:outline-none"
                />
                {erreur && (
                  <p role="alert" className="mt-3 text-sm text-red-800">
                    {erreur}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button onClick={lancerAnalyse}>Analyser</Button>
                  <Button variant="outline" onClick={() => setSaisie(GABARIT)}>
                    Réinitialiser
                  </Button>
                </div>
              </Card>

              <Card variant="cream">
                <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">
                  Noms à pseudonymiser
                </p>
                <input
                  value={noms}
                  onChange={(e) => setNoms(e.target.value)}
                  placeholder="Jean Dupont, SARL Martin"
                  className="mt-3 w-full rounded-lg border hairline bg-white p-3 text-sm text-navy-900 focus:border-gold-500 focus:outline-none"
                />
                <p className="mt-2 text-xs text-slate-600">
                  Les adresses e-mail, téléphones, IBAN, NIR et plaques sont détectés
                  automatiquement. Les patronymes, non : ils doivent être déclarés ici.
                </p>
              </Card>
            </div>

            {/* Résultat */}
            <div className="space-y-6">
              {!rapport && (
                <Card variant="cream">
                  <p className="text-sm text-slate-600">
                    Aucun rapport pour l'instant. Collez un dossier au format attendu puis lancez
                    l'analyse.
                  </p>
                </Card>
              )}

              {rapport && (
                <>
                  <Card>
                    <div className="flex flex-wrap items-baseline justify-between gap-3">
                      <h2 className="font-display text-2xl font-semibold text-navy-900">
                        {rapport.dossier.reference}
                      </h2>
                      <span className="font-mono text-xs text-slate-500">
                        régime {rapport.dossier.regime} · LDI v{rapport.version}
                      </span>
                    </div>

                    <h3 className="mt-6 font-mono text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">
                      Contradictions ({rapport.dossier.contradictions.length})
                    </h3>
                    {rapport.dossier.contradictions.length === 0 ? (
                      <p className="mt-2 text-sm text-slate-600">
                        Aucune contradiction détectée par les contrôles automatiques. Les contrôles
                        ne portent que sur les heures, les durées et l'ordre des actes.
                      </p>
                    ) : (
                      <ul className="mt-3 space-y-3">
                        {rapport.dossier.contradictions.map((c, i) => (
                          <li
                            key={`${c.type}-${i}`}
                            className={`rounded-lg border p-3 text-sm ${COULEUR_SEVERITE[c.severite]}`}
                          >
                            <span className="font-mono text-[0.68rem] uppercase tracking-[0.14em]">
                              {c.severite} · {c.type}
                            </span>
                            <p className="mt-1">{c.constat}</p>
                            <p className="mt-2 text-xs opacity-80">À vérifier : {c.verificationSuggeree}</p>
                          </li>
                        ))}
                      </ul>
                    )}

                    <h3 className="mt-8 font-mono text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">
                      Points de contrôle
                    </h3>
                    <ul className="mt-3 divide-y divide-cream-200">
                      {rapport.nullites.points.map((p) => (
                        <li key={p.id} className="py-3">
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <span className="text-sm font-semibold text-navy-900">
                              <span className="font-mono text-xs text-slate-500">{p.id}</span>{' '}
                              {p.intitule}
                            </span>
                            <span
                              className={`font-mono text-[0.68rem] uppercase tracking-[0.14em] ${COULEUR_RESULTAT[p.resultat]}`}
                            >
                              {p.resultat}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-slate-600">{p.constat}</p>
                          <p className="mt-1 font-mono text-[0.68rem] text-slate-500">
                            {p.fondement.reference} — {p.fondement.statut}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </Card>

                  <Card>
                    <h3 className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">
                      Axes de défense
                    </h3>
                    {rapport.strategie.axes.length === 0 ? (
                      <p className="mt-2 text-sm text-slate-600">
                        Aucun axe ne se dégage des éléments fournis.
                      </p>
                    ) : (
                      <ol className="mt-3 space-y-5">
                        {rapport.strategie.axes.map((a, i) => (
                          <li key={`${a.intitule}-${i}`}>
                            <p className="text-sm font-semibold text-navy-900">
                              {i + 1}. {a.intitule}{' '}
                              <span className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-gold-700">
                                {a.solidite}
                              </span>
                            </p>
                            <p className="mt-1 text-xs text-slate-600">{a.justificationSolidite}</p>
                            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                              {a.appuis.map((x, j) => (
                                <li key={j}>{x}</li>
                              ))}
                            </ul>
                          </li>
                        ))}
                      </ol>
                    )}

                    <h3 className="mt-8 font-mono text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">
                      Risques
                    </h3>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                      {rapport.strategie.risques.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>

                    <h3 className="mt-8 font-mono text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">
                      Limites
                    </h3>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                      {rapport.limites.map((l, i) => (
                        <li key={i}>{l}</li>
                      ))}
                    </ul>

                    <div className="mt-6">
                      <Button
                        variant="outline"
                        onClick={() => void navigator.clipboard?.writeText(markdown)}
                      >
                        Copier le rapport (markdown)
                      </Button>
                    </div>
                  </Card>

                  {/* Étage génératif — explicitement volontaire */}
                  <Card variant="cream">
                    <h3 className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">
                      Analyse rédigée (envoi au service)
                    </h3>
                    <p className="mt-2 text-sm text-slate-600">
                      Seul le rapport ci-dessus, pseudonymisé, est transmis. Les pièces et le JSON
                      d'origine ne le sont jamais.
                    </p>

                    {minimise && minimise.alertes.length > 0 && (
                      <ul className="mt-3 space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                        {minimise.alertes.map((a, i) => (
                          <li key={i}>{a}</li>
                        ))}
                      </ul>
                    )}

                    <label htmlFor="question" className="mt-4 block text-sm text-navy-900">
                      Question
                    </label>
                    <textarea
                      id="question"
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      rows={3}
                      placeholder="Quels moyens de nullité peuvent être soulevés, et dans quel ordre ?"
                      className="mt-2 w-full rounded-lg border hairline bg-white p-3 text-sm text-navy-900 focus:border-gold-500 focus:outline-none"
                    />

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <Button
                        onClick={() => void demanderAnalyseRedigee()}
                        disabled={
                          !isSupabaseConfigured ||
                          !question.trim() ||
                          redigee.statut === 'encours'
                        }
                      >
                        {redigee.statut === 'encours' ? 'Analyse en cours…' : 'Demander une analyse'}
                      </Button>
                      {!isSupabaseConfigured && (
                        <span className="text-xs text-slate-500">
                          Service non configuré — analyse déterministe uniquement.
                        </span>
                      )}
                    </div>

                    {redigee.statut === 'erreur' && (
                      <p role="alert" className="mt-4 text-sm text-red-800">
                        {redigee.message}
                      </p>
                    )}

                    {redigee.statut === 'ok' && (
                      <div className="mt-4">
                        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                          {redigee.avertissement}
                        </p>
                        <pre className="mt-3 max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-lg bg-white p-4 font-sans text-sm leading-relaxed text-navy-900">
                          {redigee.texte}
                        </pre>
                      </div>
                    )}
                  </Card>
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
