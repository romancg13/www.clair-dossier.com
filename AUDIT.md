# AUDIT — état du dépôt à l'entrée du chantier DEFENSE OS (MASTER PROMPT v4)

*Réalisé le 19 août 2026, avant toute écriture. Chaque constat pointe un
fichier. Les règles citées sont celles de la partie II du mandat v4.*

## 1. Ce que le dépôt contient

Deux produits cohabitent :

1. **Un site vitrine « ClairDossier »** — pages marketing (Home, Pricing,
   Security, Blog, Features, Contact), authentification Supabase, données
   éditoriales (`src/data/`), génération de pages markdown (`public/*.md`),
   scripts Stripe. Sans rapport avec le produit commandé.
2. **Un moteur d'analyse pénale « LDI »** (`src/ldi/`, ~5 300 lignes hors
   tests) — noyau déterministe testé (321 tests au vert), avec : chronologie
   et contradictions, dix contrôles procéduraux, stratégie, pseudonymisation,
   traçabilité des citations en quatre états, ingestion documentaire bornée
   (texte, CSV, docx, xlsx, eml, zip, PDF différé), coffre chiffré WebCrypto,
   cache d'analyse, journal, CLI (`scripts/ldi.ts`), et deux fonctions edge
   Supabase (analyse générative distante, relais Judilibre).

## 2. Écarts avec les règles [B] du mandat v4

| Règle | Constat | Fichier(s) | Traitement |
|---|---|---|---|
| Mandat, en-tête | Traces « ClairDossier » partout : nom de paquet, pages, SEO, domaine, adresses | `package.json`, `index.html`, `src/pages/*`, `src/data/*`, `public/*`, `netlify.toml` | **Suppression** du site vitrine entier |
| B5 | Module « signaux textuels » hérité de l'axe détection-IA | `src/ldi/modules/detection-ia.ts`, section 3 de `pipeline.ts` | **Suppression** (code + types + tests) |
| B7/B8 | Code d'appel API dans le bundle navigateur : client Supabase, invocation des fonctions edge, relais jurisprudence | `src/lib/supabase.ts`, `src/components/ldi/VueSecurite.tsx` (invoke), `src/components/ldi/VueRecherche.tsx`, `src/ldi/jurisprudence.ts` | **Suppression** ; les sources passent par le pack CLI (§9.2) |
| D-3 | Le mode distant (fonctions edge Supabase) est atteignable depuis l'interface | `supabase/functions/*`, `VueSecurite.tsx` | Fonctions edge supprimées ; le mode distant est **reconstruit côté CLI**, désactivé, non atteignable depuis l'interface |
| B10 | `google-site-verification`, URL canoniques externes, RSS | `index.html` | Suppression ; polices déjà embarquées en woff2 (`@fontsource`) — conforme |
| D-1 | L'ingestion accepte docx/xlsx/eml/zip/PDF par défaut | `src/ldi/ingestion/*` | Niveau 0 seul actif (texte collé, `.txt .md .csv .json`) ; PDF natif et formats bureautiques regroupés derrière l'**interrupteur niveau 1**, désactivé par défaut |
| B4 | Conforme : aucun pronostic chiffré (tests existants) | `src/ldi/__tests__/sorties.test.ts` | Conservé, étendu |
| B16/B20 | L'ancrage énoncé→appui existe pour les constats (`sourcePieceId`) mais pas comme contrat de passe généralisé | `src/ldi/modules/*` | Construit au noyau (schéma §3.3) |
| B17 | La neutralisation d'instructions cachées existe côté prompt (`prompt.ts`) mais pas la **détection signalée à l'ingestion** | `src/ldi/ingestion/*` | Ajouté en P0 |
| B9 | La conservation locale est **chiffrée** (coffre AES-GCM), désactivée par défaut, purge en un geste | `src/ldi/coffre.ts`, `stockage.ts` | **Conservé** : satisfait et dépasse B9 (décision consignée) |

## 3. Ce qui est réutilisé tel quel ou étendu

| Actif | Rôle dans DEFENSE OS |
|---|---|
| `src/ldi/journal.ts` (empreinte FNV-1a, sérialisation stable) | Empreintes de documents et fragments (P0), journal M13 |
| `src/ldi/confidentialite.ts` | Pseudonymisation avant toute sortie du poste (mode distant CLI) |
| `src/ldi/tracabilite.ts`, `citations.ts`, `corpus/references.ts` | B1–B3 : index de références, statuts, autorité de citation |
| `src/ldi/modules/chronologie.ts` | M2 — frise et contradictions |
| `src/ldi/modules/nullites.ts` (10 contrôles) | Socle de M3, étendu aux **14 postes** |
| `src/ldi/modules/strategie.ts`, `documents.ts` | M6/M8, étendus (riposte P5, rapport d'ancrage) |
| `src/ldi/ingestion/*` | P0, re-cloisonnée en niveaux D-1 |
| `src/ldi/coffre.ts`, `stockage.ts` | Conservation locale |
| `src/ldi/modules/recherche.ts`, `piste.ts`, CLI `scripts/ldi.ts` | §9.2 — sources officielles côté CLI, pack sources |
| `scripts/build-artifact.mjs` | Base du livrable « fichier ouvert en local » |

## 4. Points de rupture identifiés

1. **`RapportLdi` change de forme** (retrait de `analysesTextuelles`, ajout des
   entités v4) : version de schéma incrémentée, l'import refuse l'inconnu.
2. **Les tests de synchronisation edge** (`prompt-sync.test.ts`) vérifient des
   fichiers supprimés : réécrits pour la nouvelle frontière (rien de PISTE ni
   d'Anthropic dans le bundle navigateur).
3. **`LdiAtelier.tsx` perd `Seo`** et le routage marketing : l'atelier devient
   la racine de l'application.
4. **La palette change** (« Encre et greffe », §8.2) : les composants atelier
   passent du thème crème/or au registre graphite/laiton.

## 5. Code mort supprimé

- « Audit IA adverse » : déjà écarté, il ne restait que la mention motivée en
  barre latérale (`navigation.ts`) — reformulée sans le nom de module.
- `detection-ia.ts` et tout ce qui en dépend (B5).
- Scripts Stripe, générateur de pages marketing, données éditoriales.
