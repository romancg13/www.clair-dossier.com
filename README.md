# ClairDossier

ClairDossier est une application LegalTech React/Vite pour structurer les dossiers juridiques, préparer le suivi client-avocat, publier un blog SEO/GEO et connecter Supabase + Stripe.

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
- `AI_PROVIDER_URL` (optionnel, par défaut endpoint compatible OpenAI)
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SITE_URL` = `https://www.clair-dossier.com`
- `ALLOWED_ORIGINS` = `https://www.clair-dossier.com,https://clair-dossier.com`
- les `STRIPE_*_PRICE_ID` serveur, avec compatibilité temporaire pour les anciens `VITE_STRIPE_*_PRICE_ID` ajoutés comme secrets Supabase Edge Functions

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

1. créer les produits Stripe et les Prices mensuels/annuels, avec les Prices annuels calculés sur une réduction de 10 % ;
2. ajouter les Price IDs publics dans les secrets GitHub `VITE_STRIPE_*_PRICE_ID` pour le build frontend ;
3. ajouter `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_FUNCTIONS_URL` et `VITE_STRIPE_PUBLIC_KEY` dans les secrets GitHub ;
4. ajouter dans les secrets GitHub du workflow Supabase `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SITE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `ALLOWED_ORIGINS` et les `STRIPE_*_PRICE_ID` serveur ;
5. lancer le workflow manuel `Deploy Supabase Stripe Functions`, qui applique les migrations, configure les secrets Edge Functions et déploie les fonctions ;
6. créer le webhook Stripe vers `https://<project-ref>.functions.supabase.co/stripe-webhook` ;
7. redéployer GitHub Pages depuis `main` sur le domaine `www.clair-dossier.com`.

Le webhook doit être déployé avec `--no-verify-jwt` et vérifie la signature Stripe via `STRIPE_WEBHOOK_SECRET`. Il persiste les sessions checkout, les abonnements et les factures Stripe dans `payments` / `subscriptions`. Un abonnement ne doit être considéré actif qu’après événement Stripe fiable, jamais uniquement après une redirection vers `/success`.

## Sécurité applicative

- Les routes privées sont protégées par `ProtectedRoute` et une vérification `supabase.auth.getUser()`.
- Les rôles applicatifs sont `client_particulier`, `client_entreprise`, `avocat`, `collaborateur`, `admin_cabinet` et `super_admin`.
- Les rôles élevés ne sont pas auto-attribués à l’inscription ; ils doivent être affectés côté administration ou workflow serveur.
- Les documents doivent rester dans le bucket privé `case-documents` et être consultés via URLs signées temporaires.
- Les formulaires publics incluent validation, honeypot et règles RLS d’insertion sans lecture publique.

Stripe Checkout utilise les moyens de paiement automatiques. Les cartes, Apple Pay et PayPal peuvent apparaître au checkout si ces moyens sont activés et éligibles dans le Dashboard Stripe pour le pays, la devise, le navigateur et le type d'abonnement. Aucun moyen de paiement sensible ne doit être collecté dans le frontend.

Sans cette configuration, le frontend affiche clairement que le paiement est bientôt disponible.

## Avertissement LegalTech

Les textes sont juridiquement prudents mais doivent être relus par un professionnel avant mise en production. L'IA ne remplace pas l'avocat et toute analyse doit être validée par un professionnel habilité.
