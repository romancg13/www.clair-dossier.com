/**
 * L'atelier Defense OS — l'application entière.
 *
 * ┌─ CE QUI NE QUITTE PAS CETTE PAGE ───────────────────────────────────────┐
 * │ Tout s'exécute dans le navigateur, hors ligne. Les dossiers vivent en    │
 * │ mémoire de session ; ils ne touchent le disque que par le coffre chiffré │
 * │ (Paramètres), et l'écran le dit. L'atelier n'émet AUCUNE requête (B7) et │
 * │ ne contient aucun code d'appel d'API (B8) — un test le balaie.           │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { AtelierShell } from '../components/ldi/AtelierShell';
import { PaletteCommandes } from '../components/ldi/PaletteCommandes';
import { VueBibliotheque } from '../components/ldi/VueBibliotheque';
import { VueDepot } from '../components/ldi/VueDepot';
import { VueDocuments } from '../components/ldi/VueDocuments';
import { VueEcritures } from '../components/ldi/VueEcritures';
import { VueFrise } from '../components/ldi/VueFrise';
import { VueJournal } from '../components/ldi/VueJournal';
import { VueMoyens } from '../components/ldi/VueMoyens';
import { VuePreuve } from '../components/ldi/VuePreuve';
import { VuePupitre } from '../components/ldi/VuePupitre';
import { VueRegistre } from '../components/ldi/VueRegistre';
import { VueRegularite } from '../components/ldi/VueRegularite';
import { VueSources } from '../components/ldi/VueSources';
import { VueConfidentialite, VueParametres } from '../components/ldi/VueSecurite';
import { vueValide, type Vue } from '../components/ldi/navigation';
import { creerCacheAnalyse } from '../ldi/cache';
import { creerCacheChaine } from '../ldi/cache-chaine';
import { DOSSIERS_DEMONSTRATION, EXTENSIONS_DEMONSTRATION, estDemonstration } from '../ldi/demonstration';
import { empreinte } from '../ldi/journal';
import type { Dossier } from '../ldi/types';
import {
  bibliothequeVide,
  creerConsigne,
  consignesApplicables,
  reviserConsigne,
  type Bibliotheque,
} from '../noyau/consignes';
import { creerDemande, traiterDemande, verifierDemande } from '../noyau/demandes';
import { completerDossierPenal, type Demande, type DossierPenal, type ElementPreuve } from '../noyau/modele';
import type { DocumentIngere } from '../noyau/p0';
import type { SourceRecuperee } from '../noyau/sources';
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

function dossierDemonstration(base: Dossier): DossierPenal {
  return completerDossierPenal(base, EXTENSIONS_DEMONSTRATION[base.reference] ?? {});
}

export function LdiAtelier() {
  const [params, setParams] = useSearchParams();
  const vue = vueValide(params.get('vue'));

  // La chaîne P1→P6 est mémorisée par empreinte de dossier ; son journal
  // d'audit est commun à la session — chaque passe s'y consigne (M13).
  const cacheChaine = useRef(creerCacheChaine()).current;
  // Le rapport markdown (pipeline d'analyse) sert la minimisation.
  const cacheRapport = useRef(creerCacheAnalyse()).current;

  const [dossiers, setDossiers] = useState<DossierPenal[]>(() =>
    DOSSIERS_DEMONSTRATION.map(dossierDemonstration)
  );
  const [actif, setActif] = useState<string | null>(() => DOSSIERS_DEMONSTRATION[0]?.reference ?? null);
  const [coffre, setCoffre] = useState<CoffreOuvert | null>(null);
  const [conservation, setConservation] = useState<EtatConservation>(() => etatConservation());
  const [niveau1Actif, setNiveau1Actif] = useState(false);
  const [modeAudience, setModeAudience] = useState(false);
  const [bibliotheque, setBibliotheque] = useState<Bibliotheque>(bibliothequeVide);
  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [sources, setSources] = useState<SourceRecuperee[]>([]);
  const [sourcesRejetees, setSourcesRejetees] = useState<{ identifiant: string; motif: string }[]>([]);
  const [documentsParDossier, setDocumentsParDossier] = useState<Record<string, DocumentIngere[]>>({});
  const [revisionJournal, setRevisionJournal] = useState(0);

  const maintenant = useMemo(() => new Date().toISOString(), []);

  // Une exécution de chaîne par état de dossier — le cache rend le pupitre
  // praticable au-delà de deux dossiers.
  const lignes = useMemo(
    () => dossiers.map((d) => ({ dossier: d, chaine: cacheChaine.executer(d) })),
    [dossiers, cacheChaine]
  );
  const ligneActive = lignes.find((l) => l.dossier.reference === actif) ?? null;
  const chaineActive = ligneActive?.chaine ?? null;

  const demonstration = dossiers.length > 0 && dossiers.every((d) => estDemonstration(d.reference));
  const consignesActives = useMemo(
    () => (actif ? consignesApplicables(bibliotheque, actif) : bibliotheque.consignes.filter((c) => c.active && c.portee === 'cabinet')),
    [bibliotheque, actif]
  );

  // Scelle à chaque changement, mais uniquement si le coffre est ouvert dans
  // cette session. Sans clé, rien n'est écrit — aucun repli en clair (B9+).
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

  /** Ajoute un dossier, en remplaçant un homonyme ; chasse la démonstration. */
  function ajouterDossier(nouveau: DossierPenal) {
    setDossiers((liste) => [
      ...liste.filter((d) => d.reference !== nouveau.reference && !estDemonstration(d.reference)),
      nouveau,
    ]);
    setActif(nouveau.reference);
  }

  /** Mute le dossier actif — chaque geste passe par ici, immuablement. */
  function modifierActif(muter: (d: DossierPenal) => DossierPenal) {
    if (!actif) return;
    setDossiers((liste) => liste.map((d) => (d.reference === actif ? muter(d) : d)));
  }

  return (
    <>
      <PaletteCommandes
        dossiers={dossiers.map((d) => d.reference)}
        onVue={allerA}
        onActif={(r) => setActif(r)}
        onRecherche={() => allerA('documents')}
      />

      <AtelierShell
        vue={vue}
        onVue={allerA}
        references={dossiers.map((d) => d.reference)}
        actif={actif}
        onActif={setActif}
        demonstration={demonstration}
        modeAudience={modeAudience}
        onModeAudience={setModeAudience}
      >
        {vue === 'pupitre' && (
          <VuePupitre
            lignes={lignes}
            demandes={demandes}
            maintenant={maintenant}
            onActif={setActif}
            onVue={allerA}
          />
        )}

        {vue === 'depot' && (
          <VueDepot
            referenceProposee={`CAB-${new Date().getFullYear()}-001`}
            niveau1Actif={niveau1Actif}
            onDossier={(nouveau, documents) => {
              const penal = completerDossierPenal(nouveau, { avancement: 'controle' });
              ajouterDossier(penal);
              setDocumentsParDossier((etat) => ({ ...etat, [penal.reference]: documents }));
              cacheChaine.journal.consigner({
                action: 'dépôt de pièces',
                passe: 'P0',
                moteur: { type: 'deterministe', modele: null },
                entrees: documents.map((d) => d.id),
                sorties: [`documents:${documents.length}`],
                blocages: [],
              });
              setRevisionJournal((n) => n + 1);
              allerA('documents');
            }}
          />
        )}

        {vue === 'documents' && <VueDocuments documents={actif ? (documentsParDossier[actif] ?? []) : []} />}

        {vue === 'frise' && <VueFrise dossier={ligneActive?.dossier ?? null} chaine={chaineActive} />}
        {vue === 'regularite' && <VueRegularite postes={chaineActive?.postes ?? null} />}
        {vue === 'preuve' && (
          <VuePreuve
            dossier={ligneActive?.dossier ?? null}
            analyses={chaineActive?.preuves ?? null}
            onAjouter={(element) =>
              modifierActif((d) => ({
                ...d,
                preuves: [...d.preuves, { ...element, id: `pr-${empreinte(`${d.reference}|${element.type}|${d.preuves.length}`).slice(0, 8)}` } as ElementPreuve],
              }))
            }
          />
        )}
        {vue === 'moyens' && (
          <VueMoyens moyens={chaineActive?.moyens ?? null} incomplets={chaineActive?.moyensIncomplets ?? null} />
        )}

        {vue === 'ecritures' && (
          <VueEcritures
            chaine={chaineActive}
            sources={sources}
            consignes={consignesActives}
            trames={bibliotheque.trames}
            onGeneration={(type, autorise) => {
              cacheChaine.journal.consigner({
                action: `génération livrable ${type}`,
                passe: 'P6',
                moteur: { type: 'deterministe', modele: null },
                entrees: consignesActives.map((c) => c.id),
                sorties: [`livrable:${type}`, `export:${autorise ? 'autorisé' : 'bloqué'}`],
                blocages: autorise ? [] : [`gate:${type}`],
              });
              setRevisionJournal((n) => n + 1);
            }}
          />
        )}

        {vue === 'registre' && (
          <VueRegistre
            demandes={demandes}
            dossierActif={actif}
            onCreer={(enonce) => {
              if (!actif) return;
              let demande = creerDemande(actif, enonce);
              // La chaîne tourne à chaque rendu : la demande est immédiatement
              // rattachée à la dernière exécution, puis laissée à vérifier.
              demande = traiterDemande(demande, {
                passes: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'],
                sortieId: `chaine-${empreinte(actif).slice(0, 8)}`,
              });
              setDemandes((liste) => [...liste, { ...demande, etat: 'a-verifier' }]);
            }}
            onClore={(id) =>
              setDemandes((liste) => liste.map((d) => (d.id === id ? verifierDemande(d) : d)))
            }
          />
        )}

        {vue === 'bibliotheque' && (
          <VueBibliotheque
            bibliotheque={bibliotheque}
            dossierActif={actif}
            onConsigne={(enonce, portee) =>
              setBibliotheque((b) => ({
                ...b,
                consignes: [...b.consignes, creerConsigne(enonce, portee, { dossierReference: actif ?? undefined })],
              }))
            }
            onReviser={(id, enonce) => setBibliotheque((b) => reviserConsigne(b, id, enonce))}
            onTrame={(intitule, type, corps) =>
              setBibliotheque((b) => ({
                ...b,
                trames: [...b.trames, { id: `t-${empreinte(intitule + corps).slice(0, 8)}`, intitule, type, corps, ajouteeLe: new Date().toISOString() }],
              }))
            }
          />
        )}

        {vue === 'sources' && (
          <VueSources
            sources={sources}
            rejetees={sourcesRejetees}
            onImport={(importees, rejetees) => {
              setSources(importees);
              setSourcesRejetees(rejetees);
              cacheChaine.journal.consigner({
                action: 'import pack de sources',
                passe: null,
                moteur: { type: 'deterministe', modele: null },
                entrees: importees.map((s) => s.identifiant),
                sorties: [`sources:${importees.length}`, `rejetees:${rejetees.length}`],
                blocages: [],
              });
              setRevisionJournal((n) => n + 1);
            }}
          />
        )}

        {vue === 'journal' && (
          // `revisionJournal` force le rendu : le journal est interne au cache.
          <VueJournal key={revisionJournal} entrees={cacheChaine.journal.entrees()} />
        )}

        {vue === 'confidentialite' && (
          <VueConfidentialite rapport={ligneActive ? cacheRapport.analyser(ligneActive.dossier) : null} />
        )}

        {vue === 'parametres' && (
          <VueParametres
            conservation={conservation}
            coffreOuvert={coffre !== null}
            actionsCoffre={{
              onActiver: async (phrase) => {
                try {
                  const reels = dossiers.filter((d) => !estDemonstration(d.reference));
                  const { coffre: neuf, etat } = await activerConservation(phrase, reels, new Date().toISOString());
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
                if (ouverture.dossiers.length > 0) {
                  const penals = ouverture.dossiers.map((d) => completerDossierPenal(d, d as never));
                  setDossiers(penals);
                  setActif(penals[0].reference);
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
            statistiquesCache={cacheRapport.statistiques()}
            onViderCache={() => {
              cacheChaine.vider();
              cacheRapport.vider();
            }}
            nombreDossiers={dossiers.length}
          />
        )}
      </AtelierShell>
    </>
  );
}
