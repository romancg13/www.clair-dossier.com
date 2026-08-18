/**
 * Atelier LDI — plusieurs dossiers, une seule vue d'ensemble.
 *
 * ┌─ CE QUI NE QUITTE PAS CETTE PAGE ───────────────────────────────────────┐
 * │ Toute l'analyse s'exécute dans le navigateur. Les dossiers vivent en     │
 * │ mémoire de session ; ils ne sont écrits sur le disque que si l'avocat a  │
 * │ activé la conservation dans Paramètres, et l'écran le dit.               │
 * │                                                                          │
 * │ Une seule action transmet quoi que ce soit : la demande d'analyse        │
 * │ rédigée, et ce qui part alors est le rapport minimisé, jamais les pièces.│
 * └──────────────────────────────────────────────────────────────────────────┘
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { AtelierShell } from '../components/ldi/AtelierShell';
import { VueDossiers } from '../components/ldi/VueDossiers';
import { VueConfidentialite, VueParametres } from '../components/ldi/VueSecurite';
import { VueTableauDeBord } from '../components/ldi/VueTableauDeBord';
import { VueChronologie, VueControles, VueDocuments, VueStrategie } from '../components/ldi/VuesDossier';
import { vueValide, type Vue } from '../components/ldi/navigation';
import { ficheDossier } from '../ldi/atelier';
import { creerCacheAnalyse } from '../ldi/cache';
import { DOSSIERS_DEMONSTRATION, estDemonstration } from '../ldi/demonstration';
import {
  conserver,
  definirConservation,
  etatConservation,
  relire,
  type EtatConservation,
} from '../ldi/stockage';
import type { Dossier } from '../ldi/types';
import { validerDossier } from '../ldi/validation';
import { Seo } from '../lib/seo';

export function LdiAtelier() {
  const [params, setParams] = useSearchParams();
  const vue = vueValide(params.get('vue'));

  // Le cache survit aux rendus mais pas au démontage : il ne conserve donc
  // aucune donnée de dossier au-delà de la session de travail.
  const cache = useRef(creerCacheAnalyse()).current;

  const [dossiers, setDossiers] = useState<Dossier[]>(() => {
    const conserves = relire();
    return conserves.length > 0 ? conserves : DOSSIERS_DEMONSTRATION;
  });
  const [actif, setActif] = useState<string | null>(() => DOSSIERS_DEMONSTRATION[0]?.reference ?? null);
  const [erreurImport, setErreurImport] = useState<string | null>(null);
  const [conservation, setConservation] = useState<EtatConservation>(() => etatConservation());
  // Force un nouveau rendu après vidage du cache, dont les compteurs sont
  // internes et ne déclenchent donc rien par eux-mêmes.
  const [revision, setRevision] = useState(0);

  // Une analyse par état de dossier, pas une par rendu : c'est le cache qui
  // rend le classement et les filtres praticables au-delà de deux dossiers.
  const rapports = useMemo(
    () => dossiers.map((d) => cache.analyser(d)),
    // `revision` participe volontairement : vider le cache doit reconstruire.
    [dossiers, cache, revision]
  );

  const fiches = useMemo(() => rapports.map(ficheDossier), [rapports]);
  const rapportActif = rapports.find((r) => r.dossier.reference === actif) ?? null;

  const demonstration = dossiers.length > 0 && dossiers.every((d) => estDemonstration(d.reference));

  // Écrit à chaque changement, mais uniquement si la conservation est active :
  // `conserver` refuse d'écrire sans consentement, la garde est dans le module.
  useEffect(() => {
    if (!conservation.active) return;
    const aConserver = dossiers.filter((d) => !estDemonstration(d.reference));
    if (conserver(aConserver, new Date().toISOString())) {
      setConservation(etatConservation());
    }
  }, [dossiers, conservation.active]);

  const allerA = useCallback(
    (v: Vue) => {
      const suivant = new URLSearchParams(params);
      suivant.set('vue', v);
      setParams(suivant, { replace: false });
    },
    [params, setParams]
  );

  function importer(json: string) {
    let parse: unknown;
    try {
      parse = JSON.parse(json);
    } catch (e) {
      setErreurImport(`JSON invalide — ${(e as Error).message}`);
      return;
    }

    const validation = validerDossier(parse);
    if (!validation.ok) {
      setErreurImport(validation.message);
      return;
    }

    const nouveau = validation.dossier;
    setErreurImport(null);
    setDossiers((liste) => {
      // Un dossier rechargé remplace le précédent plutôt que de le doubler :
      // deux fiches portant la même référence seraient impossibles à départager.
      const sansDoublon = liste.filter((d) => d.reference !== nouveau.reference);
      // Les dossiers fictifs s'effacent dès qu'un dossier réel arrive : ils ne
      // sont là que pour peupler un atelier vide.
      const reels = sansDoublon.filter((d) => !estDemonstration(d.reference));
      return [...reels, nouveau];
    });
    setActif(nouveau.reference);
    allerA('controles');
  }

  function retirer(reference: string) {
    setDossiers((liste) => liste.filter((d) => d.reference !== reference));
    setActif((courant) => (courant === reference ? null : courant));
  }

  function copier(texte: string) {
    void navigator.clipboard?.writeText(texte);
  }

  return (
    <>
      <Seo
        title="Atelier LDI"
        description="Outil interne d’analyse de dossier pénal."
        path="/ldi"
        noindex
      />

      <AtelierShell
        vue={vue}
        onVue={allerA}
        fiches={fiches}
        actif={actif}
        onActif={setActif}
        demonstration={demonstration}
      >
        {vue === 'tableau-de-bord' && (
          <VueTableauDeBord
            fiches={fiches}
            rapports={rapports}
            actif={actif}
            onActif={setActif}
            onVue={allerA}
          />
        )}

        {vue === 'dossiers' && (
          <VueDossiers
            fiches={fiches}
            actif={actif}
            onActif={setActif}
            onVue={allerA}
            onImporter={importer}
            onRetirer={retirer}
            erreurImport={erreurImport}
          />
        )}

        {vue === 'chronologie' && <VueChronologie rapport={rapportActif} />}
        {vue === 'controles' && <VueControles rapport={rapportActif} />}
        {vue === 'strategie' && <VueStrategie rapport={rapportActif} />}
        {vue === 'documents' && <VueDocuments rapport={rapportActif} onCopier={copier} />}
        {vue === 'confidentialite' && <VueConfidentialite rapport={rapportActif} />}

        {vue === 'parametres' && (
          <VueParametres
            conservation={conservation}
            onConservation={(actif) => setConservation(definirConservation(actif))}
            statistiquesCache={cache.statistiques()}
            onViderCache={() => {
              cache.vider();
              setRevision((n) => n + 1);
            }}
            nombreDossiers={dossiers.length}
          />
        )}
      </AtelierShell>
    </>
  );
}
