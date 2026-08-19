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
import { VueDepot } from '../components/ldi/VueDepot';
import { VueDossiers } from '../components/ldi/VueDossiers';
import { VueConfidentialite, VueParametres } from '../components/ldi/VueSecurite';
import { VueTableauDeBord } from '../components/ldi/VueTableauDeBord';
import { VueChronologie, VueControles, VueDocuments, VueStrategie } from '../components/ldi/VuesDossier';
import { vueValide, type Vue } from '../components/ldi/navigation';
import { ficheDossier } from '../ldi/atelier';
import { creerCacheAnalyse } from '../ldi/cache';
import { DOSSIERS_DEMONSTRATION, estDemonstration } from '../ldi/demonstration';
import {
  activerConservation,
  conserver,
  etatConservation,
  ouvrirConservation,
  purger,
  purgerHeritage,
  type EtatConservation,
} from '../ldi/stockage';
import type { CoffreOuvert } from '../ldi/coffre';
import type { Dossier } from '../ldi/types';
import { validerDossier } from '../ldi/validation';

export function LdiAtelier() {
  const [params, setParams] = useSearchParams();
  const vue = vueValide(params.get('vue'));

  // Le cache survit aux rendus mais pas au démontage : il ne conserve donc
  // aucune donnée de dossier au-delà de la session de travail.
  const cache = useRef(creerCacheAnalyse()).current;

  // Rien n'est relu au montage : le coffre est chiffré, et son ouverture exige
  // la phrase. L'atelier démarre donc sur les dossiers fictifs, et bascule sur
  // le plan de travail réel quand l'avocat ouvre le coffre.
  const [dossiers, setDossiers] = useState<Dossier[]>(() => DOSSIERS_DEMONSTRATION);
  // La clé vit ici, en mémoire de composant : elle ne survit ni au
  // rechargement de la page, ni à la fermeture de l'onglet.
  const [coffre, setCoffre] = useState<CoffreOuvert | null>(null);
  const [actif, setActif] = useState<string | null>(() => DOSSIERS_DEMONSTRATION[0]?.reference ?? null);
  const [erreurImport, setErreurImport] = useState<string | null>(null);
  const [conservation, setConservation] = useState<EtatConservation>(() => etatConservation());
  // Interrupteur D-1 (extraction des formats à structure). Faux par défaut,
  // et non conservé : un réglage qui élargit ce que l'outil lit se réactive
  // consciemment à chaque session.
  const [niveau1Actif, setNiveau1Actif] = useState(false);
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

  // Scelle à chaque changement, mais uniquement si le coffre est ouvert dans
  // cette session. Sans clé, rien n'est écrit — il n'existe aucun repli en clair.
  useEffect(() => {
    if (!coffre) return;
    const aConserver = dossiers.filter((d) => !estDemonstration(d.reference));
    let vivant = true;
    void conserver(coffre, aConserver, new Date().toISOString()).then((ecrit) => {
      if (ecrit && vivant) setConservation(etatConservation());
    });
    return () => {
      vivant = false;
    };
  }, [dossiers, coffre]);

  const allerA = useCallback(
    (v: Vue) => {
      const suivant = new URLSearchParams(params);
      suivant.set('vue', v);
      setParams(suivant, { replace: false });
    },
    [params, setParams]
  );

  /** Ajoute un dossier à l'atelier, en remplaçant un homonyme. */
  function ajouterDossier(nouveau: Dossier) {
    setDossiers((liste) => {
      // Un dossier rechargé remplace le précédent plutôt que de le doubler :
      // deux fiches de même référence seraient impossibles à départager.
      const sansDoublon = liste.filter((d) => d.reference !== nouveau.reference);
      // Les dossiers fictifs s'effacent dès qu'un dossier réel arrive.
      return [...sansDoublon.filter((d) => !estDemonstration(d.reference)), nouveau];
    });
    setActif(nouveau.reference);
    setErreurImport(null);
  }

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

    ajouterDossier(validation.dossier);
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

        {vue === 'depot' && (
          <VueDepot
            referenceProposee={`CAB-${new Date().getFullYear()}-001`}
            niveau1Actif={niveau1Actif}
            onDossier={(nouveau) => {
              ajouterDossier(nouveau);
              allerA('dossiers');
            }}
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
            coffreOuvert={coffre !== null}
            actionsCoffre={{
              onActiver: async (phrase) => {
                try {
                  const reels = dossiers.filter((d) => !estDemonstration(d.reference));
                  const { coffre: neuf, etat } = await activerConservation(
                    phrase,
                    reels,
                    new Date().toISOString()
                  );
                  setCoffre(neuf);
                  setConservation(etat);
                  return null;
                } catch (e) {
                  return (e as Error).message;
                }
              },
              onOuvrir: async (phrase) => {
                const ouverture = await ouvrirConservation(phrase);
                if (!ouverture.ok) return ouverture.message;
                setCoffre(ouverture.coffre);
                // Le plan de travail conservé remplace les dossiers fictifs ;
                // un coffre vide laisse la démonstration en place plutôt que
                // de présenter un atelier sans rien dedans.
                if (ouverture.dossiers.length > 0) {
                  setDossiers(ouverture.dossiers);
                  setActif(ouverture.dossiers[0].reference);
                }
                setConservation(etatConservation());
                return null;
              },
              onVerrouiller: () => setCoffre(null),
              onEffacer: () => {
                purger();
                setCoffre(null);
                setConservation(etatConservation());
              },
              onPurgerHeritage: () => {
                purgerHeritage();
                setConservation(etatConservation());
              },
            }}
            niveau1Actif={niveau1Actif}
            onNiveau1={setNiveau1Actif}
            statistiquesCache={cache.statistiques()}
            onViderCache={() => {
              cache.vider();
              setRevision((n) => n + 1);
            }}
            nombreDossiers={dossiers.length}
          />
        )}
    </AtelierShell>
  );
}
