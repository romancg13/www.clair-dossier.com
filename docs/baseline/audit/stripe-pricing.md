# Audit PHASE 0 — Cartographie STRIPE & GRILLE TARIFAIRE (www.clair-dossier.com)

- Repository audité (lecture seule) : `/Users/Roman_784/Documents/Codex/2026-07-02/contrainte-absolue-ne-pas-toucher-aux/work/www.clair-dossier.com`
- Date de l'audit : 2026-08-23
- Méthode : lecture intégrale de `scripts/create-stripe-products.mjs`, `scripts/add-annual-prices.mjs`, `src/data/pricing.ts`, `src/pages/Pricing.tsx`, `src/components/sections/PricingPreview.tsx`, `public/tarifs.md`, `src/pages/Account.tsx`, `src/components/RequireAuth.tsx`, `netlify.toml`, `.github/workflows/deploy.yml`, `package.json` ; grep de « stripe », « buy.stripe.com », « price_ », « prod_ », « checkout », « portal », « abonnement », « essai », « paid », « webhook », « subscription », « customer » dans `src/`, `public/`, `supabase/`, `scripts/` ; lecture partielle ciblée de `src/data/legal.ts`, `src/pages/Login.tsx`, `src/pages/Contact.tsx`, `src/pages/Home.tsx`, `src/pages/Signup.tsx`, `scripts/gen-markdown.ts`, `supabase/migrations/*.sql`, `public/llms.txt`, `public/index.md` ; `git log` / `git show` en lecture seule pour dater les changements.
- Aucun fichier du repository n'a été modifié. Aucun fichier `.env` n'a été lu (seuls les **noms** de variables de `.env.example` ont été extraits via `cut -d= -f1`).
- Le dashboard Stripe n'a **pas** été consulté : tout ce qui concerne l'état réel du compte Stripe (IDs `prod_`/`price_`, liens actifs, taxes) est marqué « à confirmer dans le dashboard Stripe ».

---

## 1. Grille tarifaire actuelle telle qu'affichée

### 1.1 Source unique de vérité

La grille est entièrement définie dans `src/data/pricing.ts` (tableau `plans`, `src/data/pricing.ts:35-225`). Elle est consommée par :

| Consommateur | Fichier:ligne | Rôle |
|---|---|---|
| Page `/tarifs` | `src/pages/Pricing.tsx:195-199` (`plans.map`) | Affiche les 7 cartes, toggle mensuel/annuel |
| Section home « Tarifs » | `src/components/sections/PricingPreview.tsx:7-10` | Affiche 3 plans (`essentiel`, `business-pme-20`, `business-pme-pro`) en mensuel uniquement |
| Générateur markdown (build) | `scripts/gen-markdown.ts:101-115` (index.md/page.md) et `scripts/gen-markdown.ts:331-377` (tarifs.md) | Produit `public/tarifs.md`, `public/index.md`, `public/page.md` à chaque `npm run build` (`package.json:9`) |
| JSON-LD SEO | `src/pages/Pricing.tsx:112-121` (AggregateOffer 19→299 EUR, offerCount = 6) ; `src/pages/Home.tsx:21-27` (Offer price 19 EUR) | Données structurées |

Il n'existe **aucun champ add-on, option ou supplément** dans le type `Plan` (`src/data/pricing.ts:8-22`) ni dans `public/tarifs.md` (grep « add-on|option » : 0 résultat). Les mentions « add-ons » de `README.md:38` et `PLAN.md:112` (« 3 plans + toggle + matrice + add-ons ») sont **obsolètes** par rapport au code actuel (7 plans, pas d'add-ons).

Remise annuelle : `YEARLY_DISCOUNT = 0.1` (`src/data/pricing.ts:246`), équivalent mensuel = mensuel × 0,9 (`:249-251`), total annuel = mensuel × 12 × 0,9 (`:254-256`). Tous les prix sont affichés **HT** (FAQ `src/pages/Pricing.tsx:63-67`, CGV `src/data/legal.ts:166`, `public/tarifs.md:13` etc.).

### 1.2 Les sept formules (`src/data/pricing.ts:35-225`)

| # | id | Nom affiché | Audience (eyebrow) | Mensuel HT | Annuel HT (total, −10 %) | Équiv. mensuel annuel | Badge | Variante | CTA (label) | CTA mensuel (lien exact) | CTA annuel (lien exact) | Lignes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `essentiel` | Essentiel | Indépendant / EI | 19 € | 205,20 € | 17,10 € | — | light | S'abonner | `https://buy.stripe.com/00w9AT9Qm7fJ4vbeSibV605` | `https://buy.stripe.com/dRm9ATbYu6bF9PvfWmbV60b` | `:36-62` |
| 2 | `entrepreneur` | Entrepreneur | Entrepreneur / prof. libérale | 39 € | 421,20 € | 35,10 € | — | light | S'abonner | `https://buy.stripe.com/8x214n1jQ2Zt9Pvh0qbV606` | `https://buy.stripe.com/28EeVd9QmgQj7HndOebV60c` | `:63-89` |
| 3 | `business-pme-20` | Business PME 20 | TPE / PME | 49 € | 529,20 € | 44,10 € | « Populaire » | dark | S'abonner | `https://buy.stripe.com/5kQaEX7IeeIb4vb11sbV607` | `https://buy.stripe.com/14AbJ18MicA3e5L11sbV60d` | `:90-117` |
| 4 | `business-pme-50` | Business PME 50 | PME | 89 € | 961,20 € | 80,10 € | — | light | S'abonner | `https://buy.stripe.com/28E4gz8Mi9nRaTz25wbV608` | `https://buy.stripe.com/6oU00j5A69nR3r7bG6bV60e` | `:118-143` |
| 5 | `business-pme-pro` | Business / PME Pro | PME / multi-sites | 169 € | 1 825,20 € | 152,10 € | « Recommandé » | dark | S'abonner | `https://buy.stripe.com/5kQbJ1e6C7fJ6DjdOebV609` | `https://buy.stripe.com/cNifZh9Qm8jNe5L39AbV60f` | `:144-171` |
| 6 | `business-pme-premium` | Business / PME Premium | Entreprise | 299 € | 3 229,20 € | 269,10 € | — | light | S'abonner | `https://buy.stripe.com/9B628raUq8jNgdT8tUbV60a` | `https://buy.stripe.com/28EeVdaUq7fJd1H11sbV60g` | `:172-198` |
| 7 | `business-pme-sur-mesure` | Business / PME personnalisée | Grand compte | `null` → « Sur devis » | — | — | — | dark | Demander un devis | `/contact?plan=sur-mesure` | (aucun) | `:199-224` |

Les montants annuels ci-dessus sont ceux calculés par `yearlyTotal()` et ceux écrits dans `public/tarifs.md:17,37,57,77,97,117` ; ils coïncident avec la formule du script Stripe (`scripts/add-annual-prices.mjs:43`, `Math.round(monthly * 12 * 0.9 * 100)` centimes).

### 1.3 Promesse (description) et specs par plan

| id | Description affichée | Dossiers | Utilisateurs | Support | Lignes |
|---|---|---|---|---|---|
| `essentiel` | « Pour les indépendants et entrepreneurs individuels qui structurent leurs premiers dossiers. » | 5 dossiers | 1 utilisateur | Support email | `:40-51` |
| `entrepreneur` | « Pour les entrepreneurs et professions libérales avec un flux régulier de dossiers. » | 10 dossiers | 2 utilisateurs | Support email prioritaire | `:67-78` |
| `business-pme-20` | « Pour les TPE/PME avec plusieurs dossiers récurrents et une petite équipe. » | 20 dossiers | 5 utilisateurs | Support prioritaire | `:94-106` |
| `business-pme-50` | « Pour les PME qui gèrent de nombreux dossiers en parallèle. » | 50 dossiers | 5 utilisateurs | Support prioritaire | `:122-132` |
| `business-pme-pro` | « Pour les structures multi-collaborateurs avec statistiques et workflows avancés. » | Dossiers illimités | 15 utilisateurs | Support dédié | `:148-160` |
| `business-pme-premium` | « Solution entreprise : marque blanche, API, SSO, audit avancé. » | Dossiers illimités | Utilisateurs illimités | Support entreprise | `:176-187` |
| `business-pme-sur-mesure` | « Volumétrie, intégrations ou conformité spécifiques ? On construit une offre sur-mesure. » | Dossiers illimités | Utilisateurs illimités | Accompagnement dédié | `:203-213` |

### 1.4 Matrice exacte des fonctionnalités (`COMPARISON_FEATURES`, `src/data/pricing.ts:24-33`)

Les 8 fonctionnalités comparées, dans l'ordre d'affichage, avec leur **id interne** (hérité d'une ancienne grille « IA ») et leur **libellé actuel** :

| id interne | Libellé affiché (actuel) | Ancien libellé (avant commit `417708f` du 2026-06-26) |
|---|---|---|
| `messagerie` | Transmission par e-mail ou WhatsApp | Messagerie sécurisée |
| `calendrier` | Échéances affichées sur le dossier | Calendrier & relances à échéance |
| `resume-ia` | Récapitulatif du dossier | Résumé IA |
| `redaction-ia` | Suivi par étapes métier | Rédaction IA (projet de réponse) |
| `reponse-auto` | Dépôt de pièces sécurisé | Réponse automatisée aux e-mails |
| `ia-avancee` | Espace privé multi-dossiers | IA avancée (GPT-5.5) |
| `modeles` | Pièces téléchargeables | Modèles de documents |
| `recurrents` | Plusieurs dossiers en parallèle | Dossiers récurrents |

(Ancien libellé constaté via `git show 417708f -- src/data/pricing.ts`, lecture seule.)

Statuts par plan (`yes` = ✓, `limited` = « (limité) », `no` = ✗) :

| Fonctionnalité (libellé actuel) | Essentiel | Entrepreneur | PME 20 | PME 50 | Pro | Premium | Sur-mesure |
|---|---|---|---|---|---|---|---|
| Transmission par e-mail ou WhatsApp | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Échéances affichées sur le dossier | limité | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Récapitulatif du dossier | limité | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Suivi par étapes métier | ✗ | limité | ✓ | ✓ | ✓ | ✓ | ✓ |
| Dépôt de pièces sécurisé | ✗ | ✗ | limité | ✓ | ✓ | ✓ | ✓ |
| Espace privé multi-dossiers | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| Pièces téléchargeables | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Plusieurs dossiers en parallèle | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ |

Sources : `src/data/pricing.ts:52-61, 79-88, 107-116, 133-142, 161-170, 188-197, 214-223` ; rendu par `FeatureRow` (`src/pages/Pricing.tsx:552-591`) ; reproduit à l'identique dans `public/tarifs.md:23-31, 43-51, 63-71, 83-91, 103-111, 123-131, 141-149`.

### 1.5 Autres éléments de la page `/tarifs` (`src/pages/Pricing.tsx`)

| Élément | Contenu | Lignes |
|---|---|---|
| Titre H1 | « Une formule par usage. Pas de surprise. » | `:133-135` |
| Sous-titre | « De l'indépendant à l'entreprise — sept niveaux de service couvrent tous les usages. Compte gratuit, abonnement sans engagement. » | `:136-139` |
| Toggle | Mensuel / Annuel (badge « −10 % »), état React local `billing` | `:91, 141-186` |
| Bloc « Devis sur-mesure » | 4 capacités : Marque blanche complète ; API et webhooks dédiés (« SDK Node et Python disponibles ») ; SSO et audit renforcé (SAML 2.0, OIDC, DPA) ; Onboarding sur site (« Deux jours dans vos locaux ») | `:30-47, 228-262` |
| Contacts devis | WhatsApp (`buildWhatsAppUrl`, `WHATSAPP_DISPLAY`) ; `mailto:contact.clairdossier@icloud.com` ; lien `/contact?topic=commercial` | `:275-374` |
| Promesse devis | « proposition chiffrée écrite sous 48 h ouvrées » | `:377-380` |
| FAQ tarifs (5 entrées) | engagement (résiliation « depuis l'espace facturation », remboursement prorata) ; changement de plan (prorata) ; TVA (HT, 20 %, autoliquidation UE) ; essai (« Faut-il payer pour créer un compte ? » → non) ; annuel (facturé en une fois, −10 %, remboursement prorata) | `:49-80` |
| CTA finale | « Demander un devis » → `/contact` ; « Créer un compte gratuit » → `/inscription` | `:420-432` |
| Piliers de confiance | Données protégées ; Vous gardez la main ; Sans engagement (« Résiliez à tout moment ») | `src/data/pricing.ts:227-243` |

Remarques factuelles :
- Il n'existe **aucun plan gratuit** dans `plans` ; les branches `priceMonthly === 0` → « Gratuit » (`src/pages/Pricing.tsx:492-493`, `PricingPreview.tsx:88-89`, `gen-markdown.ts:103-104, 333-334`) sont du code mort. Le « compte gratuit » est la création de compte Supabase sans plan.
- Le mot « essai » n'apparaît que comme id de FAQ (`src/pages/Pricing.tsx:69`) ; il n'y a **aucune période d'essai** (pas de `trial_period_days` dans les scripts Stripe, cf. §2).
- Le CTA « sur devis » pointe vers `/contact?plan=sur-mesure` (`src/data/pricing.ts:208`) et le bloc devis vers `/contact?topic=commercial` (`Pricing.tsx:340`), mais `src/pages/Contact.tsx` n'utilise ni `useSearchParams` ni `useLocation` (grep : 0 résultat) : **les paramètres `plan` et `topic` sont ignorés**, le formulaire s'ouvre sur le sujet par défaut `'demo'` (`Contact.tsx:17`).

---

## 2. Intégration Stripe réelle

### 2.1 Nature de l'intégration

L'intégration Stripe se résume à **12 Stripe Payment Links codés en dur** dans `src/data/pricing.ts` (6 mensuels + 6 annuels, listés §1.2) et à **deux scripts Node d'administration** lancés manuellement. Il n'y a :
- aucune dépendance `stripe` ni `@stripe/stripe-js` dans `package.json:13-33` ; `node_modules/` ne contient aucun paquet `stripe` ; `package-lock.json` ne le référence pas (grep « "stripe » : 0). Les scripts (`import Stripe from 'stripe'`, `create-stripe-products.mjs:16`, `add-annual-prices.mjs:9`) ne peuvent donc tourner qu'avec une installation ad hoc non tracée.
- aucun code Stripe côté client (grep « stripe » dans `src/` : uniquement les 12 URLs de `pricing.ts` et 4 mentions légales textuelles dans `src/data/legal.ts:168, 279, 323, 430`).
- aucun code Stripe côté serveur : la seule Edge Function Supabase est `supabase/functions/notify-lead/index.ts` (grep « stripe|webhook » dans `supabase/functions/` : 0).
- aucune mention de `price_` ni `prod_` dans `src/`, `public/`, `scripts/`, `supabase/` (grep : 0). Les IDs Stripe ne sont stockés nulle part dans le repo.

### 2.2 Navigation vers Stripe

Les CTA sont rendus par `<Link to={...}>` de `react-router-dom` 7.15.1 (`src/pages/Pricing.tsx:542-547`, `PricingPreview.tsx:117-122`). React Router détecte une origine différente et marque le lien `isExternal` (`node_modules/react-router/dist/development/chunk-4N6VE7H7.mjs:1010-1030`) : un `<a href="https://buy.stripe.com/…">` standard est rendu et le navigateur effectue une navigation complète **dans le même onglet** (pas de `target="_blank"`, pas de `rel`). Aucun paramètre n'est ajouté à l'URL (pas de `?client_reference_id=`, pas de `?prefilled_email=`) : Stripe ne reçoit **aucune information sur l'utilisateur connecté**.

Sur la page `/tarifs`, le lien choisi dépend du toggle : `isYearly && plan.ctaHrefYearly ? plan.ctaHrefYearly : plan.ctaHref` (`Pricing.tsx:543`). Sur la home, `PricingPreview.tsx:118` utilise toujours `plan.ctaHref` (mensuel).

### 2.3 Script `scripts/create-stripe-products.mjs` (109 lignes, lu intégralement)

| Aspect | Détail | Lignes |
|---|---|---|
| Variable d'env attendue | `STRIPE_SECRET_KEY` (préfixe obligatoire `sk_test_`/`sk_live_`/`rk_test_`/`rk_live_`) | `:18-26` |
| Version API | `2024-12-18.acacia` | `:28` |
| Constantes | `SOURCE = 'clair-dossier-showcase'` ; `SITE_URL = 'https://www.clair-dossier.com'` | `:29-30` |
| Étape 1 `archiveOld()` | Désactive (`active:false`) tous les Payment Links actifs ayant `metadata.planId` **ou** `metadata.source === SOURCE` ; archive tous les produits actifs ayant `metadata.source === SOURCE`. **Les prix ne sont pas archivés.** | `:49-65` |
| Étape 2 `createPlanFlow()` par plan | 1 produit (`name`, `description`, `metadata: {planId, source}`) ; 1 prix `unit_amount = monthlyEuros*100`, `currency: 'eur'`, `recurring: {interval: 'month'}`, `metadata: {planId}` ; 1 Payment Link (`line_items: [{price, quantity: 1}]`, `after_completion: redirect → https://www.clair-dossier.com/compte?paid=<planId>`, `allow_promotion_codes: true`, `billing_address_collection: 'auto'`, `payment_method_collection: 'always'`, `metadata: {planId, source}`) | `:67-93` |
| Sortie | Console : `productId | priceId | paymentLink.url` par plan, puis JSON `{planId: url}` « à coller dans pricing.ts » | `:91, 104-106` |
| Plan « sur devis » | Explicitement exclu | `:33` |
| Non configuré | pas de `tax_behavior` / `automatic_tax`, pas de `trial_period_days`, pas de `consent_collection`, pas de `custom_fields`, pas de `customer_creation`, pas de `subscription_data` (ex. `trial`, `metadata`), pas de `cancel_url` (n'existe pas sur Payment Links) | (absence constatée sur `:68-90`) |

Produits et prix **mensuels** créés par le script (`PLANS`, `:34-47`) :

| planId | Nom du produit Stripe | Description produit Stripe (texte exact) | Prix mensuel | Devise | Intervalle |
|---|---|---|---|---|---|
| `essentiel` | ClairDossier — Essentiel | « Pour les indépendants et entrepreneurs individuels qui structurent leurs premiers dossiers. 5 dossiers, 1 utilisateur, calendrier et relances à échéance, résumé IA. » | 1 900 c (19 €) | eur | month |
| `entrepreneur` | ClairDossier — Entrepreneur | « Pour les entrepreneurs et professions libérales avec un flux régulier de dossiers. 10 dossiers, 2 utilisateurs, rédaction IA (projet de réponse), modèles. » | 3 900 c (39 €) | eur | month |
| `business-pme-20` | ClairDossier — Business PME 20 | « Pour les TPE/PME. 20 dossiers, 5 utilisateurs, support prioritaire, rédaction IA, dossiers récurrents. » | 4 900 c (49 €) | eur | month |
| `business-pme-50` | ClairDossier — Business PME 50 | « Pour les PME avec plusieurs dossiers en parallèle. 50 dossiers, 5 utilisateurs, support prioritaire, réponse automatisée aux e-mails, IA complète. » | 8 900 c (89 €) | eur | month |
| `business-pme-pro` | ClairDossier — Business / PME Pro | « Pour les PME et structures multi-collaborateurs. Dossiers illimités, 15 utilisateurs, statistiques avancées, IA avancée (GPT-5.5). » | 16 900 c (169 €) | eur | month |
| `business-pme-premium` | ClairDossier — Business / PME Premium | « Solution entreprise : marque blanche, API, SSO, audit avancé. Utilisateurs et dossiers illimités, support dédié. » | 29 900 c (299 €) | eur | month |

Metadata : produit `{planId, source:'clair-dossier-showcase'}` (`:71`) ; prix `{planId}` (`:78`) ; Payment Link `{planId, source}` (`:89`).

### 2.4 Script `scripts/add-annual-prices.mjs` (72 lignes, lu intégralement)

| Aspect | Détail | Lignes |
|---|---|---|
| Variable d'env attendue | `STRIPE_SECRET_KEY` (même regex) | `:11-15` |
| Version API / constantes | `2024-12-18.acacia` ; mêmes `SOURCE`, `SITE_URL` | `:16-18` |
| Idempotence | **Non idempotent** — « relancer crée des doublons de prix » (commentaire `:5`) ; aucune archivage préalable | `:5, 30-64` |
| Résolution des produits | Liste les produits actifs avec `metadata.source === SOURCE` et `metadata.planId`, construit `{planId → productId}` | `:32-35` |
| Par plan | 1 prix `unit_amount = Math.round(monthly*12*0.9*100)`, `currency: 'eur'`, `recurring: {interval: 'year'}`, `metadata: {planId, billing:'yearly'}` ; 1 Payment Link identique au mensuel (`after_completion` redirect `/compte?paid=<planId>`, `allow_promotion_codes`, `billing_address_collection:'auto'`, `payment_method_collection:'always'`), `metadata: {planId, source, billing:'yearly'}` | `:37-63` |
| Sortie | JSON `{planId: url}` « ANNUAL PAYMENT LINKS » | `:65-66` |

Prix **annuels** créés (`MONTHLY`, `:21-28`) :

| planId | Montant annuel (centimes) | Montant annuel | Intervalle |
|---|---|---|---|
| `essentiel` | 20 520 | 205,20 € | year |
| `entrepreneur` | 42 120 | 421,20 € | year |
| `business-pme-20` | 52 920 | 529,20 € | year |
| `business-pme-50` | 96 120 | 961,20 € | year |
| `business-pme-pro` | 182 520 | 1 825,20 € | year |
| `business-pme-premium` | 322 920 | 3 229,20 € | year |

Point d'attention : le redirect annuel est **identique** au mensuel (`/compte?paid=<planId>`, sans `billing=yearly`) ; le site ne peut donc pas distinguer un paiement annuel d'un mensuel au retour.

### 2.5 Chronologie (git, lecture seule)

| Date | Commit | Fait |
|---|---|---|
| 2026-06-09 | `c3048f2` | Ajout de `scripts/create-stripe-products.mjs` |
| 2026-06-11 | `32db65d` | « wire Stripe payment links + deploy to Netlify » |
| 2026-06-15 | `bd5f1e7` | Nouvelle grille 6+1 plans ; les 6 Payment Links **mensuels** actuels entrent dans `pricing.ts` ; `PLANS` du script mis à jour |
| 2026-06-18 | `9d63b0a` | Ajout de `scripts/add-annual-prices.mjs` et des 6 Payment Links **annuels** actuels |
| 2026-06-26 | `417708f` | Renommage des 8 libellés de fonctionnalités sur le site (cf. §1.4) — **les descriptions produits Stripe du script et `public/llms.txt:56-61` n'ont pas été réalignés** (ils parlent encore de « résumé IA », « rédaction IA », « IA avancée (GPT-5.5) », « réponse automatisée aux e-mails ») |

Je n'ai pas de preuve dans le repo que les scripts ont effectivement été exécutés en mode LIVE, ni de quelle version des descriptions les produits Stripe actuels portent : **à confirmer dans le dashboard Stripe**.

### 2.6 Variables d'environnement (noms seulement)

| Nom | Où | Usage |
|---|---|---|
| `STRIPE_SECRET_KEY` | `scripts/create-stripe-products.mjs:18`, `scripts/add-annual-prices.mjs:11` | Clé secrète ou restreinte Stripe, uniquement pour les scripts d'admin ; **absente** de `.env.example` et de `.github/workflows/deploy.yml` |
| `VITE_SUPABASE_URL` | `.env.example`, `.github/workflows/deploy.yml:42` | Supabase (pas Stripe) |
| `VITE_SUPABASE_ANON_KEY` | `.env.example`, `.github/workflows/deploy.yml:43` | Supabase (pas Stripe) |
| `VITE_BASE_PATH` | `.github/workflows/deploy.yml:40` | Base path Vite |

Aucune variable `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY`, `VITE_STRIPE_*` n'existe dans le repo (grep : 0).

### 2.7 Déploiement et CSP

- Le déploiement effectif est **GitHub Pages** (`.github/workflows/deploy.yml:1-6, 45-58`), Netlify étant « déployé en parallèle » (`deploy.yml:5-6`).
- `netlify.toml:26` définit une CSP dont `form-action 'self' https://buy.stripe.com`. Ces en-têtes **ne s'appliquent pas** sur GitHub Pages (pas de mécanisme d'en-têtes personnalisés là-bas). Sans incidence sur le parcours actuel : les Payment Links sont des navigations `<a href>`, pas des soumissions de formulaire.

---

## 3. Ce qui N'EXISTE PAS (constats d'absence)

| Composant | Constat | Preuve |
|---|---|---|
| **Webhook Stripe** | Aucun endpoint. | Seule fonction serveur : `supabase/functions/notify-lead/index.ts` (`find supabase -type f`). grep « webhook » dans `src/`+`supabase/`+`scripts/` : un seul résultat, le texte marketing « API et webhooks dédiés » (`src/pages/Pricing.tsx:36`). Aucune fonction Netlify (`netlify.toml` ne déclare pas de `[functions]`), aucun dossier `netlify/functions`. |
| **Table `subscriptions` / colonne plan** | Aucune. | Tables créées par les migrations : `profiles` (`supabase/migrations/20260615201942_clair_dossier_init.sql:5-17` — colonnes `id, full_name, company_name, company_type, phone, created_at, updated_at`), `dossiers` (`:20-30`), `dossier_documents` (`:35-43`), `app_admins` (`20260621144123_admin_global_access.sql:11`). grep « stripe|subscription|customer|billing|plan » dans `supabase/migrations/` : 0 résultat. |
| **Customer Portal Stripe** | Aucun lien ni appel. | grep « portal » dans `src/`, `public/`, `supabase/`, `scripts/` : 0. `src/pages/Account.tsx` (lu intégralement, 196 lignes) n'affiche aucun bloc facturation, aucun plan, aucun bouton « gérer mon abonnement ». Pourtant la FAQ promet une résiliation « depuis l'espace facturation » (`src/pages/Pricing.tsx:54`) et les CGV « via l'espace client » (`src/data/legal.ts:178`, `public/cgv.md:34`). |
| **Mapping user ↔ Stripe customer** | Aucun. | `profiles` n'a pas de `stripe_customer_id` (`clair_dossier_init.sql:5-17`). Les Payment Links sont appelés sans `client_reference_id` ni `prefilled_email` (`src/data/pricing.ts:45-182`, `Pricing.tsx:543`). `src/lib/auth.tsx` / `src/lib/supabase.ts` : grep « plan|subscription|customer|stripe » → 0 (la seule occurrence `sub.subscription.unsubscribe()` `auth.tsx:71` est l'API Supabase `onAuthStateChange`). |
| **Gating des fonctionnalités par abonnement** | Aucun. | grep « quota|max_dossiers|plan_id|planId|tier|upgrade » dans `src/` (hors `pricing.ts`) : 0 résultat (seules des classes CSS `.premium-*` dans `src/index.css:171-241`). Les RLS Supabase (`clair_dossier_init.sql:52-63`) n'imposent que `auth.uid() = user_id`, aucune limite de nombre de dossiers/utilisateurs. Un compte gratuit a donc le même accès qu'un compte payant. |
| **Checkout Session / Stripe.js** | Aucun. | grep « checkout » : seul `actions/checkout@v4` (`deploy.yml:26`). Pas de `@stripe/stripe-js` dans `package.json`. |
| **Période d'essai** | Aucune. | Pas de `trial_period_days` / `subscription_data` dans les deux scripts ; « essai » n'est qu'un id de FAQ (`Pricing.tsx:69`). |
| **Stockage des IDs Stripe** | Aucun. | grep « price_ » / « prod_ » : 0 résultat dans tout le repo hors `node_modules`. |
| **SDK `stripe` installé** | Non. | Absent de `package.json`, `package-lock.json`, `node_modules/`. |
| **Variables d'env Stripe dans le déploiement** | Non. | `deploy.yml:39-43` n'injecte que `VITE_BASE_PATH`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. |

---

## 4. Parcours utilisateur actuel de paiement

### 4.1 Étapes

| Étape | Ce qui se passe | Preuve |
|---|---|---|
| 1. Choix du plan | Sur `/tarifs` (ou home), clic « S'abonner ». Le lien est un `<a href="https://buy.stripe.com/…">` (mensuel ou annuel selon le toggle sur `/tarifs`, toujours mensuel sur la home). Navigation **même onglet**, **sans** identifiant utilisateur. L'utilisateur **n'a pas besoin d'être connecté** ni d'avoir un compte. | `Pricing.tsx:542-547`, `PricingPreview.tsx:117-122`, `pricing.ts:45-182` |
| 2. Stripe Payment Link | Page de paiement hébergée par Stripe : e-mail, carte, adresse de facturation « auto », codes promo autorisés. Le nom/description du produit affichés sont ceux du dashboard Stripe (cf. risque de divergence §6). | `create-stripe-products.mjs:80-90`, `add-annual-prices.mjs:51-61` |
| 3. Après paiement | Stripe redirige vers `https://www.clair-dossier.com/compte?paid=<planId>` (ex. `/compte?paid=business-pme-20`). Même URL pour mensuel et annuel. | `create-stripe-products.mjs:82-85`, `add-annual-prices.mjs:53-56` |
| 4a. Retour, utilisateur connecté | `/compte` est protégé par `RequireAuth` ; la page `Account` lit `params.get('paid')` et affiche un bandeau « Abonnement confirmé — Merci — votre paiement a bien été pris en compte. Votre abonnement est actif. » **Aucune vérification** n'est faite : le bandeau s'affiche pour n'importe quelle valeur de `paid` (ex. `/compte?paid=x` saisi à la main). Rien n'est écrit en base. | `App.tsx:133-142`, `Account.tsx:31, 89-98` |
| 4b. Retour, utilisateur non connecté | `RequireAuth` redirige vers `/connexion?next=%2Fcompte%3Fpaid%3D<planId>` ; après login, `Login.tsx` navigue vers `next` (le bandeau s'affiche alors). `Login` propage aussi `next` vers `/inscription` si l'utilisateur n'a pas de compte. | `RequireAuth.tsx:25-28`, `Login.tsx:11, 28, 84` |
| 4c. Cas « auth non configurée » | Si le build n'a pas les variables Supabase, `RequireAuth` laisse passer (`configured && !session` faux). | `RequireAuth.tsx:24-28` |
| 5. Ensuite | Rien. Aucun changement de droits, aucun plan affiché dans `/compte`, aucun moyen de gérer/annuler l'abonnement depuis le site. Le lien entre le paiement (e-mail saisi chez Stripe) et le compte Supabase (e-mail de login) n'existe que si l'opérateur le fait **manuellement** dans le dashboard Stripe. | `Account.tsx` (intégral), §3 |

### 4.2 Schéma

```
/tarifs ──clic S'abonner──▶ buy.stripe.com/<link> ──paiement OK──▶ /compte?paid=<planId>
   │                               │                                      │
   │ (aucun user id transmis)      │ (abandon : pas de cancel_url,        ├─ connecté : bandeau "Abonnement confirmé" (non vérifié)
   │                               │  l'utilisateur utilise "retour")     └─ non connecté : /connexion?next=… → /compte?paid=…
   │                                                                                        (puis même bandeau)
   └─ "Demander un devis" ──▶ /contact?plan=sur-mesure  (param ignoré par Contact.tsx)
```

---

## 5. Table CURRENT PLAN → STRIPE PRICE → FEATURES (base de migration V.3)

Légende : « à confirmer » = à confirmer dans le dashboard Stripe (aucun ID `prod_`/`price_`/`plink_` n'est stocké dans le repo ; seuls les URLs publics `buy.stripe.com/...` sont connus).

| Plan (id site) | Nom produit Stripe attendu (metadata `planId`) | Stripe product id | Prix mensuel (attendu) | Stripe price id mensuel | Payment Link mensuel (connu) | Prix annuel (attendu) | Stripe price id annuel | Payment Link annuel (connu) | Dossiers / Users / Support | Features ✓ (libellés actuels) | Features limité | Features ✗ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `essentiel` | ClairDossier — Essentiel (`planId=essentiel`, `source=clair-dossier-showcase`) | à confirmer | 19 €/mois EUR, interval=month, metadata `{planId}` | à confirmer | `https://buy.stripe.com/00w9AT9Qm7fJ4vbeSibV605` | 205,20 €/an EUR, interval=year, metadata `{planId, billing:yearly}` | à confirmer | `https://buy.stripe.com/dRm9ATbYu6bF9PvfWmbV60b` | 5 / 1 / Support email | messagerie | calendrier, resume-ia | redaction-ia, reponse-auto, ia-avancee, modeles, recurrents |
| `entrepreneur` | ClairDossier — Entrepreneur | à confirmer | 39 €/mois | à confirmer | `https://buy.stripe.com/8x214n1jQ2Zt9Pvh0qbV606` | 421,20 €/an | à confirmer | `https://buy.stripe.com/28EeVd9QmgQj7HndOebV60c` | 10 / 2 / Support email prioritaire | messagerie, calendrier, resume-ia, modeles | redaction-ia | reponse-auto, ia-avancee, recurrents |
| `business-pme-20` | ClairDossier — Business PME 20 | à confirmer | 49 €/mois | à confirmer | `https://buy.stripe.com/5kQaEX7IeeIb4vb11sbV607` | 529,20 €/an | à confirmer | `https://buy.stripe.com/14AbJ18MicA3e5L11sbV60d` | 20 / 5 / Support prioritaire | messagerie, calendrier, resume-ia, redaction-ia, modeles, recurrents | reponse-auto | ia-avancee |
| `business-pme-50` | ClairDossier — Business PME 50 | à confirmer | 89 €/mois | à confirmer | `https://buy.stripe.com/28E4gz8Mi9nRaTz25wbV608` | 961,20 €/an | à confirmer | `https://buy.stripe.com/6oU00j5A69nR3r7bG6bV60e` | 50 / 5 / Support prioritaire | messagerie, calendrier, resume-ia, redaction-ia, reponse-auto, modeles, recurrents | — | ia-avancee |
| `business-pme-pro` | ClairDossier — Business / PME Pro | à confirmer | 169 €/mois | à confirmer | `https://buy.stripe.com/5kQbJ1e6C7fJ6DjdOebV609` | 1 825,20 €/an | à confirmer | `https://buy.stripe.com/cNifZh9Qm8jNe5L39AbV60f` | illimité / 15 / Support dédié | les 8 | — | — |
| `business-pme-premium` | ClairDossier — Business / PME Premium | à confirmer | 299 €/mois | à confirmer | `https://buy.stripe.com/9B628raUq8jNgdT8tUbV60a` | 3 229,20 €/an | à confirmer | `https://buy.stripe.com/28EeVdaUq7fJd1H11sbV60g` | illimité / illimité / Support entreprise | les 8 | — | — |
| `business-pme-sur-mesure` | (aucun produit Stripe — exclu par `create-stripe-products.mjs:33`) | n/a | Sur devis | n/a | `/contact?plan=sur-mesure` (interne) | n/a | n/a | n/a | illimité / illimité / Accompagnement dédié | les 8 | — | — |

Correspondance id interne → libellé actuel : voir §1.4 (ex. `redaction-ia` = « Suivi par étapes métier », `ia-avancee` = « Espace privé multi-dossiers »).

Autres inconnues à confirmer dans le dashboard Stripe :
- Mode LIVE vs TEST des 12 liens (le script accepte les deux, `create-stripe-products.mjs:23, 96`).
- Si `create-stripe-products.mjs` a été relancé **après** `add-annual-prices.mjs`, `archiveOld()` a désactivé les liens annuels (ils portent `metadata.planId`, `:54`) : vérifier que les 6 liens annuels sont toujours actifs.
- Nombre de prix par produit (doublons possibles si `add-annual-prices.mjs` a été lancé plusieurs fois, `:5`).
- Descriptions produits réellement en ligne (version « IA » du script ou corrigée à la main).
- Configuration TVA (`automatic_tax`) et collecte du consentement CGV : non définies par les scripts, donc dépendantes du dashboard.
- Existence d'abonnements actifs et de clients Stripe à migrer (et leur e-mail pour rapprochement avec `auth.users`).

---

## 6. Risques business et techniques

### 6.1 Risques business

| # | Risque | Gravité | Preuve |
|---|---|---|---|
| B1 | **Paiement sans contrepartie technique** : un client qui paie n'obtient aucun droit supplémentaire (pas de gating) et un non-payeur a tout. Le modèle d'abonnement est purement déclaratif. | Élevée | §3 (absence de gating, RLS `clair_dossier_init.sql:52-63`) |
| B2 | **Promesses contractuelles non tenues** : FAQ « résiliables à tout moment depuis l'espace facturation » (`Pricing.tsx:54`), CGV « via l'espace client » (`legal.ts:178`), « changement de plan… prorata » (`Pricing.tsx:60`, `legal.ts:168`) — aucun espace facturation, aucun portail, aucun changement de plan possible côté site. Toute résiliation/changement passe par e-mail et action manuelle dans Stripe. | Élevée | `Account.tsx` intégral ; grep « portal » : 0 |
| B3 | **Divergence entre la page Tarifs et la page de paiement Stripe** : les libellés de fonctionnalités ont été dé-« IA-isés » le 2026-06-26 (`417708f`), mais les descriptions produits du script (`create-stripe-products.mjs:36-46`) et `public/llms.txt:56-61` promettent toujours « résumé IA », « rédaction IA », « IA avancée (GPT-5.5) », « réponse automatisée aux e-mails ». Si les produits Stripe n'ont pas été mis à jour à la main, le client lit une promesse différente au moment de payer (risque de pratique commerciale trompeuse). | Élevée | §1.4, §2.5 ; à confirmer dans le dashboard Stripe |
| B4 | **CGV incohérentes avec l'annuel** : l'article 3 des CGV dit « La facturation est mensuelle » (`legal.ts:168`, `public/cgv.md:30`) alors que 6 liens annuels sont vendus (`pricing.ts:46-182`) et que la FAQ décrit l'annuel (`Pricing.tsx:75-79`). | Moyenne | fichiers cités |
| B5 | **Bandeau « Abonnement confirmé » falsifiable et non vérifié** (`Account.tsx:89-98`) : n'importe qui peut afficher `/compte?paid=x`. Peut induire en erreur le support et le client (ex. paiement échoué mais redirect quand même impossible — toutefois l'URL est devinable). | Moyenne | `Account.tsx:31, 89` |
| B6 | **Rapprochement client ↔ compte manuel** : l'e-mail saisi sur Stripe peut différer de l'e-mail Supabase ; aucun `client_reference_id`. Le support ne peut pas savoir, depuis le site, qui a payé quoi. | Élevée | §2.2, §3 |
| B7 | **TVA / HT** : le site annonce HT + TVA 20 % + autoliquidation UE (`Pricing.tsx:66`, `legal.ts:166`) mais les scripts ne configurent ni `automatic_tax` ni `tax_behavior`. Si rien n'est configuré dans le dashboard, Stripe encaisse 19 € « TTC » de facto ou sans TVA. | Moyenne | `create-stripe-products.mjs:73-90` ; à confirmer dans le dashboard Stripe |
| B8 | **Pas d'acceptation des CGV au checkout** : aucun `consent_collection` dans les Payment Links ; les CGV disent « Toute souscription emporte acceptation » (`legal.ts:128`). | Faible-Moyenne | `create-stripe-products.mjs:80-90` |
| B9 | **Paramètres `?plan=sur-mesure` / `?topic=commercial` ignorés** par `/contact` : perte de contexte commercial sur les demandes de devis. | Faible | `pricing.ts:208`, `Pricing.tsx:340`, `Contact.tsx` (pas de `useSearchParams`) |
| B10 | **Documentation interne obsolète** (README « 3 plans + add-ons », PLAN.md idem). | Faible | `README.md:38`, `PLAN.md:112` |

### 6.2 Risques techniques

| # | Risque | Gravité | Preuve |
|---|---|---|---|
| T1 | **Aucun webhook** : aucune source de vérité côté application sur l'état des abonnements (créés, impayés, annulés, expirés). Toute logique future de gating devra partir de zéro (`checkout.session.completed`, `customer.subscription.*`, `invoice.payment_failed`). | Élevée | §3 |
| T2 | **IDs Stripe non versionnés** : seuls les URLs `buy.stripe.com` sont en dur ; aucune table de mapping planId → price id. Une migration V.3 doit d'abord exporter ces IDs depuis le dashboard. | Élevée | grep « price_|prod_ » : 0 |
| T3 | **`create-stripe-products.mjs` est destructif pour les liens en dur** : `archiveOld()` désactive tous les Payment Links avec `metadata.planId` (y compris les annuels) et archive les produits ; les 12 URLs codées dans `pricing.ts` deviennent mortes jusqu'à mise à jour manuelle du code + redéploiement. Les prix orphelins ne sont pas archivés. | Élevée | `create-stripe-products.mjs:49-65, 104-106` |
| T4 | **`add-annual-prices.mjs` non idempotent** : relance = doublons de prix et de liens. | Moyenne | `add-annual-prices.mjs:5` |
| T5 | **SDK `stripe` non déclaré** : les scripts ne sont pas reproductibles (`package.json` sans `stripe`, `node_modules` sans `stripe`). | Moyenne | `package.json:13-33` |
| T6 | **Redirect identique mensuel/annuel** (`/compte?paid=<planId>` sans `billing`) : impossible de distinguer la périodicité au retour. | Faible | `add-annual-prices.mjs:55` vs `create-stripe-products.mjs:84` |
| T7 | **Redirect en dur sur `https://www.clair-dossier.com`** (`SITE_URL`) : les environnements de test/preview (Netlify `clair-dossier.netlify.app`, GitHub Pages) reçoivent le retour sur la prod. | Faible | `create-stripe-products.mjs:30`, `add-annual-prices.mjs:18` |
| T8 | **Pas d'URL d'annulation** (limitation Payment Links) : un abandon de paiement laisse l'utilisateur sur Stripe ; le retour dépend du bouton « retour » du navigateur. | Faible | nature des Payment Links (`create-stripe-products.mjs:80-90`) |
| T9 | **CSP Netlify inopérante en prod** : déploiement réel sur GitHub Pages (`deploy.yml:3-6`), les en-têtes de `netlify.toml:19-26` ne s'appliquent pas. Pas bloquant pour Stripe aujourd'hui, mais à reprendre si un Checkout embarqué (`js.stripe.com`, `api.stripe.com`) est introduit en V.3 (la CSP actuelle n'autorise ni `script-src` ni `connect-src` Stripe). | Moyenne (pour V.3) | `netlify.toml:26` |
| T10 | **Schéma DB sans notion de plan** : `profiles` (`clair_dossier_init.sql:5-17`) n'a ni `plan`, ni `stripe_customer_id`, ni `subscription_status` ; aucune RLS ne lit de plan. Toute migration V.3 implique migration SQL + RLS + front. | Élevée | §3 |
| T11 | **Code mort « Gratuit »** (`priceMonthly === 0`) dans 3 fichiers ; aucun plan gratuit n'existe, alors que le marketing parle de « compte gratuit » sans en définir les limites (dossiers/utilisateurs). | Faible | `Pricing.tsx:492`, `PricingPreview.tsx:88`, `gen-markdown.ts:103, 333` |

---

## Annexe A — Commandes de grep exécutées (pour reproductibilité)

- `grep -rniI "stripe" src/ public/` → 12 URLs dans `src/data/pricing.ts`, 4 mentions légales `src/data/legal.ts:168,279,323,430`, 4 mentions dans `public/politique-confidentialite.md:24,44`, `public/cookies.md:28`, `public/cgv.md:30`.
- `grep -rniI "buy.stripe.com"` hors `pricing.ts` → `netlify.toml:26` uniquement.
- `grep -rniI "price_"` / `"prod_"` → 0.
- `grep -rniI "checkout"` → `.github/workflows/deploy.yml:26` (actions/checkout) uniquement.
- `grep -rniI "portal"` → 0.
- `grep -rniI "abonnement"` → textes marketing/légaux (`PricingPreview.tsx:24`, `legal.ts:128,150,154,178`, `Pricing.tsx:72,78,138`, `Account.tsx:92,95`, `Home.tsx:26`, `Signup.tsx:69`, `llms.txt:54`, `tarifs.md:9`, `cgv.md:12,22,24,34`, `gen-markdown.ts:322`) — aucune logique.
- `grep -rniI "essai"` → `Pricing.tsx:69` (id FAQ) ; autres résultats = « nécessaire(s) » (faux positifs).
- `grep -rniI "paid"` → `Account.tsx:31,89`, `create-stripe-products.mjs:84`, `add-annual-prices.mjs:55`.
- `grep -rniI "webhook"` → `Pricing.tsx:36` (texte marketing).
- `grep -rniI "subscription"` → `src/lib/auth.tsx:71` (API Supabase, faux positif).
- `grep -rniI "customer"` → `src/lib/seo.tsx:96` (« customer support », faux positif).
- Liens présents dans `dist/` (build du 2026-08-23) : les 12 mêmes URLs que `src/data/pricing.ts` (aucune URL différente).

## Annexe B — Fichiers non lus

- `.env` (interdit, et inexistant/gitignoré — `.gitignore:14-16`).
- Contenu des pages blog, `src/data/features.ts`, `src/data/workspaces.ts`, `src/pages/DossierFlow.tsx`, `src/pages/DossierDetail.tsx` : non lus intégralement (seuls des grep ciblés y ont été faits, sans résultat lié à Stripe/abonnement).
- Dashboard Stripe : non consulté.
