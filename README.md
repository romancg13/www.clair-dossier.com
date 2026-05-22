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
- `SUPABASE_SERVICE_ROLE_KEY`
- `SITE_URL`
- `STRIPE_PRICE_DISCOVERY`
- `STRIPE_PRICE_CLIENT_ESSENTIAL`
- `STRIPE_PRICE_BUSINESS`
- `STRIPE_PRICE_CABINET_SOLO`
- `STRIPE_PRICE_CABINET_PRO`
- `STRIPE_PRICE_CABINET_PREMIUM`

Ne jamais exposer les clés secrètes Stripe, service role Supabase ou IA dans le frontend.

## Supabase

Appliquez la migration :

```bash
supabase db push
```

La migration crée les tables demandées : `profiles`, `contact_requests`, `newsletter_subscribers`, `demo_requests`, `cases`, `case_intake_answers`, `payments`, `subscriptions`, `blog_posts`, `blog_categories`, `audit_logs`, ainsi que `documents` et `messages` pour les espaces privés.

La migration complémentaire `20260522190000_auth_profiles_and_indexes.sql` ajoute :

- création automatique d'un profil `client` à chaque inscription Supabase Auth ;
- index utiles pour les dossiers, documents, messages, paiements et abonnements ;
- rattachement plus fiable des abonnements Stripe à l'utilisateur connecté.

## Stripe

Les boutons de tarifs appellent `create-checkout-session`. Le paiement réel nécessite :

1. clés Stripe test ;
2. produits/prices Stripe ;
3. variables `STRIPE_PRICE_*` ;
4. déploiement des Edge Functions ;
5. webhook Stripe pointant vers `stripe-webhook`.

Sans cette configuration, le frontend affiche clairement que le paiement est bientôt disponible.

Les formules gratuites ou sur devis ne déclenchent pas de faux paiement : la formule Découverte renvoie vers l'inscription, et Cabinet Premium renvoie vers le contact. Les formules payantes demandent une session utilisateur afin que le webhook puisse relier l'abonnement au compte.

## État fonctionnel et limites production

- Les pages publiques, légales, blog, contact, démo, création de dossier, connexion et inscription sont routées.
- Les formulaires publics écrivent dans Supabase si `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` sont configurées.
- Les espaces privés sont protégés par session lorsque Supabase Auth est configuré ; sans Supabase, ils affichent un avertissement de configuration.
- Le blog est statique côté frontend, avec schéma SQL prêt pour une gestion back-office future.
- Le paiement Stripe nécessite les clés test/production, Price IDs, fonctions Edge déployées et webhook Stripe.
- Les textes légaux sont prudents mais doivent être validés et complétés par l'éditeur avant exploitation commerciale.

## Avertissement LegalTech

Les textes sont juridiquement prudents mais doivent être relus par un professionnel avant mise en production. L'IA ne remplace pas l'avocat et toute analyse doit être validée par un professionnel habilité.
