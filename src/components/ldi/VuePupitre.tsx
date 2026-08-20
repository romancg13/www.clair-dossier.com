/**
 * Le pupitre — vue d'accueil (§5.1).
 *
 * Trois questions, dans cet ordre : qu'est-ce qui brûle ? qu'est-ce qui
 * m'attend ? où en est chaque dossier ? Aucun pourcentage, aucun score,
 * aucune jauge de « chances », aucun classement par « qualité » (B4) : le
 * pupitre compte, date et classe — il ne prédit jamais.
 */
import { useMemo, useState } from 'react';

import { joursRestants, trierEcheances, urgenceDe } from '../../noyau/delais';
import {
  LIBELLES_AVANCEMENT,
  LIBELLES_NATURE,
  LIBELLES_PHASE,
  LIBELLES_STATUT_CLIENT,
  type Avancement,
  type DossierPenal,
  type NatureContentieux,
  type Phase,
  type StatutClient,
} from '../../noyau/modele';
import type { ResultatChaine } from '../../noyau/orchestrateur';
import { demandesEnAttente } from '../../noyau/demandes';
import type { Demande } from '../../noyau/modele';
import type { Vue } from './navigation';
import { Reserve, TitreSection, Vide } from './Indicateurs';

type Ligne = { dossier: DossierPenal; chaine: ResultatChaine };

const TON_URGENCE: Record<string, string> = {
  'sous-48h': 'text-alerte-clair',
  'sous-7j': 'text-laiton-clair',
  'sous-30j': 'text-encre',
  'sans-echeance-courte': 'text-encre-2',
};

export function VuePupitre({
  lignes,
  demandes,
  maintenant,
  onActif,
  onVue,
}: {
  lignes: Ligne[];
  demandes: Demande[];
  maintenant: string;
  onActif: (reference: string) => void;
  onVue: (vue: Vue) => void;
}) {
  const [filtrePhase, setFiltrePhase] = useState<Phase | ''>('');
  const [filtreStatut, setFiltreStatut] = useState<StatutClient | ''>('');
  const [filtreNature, setFiltreNature] = useState<NatureContentieux | ''>('');
  const [filtreAvancement, setFiltreAvancement] = useState<Avancement | ''>('');

  // ── Bloc 1 : ce qui brûle ────────────────────────────────────────────────
  const echeances = useMemo(
    () =>
      trierEcheances(
        lignes.flatMap(({ dossier }) =>
          dossier.echeances.filter((e) => e.etat === 'ouverte').map((e) => ({ ...e, dossier: dossier.reference }))
        )
      ),
    [lignes]
  );

  // ── Bloc 2 : ce qui attend — manques + demandes ouvertes, tous dossiers ──
  const actions = useMemo(
    () =>
      lignes.flatMap(({ dossier, chaine }) =>
        chaine.sorties
          .flatMap((s) => s.manques)
          .map((m) => ({ dossier: dossier.reference, quoi: m.quoi, action: m.action }))
      ),
    [lignes]
  );
  const attentes = demandesEnAttente(demandes);

  // ── Bloc 3 : la grille, filtrable sur les cinq axes ─────────────────────
  const filtrees = lignes.filter(({ dossier }) => {
    if (filtrePhase && dossier.phase !== filtrePhase) return false;
    if (filtreStatut && dossier.statutLiberte !== filtreStatut) return false;
    if (filtreNature && !dossier.natures.includes(filtreNature)) return false;
    if (filtreAvancement && dossier.avancement !== filtreAvancement) return false;
    return true;
  });

  if (lignes.length === 0) {
    return <Vide titre="Aucun dossier" explication="Déposez des pièces ou importez un dossier depuis l’onglet Dépôt." />;
  }

  return (
    <div className="space-y-10">
      {/* ── 1. Qu'est-ce qui brûle ? ─────────────────────────────────────── */}
      <section>
        <TitreSection surtitre="Échéances" titre="Qu’est-ce qui brûle ?" />
        {echeances.length === 0 ? (
          <Reserve>Aucune échéance ouverte n’est saisie. Une échéance non saisie ne sonne pas : saisir chaque terme dès qu’il est connu.</Reserve>
        ) : (
          <ol className="divide-y hairline overflow-hidden rounded-xl border hairline bg-surface shadow-card">
            {echeances.slice(0, 8).map((e) => {
              const jours = joursRestants(e, maintenant);
              const critique = e.type === 'detention' || jours <= 2;
              return (
                <li key={`${e.dossier}-${e.id}`} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 p-4">
                  <span className={`w-24 shrink-0 font-mono text-sm ${critique ? 'text-alerte-clair' : 'text-laiton-clair'}`}>
                    {jours < 0 ? `J+${-jours}` : `J−${jours}`}
                  </span>
                  <button type="button" onClick={() => onActif(e.dossier)} className="font-mono text-xs text-encre-2 underline-offset-2 hover:text-laiton-clair hover:underline">
                    {e.dossier}
                  </button>
                  <span className="min-w-0 flex-1 text-sm text-encre">{e.intitule}</span>
                  <span className="font-mono text-xs text-encre-3">{e.date}</span>
                  <span className={`font-mono text-[0.62rem] uppercase tracking-[0.14em] ${e.type === 'detention' || e.type === 'recours' ? 'text-alerte-clair' : 'text-encre-3'}`}>
                    {e.type}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {/* ── 2. Qu'est-ce qui m'attend ? ──────────────────────────────────── */}
      <section>
        <TitreSection surtitre="File d’actions" titre="Qu’est-ce qui m’attend ?">
          <button type="button" onClick={() => onVue('registre')} className="text-xs text-encre-2 underline decoration-transparent underline-offset-4 hover:text-laiton-clair hover:decoration-laiton">
            Registre des demandes →
          </button>
        </TitreSection>
        {actions.length === 0 && attentes.length === 0 ? (
          <Reserve>Rien en attente sur les éléments saisis — ce qui ne vaut que pour ce qui est saisi.</Reserve>
        ) : (
          <ul className="divide-y hairline overflow-hidden rounded-xl border hairline bg-surface shadow-card">
            {attentes.slice(0, 4).map((d) => (
              <li key={d.id} className="p-4">
                <p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-laiton-clair">demande · {d.dossierReference}</p>
                <p className="mt-1 text-sm text-encre">{d.enonce}</p>
                {d.resteAFaire.length > 0 && <p className="mt-1 text-xs text-encre-2">Reste : {d.resteAFaire.join(' · ')}</p>}
              </li>
            ))}
            {actions.slice(0, 8).map((a, i) => (
              <li key={`${a.dossier}-${i}`} className="p-4">
                <p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-encre-3">manque · {a.dossier}</p>
                <p className="mt-1 text-sm text-encre">{a.action}</p>
                <p className="mt-0.5 text-xs text-encre-2">{a.quoi}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── 3. Où en est chaque dossier ? ────────────────────────────────── */}
      <section>
        <TitreSection surtitre="Dossiers" titre="Où en est chaque dossier ?" />

        <div className="mb-4 flex flex-wrap gap-2">
          <Filtre valeur={filtrePhase} onChange={(v) => setFiltrePhase(v as Phase | '')} libelle="Phase" options={LIBELLES_PHASE} />
          <Filtre valeur={filtreStatut} onChange={(v) => setFiltreStatut(v as StatutClient | '')} libelle="Statut" options={LIBELLES_STATUT_CLIENT} />
          <Filtre valeur={filtreNature} onChange={(v) => setFiltreNature(v as NatureContentieux | '')} libelle="Nature" options={LIBELLES_NATURE} />
          <Filtre valeur={filtreAvancement} onChange={(v) => setFiltreAvancement(v as Avancement | '')} libelle="Avancement" options={LIBELLES_AVANCEMENT} />
        </div>

        <div className="overflow-x-auto rounded-xl border hairline bg-surface shadow-card">
          <table className="w-full min-w-[56rem] text-sm">
            <thead>
              <tr className="border-b hairline text-left">
                {['Dossier', 'Phase', 'Statut', 'Nature', 'Urgence', 'Avancement', 'Griefs', 'Manques', 'Pièces'].map((t) => (
                  <th key={t} className="px-4 py-3 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-encre-2">{t}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrees.map(({ dossier, chaine }) => {
                const urgence = urgenceDe(dossier.echeances, maintenant);
                const griefs = chaine.postes.reduce((n, p) => n + p.griefs.length, 0);
                const manques = chaine.sorties.reduce((n, s) => n + s.manques.length, 0);
                return (
                  <tr key={dossier.reference} className="border-b hairline align-top last:border-0">
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => onActif(dossier.reference)} className="font-mono text-xs text-encre underline-offset-2 hover:text-laiton-clair hover:underline">
                        {dossier.reference}
                      </button>
                      {dossier.initialesClient && <span className="ml-2 text-xs text-encre-3">{dossier.initialesClient}</span>}
                    </td>
                    <td className="px-4 py-3 text-encre-2">{LIBELLES_PHASE[dossier.phase]}</td>
                    <td className={`px-4 py-3 ${dossier.statutLiberte === 'detention-provisoire' ? 'text-alerte-clair' : 'text-encre-2'}`}>
                      {LIBELLES_STATUT_CLIENT[dossier.statutLiberte]}
                    </td>
                    <td className="px-4 py-3 text-encre-2">{dossier.natures.map((n) => LIBELLES_NATURE[n]).join(', ') || '—'}</td>
                    <td className={`px-4 py-3 font-mono text-xs ${TON_URGENCE[urgence]}`}>{urgence.replaceAll('-', ' ')}</td>
                    <td className="px-4 py-3 text-encre-2">{LIBELLES_AVANCEMENT[dossier.avancement]}</td>
                    <td className={`px-4 py-3 font-mono ${griefs > 0 ? 'text-laiton-clair' : 'text-encre-3'}`}>{griefs}</td>
                    <td className="px-4 py-3 font-mono text-encre-3">{manques}</td>
                    <td className="px-4 py-3 font-mono text-encre-3">{dossier.pieces.length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-3">
          <Reserve>
            Ces colonnes sont des <strong>comptes</strong>, pas des indices de solidité : un dossier à zéro grief n’est pas un dossier
            sûr, c’est un dossier où les postes contrôlés n’ont rien révélé sur les éléments saisis.
          </Reserve>
        </div>
      </section>
    </div>
  );
}

function Filtre<T extends string>({
  valeur,
  onChange,
  libelle,
  options,
}: {
  valeur: string;
  onChange: (v: string) => void;
  libelle: string;
  options: Record<T, string>;
}) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-encre-2">
      {libelle}
      <select
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border hairline bg-surface px-2 py-1.5 text-xs text-encre focus:border-laiton focus:outline-none"
      >
        <option value="">Tous</option>
        {(Object.entries(options) as [T, string][]).map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    </label>
  );
}
