# GO-LIVE — Bascule de la diffusion vers Netlify (Vague 0, Lot 1.1)

> **La bascule DNS est une décision humaine.** Ce document liste les étapes
> exactes, **sans les exécuter**. Rédigé le 2026-08-30.

## 1. Pourquoi Netlify (justification du choix)

Constat mesuré le 29/08/2026 sur la production GitHub Pages : toutes les
routes hors `/` répondent **404** (y compris `robots.txt`, `sitemap.xml` et
même `favicon.svg` — le déploiement Pages actif ne sert que le shell SPA).
GitHub Pages ne sait ni réécrire les routes d'une SPA en 200, ni poser
d'en-têtes personnalisés.

Trois candidats supportent réécriture SPA + en-têtes : Vercel, Netlify,
Cloudflare Pages. **Netlify est retenu car c'est celui qui demande zéro
changement au dépôt** :

- `netlify.toml` existe depuis juillet (réécriture SPA, CSP, en-têtes) et a
  été complété (HSTS, 301 des anciens slugs, apex→www, fallback
  `spa-shell.html`) ;
- le site est **déjà déployé en parallèle et à jour** sur
  `https://clair-dossier.netlify.app` — vérifié le 29/08/2026 : `/tarifs`
  → 200, `/robots.txt` → 200 ;
- Supabase autorise déjà `https://clair-dossier.netlify.app` dans ses URL de
  redirection d'authentification (supabase/config.toml) : l'auth fonctionne
  sur la cible avant même la bascule.

Vercel aurait exigé un `vercel.json` neuf et un nouveau projet ; Cloudflare
Pages des fichiers `_redirects`/`_headers` et un nouveau compte. Aucun
avantage décisif pour ce site statique pré-rendu.

## 2. Avant la bascule (préparation, sans risque)

1. Fusionner `feature/clairdossier-next` dans `main` (revue humaine), pousser.
   - GitHub Pages ET Netlify redéploieront : les deux recevront le pré-rendu,
     le sitemap généré et les redirections (Pages restera limité mais servira
     au moins les fichiers pré-rendus s'il redevient sain).
2. Vérifier la cible Netlify à jour :
   ```
   npm run check:routes https://clair-dossier.netlify.app
   npm run check:routes -- https://clair-dossier.netlify.app --all
   ```
   Attendu : 200 partout.
3. Relever la référence de production AVANT bascule (comparaison) :
   ```
   npm run check:routes https://www.clair-dossier.com
   ```
   (Constat du 29/08 : 1/10 en 200, TTFB ~170–190 ms sur l'accueil.)
4. Dans Netlify → Domain management : ajouter les domaines
   `www.clair-dossier.com` (primary) et `clair-dossier.com` (redirect).
   Netlify affiche alors les enregistrements DNS attendus.

## 3. Bascule DNS (chez le registrar — whois.com, cf. deploy.yml)

À réaliser par Roman dans la zone DNS de `clair-dossier.com` :

1. **`www`** : remplacer l'enregistrement actuel (CNAME vers
   `<compte>.github.io`) par :
   - `CNAME www → clair-dossier.netlify.app` *(valeur exacte affichée par
     Netlify — la reprendre depuis l'interface)*
2. **Apex `clair-dossier.com`** : remplacer les A GitHub Pages
   (185.199.108/109/110/111.153) par la cible apex de Netlify :
   - `A @ → 75.2.60.5` *(ou l'ALIAS/ANAME `apex-loadbalancer.netlify.com`
     si le registrar le permet — reprendre la valeur affichée par Netlify)*
3. Baisser le TTL à 300 s avant l'opération si possible ; le remonter après.
4. Dans Netlify, attendre la vérification du domaine puis le certificat
   Let's Encrypt (automatique, quelques minutes après propagation).
5. **Ne rien supprimer d'autre** dans la zone (MX, TXT/SPF, etc.).

## 4. Après la bascule — vérification (obligatoire)

```
npm run check:routes https://www.clair-dossier.com
npm run check:routes -- https://www.clair-dossier.com --all
```
Attendu : toutes les routes en 200.

Contrôles complémentaires :
- `curl -sI https://clair-dossier.com/tarifs` → **301** vers
  `https://www.clair-dossier.com/tarifs` (canonique unique).
- `curl -sI https://www.clair-dossier.com/fonctionnalites/pieces-ocr` →
  **301** vers `/fonctionnalites/depot-de-pieces`.
- `curl -sI https://www.clair-dossier.com/` → en-têtes présents :
  `strict-transport-security`, `content-security-policy`,
  `x-content-type-options`, `referrer-policy`, `x-frame-options`,
  `permissions-policy`.
- Parcours réels sur le domaine : connexion, création de dossier, dépôt de
  pièce, page Tarifs (liens Stripe), formulaire de contact.
- Google Search Console : soumettre `https://www.clair-dossier.com/sitemap.xml`.

## 5. Après stabilisation (optionnel, recommandé)

- Désactiver le workflow GitHub Pages (`.github/workflows/deploy.yml`) ou le
  conserver comme miroir — décision à tracer.
- HSTS : envisager `includeSubDomains` (et `preload` seulement après
  inventaire complet des sous-domaines et engagement long terme) — décision.
- Activer les lots dormants (voir netlify.toml `[build.environment]`) :
  capture de prospects (3 prérequis) et mesure d'audience sans cookie.

## 6. Retour arrière

Remettre les enregistrements DNS GitHub Pages notés à l'étape 3 (garder une
capture de la zone avant modification). Aucun contenu n'est perdu : les deux
hébergeurs restent déployés en parallèle.
