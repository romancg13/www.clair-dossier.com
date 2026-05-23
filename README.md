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

Les boutons de tarifs appellent `create-checkout-session`. Le paiement réel nécessite :

1. créer les produits Stripe et les Prices mensuels/annuels ;
2. ajouter les Price IDs dans les secrets GitHub `VITE_STRIPE_*_PRICE_ID` ;
3. ajouter `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_FUNCTIONS_URL` et `VITE_STRIPE_PUBLIC_KEY` dans les secrets GitHub ;
4. ajouter dans Supabase Edge Functions `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SITE_URL`, `SUPABASE_SERVICE_ROLE_KEY` et les mêmes `VITE_STRIPE_*_PRICE_ID` ;
5. lancer le workflow manuel `Deploy Supabase Stripe Functions` ;
6. redéployer GitHub Pages depuis `main` ;
7. créer le webhook Stripe vers `https://<project-ref>.functions.supabase.co/stripe-webhook`.

Sans cette configuration, le frontend affiche clairement que le paiement est bientôt disponible.

## Avertissement LegalTech

Les textes sont juridiquement prudents mais doivent être relus par un professionnel avant mise en production. L'IA ne remplace pas l'avocat et toute analyse doit être validée par un professionnel habilité.
