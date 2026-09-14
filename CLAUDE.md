# ClairDossier — mémoire de projet

Avant toute tâche, lire intégralement docs/MASTER_PROMPT.md.
Ce document prévaut sur toute impression esthétique ou tout raccourci d'implémentation.

- Constitution complète : docs/MASTER_PROMPT.md (à lire avant toute tâche ; relire après tout compactage de contexte)
- Règle n°1 : ne jamais détruire l'existant sans mapping explicite (voir PARTIE I) ; toute insertion suit le protocole II.7
- Stack en place (Phase 0, 2026-08-23) : Vite 6 · React 19 · TypeScript 5 strict · React Router 7 (SPA, BrowserRouter) · Tailwind v4 (`@theme` dans src/index.css) · Motion (`motion/react`) · @fontsource (Cormorant Garamond, Inter, JetBrains Mono) · Supabase JS 2 — ne jamais remplacer sans nécessité majeure
- Hébergement : GitHub Pages, déployé automatiquement par .github/workflows/deploy.yml à chaque push sur `main` (repo github.com/romancg13/www.clair-dossier.com). Netlify (netlify.toml) = cible parallèle non active sur le domaine. Un push sur `main` = mise en production.
- Base de données : Supabase existant (projet `buzgokfmxpmyceppvjpp`, tables `profiles`, `dossiers`, `dossier_documents`, `app_admins`, bucket `documents`, edge function `notify-lead`) — KEEP SUPABASE (voir IX.4/IX.5). Schéma : supabase/migrations/*.sql. Toute évolution = nouvelle migration additive.
- Paiement : Stripe existant via Payment Links (7 formules dans src/data/pricing.ts, scripts/*.mjs) — NE PAS REFAIRE STRIPE (voir V.2/V.3). Aucun webhook ni table subscriptions aujourd'hui.
- Téléphone officiel : 04 91 95 90 32 (`tel:0491959032`) — identité publique : "ClairDossier" (voir I.5). Ancien numéro à remplacer : +33 7 82 98 36 44 (WhatsApp, source unique src/lib/whatsapp.ts + src/data/legal.ts + scripts/gen-markdown.ts ; les public/*.md se régénèrent via `npm run gen:md`).
- Baseline de référence : CLAIRDOSSIER_BASELINE.md · FEATURE_INVENTORY.md · DESIGN_INVENTORY.md · NON_REGRESSION_MATRIX.md · docs/baseline/STRIPE_SUPABASE_MAP.md · captures docs/baseline/screens/
- Branche de travail : `feature/clairdossier-next` (II.3.6). Ne jamais commiter directement sur `main`. Ne jamais pousser sans demande explicite.
- Branche distante `claude/legal-defense-intelligence-os-ko41pt` = refonte destructive NON fusionnée (purge du site vitrine). Ne jamais la fusionner ni s'en inspirer pour supprimer l'existant.
- Avant tout commit destructif ou migration : demander confirmation humaine (voir II.5). Garde-fous mécaniques : .claude/settings.json + scripts/guard_destructive.py.
- Commandes : `npm run dev` (5173) · `npm run typecheck` · `npm run build` (gen:md + tsc + vite) · `npm run preview` (4173). Aucun test ni lint à ce jour — à créer (IX.6).
- Secrets : jamais dans le code ni dans .env.example. Les clés `VITE_SUPABASE_*` sont des clés anon publiques protégées par RLS.
