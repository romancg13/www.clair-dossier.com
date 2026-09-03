# DECISIONS.md — Journal des décisions d'architecture ClairDossier

Format : une entrée par décision, numérotée, datée, avec contexte, décision, conséquences et statut. Les décisions héritées (antérieures à ce journal) sont reconstituées depuis les commentaires de code et l'historique git ; elles sont marquées « héritée ».

---

## D-000 — Décisions héritées (reconstituées le 2026-09-02)

| Réf. | Décision | Preuve |
|---|---|---|
| H-1 | Site vitrine + application légère en SPA React/Vite, sans serveur applicatif : le navigateur parle directement à Supabase sous RLS. | `src/lib/supabase.ts`, `PLAN.md:5` |
| H-2 | Cloisonnement des données par `user_id = auth.uid()` ; policies admin **additives**, d'abord en lecture seule, puis INSERT/DELETE ajoutés sans modifier les policies `_own`. | `supabase/migrations/20260621144123_admin_global_access.sql:1-8`, `20260628093000_dossier_deliverables.sql:4-10` |
| H-3 | Admin global unique désigné par e-mail dans une migration ; table `app_admins` sans policy, `REVOKE ALL` pour les rôles applicatifs ; `is_admin()` SECURITY DEFINER. | `20260621144123_admin_global_access.sql:10-35` |
| H-4 | Les livrables produits par ClairDossier sont rangés **sous le `user_id` du client** (`kind = 'deliverable'`) pour qu'il y accède par ses propres policies. | `20260628093000_dossier_deliverables.sql:5-8` |
| H-5 | Notification de lead par trigger `pg_net` → Edge Function → Resend, avec minimisation du contenu de l'e-mail sortant. | `20260617110728_dossier_lead_notification.sql`, `supabase/functions/notify-lead/index.ts:15-19` |
| H-6 | Transmission d'un dossier jamais automatique : e-mail ou WhatsApp déclenchés par l'utilisateur. | `src/data/features.ts:79-98`, `src/pages/DossierFlow.tsx:381-399` |
| H-7 | Réalignement du site public sur le produit réel (retrait OCR, IA, GPT-5.5, OVH, ISO/HDS…) — appliqué aux pages HTML le 2026-06-26. | commit `417708f` |
| H-8 | Publication sur GitHub Pages tant que le DNS n'est pas basculé vers Netlify ; Netlify conservé comme cible finale avec CSP et en-têtes de sécurité. | `.github/workflows/deploy.yml:3-6`, `netlify.toml` |
| H-9 | Fonts self-hosted (`@fontsource`), aucune dépendance Google ; palette et typographie en tokens `@theme`. | `src/index.css:1-43` |
| H-10 | Génération de miroirs markdown (`public/*.md`, `llms.txt`) pour les crawlers IA, à chaque build. | `scripts/gen-markdown.ts` |
| H-11 | **Décisions du « cahier directeur »** (document absent du dépôt, `[à vérifier]` auprès de l'éditeur ; seules sources : commits `ddeabac`, `417708f`, `271ac1b` du 2026-06-26 au 2026-07-01) : (a) page dossier avec frise « Avancement du dossier » à 5 étapes métier cliquables, panneau explicatif, message dynamique et carte « Ce que vous devez faire maintenant » ; (b) pièces regroupées dans un seul onglet, page à 4 onglets (Vue d'ensemble / Pièces / Échéances / DashBoard ClairDossier) ; (c) nom du dossier obligatoire, saisi sous les catégories, validation bloquante ; (d) e-mail de notification de lead minimisé (référence opaque + lien admin, aucune donnée nominative) ; (e) libellés de typologie alignés PME/artisans ; (f) mention de validation humaine et disclaimer juridique sur la page dossier. | `src/pages/DossierDetail.tsx:54-89,143-150,797-808`, `src/pages/DossierFlow.tsx:258-269`, `supabase/functions/notify-lead/index.ts:16-19` |
| H-12 | Remplacement de l'application Supabase « legacy » par le showcase v2 sur `main` (2026-05-25) ; l'ancienne application vit sur la branche `legacy/legaltech-supabase`, non présente dans ce clone. | commit `4a2dedc` |
| H-13 | Déploiement : suppression du workflow Pages (`1defbc9`, 2026-05-25) → Netlify (`32db65d`, 2026-06-11) → retour à GitHub Pages « tant que le DNS n'est pas basculé vers Netlify » (`86f7593`, 2026-06-15). État transitoire toujours en vigueur ; cible définitive à trancher par l'éditeur. | `git log -- .github/workflows/deploy.yml`, `.github/workflows/deploy.yml:3-6` |
| H-14 | Formulaire Contact et transmission du dossier routés vers WhatsApp click-to-chat / mailto, l'utilisateur gardant le dernier clic (2026-05-25). | commit `7364a97`, `src/lib/whatsapp.ts` |

---

## D-001 — Inventaire avant toute écriture de code (2026-09-02)

**Contexte.** Le master prompt CLAIR-IA v3.0 (PARTIE 3) rend l'inventaire bloquant. Le dépôt ne contenait ni `docs/`, ni `CLAUDE.md`, ni `DECISIONS.md`.

**Décision.** Produire `docs/INVENTAIRE-EXISTANT.md` par lecture intégrale + exécution réelle (`npm ci`, `typecheck`, `build`) + sondes HTTP sur la production + lecture de l'historique GitHub Actions, avec trois lecteurs parallèles recoupés par lecture directe. Aucune ligne de code applicatif écrite pendant cette étape. Le master prompt est archivé tel quel dans `docs/MASTER-PROMPT-IA-CLAIRDOSSIER.md`.

**Conséquences.** Deux bloquants en production (B1 `publicDir`, B2 allégations résiduelles), trois écarts structurels avec la cible (E1-E3), 11 majeurs, 18 mineurs, consignés dans l'inventaire § 10. Neuf points requièrent une intervention humaine (§ 12). Choix de grille : BLOQUANT est réservé aux défauts constatés en production ou empêchant la mission ; l'écart avec le modèle cible est traité à part car il est l'objet même des étapes 3 à 26.

**Statut.** Appliquée.

---

## D-002 — `CLAUDE.md` et `DECISIONS.md` comme mémoire inter-sessions (2026-09-02)

**Décision.** `CLAUDE.md` reprend les PARTIES 2 et 15 du master prompt, la discipline de session (PARTIE 0.3) et un résumé du contexte réel du dépôt. `DECISIONS.md` reçoit une entrée par étape du plan de build et par modification d'un fichier existant.

**Statut.** Appliquée.

---

## D-003 — Ordre d'exécution : correctif B1 + B2 en un seul lot, avant l'étape 3 du plan (2026-09-02)

**Contexte.** `vite.config.ts:23` (`publicDir: 'publique'`) exclut tout `public/` du build ; la production renvoie 404 sur robots, sitemap, favicon, og-image, `*.md`, brochure. Mais `public/llms.txt`, `public/og-default.svg`, `scripts/gen-markdown.ts` (lignes 70, 386, 407) et deux articles de blog contiennent encore des promesses non tenues (OVH, AES-256, 2FA obligatoire, HDS, ISO 27001, GPT-5.5, réponse automatisée…). Corriger B1 seul republierait ces contenus.

**Décision.** Traiter B1 et B2 dans le même commit : (a) retirer `publicDir: 'publique'` (retour au défaut `public`, seul cohérent avec `gen-markdown.ts:31` qui écrit en dur dans `public/`) ; (b) réaligner `gen-markdown.ts`, `llms.txt`, `og-default.svg` et les deux articles sur les formulations prudentes déjà utilisées par le HTML (`Security.tsx`, `features.ts`) ; (c) régénérer `public/*.md` ; (d) vérifier que `dist/` contient à nouveau les fichiers statiques. La description Stripe « IA avancée (GPT-5.5) » (`scripts/create-stripe-products.mjs:44`) est corrigée dans le script ; la correction dans le dashboard Stripe relève d'une action humaine.

**Alternative écartée.** Renommer `public/` en `publique/` : casserait `gen-markdown.ts` et l'historique, sans bénéfice.

**Exécution (2026-09-02).**
- `vite.config.ts` : ligne `publicDir: 'publique'` retirée (retour au défaut), commentaire de justification ajouté.
- Contenus réalignés sur les capacités réelles : `scripts/gen-markdown.ts` (accueil, parcours, index du journal, devis, page sécurité entièrement dérivée des données partagées), `public/llms.txt` (réécrit), `public/og-default.svg` (H1 actuel, sous-titre sans OVH), `index.html` (meta description, og:description), `src/components/sections/{Hero,Workflow,DossierLifecycle,FinalCTA,FeaturesGrid,BlogPreview}.tsx`, `src/lib/seo.tsx` (orgSchema), `src/pages/{Home,Pricing,BlogIndex,Security}.tsx`, `src/data/{pricing,faq,features,authors}.ts`, quatre articles de blog (`rgpd-legaltech`, `ia-droit`, `chronologie-prud-homale`, `mise-en-demeure`), `scripts/create-stripe-products.mjs` (descriptions sans IA).
- Nouveau fichier `src/data/security.ts` : source de vérité unique des engagements sécurité (piliers, schéma, badges), consommée par `Security.tsx` et par `gen-markdown.ts` ; le registre `SECURITY_ICONS`, jusque-là inutilisé, sert désormais au rendu.
- Ce qui a été volontairement laissé : les engagements de délai de réponse (« sous 1 h », « sous 48 h », « sous 24 h ouvrées ») sont des engagements commerciaux de l'éditeur, pas des capacités produit ; la matrice comparative des plans (capacités gratuites marquées ✗) relève d'une décision commerciale ; les conseils génériques de l'article RGPD (« exiger AES-256, TLS 1.3, 2FA à son fournisseur ») ne décrivent pas ClairDossier. Tous trois sont listés au § 12 de l'inventaire pour arbitrage humain.
- Vérifications : `npm run gen:md` (27 fichiers), `npm run typecheck` exit 0, `npm run build` exit 0, `dist/` contient CNAME, favicon, robots, sitemap, llms.txt, og-default.svg, brochure et les 27 `.md` ; grep résiduel sur OVH / AES-256 / HDS / ISO 27001 / GPT / « 100 % conforme » / relances automatiques / résumé IA : plus aucune occurrence descriptive de ClairDossier.
- Action humaine restante : mettre à jour les descriptions des produits déjà créés dans le dashboard Stripe.

**Statut.** Appliquée.

---

## D-004 — Extension additive du modèle de données, pas de refonte (2026-09-02)

**Contexte.** Le produit est en production avec un cloisonnement par `user_id`. Le modèle cible (PARTIE 7.2) exige `tenant_id`, versionnage documentaire, ancrages source, audit, etc.

**Décision.** Toutes les migrations à venir sont additives et rejouables : nouvelles tables, nouvelles colonnes nullables avec backfill, nouvelles policies. Le `tenant_id` est introduit avec un backfill « un utilisateur = un tenant » et des policies `tenant` ajoutées **à côté** des policies `_own`, qui ne seront retirées qu'après un test d'isolation au vert. `dossier_documents` est étendue (hash, mime, pages, version…) plutôt que remplacée. `dossiers.status` et `dossiers.typology` ne sont contraints qu'après inventaire des valeurs réellement présentes en base (action humaine : lecture de la production).

**Statut.** Décidée, s'applique à partir de l'étape 3.
