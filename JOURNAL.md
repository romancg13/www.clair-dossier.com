# JOURNAL — passage des étapes (mandat v4, §11.1)

## Étape 1 — Audit
- **Fait** : inventaire complet, écarts B consignés dans `AUDIT.md`, purge du
  site vitrine, de Supabase, du code d'appel API navigateur et du module B5.
- **Volontairement écarté** : renommage du dépôt distant (hors de portée d'une
  session de code).
- **Reste ouvert** : rien — la purge est vérifiée par typecheck + suite.

## Étape 2 — Noyau métier
- **Fait** : modèle de données v4 (`src/noyau/modele.ts`, schéma 3.0) étendant
  le `Dossier` d'analyse ; taxonomie cinq axes ; invariants contrôlés sans
  correction silencieuse ; propagation de grief transitive et cyclable ;
  contrat de passes §3.3 avec ancrage CALCULÉ, jamais déclaré (`passes.ts`) ;
  moteur de délais exposant méthode, entrées et fondement (`delais.ts`).
  16 tests.
- **Volontairement écarté** : réécrire les types d'analyse existants — le
  modèle v4 les étend, il ne les remplace pas (réversible, testé).
- **Reste ouvert** : les entités Document/Fragment arrivent avec P0 (étape 4).

## Étape 3 — Gate d'export (M9)
- **Fait** : `src/noyau/gate.ts` — huit causes de blocage de §10.2, chemin
  exact par anomalie, aucun contournement d'interface. 14 tests, chaque cause
  couverte une à une.
- **Volontairement écarté** : un détecteur « sémantique » de B13/B15 — les
  motifs sont des fils de détente lexicaux, dits comme tels dans le code ; le
  premier rempart reste les instructions de passe.
- **Reste ouvert** : la vérification P6 des références s'étoffera quand le
  pack sources existera (étape 15).

## Étape 4 — M10 / P0 : ingestion par niveaux, fragments, index, B17
- **Fait** : `niveaux.ts` (interrupteur D-1, refus nommés, texte collé),
  `fragments.ts` (texte source intact à l'octet près, cote proposée jamais
  imposée, index plein texte local avec positions), `instructions-cachees.ts`
  (B17 : détection citée et localisée, jamais exécutée ni supprimée),
  `p0.ts` (l'ingestion comme passe, avec sa déclaration). Interrupteur branché
  dans Paramètres, non conservé entre sessions. 15 tests.
- **Volontairement écarté** : supprimer les extracteurs bureautiques — ils
  rejoignent le PDF derrière l'interrupteur (voir DECISIONS.md, étape 1).
- **Reste ouvert** : la vue Documents (alertes B17 à l'écran) arrive avec les
  vues, étape 12.

## Étape 5 — M11 : bibliothèque et consignes permanentes
- **Fait** : `consignes.ts` — consignes cabinet/dossier, versionnées (réviser
  désactive sans supprimer, B21), injection déterministe dans les
  instructions, cloisonnement B18 testé (une consigne de dossier ne fuit pas).
- **Volontairement écarté** : un éditeur de trames complet — les trames sont
  stockées et mentionnées au rapport d'ancrage, l'édition riche viendra après.
- **Reste ouvert** : vue Bibliothèque (étape 12).

## Étape 7 — M3 : grille de régularité, quatorze postes
- **Fait** : `postes.ts` — 14 postes, chacun rendant attendu / présent (ancré)
  / manques (avec geste) / grief envisageable / actes affectés par
  propagation. Jamais de silence : un poste sans matière le DIT. Les contrôles
  horodatés existants (GAV, CTRL, PERQ, PREUVE, PRESC) sont versés, pas
  recalculés. P2 scellée. 7 tests dont couverture 14/14 sur dossier vide.
- **Volontairement écarté** : recalculer dans la grille ce que le module de
  nullités calcule déjà — un calcul, deux lecteurs.
- **Reste ouvert** : M1/M2 écrans (étape 12) ; la frise (étape 13).

## Étape 8 — Couche d'intelligence
- **Fait** : `instructions.ts` (gabarit §6.3, versionné, zéro référence
  juridique en dur — testé), `moteur.ts` (local Ollama refusant toute URL non
  locale À LA CONSTRUCTION ; distant construit avec DEUX verrous cumulatifs
  revalidés à chaque appel, corps d'erreur amont jamais relayé). Frontière
  interface étendue : importer `noyau/moteur` depuis l'interface fait échouer
  la suite. 14 tests.
- **Volontairement écarté** : un état « déverrouillé » du mode distant — le
  consentement ne s'hérite pas d'un appel à l'autre.
- **Reste ouvert** : l'orchestrateur des sept passes se scelle à l'étape 10,
  quand P3/P4/P5 existent.

## Étape 6 — M1/M2 : constitution et délais
- **Fait** : `serialisation.ts` — export/réimport identique (empreinte
  comparée), refus des versions de schéma inconnues, défauts VIDES pour les
  dossiers historiques. Le moteur de délais (M2) était fait à l'étape 2.
- **Volontairement écarté** : une migration automatique de schéma — l'import
  refuse plutôt que deviner.
- **Reste ouvert** : rien.

## Étapes 9-10 — M4/M5 (P3/P4), M6/M7 (P5), orchestrateur
- **Fait** : `preuve.ts` (sept grilles de lecture + filet générique, aucune
  conclusion sur les faits), `qualification.ts` (éléments constitutifs
  fonctionnels par nature, un « présent » sans appui est reclassé),
  `moyens.ts` (ordre procédural imposé, chaque moyen naît avec riposte et
  contre-riposte), `peine.ts` (paramètres et pièces, zéro chiffre),
  `orchestrateur.ts` (P1→P6, déterministe, rejouable, P6 recalcule l'ancrage
  de toutes les sorties). La chaîne tourne sur un dossier VIDE : le mode
  déterministe seul n'est jamais inerte.
- **Volontairement écarté** : brancher un moteur d'inférence DANS la chaîne —
  il n'intervient qu'en aval, sur demande.
- **Reste ouvert** : le rendu des livrables (étape 14) consomme ces sorties.

## Étape 11 — M12/M13 : demandes et journal d'audit
- **Fait** : `demandes.ts` — aucune fonction de suppression n'existe (B21) ;
  une demande partiellement traitée reste ouverte avec ce qui manque ; la
  reprise crée une nouvelle entrée et conserve l'ancienne. `audit.ts` —
  entrées à identifiants et comptes seulement ; testé : le contenu du dossier
  ne fuit pas dans l'export du journal (B11).
- **Volontairement écarté** : un champ de texte libre dans l'entrée de
  journal — c'est par la forme du type que B11 tient.
- **Reste ouvert** : vues Registre et Journal (étape 12).

## Étapes 12-14 — Interface, design « Encre et greffe », livrables
- **Fait** : quatorze vues branchées sur la chaîne (pupitre trois blocs avec
  filtres cinq axes, frise avec propagation des griefs, régularité 14 postes
  dépliables, preuve avec saisie, moyens par catégorie procédurale, écritures
  avec verdict de gate NON contournable et registre document papier,
  registre des demandes, bibliothèque de consignes versionnées, sources avec
  rejets B3 nommés, journal filtrable, minimisation, paramètres). Palette de
  commandes Ctrl+K, mode audience, badge moteur permanent (B19), impression
  limitée à la zone document, animations sous prefers-reduced-motion. Palette
  §8.2 appliquée aux jetons près ; vérifié dans Chromium, captures des vues
  principales.
- **Volontairement écarté** : les vues « tableau de bord » et « dossiers »
  séparées — le pupitre les absorbe. Undo/redo global : la saisie passe par
  des formulaires courts, réversibles par l'édition ; consigné comme limite.
- **Reste ouvert** : brancher la sortie generative CLI dans l'écran (jamais —
  D-3) ; l'export fichier des livrables passe par copier/imprimer.
