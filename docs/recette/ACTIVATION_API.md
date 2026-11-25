# Activer l'API Claude sur la recette — une seule manipulation

Tout le code est prêt et testé avec un modèle simulé. Il manque uniquement la clé, que seul le propriétaire
peut créer (aucun outil de cette session ne peut ouvrir la Claude Console ni y lire un solde).

## La manipulation (≈ 3 minutes)

1. Ouvrir https://platform.claude.com/settings/workspaces → créer le workspace **ClairDossier Recette**.
   Dans ses limites, fixer une **limite de dépense mensuelle de 2 USD** (garde-fou côté fournisseur, en plus du plafond du code).
   Ne pas activer la recharge automatique.
2. Ouvrir https://platform.claude.com/settings/keys → **Create key**, workspace « ClairDossier Recette », nom `recette-vercel`. Copier la clé.
3. Ouvrir Vercel → projet `clairdossier-recette-20b5a2` → Settings → Environment Variables → ajouter
   `ANTHROPIC_API_KEY` (cocher **Sensitive**, environnements Production et Preview) → Save → **Redeploy**.

Ne collez jamais la clé dans un chat, un ticket ou le dépôt. Aucune variable `VITE_` ne doit la contenir.

## Ce qui se passe ensuite, sans autre action

| Élément | Comportement |
|---|---|
| Assistant ClairDossier Intelligence | passe de « règles » à « modèle » : Haiku 5.5 (demande simple), Sonnet 5.5 (courante), Opus 5.5 (complexe) |
| Plafond | 0,80 USD par mois pour l'assistant, 0,25 USD par compte ; coût maximal réservé avant chaque appel |
| Lecture des pièces par l'IA | reste sur les règles tant que `RECETTE_AI=direct` n'est pas ajouté (budget 1 € par mois) |
| Vérification | dans un dossier, ouvrir « ClairDossier IA » et poser une question : la réponse ne porte plus la mention « règles automatiques ». Détail (clé valide, modèles accessibles par `GET /v1/models`, dépense du mois) : page `/admin`, qui exige d'ajouter aussi `RECETTE_ADMIN_PASSWORD` dans Vercel |
| Clé invalide, crédits épuisés | repli immédiat sur les règles, annoncé au client, sans nouvelle tentative |

Total plafonné par le code : 0,80 USD (assistant) + 1 € (lecture) < 2 USD par mois.

## Ce qui reste à vérifier dans la Console (lecture seule)

- Le solde réel des crédits inclus (le « dernier crédit » affiché n'est pas le solde).
- Que les quatre modèles sont accessibles au workspace (la page `/admin` le confirme).
- La rétention des données et la zone d'inférence, avant toute pièce réelle (voir `MOTEUR_ET_CONFORMITE.md`).
