import { useRef, useState } from 'react';

import { LIBELLES_FORMAT } from '../../ldi/ingestion/formats';
import { AVERTISSEMENT_NIVEAU_1, ingererSelonNiveau } from '../../ldi/ingestion/niveaux';
import { bordereau, mettreEnEtat, versPieces, type FicheMiseEnEtat } from '../../ldi/ingestion/mise-en-etat';
import { BORNES_DEFAUT, type FichierEntrant, type PieceIngeree, type ResultatIngestion } from '../../ldi/ingestion/types';
import type { Dossier } from '../../ldi/types';
import { documentsDepuisIngestion, type DocumentIngere } from '../../noyau/p0';
import { Reserve, TitreSection, Tuile, GrilleTuiles, Vide } from './Indicateurs';

/**
 * Les deux passes de l'ingestion, nommées pour l'écran.
 *
 * `lecture` est immédiate et sans dépendance. `extraction` ne démarre que s'il
 * y a un PDF ou un courriel dans le lot, et commence alors par télécharger son
 * extracteur : sur une connexion lente, ce temps doit être expliqué plutôt que
 * subi comme un blocage.
 */
type Passe = 'lecture' | 'extraction';

type Etat =
  | { statut: 'inactif' }
  | { statut: 'encours'; passe: Passe; fait: number; total: number; courant: string }
  | { statut: 'erreur'; message: string }
  | { statut: 'ok'; resultat: ResultatIngestion; fiches: FicheMiseEnEtat[] };

/**
 * Dépôt de fichiers et mise en état.
 *
 * L'ingestion s'exécute intégralement dans le navigateur : les octets ne
 * quittent pas le poste, et l'écran le dit avant que l'avocat ne dépose quoi
 * que ce soit — pas après.
 */
export function VueDepot({
  onDossier,
  referenceProposee,
  niveau1Actif,
}: {
  /** Le dossier constitué ET les documents ingérés (empreintes, B17, fragments). */
  onDossier: (dossier: Dossier, documents: DocumentIngere[]) => void;
  referenceProposee: string;
  /** Interrupteur D-1 : extraction des formats à structure. FAUX par défaut. */
  niveau1Actif: boolean;
}) {
  const [etat, setEtat] = useState<Etat>({ statut: 'inactif' });
  const [survol, setSurvol] = useState(false);
  const [reference, setReference] = useState(referenceProposee);
  const champFichiers = useRef<HTMLInputElement>(null);
  const champDossier = useRef<HTMLInputElement>(null);

  async function traiter(liste: FileList | null) {
    if (!liste || liste.length === 0) return;
    const fichiers = [...liste];

    setEtat({
      statut: 'encours',
      passe: 'lecture',
      fait: 0,
      total: fichiers.length,
      courant: fichiers[0].name,
    });

    try {
      const entrants: FichierEntrant[] = [];
      for (const [i, f] of fichiers.entries()) {
        setEtat({
          statut: 'encours',
          passe: 'lecture',
          fait: i,
          total: fichiers.length,
          courant: f.name,
        });
        // `webkitRelativePath` porte l'arborescence quand un répertoire entier
        // est déposé : c'est le classement déjà fait par le cabinet.
        const chemin = (f as File & { webkitRelativePath?: string }).webkitRelativePath ?? '';
        entrants.push({
          nom: f.name,
          chemin: chemin.includes('/') ? chemin.slice(0, chemin.lastIndexOf('/')) : '',
          octets: new Uint8Array(await f.arrayBuffer()),
        });
      }

      const resultat = ingererSelonNiveau(entrants, { niveau1Actif, bornes: BORNES_DEFAUT });

      // Second passage. Le module n'est chargé que s'il y a effectivement de
      // quoi le faire travailler : un cabinet qui ne dépose que des documents
      // Word ne télécharge jamais l'extracteur PDF.
      const differees = resultat.pieces.filter(
        (p) => p.format === 'pdf' || p.format === 'courriel'
      ).length;

      if (differees > 0) {
        setEtat({
          statut: 'encours',
          passe: 'extraction',
          fait: 0,
          total: differees,
          courant: '',
        });
        const { completerLourds } = await import('../../ldi/ingestion/lourds');
        await completerLourds(resultat, BORNES_DEFAUT, (fait, total, nom) => {
          setEtat({ statut: 'encours', passe: 'extraction', fait, total, courant: nom });
        });
      }

      // La mise en état vient APRÈS le second passage : proposer une date ou
      // une nature avant d'avoir lu le PDF reviendrait à les tirer du seul nom
      // de fichier, en laissant croire qu'elles viennent du document.
      setEtat({ statut: 'ok', resultat, fiches: mettreEnEtat(resultat.pieces) });
    } catch (e) {
      setEtat({ statut: 'erreur', message: (e as Error).message });
    }
  }

  return (
    <div className="space-y-8">
      <section>
        <TitreSection surtitre="Dépôt" titre="Charger des pièces" />

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setSurvol(true);
          }}
          onDragLeave={() => setSurvol(false)}
          onDrop={(e) => {
            e.preventDefault();
            setSurvol(false);
            void traiter(e.dataTransfer.files);
          }}
          className={`rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
            survol ? 'border-laiton bg-laiton/10' : 'hairline bg-surface'
          }`}
        >
          <p className="font-display text-xl font-semibold text-encre">
            Déposez vos fichiers ici
          </p>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-encre-2">
            {niveau1Actif
              ? 'PDF natifs, Word, tableurs, CSV, courriels, archives ZIP — ou un répertoire entier.'
              : 'Texte brut : .txt, .md, .csv, .json — ou du texte collé.'}{' '}
            L’extraction s’exécute <strong>dans ce navigateur</strong> : aucun octet n’est transmis.
          </p>
          {niveau1Actif && (
            <p className="mx-auto mt-2 max-w-lg text-xs leading-relaxed text-laiton-clair">
              {AVERTISSEMENT_NIVEAU_1}
            </p>
          )}

          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => champFichiers.current?.click()}
              className="rounded-lg bg-laiton px-5 py-2.5 text-sm text-fond transition-colors hover:bg-laiton-clair"
            >
              Choisir des fichiers
            </button>
            <button
              type="button"
              onClick={() => champDossier.current?.click()}
              className="rounded-lg border hairline bg-surface px-5 py-2.5 text-sm text-encre transition-colors hover:border-laiton"
            >
              Choisir un répertoire
            </button>
          </div>

          <input
            ref={champFichiers}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => void traiter(e.target.files)}
          />
          <input
            ref={champDossier}
            type="file"
            // Attributs non standard : seuls les navigateurs Chromium et
            // WebKit les exposent. Le dépôt fichier par fichier reste possible
            // partout ailleurs, et le bouton ci-dessus ne disparaît pas.
            {...{ webkitdirectory: '', directory: '' }}
            className="hidden"
            onChange={(e) => void traiter(e.target.files)}
          />
        </div>

        <div className="mt-4">
          <Reserve>
            Ce que l’outil <strong>ne sait pas lire</strong> : les pages numérisées sans couche
            texte. La reconnaissance optique n’est pas installée — elle exigerait une dizaine de
            mégaoctets et, par défaut, trois requêtes vers un service tiers à chaque océrisation
            (voir <code className="font-mono">docs/DEPENDANCES.md</code>). Ces pages sont
            conservées, comptées et signalées en quarantaine ; elles ne sont pas analysées, et
            aucun constat ne s’appuiera dessus.
          </Reserve>
        </div>
      </section>

      {etat.statut === 'encours' && (
        <section className="rounded-xl border hairline bg-surface p-6 shadow-card">
          <p className="text-sm text-encre">
            {etat.passe === 'lecture' ? 'Lecture' : 'Extraction'}{' '}
            {Math.min(etat.fait + 1, etat.total)} / {etat.total}
            {etat.courant ? ` — ${etat.courant}` : ''}
          </p>
          {etat.passe === 'extraction' && (
            <p className="mt-1 text-xs text-encre-2">
              PDF et courriels : leur extracteur est téléchargé maintenant, une seule fois,
              parce que le lot en contient. Rien n’est transmis — c’est le code de l’outil qui
              arrive, pas les pièces qui partent.
            </p>
          )}
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full bg-laiton transition-[width] duration-200"
              style={{
                width: `${Math.round((Math.min(etat.fait + 1, etat.total) / etat.total) * 100)}%`,
              }}
            />
          </div>
        </section>
      )}

      {etat.statut === 'erreur' && (
        <p role="alert" className="rounded-lg border border-alerte/60 bg-alerte/10 p-4 text-sm text-alerte-clair">
          L’ingestion a échoué — {etat.message}
        </p>
      )}

      {etat.statut === 'ok' && (
        <Resultat
          resultat={etat.resultat}
          fiches={etat.fiches}
          reference={reference}
          onReference={setReference}
          onDossier={onDossier}
        />
      )}
    </div>
  );
}

function Resultat({
  resultat,
  fiches,
  reference,
  onReference,
  onDossier,
}: {
  resultat: ResultatIngestion;
  fiches: FicheMiseEnEtat[];
  reference: string;
  onReference: (r: string) => void;
  onDossier: (d: Dossier, documents: DocumentIngere[]) => void;
}) {
  const c = resultat.compteurs;

  if (c.pieces === 0) {
    return (
      <Vide
        titre="Aucune pièce exploitable"
        explication="Tous les fichiers déposés ont été refusés ou reconnus comme doublons. Le détail figure ci-dessous."
      />
    );
  }

  return (
    <>
      <section>
        <TitreSection surtitre="Résultat" titre="Ce qui a été lu" />
        <GrilleTuiles>
          <Tuile valeur={c.pieces} intitule="Pièces" precision={`${c.pagesTotal} page(s) au total`} />
          <Tuile
            valeur={c.pagesEnQuarantaine}
            intitule="Pages non lues"
            ton={c.pagesEnQuarantaine > 0 ? 'attente' : 'neutre'}
            precision="numérisation sans couche texte, ou format non reconnu"
          />
          <Tuile
            valeur={resultat.doublons.length}
            intitule="Doublons écartés"
            precision="même contenu, nom différent"
          />
          <Tuile
            valeur={resultat.refuses.length}
            intitule="Fichiers refusés"
            ton={resultat.refuses.length > 0 ? 'alerte' : 'neutre'}
            precision="hors bornes, vides ou illisibles"
          />
        </GrilleTuiles>
      </section>

      <section>
        <TitreSection surtitre="Mise en état" titre="Métadonnées proposées">
          <div className="flex items-center gap-2">
            <label htmlFor="ref-dossier" className="text-xs text-encre-2">
              Référence
            </label>
            <input
              id="ref-dossier"
              value={reference}
              onChange={(e) => onReference(e.target.value)}
              className="w-40 rounded-lg border hairline bg-surface px-3 py-1.5 text-sm text-encre focus:border-laiton focus:outline-none"
            />
          </div>
        </TitreSection>

        <div className="mb-4">
          <Reserve>
            Tout ce qui suit est <strong>proposé</strong>, rien n’est confirmé. Chaque date et
            chaque nature vient de l’extrait affiché : jugez sur pièce plutôt que sur la confiance.
            Une cote, une nature ou une date fausse dans un bordereau engage l’avocat qui le signe.
          </Reserve>
        </div>

        <div className="overflow-x-auto rounded-xl border hairline bg-surface shadow-card">
          <table className="w-full min-w-[52rem] text-sm">
            <thead>
              <tr className="border-b hairline text-left">
                {['Cote', 'Fichier', 'Nature', 'Date', 'Pages', 'Justificatif'].map((t) => (
                  <th key={t} className="px-4 py-3 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-encre-2">
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fiches.map((f) => (
                <tr key={f.empreinte} className="border-b hairline last:border-0 align-top">
                  <td className="px-4 py-3 font-mono text-xs text-encre">{f.cote.valeur} *</td>
                  <td className="px-4 py-3 text-encre">{f.nomFichier}</td>
                  <td className="px-4 py-3 text-encre-2">{f.nature.valeur} *</td>
                  <td className="px-4 py-3 text-encre-2">
                    {f.date.valeur ?? <span className="text-encre-3">[MANQUANTE]</span>}
                    {f.date.valeur ? ' *' : ''}
                  </td>
                  <td className="px-4 py-3 text-encre-2">
                    {f.pages.total}
                    {f.pages.quarantaine > 0 && (
                      <span className="ml-1 text-laiton-clair">({f.pages.quarantaine} non lue)</span>
                    )}
                  </td>
                  <td className="max-w-sm px-4 py-3 text-xs leading-relaxed text-encre-2">
                    {f.date.justificatif || f.nature.justificatif || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() =>
              onDossier(
                {
                  reference: reference.trim() || 'DOSSIER-IMPORTÉ',
                  qualifications: [],
                  regime: 'droit-commun',
                  pieces: versPieces(fiches),
                  evenements: [],
                },
                documentsDepuisIngestion(resultat, new Date().toISOString(), 'fichier')
              )
            }
            className="rounded-lg bg-laiton px-5 py-2.5 text-sm text-fond transition-colors hover:bg-laiton-clair"
          >
            Créer le dossier à partir de ces pièces
          </button>
          <button
            type="button"
            onClick={() => void navigator.clipboard?.writeText(bordereau(fiches, reference))}
            className="rounded-lg border hairline bg-surface px-5 py-2.5 text-sm text-encre transition-colors hover:border-laiton"
          >
            Copier le bordereau
          </button>
        </div>

        <p className="mt-3 text-xs text-encre-2">
          Le dossier créé ne comporte <strong>aucun événement</strong> : la chronologie se
          construit à partir d’actes datés que seul l’avocat peut qualifier. Les pièces, elles,
          sont versées avec leur cote proposée.
        </p>
      </section>

      {(resultat.doublons.length > 0 || resultat.refuses.length > 0) && (
        <section>
          <TitreSection surtitre="Écartés" titre="Ce qui n’est pas entré au dossier" />
          <ul className="divide-y hairline overflow-hidden rounded-xl border hairline bg-surface shadow-card">
            {resultat.refuses.map((r) => (
              <li key={`r-${ou(r)}`} className="p-4">
                <p className="font-mono text-xs text-alerte-clair">refusé · {ou(r)}</p>
                <p className="mt-1 text-sm text-encre-2">{r.motif}</p>
              </li>
            ))}
            {resultat.doublons.map((d) => (
              <li key={`d-${ou(d)}`} className="p-4">
                <p className="font-mono text-xs text-encre-2">doublon · {ou(d)}</p>
                <p className="mt-1 text-sm text-encre-2">
                  Contenu identique à <span className="font-mono">{d.identiqueA}</span>. Un seul
                  exemplaire est versé.
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <FormatsLus pieces={resultat.pieces} />
    </>
  );
}

/**
 * Désignation d'un fichier écarté : chemin puis nom.
 *
 * Deux `vide.txt`, l'un déposé et l'autre au fond d'une archive, sont deux
 * pièces manquantes distinctes. Les afficher sous le même libellé donnerait à
 * lire un doublon d'affichage là où il y a deux trous dans la procédure.
 */
function ou(e: { nomFichier: string; chemin: string }): string {
  return e.chemin ? `${e.chemin}/${e.nomFichier}` : e.nomFichier;
}

function FormatsLus({ pieces }: { pieces: PieceIngeree[] }) {
  const parFormat = new Map<string, number>();
  for (const p of pieces) parFormat.set(p.format, (parFormat.get(p.format) ?? 0) + 1);

  return (
    <section>
      <TitreSection surtitre="Formats" titre="Ce qui a été reconnu" />
      <ul className="flex flex-wrap gap-2">
        {[...parFormat].map(([format, n]) => (
          <li
            key={format}
            className="rounded-full border hairline bg-surface px-3.5 py-1.5 text-xs text-encre"
          >
            {LIBELLES_FORMAT[format as keyof typeof LIBELLES_FORMAT] ?? format} · {n}
          </li>
        ))}
      </ul>
    </section>
  );
}
