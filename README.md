# ClairDossier

ClairDossier est une base d'application LegalTech React/Vite pour structurer les dossiers juridiques, préparer le suivi client-avocat, publier un blog SEO/GEO et connecter Supabase + Stripe.

Slogan : **Votre dossier juridique, clair, structuré et suivi.**

## Stack

- React + Vite + TypeScript
- React Router
- Supabase client côté frontend, Supabase Auth, schéma SQL/RLS dans `supabase/migrations`
- Fonctions Supabase Edge pour Stripe Checkout, webhook Stripe, portail client vérifié par RLS et assistant IA blog
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
- `AI_PROVIDER_URL` (optionnel)
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY` (fonctions Edge)
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

Les migrations créent les tables demandées : `profiles`, `contact_requests`, `newsletter_subscribers`, `demo_requests`, `cases`, `case_intake_answers`, `payments`, `subscriptions`, `blog_posts`, `blog_categories`, `audit_logs`, ainsi que `documents` et `messages` pour les espaces privés. Elles activent aussi les règles RLS, les insertions publiques consenties et la création automatique d'un profil client après inscription Supabase Auth.

## Stripe

Les boutons des formules payantes appellent `create-checkout-session` après connexion utilisateur. La formule Découverte redirige vers la création de dossier et Cabinet Premium vers le contact commercial. Le paiement réel nécessite :

1. clés Stripe test ;
2. produits/prices Stripe ;
3. variables `STRIPE_PRICE_*` pour les formules payantes ;
4. déploiement des Edge Functions ;
5. webhook Stripe pointant vers `stripe-webhook` ;
6. portail client Stripe configuré pour la gestion d'abonnement.

Sans cette configuration, le frontend affiche clairement que le paiement est bientôt disponible.

## Avertissement LegalTech

Les textes sont juridiquement prudents mais doivent être relus par un professionnel avant mise en production. L'IA ne remplace pas l'avocat et toute analyse doit être validée par un professionnel habilité.
