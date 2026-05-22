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

Variables serveur uniquement, à configurer dans Supabase Edge Functions ou l'environnement backend :

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `AI_API_KEY`
- `AI_PROVIDER_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SITE_URL`
- `STRIPE_PRICE_CLIENT_ESSENTIAL`
- `STRIPE_PRICE_BUSINESS`
- `STRIPE_PRICE_CABINET_SOLO`
- `STRIPE_PRICE_CABINET_PRO`

Ne jamais exposer les clés secrètes Stripe, service role Supabase ou IA dans le frontend.

## Supabase

Appliquez la migration :

```bash
supabase db push
```

La migration crée les tables demandées : `profiles`, `contact_requests`, `newsletter_subscribers`, `demo_requests`, `cases`, `case_intake_answers`, `payments`, `subscriptions`, `blog_posts`, `blog_categories`, `audit_logs`, ainsi que `documents` et `messages` pour les espaces privés.

## Stripe

Les formules payantes appellent `create-checkout-session`. La formule Découverte démarre sans paiement et Cabinet Premium passe par une demande de démo/devis. Le paiement réel nécessite :

1. clés Stripe test ;
2. produits/prices Stripe ;
3. variables `STRIPE_PRICE_*` ;
4. déploiement des Edge Functions ;
5. webhook Stripe pointant vers `stripe-webhook`.
6. portail client Stripe activé si vous souhaitez permettre la gestion autonome des abonnements.

Sans cette configuration, le frontend affiche clairement que le paiement est bientôt disponible.

## Espaces privés

Les routes `/dashboard`, `/mes-dossiers`, `/documents`, `/messages`, `/paiements`, `/abonnement`, `/parametres` et `/cabinet/*` sont protégées par Supabase Auth côté interface. Les données sensibles doivent rester protégées par les politiques RLS de la migration et par des contrôles de rôle côté fonctions serveur.

## Avertissement LegalTech

Les textes sont juridiquement prudents mais doivent être relus par un professionnel avant mise en production. L'IA ne remplace pas l'avocat et toute analyse doit être validée par un professionnel habilité.
