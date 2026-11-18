# Moteur IA — checklist unique du propriétaire

Tout le reste est déjà prêt (code publié, scripts, tests, surveillance). Chaque point ci-dessous exige
**votre** compte, **votre** décision ou **votre** dépense : rien n'a été fait à votre place. Après chaque
point, relancez la même commande : elle reprend où elle s'était arrêtée et affiche ce qui reste.

```bash
npm run ia:commission
```

Statuts : `CONFIGURATION_REQUISE → INFRA_PRETE → RECETTE_REUSSIE → VALIDATION_REQUISE → ACTIF`
(`SUSPENDU` = arrêt d'urgence, `INCIDENT` = gel des paiements rompu ou erreur). État local :
`.ia-commission/etat.json` (aucun secret, ignoré par Git).

## 1. Hébergement du site public — décision requise (VÉRIFIÉ le 2026-11-04)

La documentation officielle de GitHub Pages (« GitHub Pages limits ») interdit de l'utiliser comme
hébergement gratuit pour faire fonctionner une activité en ligne ou un site principalement destiné aux
transactions commerciales ou à un logiciel commercial en ligne (SaaS) : c'est le cas de ClairDossier.
Le moteur IA, lui, ne tourne pas sur GitHub Pages (il s'exécute dans Supabase) ; la question concerne le
site public. Options, à choisir par vous (offres et conditions **À CONFIRMER** sur leurs pages officielles) :

- un hébergeur statique autorisant l'usage commercial (le dépôt contient déjà `netlify.toml`, cible
  préparée non active) ;
- une offre payante adaptée chez un hébergeur existant.

Aucune bascule DNS n'est faite sans votre accord. La bascule consiste à : déployer le même build
(`npm run build`, sortie `dist/`), vérifier routes, `robots.txt`, `sitemap.xml`, paiements et en-têtes sur
l'adresse provisoire, puis pointer le domaine ; retour arrière = remettre l'enregistrement DNS GitHub Pages.

## 2. Supabase de production — connexion du compte propriétaire

Le projet `buzgokfmxpmyceppvjpp` n'est visible d'aucun compte connecté sur cette machine (VÉRIFIÉ :
HTTP 403). Les autres projets visibles ne doivent jamais servir de substitut.

1. Sauvegarde AVANT toute migration : <https://supabase.com/dashboard/project/buzgokfmxpmyceppvjpp/database/backups>
   (vérifier la date de la dernière sauvegarde de la base). Les fichiers du stockage (`documents`) se
   sauvegardent séparément : vérifiez ce que couvre votre offre (**À CONFIRMER**).
2. `npx -y supabase@3.0.0 login` avec le compte propriétaire, puis `npm run ia:commission` (simulation).
3. `npm run ia:commission -- --apply --deploy-functions` : applique UNIQUEMENT les 3 migrations IA
   (20261023, 20261102, 20261104), déploie UNIQUEMENT `ai-worker`, crée le jeton du worker dans Vault
   (jamais affiché) et planifie les tâches. Jamais : Stripe, abonnements, authentification, autres fonctions.

## 3. Fournisseur IA — compte, clé, modèles et budget (dépense : accord requis)

Faits VÉRIFIÉS sur les pages officielles d'Anthropic (consultées le 2026-11-04) : les entrées et sorties
API sont supprimées sous 30 jours par défaut (« How long do you store my organization's data », mise à jour
du 1er juillet 2026) ; elles ne servent pas à l'entraînement par défaut (« Is my data used for model
training », mise à jour du 18 août 2026) ; une conservation nulle (« zero data retention ») est possible par
accord. Le worker n'utilise pas l'API Files (pièces envoyées dans la requête). **À CONFIRMER** sur votre
contrat : entité contractante, DPA, mécanisme de transfert hors UE, éligibilité à la conservation nulle.

1. Ouvrir un compte d'organisation sur <https://console.anthropic.com>, accepter les conditions
   commerciales, signer le DPA, demander la conservation nulle si souhaitée.
2. Choisir les modèles (extraction / consolidation) après la recette ; ils sont configurables sans code.
3. Fixer deux budgets mensuels en centimes : par compte et global. **Aucun défaut** : sans eux, le worker
   ne traite rien.
4. `npm run ia:commission -- --apply --secrets` : saisie masquée de `ANTHROPIC_API_KEY`,
   `AI_BUDGET_CENTS_PER_USER_MONTH`, `AI_BUDGET_CENTS_GLOBAL_MONTH`, `AI_MODEL_EXTRACT`,
   `AI_MODEL_CONSOLIDATE`. Ne collez jamais une clé dans une conversation, un fichier ou une URL.

## 4. Recette réelle sur données fictives

1. `npm run ia:corpus -- --nombre 20` (puis 190) : pièces fictives dans `.ia-commission/corpus/`.
   Imprimez puis scannez/photographiez `02-facture.pdf` pour éprouver l'OCR sur un vrai scan.
2. Sur un compte de test disposant **déjà** d'un droit d'accès légitime (aucun abonnement artificiel),
   créez un dossier, déposez les pièces, activez le traitement sur ce dossier depuis la console admin
   « IA privée ».
3. `IA_DOSSIER_PILOTE=<uuid du dossier> npm run ia:commission` : la recette est validée quand l'analyse
   complète est publiée et que les 13 fichiers des six livrables existent. Coût et durée : console admin.

## 5. Décisions juridiques — rien n'est publié sans vous

À lire puis approuver ou corriger : `docs/ia/TEXTES_A_APPROUVER.md` (CGV art. 6, confidentialité,
information IA) et `docs/ia/AIPD.md`. Enregistrement de vos approbations (auteur, date, version) :

```bash
npm run ia:commission -- --approuver
```

Ensuite seulement : publication des textes approuvés et `VITE_AI_ENGINE: '1'` dans
`.github/workflows/deploy.yml` (une PR), activation du seul compte pilote, puis des comptes autorisés.
Aucun dossier existant n'est analysé rétroactivement.
