# Hébergement du site public — décision du propriétaire (état vérifié le 2026-11-04)

Rien n'est basculé : aucun changement de DNS, de domaine ni de fournisseur sans votre accord écrit.

## Faits vérifiés

| Point | Constat |
|---|---|
| Production | GitHub Pages, déploiement `deploy.yml` à chaque fusion sur `main` ; commit servi lisible sur `/version.json`. |
| Conditions GitHub Pages | La documentation officielle (« GitHub Pages limits ») exclut l'usage comme hébergement gratuit d'une activité commerciale ou d'un SaaS — voir `docs/ia/CHECKLIST_PROPRIETAIRE.md` §1. |
| Conditions Vercel | « Hobby teams are restricted to non-commercial personal use only. All commercial usage of the platform requires either a Pro or Enterprise plan. » (vercel.com/docs/limits/fair-use-guidelines, mise à jour du 2026-09-14). Le plan de l'équipe `clair-dossier` n'est pas lisible par le connecteur : **À CONFIRMER**. Le projet `clairdossier-demo` sert aux previews (`noindex`), jamais à la production. |
| Netlify | Cible préparée (`netlify.toml`) ; le site parallèle `clair-dossier.netlify.app` est **périmé** (ancien contenu, sans `/version.json`). Conditions commerciales du plan **À CONFIRMER** sur netlify.com/pricing. |
| Routage | Avec le prérendu, toutes les routes publiques et d'application répondent 200 (coquille `noindex` pour l'espace client) et les URL inconnues 404, **y compris sur GitHub Pages**. Seule limite GitHub Pages : `/compte/dossier/:id` répond 404 (page affichée normalement, `noindex`, `Disallow: /compte` dans robots.txt) faute de réécriture serveur. Vercel (`vercel.json`) et Netlify (`netlify.toml`) réécrivent ce seul motif en 200. |

## Options

1. **Rester sur GitHub Pages** : aucun coût, fonctionnel, mais non conforme aux conditions pour un usage commercial.
2. **Vercel Pro** (coût par membre de l'équipe, à vérifier sur vercel.com/pricing) : `vercel.json` prêt, previews déjà opérationnelles.
3. **Netlify** (offre et conditions commerciales à vérifier) : `netlify.toml` prêt (en-têtes de sécurité, 301, apex → www).

## Bascule (une fois l'option et le budget validés)

1. Créer le projet de production (jamais `clairdossier-demo`) relié au dépôt, avec les mêmes variables publiques que `deploy.yml` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_PLAUSIBLE_DOMAIN`, `VITE_STRIPE_PORTAL_URL`).
2. Recette sur l'adresse provisoire : `node scripts/surveillance-site.mjs` (après avoir pointé `SITE` sur l'adresse provisoire), routes 200/404, `robots.txt`, `sitemap.xml`, canonique `https://www.clair-dossier.com/`, 12 liens Stripe identiques à `tests/paiements-geles.json`, connexion réelle.
3. Ajouter l'adresse provisoire aux URL de redirection Supabase (Auth) avant de tester la connexion.
4. DNS : abaisser le TTL la veille, puis pointer `www` et l'apex vers le nouveau fournisseur ; HTTPS émis automatiquement.
5. **Retour arrière** : remettre les enregistrements DNS GitHub Pages (le déploiement Pages reste actif tant que `deploy.yml` n'est pas désactivé).
