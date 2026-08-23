# Audit PHASE 0 — Inventaire CONTENU & STRUCTURE des pages publiques (marketing)

- Projet : ClairDossier — https://www.clair-dossier.com
- Dépôt audité (lecture seule) : `/Users/Roman_784/Documents/Codex/2026-07-02/contrainte-absolue-ne-pas-toucher-aux/work/www.clair-dossier.com`
- Date de l'audit : 2026-08-23
- Méthode : lecture intégrale des fichiers listés dans la mission + `src/App.tsx` (routes), `src/components/RequireAuth.tsx` (garde d'auth), extraits de `src/data/pricing.ts` (3 plans affichés sur la Home), en-tête de `src/components/primitives/Reveal.tsx` (animations). Un `grep` transverse sur `src/` a servi uniquement à localiser coordonnées/identités. Aucun fichier modifié, aucun `.env` lu, aucune commande git d'écriture.
- Tous les chemins ci-dessous sont relatifs à la racine du dépôt. Les citations sont reproduites à l'identique du code source.

> Périmètre explicitement NON lu (donc non décrit) : `src/components/Nav.tsx`, `src/components/Footer.tsx` (sauf 1 ligne remontée par grep), `src/components/Layout.tsx`, `src/pages/Pricing.tsx` (sauf lignes remontées par grep), `src/pages/LegalPage.tsx`, `src/data/legal.ts` (sauf lignes remontées par grep), `src/lib/seo.tsx`, corps complet des 7 articles de blog (seuls les en-têtes ont été lus, plus un `grep cite:`).

---

## 0. Routes publiques (contexte) — `src/App.tsx`

| Route | Page | Garde d'auth | Référence |
|---|---|---|---|
| `/` | `Home` (chargée en eager) | non | `src/App.tsx:50` |
| `/fonctionnalites` | `FeaturesIndex` | non | `src/App.tsx:51-58` |
| `/fonctionnalites/:slug` | `FeatureDetail` | non | `src/App.tsx:59-66` |
| `/tarifs` | `Pricing` (hors périmètre de ce rapport) | non | `src/App.tsx:67-74` |
| `/securite` | `Security` | non | `src/App.tsx:75-82` |
| `/blog` | `BlogIndex` | non | `src/App.tsx:83-90` |
| `/blog/:slug` | `BlogPost` | non | `src/App.tsx:91-98` |
| `/contact` | `Contact` | non | `src/App.tsx:99-106` |
| `/dossier/nouveau` | `DossierFlow` | **oui** (`RequireAuth`) | `src/App.tsx:107-116` |
| `/inscription`, `/connexion` | `Signup`, `Login` | non | `src/App.tsx:117-132` |
| `/compte`, `/compte/dossier/:id` | `Account`, `DossierDetail` | oui | `src/App.tsx:133-152` |
| `/mentions-legales`, `/cgv`, `/politique-confidentialite`, `/cookies` | `LegalPage` | non | `src/App.tsx:153-184` |
| `*` | `NotFound` | non | `src/App.tsx:185-192` |

Comportement de `RequireAuth` (`src/components/RequireAuth.tsx:25-28`) : si l'auth est configurée et qu'il n'y a pas de session, redirection vers `/connexion?next=<chemin encodé>`. Si l'auth n'est pas configurée (build sans variables d'env), la page est rendue sans blocage (`src/components/RequireAuth.tsx:24`). Conséquence : tous les CTA « Créer un dossier » du site public pointent vers une route protégée.

Stack (`package.json`) : React 19 (`:20`), react-router-dom ^7.1.0 (`:22`), motion ^11.15.0 (`:19`), @supabase/supabase-js ^2.108.2 (`:17`), Vite 6 (`:33`).

---

## 1. HOME — `src/pages/Home.tsx`

### 1.1 Métadonnées SEO (`src/pages/Home.tsx:45-50`)

| Élément | Valeur exacte | Réf. |
|---|---|---|
| `<title>` | `ClairDossier — Votre dossier juridique, clair, structuré et suivi` | `Home.tsx:46` |
| meta description | `ClairDossier transforme les demandes juridiques en dossiers structurés et suivis. Plateforme legaltech française pour clients, PME et cabinets d'avocats.` | `Home.tsx:47` |
| JSON-LD | `orgSchema`, `websiteSchema` (définis dans `src/lib/seo.tsx`, non lu), `softwareSchema`, `faqSchema` | `Home.tsx:49` |
| `softwareSchema` | `@type: SoftwareApplication`, `name: ClairDossier`, `applicationCategory: LegalService`, `operatingSystem: Web`, offre `price: "19"`, `priceCurrency: EUR`, description offre `Création de compte gratuite, abonnement à partir de 19 €/mois HT.` ; description : `Plateforme legaltech française. Transforme les demandes juridiques en dossiers structurés, suivis et transmis sur validation de l'utilisateur.` | `Home.tsx:15-30` |
| `faqSchema` | `FAQPage` construit à partir de `homeFaq` (8 questions, voir §3.4) | `Home.tsx:32-40` |

### 1.2 Sections dans l'ordre de montage (`src/pages/Home.tsx:51-61`)

| # | Composant | Fichier | Kicker (surtitre mono) | H2 / titre exact | Contenu résumé | CTA (libellé exact → destination) | Animations |
|---|---|---|---|---|---|---|---|
| 1 | `Hero` | `src/components/sections/Hero.tsx` | `Legaltech pour PME · artisans · indépendants` (`:44`) | **H1** (voir 1.3) | H1 + sous-titre + 2 CTA + 3 « fact pills » + carte d'aperçu de dossier à droite | `Créer un dossier` → `/dossier/nouveau` (`:88-99`) ; `Demander une démo` → `/contact` (`:100-105`) | Kicker/sous-titre/CTA/pills : fade + translateY 8→0, délais 0 / 0.5 / 0.7 / 0.9 s (`:38-41, 70-73, 82-85, 108-111`). H1 : `SplitWords` stagger 0.06 s, durée 0.85 s (`:48-67`) + `MarkerHighlight` (surlignage) sur « clair, », « structuré », « suivi. » avec délais 0.6 / 0.85 / 1.1 s (`:55-62`). Carte : slide-in x 16→0 (`:124-126`) puis flottement vertical y [0,-6,0] en boucle 8 s (`:130-135`) ; point d'étape active pulsant scale [1,1.4,1] sur 1.8 s en boucle (`:199-217`). Tout désactivé si `prefers-reduced-motion` (`useReducedMotion`, `:24`). |
| 2 | `AvantApres` | `src/components/sections/AvantApres.tsx` | `Avant ClairDossier` (`:28`) / `Avec ClairDossier` (`:70`) | Deux H2 : `Le dossier vit dans le désordre.` (`:31`) et `Le dossier vit dans l'ordre.` (`:73`) | Deux colonnes de 5 puces chacune (voir 1.5) séparées par une flèche verticale dorée (desktop) | aucun | `Reveal` section (fade + y 18→0, 0.55 s, au scroll, une fois) |
| 3 | `FeaturesGrid` | `src/components/sections/FeaturesGrid.tsx` | `Fonctionnalités` (`:14`) | `Huit briques pour structurer un dossier juridique.` (`:17`) | Paragraphe `Chaque brique répond à un point de friction identifié auprès de cabinets et de services juridiques français. Aucune n'est décorative.` (`:20-21`) ; grille 4 colonnes itérant sur **toutes** les entrées de `features` (9 entrées — voir §3.1 et §7) avec icône, `shortTitle` (H3), `blurb` | `Voir` → `/fonctionnalites/{slug}` sur chaque carte (`:44-50`) | `Reveal` + `Stagger`/`StaggerItem` en vue (`:25`) ; `whileHover: y -4` sur chaque carte (`:31`) |
| 4 | `WorkspacesTabs` | `src/components/sections/WorkspacesTabs.tsx` | `Espaces dédiés` (`:20`) | `Un même dossier, trois lectures différentes.` (`:23`) | Paragraphe `Chaque acteur du dossier accède aux informations utiles à sa décision — jamais plus, jamais moins.` (`:26-27`) ; composant `Tabs` (`defaultId="client"`, `:33`) sur les 3 `workspaces` (§3.3) : H3 = `workspace.title`, description, liste `capabilities`, mockup (kicker/titre/lignes dl/footnote) | aucun | `Reveal` section ; fond navy avec dégradés radiaux dorés (`:9-16`) |
| 5 | `Workflow` | `src/components/sections/Workflow.tsx` | `Workflow` (`:25`) | `Six statuts. Aucun « entre-deux ».` (`:28`) | Paragraphe `Chaque dossier traverse les mêmes six états. Vous savez où en est votre dossier sans avoir à demander, et ce qu'il reste à faire sans avoir à chercher.` (`:31-33`) ; frise horizontale 6 colonnes (desktop, `:38-57`) ou liste verticale numérotée (mobile, `:60-79`) itérant sur `statuses` (§3.2) : `Étape 01…06`, `label` (H3), `description` | aucun | `Reveal` ; ligne dorée horizontale dont `scaleX` est lié au scroll (`useScroll` offset `["start 80%","end 30%"]`, `:14-18, 46-50`) ; désactivé en reduced motion |
| 6 | `DossierLifecycle` | `src/components/sections/DossierLifecycle.tsx` | `Cycle de vie du dossier` (`:58`) | `De la création du dossier au contentieux.` (`:61`) | Paragraphe (`:64-67`) : `ClairDossier permet de créer un dossier, ajouter les documents, suivre les échéances, gérer la facture, préparer les relances et regrouper les pièces utiles en cas d'impayé ou de contentieux. Le dossier peut aussi servir à transmettre les pièces au comptable ou à un professionnel du droit.` ; 5 cartes `STEPS` (`:11-37`, voir 1.6) ; encart `Documents liés au personnel` (H3, `:99`) avec 10 pastilles `PERSONNEL` (`:39-50`) ; 2 encarts `Comptable` (`:117-123`) et `Professionnel du droit` (`:127-133`) | aucun | `Reveal` + `Stagger` en vue |
| 7 | `SecurityBlock` | `src/components/sections/SecurityBlock.tsx` | `Sécurité & conformité` (`:53`) | `La sécurité juridique commence par la sécurité technique.` (`:56`) | 6 cartes `TRUST` (`:13-44`, voir 1.7) | `Charte complète` → `/securite` (`:59-65`) | `Reveal` + `Stagger` en vue |
| 8 | `PricingPreview` | `src/components/sections/PricingPreview.tsx` | `Tarifs` (`:18`) | `Une formule par usage. Pas de surprise.` (`:21`) | Paragraphe `Sept formules, de l'indépendant à l'entreprise. Compte gratuit, abonnement sans engagement — et 10 % de réduction en facturation annuelle.` (`:24-25`) ; 3 cartes compactes pour les plans `essentiel`, `business-pme-20`, `business-pme-pro` (`:7-10`) affichant `audience`, `name`, `description`, prix `/mois` (`formatEuro`), 3 specs (dossiers/utilisateurs/support), badge éventuel | Par carte : `plan.ctaLabel` → `plan.ctaHref` (`:117-122`) soit 3 × `S'abonner` → liens Stripe (voir §4) ; sous la grille : `Voir les 7 formules et le détail` → `/tarifs` (`:38-44`) | `Reveal` + `Stagger` en vue |
| 9 | `BlogPreview` | `src/components/sections/BlogPreview.tsx` | `Journal` (`:17`) | `Trois lectures pour comprendre où on se situe.` (`:20`) | Grille 3 colonnes itérant sur **tous** les `blogPosts` (7 articles, pas 3 — voir §7) : vignette dégradé navy/or, `category`, date fr-FR + `readMinutes`, `title` (H3), `summary` | `Tout le journal` → `/blog` (`:23-29`) ; chaque carte est un lien → `/blog/{slug}` avec le libellé `Lire l'article` (`:35-37, 71`) | `Reveal` + `Stagger` en vue |
| 10 | `FaqBlock` | `src/components/sections/FaqBlock.tsx` | `Foire aux questions` (`:11`) | `Huit questions qui reviennent.` (`:14`) | `Accordion` sur `homeFaq` (8 entrées, §3.4) | aucun | `Reveal` |
| 11 | `FinalCTA` | `src/components/sections/FinalCTA.tsx` | `Passez à l'usage` (`:27`) | `Prêt à transformer vos dossiers ?` (`:30`) | Paragraphe (`:33-35`) : `Vous pouvez commencer seul, en cinq minutes, ou demander une démo pour explorer l'outil avec votre équipe. Les deux chemins mènent au même endroit — un dossier juridique propre, validé par un professionnel.` | `Créer un dossier` → `/dossier/nouveau` (`:38-44`) ; `Réserver une démo` → `/contact` (`:45-50`) | `Reveal` ; fond navy, filets dorés haut/bas (`:8-15`), halo radial (`:16-23`) |

Mécanique d'animation partagée (`src/components/primitives/Reveal.tsx:1-60`) : `Reveal` = fade + translateY (18 px par défaut) → 0 en 0.55 s, easing `[0.16,1,0.3,1]`, déclenché une seule fois à l'entrée dans le viewport avec marge 240 px (`:14`), avec un fallback forçant l'affichage après 900 ms (`:9, 37-40`) ; rendu sans animation si `prefers-reduced-motion` (`:42-44`). `Stagger`/`StaggerItem` (non lus en détail) sont importés du même fichier.

### 1.3 Hero — H1 et sous-titre (texte exact)

- **H1** (`src/components/sections/Hero.tsx:47-68`, prop `text` ligne 64) :
  `Votre dossier administratif et juridique, clair, structuré et suivi.`
  Les mots `clair,`, `structuré`, `suivi.` sont enveloppés dans `MarkerHighlight` (surlignage animé) (`:55-62`).
- **Surtitre** (`:44`) : `Legaltech pour PME · artisans · indépendants`
- **Sous-titre** (`:76-79`) :
  `Créez des dossiers administratifs et juridiques structurés : déposez vos pièces dans un espace privé, suivez l'avancement et vos échéances, puis transmettez quand vous le décidez. Pour les PME, artisans, entreprises individuelles et professions libérales.`
- **Fact pills** (`:114-116`) : `Suivi étape par étape` · `Pièces chiffrées` · `Conçu pour le RGPD`

### 1.4 Hero — contenu de la « hero card » (`src/components/sections/Hero.tsx:121-262`)

| Zone | Texte exact | Réf. |
|---|---|---|
| `aria-label` de l'aside | `Aperçu dossier ClairDossier` | `:122` |
| Badge haut-gauche | `Exemple` | `:140` |
| Indicateur haut-droite | `Actif` (point doré) | `:146` |
| Ligne mono | `Aperçu · exemple de dossier · #CD-2026-0421` | `:151` |
| **H2** de la carte | `Dossier prud'homal — synthèse` | `:156` |
| Badge statut | `En attente validation` | `:159` |
| `dl` ligne 1 | `Statut` → `Validation pro (option)` (ton gold) | `:8` |
| `dl` ligne 2 | `Pièces déposées` → `7 / 9` | `:9` |
| `dl` ligne 3 | `Chronologie` → `4 évènements datés` | `:10` |
| `dl` ligne 4 | `Validation` → `Sous 24 h ouvrées` (ton navy) | `:11` |
| Label frise | `Avancement` | `:187` |
| Étapes de la frise (`timelineSteps`) | `Brouillon` (done) · `Complété` (done) · `Attente` (done) · `Validation` (**active**) · `Validé` (pending) · `Archivé` (pending) | `:14-21` |
| Mobile | `Étape 4 / 6` + label actif `Validation` | `:233-242` |

Observation factuelle : les labels de la frise de la carte (`Attente`, `Validation`) ne correspondent pas aux labels de `src/data/statuses.ts` (`Transmis`, `En cours`) utilisés par la section Workflow (voir §3.2, §7).

### 1.5 AvantApres — puces exactes (`src/components/sections/AvantApres.tsx`)

**AVANT** (`:4-10`) :
1. `Pièces dispersées dans 4 emails, 2 fils WhatsApp et un dossier carton.`
2. `Chronologie reconstituée à la main avant chaque consultation, recommencée à chaque rebondissement.`
3. `Le client ignore où en est son dossier — il appelle pour demander.`
4. `L'avancement est dans votre tête ou sur un coin de table, pas dans un système.`
5. `Validation par mail informel, signature scannée, conservation aléatoire.`

**AVEC** (`:12-18`) :
1. `Pièces déposées une fois dans un espace privé sécurisé, consultables et téléchargeables.`
2. `Avancement suivi sur 5 étapes métier claires, avec les échéances réunies au même endroit.`
3. `Vous consultez l'avancement de votre dossier à tout moment, depuis votre espace.`
4. `Tous vos dossiers réunis dans un espace privé, isolés et accessibles par vous seul.`
5. `Rien ne part sans votre validation : transmission par e-mail ou WhatsApp, quand vous le décidez.`

### 1.6 DossierLifecycle — 5 étapes et encarts (`src/components/sections/DossierLifecycle.tsx`)

| Étape | Label | Corps | Réf. |
|---|---|---|---|
| 01 | `Création du dossier` | `On ouvre un dossier pour un client, un chantier ou une affaire, et on y rattache tout ce qui s'y rapporte.` | `:12-16` |
| 02 | `Devis, contrat ou accord` | `Devis signé, contrat, bon de commande ou simple accord écrit : la base de la relation est posée et conservée.` | `:17-21` |
| 03 | `Suivi du dossier` | `Documents ajoutés au fil de l'eau, échéances calées, relances préparées à date. On voit où en est chaque dossier.` | `:22-26` |
| 04 | `Facture et paiement` | `La facture est rattachée au dossier, le paiement est suivi, et les justificatifs restent regroupés au même endroit.` | `:27-31` |
| 05 | `Option impayé / pré-contentieux` | `En cas d'impayé, on regroupe les pièces utiles et on prépare un dossier clair, prêt à être transmis si besoin.` | `:32-36` |

Pastilles `PERSONNEL` (`:39-50`) : `Contrat de travail`, `DPAE`, `Fiche de poste`, `Planning`, `Bulletins de paie`, `Congés et absences`, `Arrêts maladie`, `Notes de frais`, `Documents de fin de contrat`, `Autre document RH`.

Encart `Comptable` (`:119-122`) : `ClairDossier permet également de regrouper les pièces utiles à transmettre au comptable : factures, devis, justificatifs de paiement, documents administratifs et pièces liées au personnel.`
Encart `Professionnel du droit` (`:129-132`) : `En cas d'impayé ou de contentieux, ClairDossier aide à préparer un dossier clair pouvant être transmis à un avocat, un commissaire de justice, un notaire ou tout autre professionnel compétent.`

### 1.7 SecurityBlock — 6 cartes `TRUST` (`src/components/sections/SecurityBlock.tsx:13-44`)

| Titre | Corps | Réf. |
|---|---|---|
| `Hébergeur conforme RGPD` | `Vos données sont hébergées chez un sous-traitant conforme au RGPD. Aucune lecture ni exploitation automatique de vos pièces.` | `:14-18` |
| `Chiffrement en transit et au repos` | `Tous les échanges passent en HTTPS. Vos pièces et données sont chiffrées au repos côté hébergeur.` | `:19-23` |
| `Vos droits RGPD` | `Accès, export et suppression de vos données sur demande, via le contact ou votre espace. Traitement sous 30 jours.` | `:24-28` |
| `Vous gardez la main` | `Rien ne quitte votre espace sans votre validation. La transmission d'un dossier par e-mail ou WhatsApp est déclenchée par vous.` | `:29-33` |
| `Stockage privé des pièces` | `Vos documents sont déposés dans un espace privé. Le téléchargement passe par des liens signés temporaires.` | `:34-38` |
| `Isolation par utilisateur` | `Chaque compte ne voit que ses propres dossiers. L'accès est protégé par authentification et isolé entre utilisateurs.` | `:39-43` |

### 1.8 PricingPreview — 3 plans affichés (`src/data/pricing.ts`, extraits)

| Plan id | `audience` | `name` | `description` | Prix | Badge | Specs | CTA | Réf. |
|---|---|---|---|---|---|---|---|---|
| `essentiel` | `Indépendant / EI` | `Essentiel` | `Pour les indépendants et entrepreneurs individuels qui structurent leurs premiers dossiers.` | 19 €/mois | — | `5 dossiers` · `1 utilisateur` · `Support email` | `S'abonner` → `https://buy.stripe.com/00w9AT9Qm7fJ4vbeSibV605` | `pricing.ts:37-51` |
| `business-pme-20` | `TPE / PME` | `Business PME 20` | `Pour les TPE/PME avec plusieurs dossiers récurrents et une petite équipe.` | 49 €/mois | `Populaire` | `20 dossiers` · `5 utilisateurs` · `Support prioritaire` | `S'abonner` → `https://buy.stripe.com/5kQaEX7IeeIb4vb11sbV607` | `pricing.ts:91-105` |
| `business-pme-pro` | `PME / multi-sites` | `Business / PME Pro` | `Pour les structures multi-collaborateurs avec statistiques et workflows avancés.` | 169 €/mois | `Recommandé` | `Dossiers illimités` · `15 utilisateurs` · `Support dédié` | `S'abonner` → `https://buy.stripe.com/5kQbJ1e6C7fJ6DjdOebV609` | `pricing.ts:145-159` |

Note : `PricingPreview.tsx:117-122` utilise `<Link to={plan.ctaHref}>` (react-router) avec une URL Stripe absolue. Le `ctaHrefYearly` (`pricing.ts:46, 100, 154` — lu via extrait) n'est pas utilisé sur la Home. Le comportement exact du `Link` react-router 7 avec une URL externe n'a pas été vérifié à l'exécution.

---

## 2. Autres pages publiques

### 2.1 `/fonctionnalites` — `src/pages/FeaturesIndex.tsx`

| Élément | Contenu | Réf. |
|---|---|---|
| SEO title | `Fonctionnalités` | `:20` |
| SEO description | `Les neuf briques ClairDossier : création de dossier guidée en 5 étapes, dépôt de pièces sécurisé, suivi de l'avancement, échéances, transmission par e-mail ou WhatsApp validée par vous, espace privé conforme RGPD.` | `:21` |
| JSON-LD | breadcrumb `Accueil > Fonctionnalités` + un schéma `Service` par feature (`serviceType`/`name` = `title`, `description` = `blurb`, provider `ClairDossier`) | `:7-14, 23-29` |
| Kicker | `Fonctionnalités` | `:37` |
| **H1** | `Neuf briques, un dossier administratif et juridique propre.` | `:40` |
| Sous-titre | `Chaque fonctionnalité a été conçue pour traiter un point de friction identifié dans des dossiers réels — pas pour cocher une case dans un comparatif. Vous pouvez les découvrir dans l'ordre ou attaquer celle qui vous parle d'abord.` | `:43-46` |
| Section grille | 3 colonnes, une carte-lien par feature (icône, H2 = `f.title`, `f.blurb`), libellé `Lire la fiche` | `:53-88` |
| Section CTA bas (fond navy) | H2 `Plutôt voir en pratique ?` ; texte `Trente minutes de démo. Pas de slide marketing — on ouvre directement un dossier type avec vous.` | `:91-102` |
| CTA | `Demander une démo` → `/contact` (`:104-110`) ; `Créer un dossier maintenant` → `/dossier/nouveau` (`:111-116`) | |
| Formulaires | aucun | |

### 2.2 `/fonctionnalites/:slug` — `src/pages/FeatureDetail.tsx`

| Élément | Contenu | Réf. |
|---|---|---|
| Résolution | `getFeatureBySlug(slug)` ; si inconnu → rend `<NotFound />` | `:10-12` |
| SEO | title = `feature.title`, description = `feature.blurb`, breadcrumb 3 niveaux + schéma `Service` | `:19-38` |
| Fil d'ariane | `Accueil` (→ `/`) / `Fonctionnalités` (→ `/fonctionnalites`) / `shortTitle` | `:41-49` |
| Kicker | `Fonctionnalité · {shortTitle}` | `:59` |
| **H1** | `{feature.title}` | `:61-63` |
| Accroche (italique display) | `{feature.hero}` | `:64-66` |
| Corps | un `<p>` par entrée de `feature.body` | `:74-78` |
| Aside `Concrètement` | liste `feature.bullets` + CTA | `:79-98` |
| CTA aside | `Essayer maintenant` → `/dossier/nouveau` | `:91-97` |
| Section `Autres briques utiles.` (H2) | 3 premières features ≠ courante (`features.filter(...).slice(0,3)`, donc toujours les 3 premières de la liste) ; lien `Toutes les fonctionnalités` → `/fonctionnalites` ; cartes → `/fonctionnalites/{slug}` | `:15, 103-134` |
| Formulaires | aucun | |

### 2.3 `/securite` — `src/pages/Security.tsx`

| Élément | Contenu | Réf. |
|---|---|---|
| SEO title | `Sécurité &amp; conformité` (entité HTML dans l'attribut JSX) | `:81` |
| SEO description | `Chiffrement en transit et au repos, isolation des données par utilisateur, stockage privé des pièces et hébergeur conforme RGPD. Les engagements sécurité de ClairDossier.` | `:82` |
| JSON-LD | breadcrumb `Accueil > Sécurité` | `:84-87` |
| Kicker | `Sécurité & conformité` | `:95` |
| **H1** | `La sécurité administrative et juridique commence par la sécurité technique.` | `:97-100` |
| Sous-titre | `Pour une legaltech, la confiance se mérite. Cette page expose, sans jargon, ce que nous faisons concrètement pour protéger vos données : chiffrement, isolation par utilisateur, stockage privé de vos pièces et respect de vos droits RGPD.` | `:101-106` |
| Section « Architecture simplifiée » | H2 `Du navigateur jusqu'à vos sauvegardes.` ; 5 nœuds : `1 Client · Navigateur · App`, `2 HTTPS · Connexion chiffrée`, `3 Authentification · Compte confirmé`, `4 Application · Isolation par utilisateur`, `5 Stockage privé · Pièces chiffrées au repos` ; paragraphe de synthèse | `:112-164` |
| Section `#conformite` — 6 piliers `PILLARS` | `Hébergement`, `Chiffrement`, `Accès`, `Conformité`, `Vos pièces`, `Maîtrise & contact` — chacun avec corps + 3 puces (texte intégral `:14-75`) | `:167-192` |
| Section badges `Nos engagements en clair` | `RGPD / Conçu pour`, `Chiffrement / Transit & repos`, `Isolation / Par utilisateur`, `Vos droits / Sur demande` | `:195-221` |
| Section `#dpa` « Vos droits » | H2 `Vos données restent les vôtres.` ; texte `Au titre du RGPD, vous pouvez exercer vos droits sur vos données. Adressez-nous votre demande via le contact ou depuis votre espace : nous la traitons dans un délai de 30 jours.` ; 6 lignes : `Accès à vos données` / `Export de vos données` / `Suppression` / `Rectification` (état `Sur demande`), `Création de compte` (`Gratuite, confirmée par e-mail`, `Inclus`), `Stockage privé des pièces` (`Inclus`) | `:224-287` |
| CTA | `Exercer un droit` → `/contact` | `:289-295` |
| Section « Divulgation responsable » (navy) | H2 `Trouvé une faille ? Écrivez-nous.` ; texte `Nous prenons les rapports de vulnérabilités au sérieux. Si vous identifiez une faille, écrivez-nous à l'adresse ci-dessous : nous reviendrons vers vous. Aucune action en justice contre les chercheurs de bonne foi qui respectent une démarche responsable.` | `:301-314` |
| CTA | `contact.clairdossier@icloud.com` → `mailto:contact.clairdossier@icloud.com` | `:315-320` |
| Formulaires | aucun | |

Point notable (`Security.tsx:38, 42`) : la page affirme `Seul un administrateur unique peut consulter les dossiers côté support.` / `Consultation support limitée à un seul admin`.

### 2.4 `/contact` — `src/pages/Contact.tsx`

| Élément | Contenu | Réf. |
|---|---|---|
| SEO title | `Contact` | `:43` |
| SEO description | `Réserver une démo ClairDossier, poser une question commerciale, contacter le support, ou écrire à l'équipe presse. Échanges directs via WhatsApp.` | `:44` |
| Kicker | `Contact` | `:58` |
| **H1** | `Une réponse sur WhatsApp, dans l'heure.` | `:61` |
| Sous-titre | `Pas de formulaire en file d'attente, pas de tickets perdus. Vous écrivez, on lit, on répond — directement sur WhatsApp.` | `:64-65` |
| Carte WhatsApp (lien, `target=_blank`) | kicker `WhatsApp` ; numéro affiché `WHATSAPP_DISPLAY` = `+33 7 82 98 36 44` ; texte `Réponse en moyenne sous 1 h en journée (9 h – 19 h, lundi-vendredi).` ; libellé `Ouvrir une conversation` → `buildWhatsAppUrl("Bonjour ClairDossier, j'aimerais vous poser une question.")` = `https://wa.me/33782983644?text=…` | `:69-93` |
| `ContactInfo` Email | `contact.clairdossier@icloud.com` → `mailto:contact.clairdossier@icloud.com` ; détail `Demandes générales, devis, et divulgation responsable de vulnérabilités — réponse sous 24 h ouvrées` | `:96-101` |
| `ContactInfo` Siège | `Château-Gombert, 13013 Marseille` (sans lien) ; détail `Voir les mentions légales pour les coordonnées complètes` | `:102-106` |
| Bloc formulaire | kicker `Formulaire guidé` ; H2 `Préparez votre message en quelques champs.` ; texte `Au clic sur « Continuer sur WhatsApp », votre message est composé et WhatsApp s'ouvre prêt à être envoyé. Vous restez maître du dernier clic.` | `:113-122` |

**Formulaire** (`<form onSubmit={onSubmit} noValidate>`, `:124`) :

| Champ | `name` | Type | Requis (attribut) | Placeholder | Réf. |
|---|---|---|---|---|---|
| `Nature de la demande` | — (état React `topic`, boutons `type=button`) | 4 boutons : `Démo produit` (`30 minutes pour explorer ClairDossier avec votre équipe.`), `Question commerciale` (`Devis Entreprise, contrat-cadre, négociation cabinet.`), `Support technique` (`Compte existant, configuration, intégration API.`), `Presse & contenu` (`Demande d'interview, contribution, partenariat éditorial.`) ; défaut `demo` | — | — | `:9-14, 17, 126-146` |
| `Nom complet` * | `name` | text | oui | `Nom et prénom` | `:148` |
| `Email professionnel` * | `email` | email | oui | `vous@cabinet.fr` | `:149` |
| `Structure` | `organization` | text | non | `Cabinet, entreprise, ou « particulier »` | `:150` |
| `Votre message` | `message` | textarea 5 lignes | oui | `Quelques lignes suffisent — on vous recontacte pour creuser.` | `:152-163` |
| Consentement | (aucun `name`) | checkbox | oui | libellé `J'accepte que ClairDossier traite ma demande selon la politique de confidentialité. Le message sera envoyé via WhatsApp.` — lien `<a href="/politique-confidentialite">` (ancre HTML, pas `Link`) | `:165-178` |
| Bouton submit | — | — | — | `Continuer sur WhatsApp` (icône WhatsApp) | `:180-186` |
| Mention sous le bouton | | | | `On vous recontacte sur le numéro WhatsApp depuis lequel vous écrivez.` | `:187-189` |

**Que fait la soumission** (`:19-38`) : `e.preventDefault()`, lecture de `FormData`, composition du texte :
```
Bonjour ClairDossier,

Nature de la demande : {topicLabel}
Nom : {name}
Email : {email}
Structure : {organization}   (ligne omise si vide)

{message}
```
puis `openWhatsApp(text)` (`src/lib/whatsapp.ts:12-20`) : `window.open("https://wa.me/33782983644?text=<encodé>", "_blank", "noopener,noreferrer")`, avec repli `window.location.href = url` si le popup est bloqué. **Aucun appel réseau vers Supabase, aucun mailto, aucune persistance** : le formulaire ne fait que pré-remplir un message WhatsApp. Remarques factuelles : le `<form>` porte `noValidate` (`:124`), et `onSubmit` n'effectue aucune vérification des champs requis ni de la case de consentement ; la validation native étant désactivée, un envoi à champs vides est techniquement possible (non testé à l'exécution).

### 2.5 `/blog` — `src/pages/BlogIndex.tsx`

| Élément | Contenu | Réf. |
|---|---|---|
| SEO title | `Journal` | `:16` |
| SEO description | `Articles juridiques pédagogiques : préparation prud'homale, RGPD legaltech, IA et droit. Lecture libre, signée.` | `:17` |
| JSON-LD | breadcrumb `Accueil > Journal` + schéma `Blog` (`name: Journal ClairDossier`, `url: https://www.clair-dossier.com/blog`, `inLanguage: fr-FR`, un `BlogPosting` par article avec `author` `Person` = `authors[p.author].name`) | `:19-38` |
| Kicker | `Journal` | `:46` |
| **H1** | `Le droit administratif et juridique, expliqué calmement.` | `:49` |
| Sous-titre | `Articles écrits par des avocats, des juristes IT et l'équipe éditoriale ClairDossier. Pédagogie sans simplification. Position claire sur les sujets de fond.` | `:52-54` |
| Grille | 3 colonnes, tous les `blogPosts` : vignette dégradé (lien → `/blog/{slug}`), `category`, date + `readMinutes` min, H2 = titre (lien), `summary`, avatar initiales + nom auteur, lien `Lire` → `/blog/{slug}` | `:63-125` |
| Formulaires | aucun | |

### 2.6 `/blog/:slug` — `src/pages/BlogPost.tsx`

| Élément | Contenu | Réf. |
|---|---|---|
| Résolution | `getPostBySlug(slug)` ; inconnu → `<NotFound />` | `:15-17` |
| SEO | title = `post.metaTitle`, description = `post.metaDescription`, `type="article"`, breadcrumb 3 niveaux, schéma `BlogPosting` (author = `Organization` avec `name`/`description`=role, publisher `ClairDossier`, logo `https://www.clair-dossier.com/favicon.svg`, `wordCount` calculé, `timeRequired`, `keywords` = tags), schéma `FAQPage` si `post.faq` | `:33-94` |
| Commentaire code | `Schema HowTo retiré : Google a déprécié les rich results HowTo (sept. 2023).` | `:75-76` |
| Fil d'ariane | `Accueil` / `Journal` / titre | `:97-105` |
| Kicker | `{category} · {readMinutes} min de lecture` | `:111` |
| **H1** | `{post.title}` | `:113-115` |
| Chapô (italique) | `{post.summary}` | `:116-118` |
| Bloc auteur | initiales, `author.name`, `author.role`, date | `:119-132` |
| Image hero | placeholder dégradé (pas d'image réelle ; `heroImageQuery` non utilisé) | `:135-153` |
| Corps | blocs `p`, `h2`, `h3`, `quote` (avec `cite`), `list`, `callout` (label `Note`, ton gold/navy) via `ContentBlock` | `:157-163, 236-297` |
| Aside `À retenir` | `post.takeaways` | `:165-178` |
| Section `Questions liées` (H2) | `post.faq` (H3 question + réponse) | `:180-195` |
| Section `Continuer la lecture.` (H2) | `getRelatedPosts(post)` (via `relatedSlugs`), cartes → `/blog/{slug}`, libellé `Lire` | `:199-231` |
| CTA / formulaires | aucun CTA produit, aucun formulaire | |

### 2.7 404 — `src/pages/NotFound.tsx`

| Élément | Contenu | Réf. |
|---|---|---|
| SEO | title `Page introuvable`, description `La page demandée n'existe pas.`, `path="/"`, `noindex` | `:7` |
| Kicker | `Erreur 404` | `:9` |
| **H1** | `Cette page n'existe pas.` | `:11` |
| Texte | `Le lien est peut-être obsolète ou mal recopié. Revenez à l'accueil ou ouvrez le journal.` | `:14` |
| CTA | `Retour à l'accueil` → `/` (`:17-22`) ; `Lire le journal` → `/blog` (`:23-25`) | |

---

## 3. Données

### 3.1 Fonctionnalités — `src/data/features.ts` (**9 entrées**, pas 8)

Type `Feature` : `slug, title, shortTitle, icon, blurb, hero, body[], bullets[]` (`:3-12`). Accesseur `getFeatureBySlug` (`:204-209`).

| # | `slug` | `title` | `shortTitle` | `icon` | `blurb` (promesse courte) | `hero` (promesse) | Corps (résumé) | Réf. |
|---|---|---|---|---|---|---|---|---|
| 1 | `creation-guidee` | `Création guidée par typologie` | `Création guidée` | `form-guide` | `Un tunnel de création en 5 étapes qui s'adapte à votre profil — artisan, indépendant, profession libérale, PME — et structure votre dossier dès le départ.` | `Le bon dossier commence par les bonnes étapes. ClairDossier en propose 5, dans l'ordre.` | 4 § : critique du formulaire générique ; tunnel en 5 étapes (profil, nature, informations, dépôt des documents, récapitulatif), nom du dossier obligatoire ; un écran par étape ; récapitulatif avant confirmation. Bullets : `Tunnel de création en 5 étapes guidées` / `Adaptation au profil : artisan, indépendant, profession libérale, PME` / `Nom de dossier obligatoire pour un repérage clair` / `Récapitulatif complet avant validation finale` | `:15-35` |
| 2 | `pieces-ocr` | `Dépôt de pièces dans un espace privé` | `Dépôt de pièces` | `scan-ocr` | `Déposez vos pièces — contrats, courriers, factures — dans un espace privé et sécurisé, rattaché au dossier.` | `Vos pièces ne sont pas un fourre-tout. ClairDossier les range dans un espace privé, dossier par dossier.` | 4 § : rassemblement des pièces ; dépôt PDF/scans/photos, liens temporaires signés ; consultation/téléchargement depuis la page d'avancement ; isolation par utilisateur. Bullets `:50-55` | `:36-56` |
| 3 | `chronologie` | `Avancement du dossier en 5 étapes` | `Avancement` | `timeline` | `Une page d'avancement claire qui suit votre dossier à travers 5 étapes métier, avec pièces et échéances réunies au même endroit.` | `Où en est mon dossier ? Vous l'ouvrez, vous voyez les 5 étapes, vous savez.` | 4 § : page « Avancement du dossier » à 5 étapes cliquables ; pièces et échéances sur le même écran ; vue fidèle aux saisies. Bullets `:71-76` | `:57-77` |
| 4 | `validation-avocat` | `Transmission validée par vous` | `Transmission` | `validate` | `Vous transmettez votre dossier par e-mail ou WhatsApp, quand vous le décidez. Rien ne part sans votre validation explicite.` | `Le dossier ne part jamais tout seul. C'est vous qui déclenchez la transmission, par e-mail ou par WhatsApp.` | 4 § : aucun envoi automatique ; transmission e-mail/WhatsApp ; relecture du récapitulatif ; données conservées jusqu'à validation. Bullets `:92-97` | `:78-98` |
| 5 | `suivi-statuts` | `Liste de vos dossiers en un espace` | `Mes dossiers` | `status-track` | `Tous vos dossiers réunis dans votre espace de compte. D'un coup d'œil, vous voyez lesquels ouvrir et où chacun en est.` | `Plus besoin de chercher partout. Vos dossiers sont rassemblés dans un seul espace.` | 4 § : liste des dossiers ; compte gratuit confirmé par e-mail ; accès à la page d'avancement ; isolation. Bullets `:113-118` | `:99-119` |
| 6 | `messagerie-securisee` | `Espace privé et sécurisé` | `Espace sécurisé` | `message-secure` | `Vos pièces et informations quittent les SMS et les e-mails dispersés pour un espace privé : accès par authentification, chiffrement en transit et au repos.` | `Un dossier mérite mieux qu'un fil de SMS. ClairDossier le garde dans un espace privé, sous votre compte.` | 4 § : risque des pièces par SMS/e-mail/WhatsApp ; authentification, HTTPS, chiffrement au repos ; liens signés ; transmission sur action explicite. Bullets `:134-139` | `:120-140` |
| 7 | `coffre-fort` | `Vos données protégées et maîtrisées` | `Données RGPD` | `vault` | `Vos données sont isolées par utilisateur, chiffrées au repos côté hébergeur, accessibles par authentification. Accès, export et suppression sur demande.` | `Vos données n'appartiennent qu'à vous. Vous pouvez en demander l'accès, l'export ou la suppression.` | 4 § : RGPD ; hébergeur sous-traitant conforme ; droits accès/export/suppression sous 30 jours ; maîtrise de la transmission. Bullets `:155-160` | `:141-161` |
| 8 | `calendrier-relances` | `Échéances renseignées et affichées` | `Échéances` | `timeline` | `Chaque dossier a ses dates clés. ClairDossier les conserve et les affiche sur la page d'avancement, sous vos yeux à chaque consultation.` | `Une échéance se garde en vue. ClairDossier l'affiche sur le dossier, là où vous la consultez.` | 3 § : délais au cœur des dossiers ; échéances renseignées à la création, affichées sur l'avancement ; dates réunies avec le dossier. Bullets `:175-180` | `:162-181` |
| 9 | `reponse-auto-mails` | `Récapitulatif avant transmission` | `Récapitulatif` | `ai-brief` | `Avant d'envoyer, ClairDossier vous présente un récapitulatif complet du dossier. Vous relisez, vous corrigez si besoin, puis vous transmettez.` | `On relit avant d'envoyer. ClairDossier réunit tout le dossier dans un récapitulatif clair.` | 3 § : récapitulatif en fin de tunnel ; profil/nature/informations/pièces sur un écran, retour arrière ; transmission e-mail/WhatsApp. Bullets `:195-200` | `:182-201` |

Observation factuelle : plusieurs `slug` (`pieces-ocr`, `validation-avocat`, `suivi-statuts`, `messagerie-securisee`, `coffre-fort`, `calendrier-relances`, `reponse-auto-mails`) et clés d'icône (`scan-ocr`, `ai-brief`) ne correspondent plus aux titres actuels (aucune mention d'OCR, d'avocat, de messagerie, de coffre-fort, de relances ou de réponse automatique dans les contenus). Ces slugs sont les URL publiques `/fonctionnalites/{slug}`.

### 3.2 Statuts de dossier — `src/data/statuses.ts` (6 entrées)

Type `CaseStatus` : `id, label, short, description, who ("client"|"avocat"|"plateforme"), next?` (`:1-8`).

| # | `id` | `label` | `who` | `next` | `description` | Réf. |
|---|---|---|---|---|---|---|
| 1 | `brouillon` | `Brouillon` | client | `complete` | `Vous construisez votre dossier dans le tunnel en 5 étapes : profil, nature, informations, dépôt des pièces, récapitulatif. Le nom du dossier est obligatoire. Rien n'est transmis tant que vous ne l'avez pas décidé.` | `:11-19` |
| 2 | `complete` | `Complété` | client | `attente-avocat` | `Vous avez renseigné les informations et déposé vos pièces dans l'espace privé sécurisé. Le récapitulatif vous montre le dossier avant toute transmission.` | `:20-28` |
| 3 | `attente-avocat` | `Transmis` | client | `validation` | `Vous transmettez le dossier par e-mail ou WhatsApp, à votre initiative. Aucun envoi automatique : rien ne part sans votre validation explicite.` | `:29-37` |
| 4 | `validation` | `En cours` | plateforme | `valide` | `Le dossier suit son avancement sur les 5 étapes métier, cliquables depuis la page détail. Les pièces restent téléchargeables et les échéances affichées.` | `:38-46` |
| 5 | `valide` | `Validé` | plateforme | `archive` | `Le dossier est complet et structuré, prêt à être partagé ou suivi dans la durée. Les pièces sont réunies dans un espace privé, accessibles via des liens signés temporaires.` | `:47-55` |
| 6 | `archive` | `Archivé` | plateforme | — | `L'affaire est close. Vos données restent isolées par compte et conservées selon les délais légaux. Vous pouvez en demander l'accès ou l'export via le contact.` | `:56-63` |

Observation : les `id` `attente-avocat` / `validation` et le type `who: "avocat"` (jamais utilisé dans les 6 entrées) sont des vestiges d'un vocabulaire « validation avocat ». La section Workflow parle de « six statuts » alors que les descriptions parlent de « 5 étapes métier » (deux notions distinctes : statut du dossier vs étapes du tunnel/avancement).

### 3.3 Espaces (workspaces) — `src/data/workspaces.ts` (3 entrées)

Type `Workspace` : `id ("client"|"avocat"|"cabinet"), label, title, description, capabilities[], mockup{kicker,title,rows[],footnote?}` (`:1-18`).

| `id` | Onglet `label` | `title` (H3) | `description` | `capabilities` | Mockup | Réf. |
|---|---|---|---|---|---|---|
| `client` | `Vous` | `Votre dossier, vos décisions.` | `Vous construisez votre dossier à votre rythme. Vous voyez en permanence où il en est, qui agit, ce qui est attendu de vous.` | `Création guidée en 5 étapes (profil, nature, informations, pièces, récapitulatif)` · `Suivi de l'avancement sur les 5 étapes métier de votre dossier` · `Transmission par e-mail ou WhatsApp, déclenchée par vous` · `Récupération de vos pièces et données sur demande` | kicker `Aperçu dossier`, titre `Avancement du dossier`, lignes : `Étape`→`Dépôt des pièces` (gold), `Pièces déposées`→`7 / 9`, `Échéance`→`affichée sur le dossier`, `Transmission`→`à votre validation` (navy), `Stockage`→`espace privé sécurisé` ; footnote `Rien n'est transmis sans votre validation explicite.` | `:21-45` |
| `avocat` | `Validation` | `Une relecture côté support, quand c'est utile.` | `Un administrateur unique peut, côté support, consulter votre dossier et les pièces déposées pour vous accompagner. Vous gardez la main : rien n'est transmis hors de votre espace sans votre accord.` | `Consultation du dossier et des pièces par l'administrateur support` · `Vue d'ensemble des 5 étapes et des échéances du dossier` · `Accès limité à l'administrateur unique, isolé des autres comptes` · `Pièces accessibles via des liens privés à durée limitée` | kicker `Support · Relecture du dossier`, titre `Aperçu du dossier`, lignes : `Profil`→`Indépendant`, `Nature`→`renseignée à la création` (navy), `Pièces`→`déposées dans l'espace privé`, `Étape en cours`→`Récapitulatif`, `Accès`→`administrateur unique` (gold) ; footnote `Accès support réservé à un administrateur unique.` | `:46-70` |
| `cabinet` | `Entreprise` | `Tous vos dossiers, au même endroit.` | `Artisan, indépendant, profession libérale ou PME : retrouvez la liste de vos dossiers et l'avancement de chacun depuis un seul espace. Chaque compte ne voit que ses propres dossiers.` | `Liste de tous vos dossiers avec leur étape en cours` · `Page détail « Avancement du dossier » pour chaque dossier` · `Données isolées par compte : vous ne voyez que les vôtres` · `Transmission par e-mail ou WhatsApp, dossier par dossier` | kicker `Vos dossiers · vue d'ensemble`, titre `Liste des dossiers`, lignes : `Dossiers du compte`→`tous regroupés` (navy), `Avancement`→`étape affichée par dossier`, `Pièces`→`téléchargeables par dossier` (gold), `Échéances`→`affichées sur chaque dossier`, `Visibilité`→`limitée à votre compte` ; footnote `Chaque compte est isolé : aucun accès croisé entre utilisateurs.` | `:71-96` |

Observation : les `id` `avocat` / `cabinet` sont des vestiges ; les labels affichés sont `Vous` / `Validation` / `Entreprise`.

### 3.4 FAQ — `src/data/faq.ts` (`homeFaq`, 8 entrées)

| `id` | Question exacte | Réponse (résumé) | Réf. |
|---|---|---|---|
| `qui-valide` | `Qui prépare les dossiers sur ClairDossier ?` | `C'est vous.` Tunnel 5 étapes ; l'outil structure et conserve ; l'utilisateur reste seul maître du contenu. | `:8-13` |
| `donnees-securisees` | `Mes données sont-elles vraiment sécurisées ?` | HTTPS, chiffrement au repos, stockage privé, liens temporaires, isolation par compte, hébergeurs sous-traitants conformes RGPD. | `:14-19` |
| `obligation-avocat` | `Suis-je obligé de passer par un tiers via ClairDossier ?` | `Non.` Transmission e-mail/WhatsApp au destinataire choisi, sur validation explicite, aucun intermédiaire imposé. | `:20-25` |
| `compatible-cabinet` | `Comment je récupère ou partage mes dossiers ?` | Page détail « Avancement du dossier » : 5 étapes, téléchargement des pièces, échéances ; transmission e-mail/WhatsApp après validation. | `:26-31` |
| `refus-avocat` | `Comment je suis l'avancement de mon dossier ?` | 5 étapes métier cliquables, pièces téléchargeables, échéances ; complément depuis l'app puis transmission. | `:32-37` |
| `tarification-cabinet` | `La facturation est par utilisateur ou par dossier ?` | `Selon le plan.` Essentiel → Business PME 50 : nombre défini de dossiers/utilisateurs ; Pro et Premium : dossiers illimités (15 utilisateurs, puis illimité). | `:38-43` |
| `export-possible` | `Puis-je récupérer mes pièces et mon dossier ?` | `Oui.` Téléchargement des pièces, transmission e-mail/WhatsApp, export RGPD via le contact (sous 30 jours). | `:44-49` |
| `rgpd-donnees` | `Conformité RGPD : comment exercer mes droits sur mes données ?` | Chiffrement au repos, isolation, droits accès/export/suppression via contact ou espace, sous 30 jours. | `:50-55` |

Observation : les `id` (`qui-valide`, `obligation-avocat`, `compatible-cabinet`, `refus-avocat`, `tarification-cabinet`) reflètent un ancien questionnaire orienté avocat/cabinet ; les questions affichées ont été réécrites.

### 3.5 Auteurs — `src/data/authors.ts` (1 entrée)

| `id` | `name` | `role` | `initials` | `bio` | Réf. |
|---|---|---|---|---|---|
| `redaction` | `Rédaction ClairDossier` | `Cellule éditoriale` | `CD` | `Articles écrits par l'équipe éditoriale ClairDossier, à partir d'entretiens avec des praticiens et de relectures par des avocats. Les contenus sont pédagogiques : ils ne constituent pas un conseil juridique personnalisé et n'engagent pas leurs auteurs.` | `:10-17` |

Aucun auteur nommément identifié (personne physique) dans ce fichier.

### 3.6 Articles de blog — `src/data/blog/` (7 articles)

Ordre d'affichage (`src/data/blog/index.ts:11-19`, tri descendant par date déclaré en commentaire) : `preparer-rendez-vous-avocat`, `chronologie-prud-homale`, `mise-en-demeure`, `conservation-documents`, `mediation-contentieux`, `rgpd-legaltech`, `ia-droit`. **Observation** : `rgpd-legaltech` (2026-04-28) et `ia-droit` (2026-05-02) sont placés en fin de liste alors que leurs dates sont postérieures à `mise-en-demeure` (2026-04-15), `conservation-documents` (2026-03-28) et `mediation-contentieux` (2026-02-12) — l'ordre n'est pas strictement décroissant (commentaire `:17-18` : « (existant — date dans le fichier) »).

Type `BlogPost` (`src/data/blog/types.ts:21-39`) : `slug, title, metaTitle, metaDescription, summary, author, date, readMinutes, category, tags[], heroImageQuery, content[], takeaways[], faq?, howTo?, relatedSlugs[]`. Blocs de contenu : `p, h2, h3, quote(cite?), list, callout(tone gold|navy)` (`types.ts:1-7`).

| Fichier | `slug` | `title` | `date` | `author` | `readMinutes` | `category` | `tags` (mots-clés) | `metaTitle` | `relatedSlugs` |
|---|---|---|---|---|---|---|---|---|---|
| `preparer-rendez-vous-avocat.ts` (150 l.) | `preparer-rendez-vous-avocat` | `Préparer son rendez-vous avocat : la checklist en 8 étapes` | `2026-05-20` | `redaction` | 7 | `Méthode` | `rendez-vous`, `méthode`, `consultation`, `préparation` | `Préparer son rendez-vous avocat — checklist 8 étapes` | `chronologie-prud-homale`, `mise-en-demeure`, `mediation-contentieux` (`:149`) |
| `chronologie-prud-homale.ts` (112 l.) | `chronologie-prud-homale` | `Préparer un dossier prud'homal : la chronologie qui fait la différence` | `2026-05-12` | `redaction` | 6 | `Droit social` | `prud'hommes`, `droit du travail`, `méthode`, `chronologie` | `Préparer un dossier prud'homal — la chronologie qui décide` | `ia-droit`, `rgpd-legaltech` (`:111`) |
| `ia-droit.ts` (142 l.) | `ia-droit` | `L'IA dans le droit : assistante de préparation, pas substitut` | `2026-05-02` | `redaction` | 7 | `IA et droit` | `IA`, `déontologie`, `pratique professionnelle`, `RIN` | `IA et droit — assistante de préparation, pas substitut` | `chronologie-prud-homale`, `rgpd-legaltech` (`:141`) |
| `rgpd-legaltech.ts` (123 l.) | `rgpd-legaltech` | `RGPD et legaltech : où vont vraiment vos données juridiques ?` | `2026-04-28` | `redaction` | 8 | `Conformité` | `RGPD`, `protection données`, `legaltech`, `DPO` | `RGPD legaltech — où vont vraiment vos données ?` | `ia-droit`, `chronologie-prud-homale` (`:122`) |
| `mise-en-demeure.ts` (149 l.) | `mise-en-demeure` | `Mise en demeure : le courrier qui débloque (souvent) la situation` | `2026-04-15` | `redaction` | 8 | `Procédure amiable` | `mise en demeure`, `recouvrement`, `procédure amiable`, `modèle` | `Mise en demeure — guide pratique et erreurs à éviter` | `preparer-rendez-vous-avocat`, `conservation-documents`, `mediation-contentieux` (`:148`) |
| `conservation-documents.ts` (152 l.) | `conservation-documents` | `Conservation des documents juridiques : durées légales et bonnes pratiques` | `2026-03-28` | `redaction` | 9 | `Conformité` | `conservation`, `documents`, `RGPD`, `archives` | `Conservation documents juridiques — durées légales France` | `rgpd-legaltech`, `preparer-rendez-vous-avocat`, `mise-en-demeure` (`:151`) |
| `mediation-contentieux.ts` (134 l.) | `mediation-contentieux` | `Médiation ou contentieux : trois critères pour choisir` | `2026-02-12` | `redaction` | 7 | `Résolution de conflit` | `médiation`, `contentieux`, `résolution amiable`, `stratégie` | `Médiation ou contentieux — comment choisir la bonne voie` | `mise-en-demeure`, `preparer-rendez-vous-avocat`, `chronologie-prud-homale` (`:133`) |

Toutes les métadonnées ci-dessus sont aux lignes 4-16 de chaque fichier (`slug :4`, `title :5`, `metaTitle :6`, `metaDescription :7-8`, `summary :9-10`, `author :11`, `date :12`, `readMinutes :13`, `category :14`, `tags :15`, `heroImageQuery :16`).

Résumés (`summary`, ligne 10 de chaque fichier) :
- `preparer-rendez-vous-avocat` : `Une heure de consultation chez un avocat coûte entre 200 et 400 euros en moyenne. La passer à reconstruire votre chronologie ou à chercher une facture, c'est du temps perdu. Voici les huit étapes qui transforment un premier rendez-vous brouillon en consultation efficace.`
- `chronologie-prud-homale` : `Dans un dossier prud'homal, la chronologie reconstituée pèse souvent plus lourd que la qualité des arguments juridiques. Voici comment la construire correctement, dès le premier rendez-vous client, et pourquoi cette discipline change la stratégie de l'avocat.`
- `ia-droit` : `L'IA générative bouleverse les métiers du droit, mais une frontière reste non négociable : l'IA prépare le travail du professionnel — elle ne le remplace pas. Voici où l'IA est utile, où elle est dangereuse, et pourquoi cette frontière protège autant les avocats que leurs clients.`
- `rgpd-legaltech` : `Quand vous déposez le contrat de travail d'un salarié sur une plateforme legaltech, vous engagez la conformité RGPD du cabinet, pas seulement la vôtre. Voici comment vérifier qu'une legaltech tient ses engagements — et ce que les articles 28, 32 et 35 du RGPD exigent concrètement.`
- `mise-en-demeure` : `Avant tout procès, la loi française demande presque toujours d'avoir tenté un règlement amiable. La mise en demeure est l'outil principal de cette tentative. Bien rédigée, elle débloque souvent la situation sans aller plus loin. Mal rédigée, elle peut être inopposable et faire perdre un temps précieux.`
- `conservation-documents` : `Combien de temps faut-il garder ses contrats, factures, bulletins de paie, actes notariés ? La règle change selon le document et la situation, et l'erreur a deux directions : trop court (vous perdez une preuve), trop long (vous violez le RGPD). Voici le guide.`
- `mediation-contentieux` : `Aller au tribunal coûte cher, dure des mois, et la décision peut surprendre. La médiation coûte peu, dure quelques semaines, et la décision vous appartient. Mais elle ne convient pas à tous les dossiers. Trois critères concrets pour choisir.`

`heroImageQuery` (ligne 16) : `lawyer desk notes`, `law library books`, `judge desk justice`, `data center server room`, `registered letter signature`, `paper archives folders`, `mediation handshake table` — non exploité par `BlogPost.tsx` (placeholder dégradé).

Seule citation avec `cite` dans les 7 articles (grep) : `src/data/blog/chronologie-prud-homale.ts:38` → `cite: 'Adage transmis en formation continue droit social'` (pas un nom de personne).

---

## 4. Tous les libellés de CTA du site public (périmètre lu) et leurs destinations

| Page / section | Libellé exact | Type | Destination | Réf. |
|---|---|---|---|---|
| Home / Hero | `Créer un dossier` | route interne (protégée) | `/dossier/nouveau` → redirige vers `/connexion?next=%2Fdossier%2Fnouveau` si non connecté | `Hero.tsx:88-99` |
| Home / Hero | `Demander une démo` | route interne | `/contact` | `Hero.tsx:100-105` |
| Home / FeaturesGrid (×9) | `Voir` | route interne | `/fonctionnalites/{slug}` | `FeaturesGrid.tsx:44-50` |
| Home / SecurityBlock | `Charte complète` | route interne | `/securite` | `SecurityBlock.tsx:59-65` |
| Home / PricingPreview (×3) | `S'abonner` | lien externe (via `<Link>`) | Stripe : `https://buy.stripe.com/00w9AT9Qm7fJ4vbeSibV605` (Essentiel), `https://buy.stripe.com/5kQaEX7IeeIb4vb11sbV607` (Business PME 20), `https://buy.stripe.com/5kQbJ1e6C7fJ6DjdOebV609` (Business / PME Pro) | `PricingPreview.tsx:117-122`, `pricing.ts:44-45, 99-100, 153-154` |
| Home / PricingPreview | `Voir les 7 formules et le détail` | route interne | `/tarifs` | `PricingPreview.tsx:38-44` |
| Home / BlogPreview | `Tout le journal` | route interne | `/blog` | `BlogPreview.tsx:23-29` |
| Home / BlogPreview (×7) | `Lire l'article` (carte entière cliquable) | route interne | `/blog/{slug}` | `BlogPreview.tsx:35-37, 71` |
| Home / FinalCTA | `Créer un dossier` | route interne (protégée) | `/dossier/nouveau` | `FinalCTA.tsx:38-44` |
| Home / FinalCTA | `Réserver une démo` | route interne | `/contact` | `FinalCTA.tsx:45-50` |
| Fonctionnalités (×9) | `Lire la fiche` (carte entière cliquable) | route interne | `/fonctionnalites/{slug}` | `FeaturesIndex.tsx:60-82` |
| Fonctionnalités / CTA bas | `Demander une démo` | route interne | `/contact` | `FeaturesIndex.tsx:104-110` |
| Fonctionnalités / CTA bas | `Créer un dossier maintenant` | route interne (protégée) | `/dossier/nouveau` | `FeaturesIndex.tsx:111-116` |
| Fiche fonctionnalité / fil d'ariane | `Accueil`, `Fonctionnalités` | route interne | `/`, `/fonctionnalites` | `FeatureDetail.tsx:43-45` |
| Fiche fonctionnalité / aside | `Essayer maintenant` | route interne (protégée) | `/dossier/nouveau` | `FeatureDetail.tsx:91-97` |
| Fiche fonctionnalité / related | `Toutes les fonctionnalités` | route interne | `/fonctionnalites` | `FeatureDetail.tsx:109-111` |
| Fiche fonctionnalité / related (×3) | carte (`shortTitle` + `blurb`) | route interne | `/fonctionnalites/{slug}` | `FeatureDetail.tsx:117-129` |
| Sécurité / Vos droits | `Exercer un droit` | route interne | `/contact` | `Security.tsx:289-295` |
| Sécurité / Divulgation responsable | `contact.clairdossier@icloud.com` | mailto | `mailto:contact.clairdossier@icloud.com` | `Security.tsx:315-320` |
| Contact / carte WhatsApp | `Ouvrir une conversation` (carte entière cliquable, `target=_blank`) | WhatsApp | `https://wa.me/33782983644?text=Bonjour%20ClairDossier%2C%20j'aimerais%20vous%20poser%20une%20question.` (encodage via `encodeURIComponent`) | `Contact.tsx:69-93`, `whatsapp.ts:8-10` |
| Contact / infos | `contact.clairdossier@icloud.com` | mailto | `mailto:contact.clairdossier@icloud.com` | `Contact.tsx:96-101` |
| Contact / formulaire | lien `politique de confidentialité` | ancre HTML (rechargement complet) | `/politique-confidentialite` | `Contact.tsx:173-175` |
| Contact / formulaire | `Continuer sur WhatsApp` (submit) | WhatsApp | `window.open("https://wa.me/33782983644?text=<message composé>")`, repli `location.href` | `Contact.tsx:180-186`, `:19-38`, `whatsapp.ts:12-20` |
| Blog index (×7) | vignette, titre, `Lire` | route interne | `/blog/{slug}` | `BlogIndex.tsx:69, 96, 112-118` |
| Article / fil d'ariane | `Accueil`, `Journal` | route interne | `/`, `/blog` | `BlogPost.tsx:99-101` |
| Article / Continuer la lecture | `Lire` (carte entière cliquable) | route interne | `/blog/{slug}` | `BlogPost.tsx:208-226` |
| 404 | `Retour à l'accueil` | route interne | `/` | `NotFound.tsx:17-22` |
| 404 | `Lire le journal` | route interne | `/blog` | `NotFound.tsx:23-25` |

Aucun lien `tel:` dans les fichiers lus (grep `tel:` sur `src/` : aucune occurrence hors `mailto:`).

Synthèse des destinations : 4 CTA primaires « créer un dossier » (Hero, FinalCTA, FeaturesIndex, FeatureDetail) → `/dossier/nouveau` (protégé) ; 4 CTA « démo » (Hero, FinalCTA, FeaturesIndex, Security « Exercer un droit ») → `/contact` ; 3 CTA paiement → Stripe ; 1 mailto (Security) + 1 mailto (Contact) ; 2 WhatsApp (Contact).

---

## 5. Coordonnées et identités présentes

### 5.1 Dans les fichiers du périmètre

| Type | Texte exact | Fichier:ligne | Contexte |
|---|---|---|---|
| Numéro WhatsApp (format wa.me) | `33782983644` | `src/lib/whatsapp.ts:5` | `export const WHATSAPP_NUMBER = '33782983644';` |
| Numéro WhatsApp (affiché) | `+33 7 82 98 36 44` | `src/lib/whatsapp.ts:6` | `export const WHATSAPP_DISPLAY = '+33 7 82 98 36 44';` — affiché sur `/contact` via `Contact.tsx:83` |
| E-mail | `contact.clairdossier@icloud.com` | `src/pages/Contact.tsx:98` | valeur affichée (`ContactInfo`) |
| E-mail | `contact.clairdossier@icloud.com` | `src/pages/Contact.tsx:99` | `href="mailto:contact.clairdossier@icloud.com"` |
| E-mail | `contact.clairdossier@icloud.com` | `src/pages/Security.tsx:316` | `href="mailto:contact.clairdossier@icloud.com"` |
| E-mail | `contact.clairdossier@icloud.com` | `src/pages/Security.tsx:319` | texte du bouton |
| Adresse (siège) | `Château-Gombert, 13013 Marseille` | `src/pages/Contact.tsx:104` | `ContactInfo label="Siège"` |
| Placeholder e-mail (exemple, non réel) | `vous@cabinet.fr` | `src/pages/Contact.tsx:149` | placeholder du champ email |
| Identifiant d'exemple | `#CD-2026-0421` | `src/components/sections/Hero.tsx:151` | numéro de dossier fictif |
| Entité éditoriale | `Rédaction ClairDossier` / `Cellule éditoriale` / initiales `CD` | `src/data/authors.ts:12-13, 16` | auteur unique des 7 articles |
| Marque | `ClairDossier` | partout (ex. `Home.tsx:18, 46`) | nom produit / organisation dans les schémas JSON-LD |
| URL canonique | `https://www.clair-dossier.com/` | `src/pages/BlogIndex.tsx:28, 34` ; `src/pages/BlogPost.tsx:49, 55-56, 58` | schémas JSON-LD |

Aucun nom de personne physique, aucun numéro de téléphone autre que le WhatsApp, aucune adresse autre que le siège n'apparaissent dans les fichiers du périmètre (fichiers lus intégralement + en-têtes des articles ; le corps des articles n'a pas été lu, seul `grep cite:` a été exécuté).

### 5.2 Hors périmètre mais remontés par le grep transverse sur `src/` (pour information, fichiers NON lus intégralement)

| Type | Texte exact | Fichier:ligne |
|---|---|---|
| Nom de personne + SIREN | `© 2026 ClairDossier · Édité par Roman Gomes · SIREN 105 490 734` | `src/components/Footer.tsx:46` |
| Éditeur, SIREN, SIRET, siège | `Le site clair-dossier.com est édité par Roman Gomes, entrepreneur individuel immatriculé au Répertoire National des Entreprises (RNE) sous le numéro SIREN 105 490 734 (SIRET siège : 105 490 734 00016), dont le siège social est situé Château-Gombert, 13013 Marseille, France.` | `src/data/legal.ts:36` |
| E-mail + WhatsApp | `Contact : contact.clairdossier@icloud.com — WhatsApp : +33 7 82 98 36 44.` | `src/data/legal.ts:48` |
| Directeur de la publication | `Le directeur de la publication du site clair-dossier.com est Roman Gomes…` | `src/data/legal.ts:62` |
| Responsable de traitement | `… Roman Gomes, entrepreneur individuel, SIREN 105 490 734, dont le siège est situé Château-Gombert, 13013 Marseille …` | `src/data/legal.ts:262` |
| E-mail (autres occurrences) | `contact.clairdossier@icloud.com` | `src/data/legal.ts:114, 178, 182, 216, 370` ; `src/pages/Pricing.tsx:304, 327` ; `src/pages/LegalPage.tsx:134, 137` ; `src/pages/DossierFlow.tsx:39` (`TEAM_EMAIL`) |
| Mailto pré-rempli devis | `mailto:contact.clairdossier@icloud.com?subject=Demande%20de%20devis%20sur-mesure&body=…` | `src/pages/Pricing.tsx:304` |

---

## 6. Positionnement et vocabulaire produit actuels (factuel)

### 6.1 Persona / cible déclarée

| Source | Formulation exacte | Réf. |
|---|---|---|
| Hero kicker | `Legaltech pour PME · artisans · indépendants` | `Hero.tsx:44` |
| Hero sous-titre | `Pour les PME, artisans, entreprises individuelles et professions libérales.` | `Hero.tsx:78-79` |
| Feature 1 | profil `artisan, indépendant, profession libérale ou PME` | `features.ts:21, 25, 31` |
| Workspace `cabinet` | `Artisan, indépendant, profession libérale ou PME` | `workspaces.ts:76` |
| Plans (audiences) | `Indépendant / EI`, `TPE / PME`, `PME / multi-sites` | `pricing.ts:38, 92, 146` |
| Home SEO description | `Plateforme legaltech française pour clients, PME et cabinets d'avocats.` | `Home.tsx:47` |
| FeaturesGrid | `point de friction identifié auprès de cabinets et de services juridiques français` | `FeaturesGrid.tsx:20-21` |
| DossierLifecycle | `un client, un chantier ou une affaire` ; transmission `au comptable ou à un professionnel du droit` | `DossierLifecycle.tsx:15, 66-67` |
| Contact | placeholder `vous@cabinet.fr` ; `Cabinet, entreprise, ou « particulier »` ; `négociation cabinet` | `Contact.tsx:149, 150, 11` |

Le cœur de cible affiché (Hero, features, workspaces, plans) est **l'entreprise non-juriste** (PME, TPE, artisan, indépendant, EI, profession libérale). Des traces de cible « cabinet d'avocats / client de cabinet » subsistent dans la meta description Home, le texte FeaturesGrid, les placeholders Contact, les `id` internes (`avocat`, `cabinet`, `attente-avocat`, `validation-avocat`, `qui-valide`, `obligation-avocat`…) et dans les articles de blog (rédigés pour/à propos d'avocats : `preparer-rendez-vous-avocat`, `chronologie-prud-homale` « stratégie de l'avocat », `rgpd-legaltech` « conformité RGPD du cabinet », `ia-droit`).

### 6.2 Promesse

| Élément | Formulation | Réf. |
|---|---|---|
| Promesse principale (H1) | `Votre dossier administratif et juridique, clair, structuré et suivi.` | `Hero.tsx:64` |
| Mécanisme | créer un dossier (tunnel 5 étapes : profil, nature, informations, pièces, récapitulatif) → déposer les pièces dans un espace privé → suivre l'avancement (5 étapes métier) et les échéances → transmettre par e-mail ou WhatsApp sur validation explicite | `Hero.tsx:76-79`, `features.ts`, `statuses.ts`, `workspaces.ts` |
| Principe répété (« vous gardez la main ») | `Rien ne part sans votre validation` / `Rien n'est transmis sans votre validation explicite.` / `Aucun envoi automatique` | `AvantApres.tsx:17`, `workspaces.ts:43`, `statuses.ts:34`, `SecurityBlock.tsx:32`, `features.ts:84, 87, 93` |
| Cycle de vie étendu (Home §6) | création → devis/contrat → suivi → facture et paiement → option impayé / pré-contentieux ; documents RH ; transmission au comptable / professionnel du droit | `DossierLifecycle.tsx:11-37, 39-50, 117-133` |
| Preuves de confiance | `Suivi étape par étape` · `Pièces chiffrées` · `Conçu pour le RGPD` ; hébergeur conforme RGPD, HTTPS, chiffrement au repos, liens signés temporaires, isolation par utilisateur, droits RGPD sous 30 jours, administrateur support unique | `Hero.tsx:114-116`, `SecurityBlock.tsx:13-44`, `Security.tsx:14-75` |
| Modèle économique | `Création de compte gratuite, abonnement à partir de 19 €/mois HT.` ; `Sept formules … Compte gratuit, abonnement sans engagement — et 10 % de réduction en facturation annuelle.` | `Home.tsx:26`, `PricingPreview.tsx:24-25` |
| Canal de contact | WhatsApp comme canal principal (`Une réponse sur WhatsApp, dans l'heure.`), e-mail secondaire | `Contact.tsx:61, 96-101` |

Formulations contradictoires relevées (texte exact) :
- `FinalCTA.tsx:34-35` : `un dossier juridique propre, validé par un professionnel.` — alors que `faq.ts:12` répond `C'est vous.` à « Qui prépare les dossiers ? » et que `features.ts:80` titre `Transmission validée par vous`.
- `Hero.tsx:8, 11` (carte) : `Statut → Validation pro (option)` et `Validation → Sous 24 h ouvrées` ; `Hero.tsx:159` : badge `En attente validation` — vocabulaire de validation par un tiers absent du reste du site.
- `Home.tsx:29` (JSON-LD) : `Transforme les demandes juridiques en dossiers structurés` vs H1 « dossier administratif et juridique ».

### 6.3 Ton et style rédactionnel

- Tutoiement : non ; vouvoiement systématique (`Vous`, `votre dossier`).
- Phrases courtes, affirmatives, souvent en deux temps avec point final dans les titres (`Six statuts. Aucun « entre-deux ».`, `Une formule par usage. Pas de surprise.`, `Le dossier vit dans l'ordre.`).
- Registre « anti-marketing » explicite : `Aucune n'est décorative.` (`FeaturesGrid.tsx:21`), `pas pour cocher une case dans un comparatif` (`FeaturesIndex.tsx:44-45`), `Pas de slide marketing` (`FeaturesIndex.tsx:100`), `Pas de formulaire en file d'attente, pas de tickets perdus.` (`Contact.tsx:64`), `sans jargon` (`Security.tsx:103`), `Le RGPD n'est pas une case à cocher.` (`features.ts:150`).
- Typographie française : guillemets « », espaces avant `:` `?` `!`, tirets cadratins `—`, nombres avec espace (`10 %`, `24 h`).
- Surtitres (kickers) en capitales espacées monospace : `Fonctionnalités`, `Espaces dédiés`, `Workflow`, `Cycle de vie du dossier`, `Sécurité & conformité`, `Tarifs`, `Journal`, `Foire aux questions`, `Passez à l'usage`.
- Vocabulaire produit récurrent : **dossier**, **pièces** (jamais « fichiers » dans les textes), **espace privé** / **espace sécurisé**, **tunnel de création en 5 étapes**, **étapes métier**, **page d'avancement** / **« Avancement du dossier »**, **récapitulatif**, **transmission** (e-mail ou WhatsApp), **validation explicite**, **échéances**, **isolation par utilisateur**, **liens signés temporaires**, **hébergeur sous-traitant conforme RGPD**, **administrateur unique**, **legaltech**.
- Charte visuelle sous-jacente (classes) : palette `navy-900` / `gold-500` / `cream-50` / `slate-500`, polices `font-display` + `font-mono`, classes `premium-*`, `hairline`, `sheen`, `shadow-gold`.

---

## 7. Écarts et incohérences factuelles relevées (sans interprétation)

| # | Constat | Réf. |
|---|---|---|
| 1 | `FeaturesGrid` titre `Huit briques…` mais itère sur `features` qui contient **9** entrées ; `FeaturesIndex` titre `Neuf briques…` et la meta description dit `Les neuf briques`. | `FeaturesGrid.tsx:17, 26` ; `features.ts:14-202` ; `FeaturesIndex.tsx:21, 40` |
| 2 | `BlogPreview` titre `Trois lectures…` mais affiche **tous** les `blogPosts` (7). | `BlogPreview.tsx:20, 33` ; `blog/index.ts:11-19` |
| 3 | `BlogIndex` sous-titre `Articles écrits par des avocats, des juristes IT et l'équipe éditoriale` ; un seul auteur déclaré (`Rédaction ClairDossier`), tous les articles ont `author: 'redaction'`. | `BlogIndex.tsx:52-53` ; `authors.ts:9-18` ; 7 fichiers blog `:11` |
| 4 | Labels de frise de la hero card (`Attente`, `Validation`) ≠ labels `statuses.ts` (`Transmis`, `En cours`). | `Hero.tsx:14-21` ; `statuses.ts:31, 40` |
| 5 | `FinalCTA` : `validé par un professionnel` vs FAQ `C'est vous.` / feature `Transmission validée par vous`. | `FinalCTA.tsx:35` ; `faq.ts:12` ; `features.ts:80` |
| 6 | Slugs d'URL publics obsolètes par rapport aux titres (`pieces-ocr`, `validation-avocat`, `messagerie-securisee`, `coffre-fort`, `calendrier-relances`, `reponse-auto-mails`) ; idem `id` internes `avocat`/`cabinet` (workspaces), `attente-avocat`/`validation` (statuts), `qui-valide`/`obligation-avocat`/`refus-avocat`/`compatible-cabinet`/`tarification-cabinet` (FAQ). | `features.ts:16-183` ; `workspaces.ts:47, 72` ; `statuses.ts:30, 39` ; `faq.ts:9-51` |
| 7 | Ordre de `blogPosts` non strictement décroissant par date (`rgpd-legaltech` 2026-04-28 et `ia-droit` 2026-05-02 en fin de liste). | `blog/index.ts:10-19` |
| 8 | Contact : `<form noValidate>` + aucune validation JS ; case de consentement sans `name` ; lien confidentialité en `<a href>` et non `<Link>`. | `Contact.tsx:124, 166-170, 173` |
| 9 | `PricingPreview` utilise `<Link to>` react-router pour des URL Stripe absolues. | `PricingPreview.tsx:117-122` |
| 10 | Tous les CTA « Créer un dossier » / « Essayer maintenant » mènent à une route protégée (`/dossier/nouveau` → `/connexion?next=…`) ; aucun CTA public ne pointe directement vers `/inscription`. | `App.tsx:107-116` ; `RequireAuth.tsx:25-28` |
| 11 | `Home.tsx` meta description cite `cabinets d'avocats` ; le Hero cible `PME · artisans · indépendants`. | `Home.tsx:47` ; `Hero.tsx:44` |
| 12 | `FeatureDetail` « Autres briques utiles » affiche toujours les 3 premières features de la liste (hors courante), pas une sélection liée. | `FeatureDetail.tsx:15` |
| 13 | `heroImageQuery` des articles et `howTo`/`HowToSchema` du type ne sont pas exploités à l'affichage (placeholder dégradé ; HowTo retiré par commentaire). | `types.ts:9-19, 32, 37` ; `BlogPost.tsx:75-76, 135-153` |
