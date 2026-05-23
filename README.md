# ClairDossier

ClairDossier est une base d'application LegalTech React/Vite pour structurer les dossiers juridiques, préparer le suivi client-avocat, publier un blog SEO/GEO et connecter Supabase + Stripe.

Slogan : **Votre dossier juridique, clair, structuré et suivi.**

## Stack

- React + Vite + TypeScript
- React Router
- Supabase client côté frontend, schéma SQL/RLS dans `supabase/migrations`
- Fonctions Supabase Edge pour Stripe Checkout, webhook Stripe, portail client et assistant IA blog
- SEO statique : `index.html`, `robots.txt`, `sitemap.xml`, Open Graph, JSON-LD Article/FAQ

## Lancer en local

```bash
npm install
npm run dev:payments
npm run dev
```

## Build production

```bash
npm run build
```

## Variables d'environnement

Copiez `.env.example` vers `.env` puis renseignez les valeurs nécessaires.

Variables publiques frontend :

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_PAYMENTS_API_URL`
- `VITE_STRIPE_PUBLIC_KEY`
- `VITE_SUPABASE_FUNCTIONS_URL`
- `VITE_STRIPE_CLIENT_ESSENTIEL_MONTHLY_PRICE_ID`
- `VITE_STRIPE_CLIENT_ESSENTIEL_YEARLY_PRICE_ID`
- `VITE_STRIPE_BUSINESS_MONTHLY_PRICE_ID`
- `VITE_STRIPE_BUSINESS_YEARLY_PRICE_ID`
- `VITE_STRIPE_CABINET_SOLO_MONTHLY_PRICE_ID`
- `VITE_STRIPE_CABINET_SOLO_YEARLY_PRICE_ID`
- `VITE_STRIPE_CABINET_PRO_MONTHLY_PRICE_ID`
- `VITE_STRIPE_CABINET_PRO_YEARLY_PRICE_ID`
- `VITE_STRIPE_CABINET_PREMIUM_MONTHLY_PRICE_ID`
- `VITE_STRIPE_CABINET_PREMIUM_YEARLY_PRICE_ID`

Variables serveur uniquement, à configurer dans Supabase Edge Functions ou l'environnement backend :

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `PAYMENTS_PORT`
- `STRIPE_ALLOWED_ORIGINS`
- `AI_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SITE_URL`
- les mêmes `VITE_STRIPE_*_PRICE_ID` que le frontend, ajoutés comme secrets Supabase Edge Functions

Variables GitHub Actions pour déployer Supabase :

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_REF`
- `SUPABASE_DB_PASSWORD`

Ne jamais exposer les clés secrètes Stripe, service role Supabase ou IA dans le frontend.

## Supabase

Appliquez la migration :

```bash
supabase db push
```

La migration crée les tables demandées : `profiles`, `contact_requests`, `newsletter_subscribers`, `demo_requests`, `cases`, `case_intake_answers`, `payments`, `subscriptions`, `blog_posts`, `blog_categories`, `audit_logs`, ainsi que `documents` et `messages` pour les espaces privés.

## Stripe

Le fichier backend Node `payments.js` expose :

- `GET /api/stripe-health` pour vérifier que Stripe est connecté et détecter le mode `test` ou `live` depuis `STRIPE_SECRET_KEY` ;
- `POST /api/create-checkout-session` pour créer une session Stripe Checkout en mode `subscription`.

Le frontend appelle ce backend via `/api/create-checkout-session` en local grâce au proxy Vite. En production, renseignez `VITE_PAYMENTS_API_URL` si le backend est hébergé sur un domaine différent du site.

La clé secrète Stripe doit être collée uniquement dans l'environnement serveur qui lance `payments.js` :

```bash
STRIPE_SECRET_KEY=sk_test_...
```

Utilisez une clé `sk_test_...` pour le mode test et une clé `sk_live_...` pour le mode live. Ne placez jamais `STRIPE_SECRET_KEY` dans une variable `VITE_*`.

Les prix Stripe Checkout sont calculés côté serveur depuis le catalogue de `payments.js` :

- Client Essentiel : 19 € / mois ou 205,20 € / an ;
- Business / PME : 79 € / mois ou 853,20 € / an ;
- Cabinet Solo : 99 € / mois ou 1 069,20 € / an ;
- Cabinet Pro : 249 € / mois ou 2 689,20 € / an.

Les abonnements annuels appliquent automatiquement une réduction de 10 % côté backend et dans l'affichage frontend.

Les boutons de tarifs appellent Stripe Checkout. Le paiement réel nécessite :

1. lancer `payments.js` avec `STRIPE_SECRET_KEY`, `SITE_URL` et `STRIPE_ALLOWED_ORIGINS` ;
2. ajouter `VITE_PAYMENTS_API_URL` si le backend n'est pas sur le même domaine que le frontend ;
3. conserver `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` pour lier le checkout aux comptes utilisateurs ;
4. configurer le webhook Stripe si vous utilisez la synchronisation Supabase des paiements et abonnements.

Stripe Checkout utilise les moyens de paiement automatiques. Les cartes, Apple Pay et PayPal peuvent apparaître au checkout si ces moyens sont activés et éligibles dans le Dashboard Stripe pour le pays, la devise, le navigateur et le type d'abonnement. Aucun moyen de paiement sensible ne doit être collecté dans le frontend.

Sans `STRIPE_SECRET_KEY`, `/api/stripe-health` renvoie `connected: false` et la création de session renvoie une erreur claire.

## Avertissement LegalTech

Les textes sont juridiquement prudents mais doivent être relus par un professionnel avant mise en production. L'IA ne remplace pas l'avocat et toute analyse doit être validée par un professionnel habilité.
