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
