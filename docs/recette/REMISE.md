# Remise de recette — ClairDossier « dépôt → résultat sans admin »

Date : 18 novembre 2026 · Branche : `claude/clair-dossier-workflow-63mjz1` · Statut : **démo isolée, rien en production**.

## 1. Lien de démo

**https://clairdossier-recette-20b5a2.vercel.app** — commit affiché sur `/version.json`.

- Projet Vercel séparé (`clairdossier-recette-20b5a2`), fonctions à Paris (cdg1), stockage Vercel Blob **privé** (cdg1).
- Données 100 % fictives (dossier « Atelier Lumen »), paiement simulé, aucun e-mail envoyé, site `noindex` (en-tête + robots.txt), bandeau « Recette » permanent.
- Vérifié depuis une session neuve (navigateur Playwright vierge, sans cookie) : voir §4.

## 2. Visite en 3 gestes

1. `/connexion` → bouton **« Abonnée (Camille Roche) »** (compte fictif isolé, propre à chaque visiteur).
2. **« Nouveau dossier »** → nom + objectif → **« Créer et déposer »**, puis **« lot initial (4) »** (courrier, avis d'échéance scanné, relevé de charges, courriel).
3. Fermer l'onglet, revenir ~1 min plus tard : situation en deux phrases, **« Joindre le bail »**, dates, six résultats téléchargeables. Option : **« bail + doublon »** → doublon reconnu, nouveau geste **« Vérifier la date »** (5 ou 3 mars 2021).

Sans abonnement (bouton « Sans abonnement ») : création et dépôt refusés (402), redirection vers `/tarifs`, aucune pièce reçue.

## 3. Réel, simulé, non vérifié

| Fonction | Statut | Environnement | Preuve |
|---|---|---|---|
| Accueil « Déposez vos pièces… », Tarifs lisibles, 3 résultats en Fonctionnalités | Réel | Démo Vercel (drapeaux de build) | `captures/avant-apres-accueil-390.jpg` ; accueil 918 → 324 mots, 11 298 → 4 212 px (390 px) ; tarifs 871 → 305 mots ; 0 débordement, 0 erreur console (390/768/1440) |
| Droits vérifiés avant tout stockage (402, rien conservé) | Réel | Démo + tests | parcours `creation_sans_abonnement: 402` ; test `recette-api` |
| Paiement | **Simulé** (cartes de test de recette) | Démo | aucune transaction Stripe |
| Activation par événement signé (HMAC, idempotent, ordonné, fin de période) | Réel (mécanisme) / simulé (émetteur) | Démo + tests | parcours « actif après événement signé » |
| Dépôt fictif → traitement serveur → rendu classé → consultation après fermeture | **Réel** | Fonctions Vercel + Blob | parcours navigateur : premier résultat 41–50 s, onglet fermé pendant le traitement |
| Persistance | Réel (Blob privé, écritures conditionnelles ETag) | Démo | aucune mémoire de processus ni disque temporaire |
| Lecture PDF texte, tableur, courriel | Réel (règles déterministes, citations page/ligne) | Démo | `exemple-tableau-de-bord.pdf` |
| Lecture IA des scans / analyse par modèle | **Non vérifié** | Aperçu isolé | passerelle Vercel : `403 — Free tier users do not have access to this model` ; 0 € dépensé ; la pièce est mise en attente (« sera lue dès que le service le permettra »), le reste du dossier est livré |
| Six rendus à la charte (A4, polices incorporées, texte sélectionnable) + ICS dates confirmées | Réel | Démo | 6 PDF + 1 ICS téléchargés depuis la démo |
| Dates modifiables (formulaire PDF + historique) | Réel | Démo + tests | parcours « correction enregistrée » |
| Non-duplication (empreinte), reprise, budgets, une notification par lot | Réel | Démo + tests | parcours : 2 lots → 2 notifications |
| Notifications | **Simulé** (boîte de recette) | Démo | aucun envoi externe |
| Connecteur MCP privé (OAuth 2.1, PKCE, lecture seule, révocable) | Réel via client scripté | Démo | 401 sans jeton, 6 outils `readOnlyHint`, dossier d'autrui introuvable, 401 après révocation |
| MCP depuis l'interface ChatGPT / Claude Code | Non vérifié | — | à faire par le titulaire (commande §7) |
| Prestations (3 posts LinkedIn datés Europe/Paris avec heure d'été, demande de justificatifs, fiche RDV) | Réel (brouillons) | Démo + tests | test « LinkedIn … heure d'été vérifiés » |
| Isolement A/B | Réel | Démo + tests | API et MCP : 404 identique à un identifiant inexistant |
| Sélecteur unique suivi/cartes (code de production) | Réel dans la branche, **non déployé** | Tests | `splitDeliverables` ; une ligne au lieu de six cartes vides |
| Stripe | Vérifié en lecture seule | Compte live | §5 |

Zéro clic admin : aucun compte administrateur n'existe sur la démo (aucun mot de passe admin fourni) ; le parcours n'utilise que le compte client.

Contrôle des citations (limite connue) : un extrait n'est « retrouvé » que s'il figure dans la pièce sur des limites de mots (« 5 janvier 2027 » n'est pas retrouvé dans « 15 janvier 2027 »), et un extrait d'analyse réduit à un nombre isolé ou à un mot de moins de quatre lettres ne prouve rien. Un mot isolé plus long (« janvier ») reste en revanche « retrouvé » s'il figure dans une preuve vérifiée de la même pièce.

## 4. Mesures (session neuve, Playwright, mobile 390 px, client hors UE)

Commit testé : `493bead` (trois parcours complets + MCP distant).

| Étape | Démo Vercel | Local |
|---|---|---|
| Dépôt de 4 pièces dont un scan (réponse) | 11 – 12 s | 0,2 s |
| Premier résultat après dépôt (onglet fermé) | 41 – 50 s | 6 s |
| Complément (bail + doublon) | 34 – 40 s | 6 s |

Écart : latence du stockage Blob (≈ 0,25 s par accès) et démarrages à froid. Corrigés pendant la recette : ETag faible renvoyé par le CDN Blob (consolidation jamais publiée), conflit d'écriture concurrente non rejoué (un essai à 295 s : travail verrouillé jusqu'à la fin du bail ; bail ramené à 60 s), attente fixe de 20 s avant consolidation, relances en rafale, écritures du dépôt en série. Cible production (Supabase) non mesurée.

Observation : une erreur transitoire « module script … text/html » au premier passage lancé pendant la bascule de déploiement (ancienne page, nouveaux fichiers) ; non reproduite ensuite. Protection contre ce décalage de version : à activer si la démo est conservée.

## 5. Vérifications sans modification

**Stripe (live, lecture seule)** — seul compte accessible ; aucun bac à sable n'est rattaché à cette session.
- 13 liens de paiement actifs ; les 12 référencés dans `src/data/pricing.ts` (6 formules × mensuel/annuel) existent, `metadata.planId` identique, retour vers `/compte?paid=<formule>`.
- 1 lien actif non référencé dans le dépôt (`plink_1TleRm…`, sans métadonnées) : à identifier par vous.
- **0 endpoint webhook enregistré** : le code `stripe-webhook` existe mais ne reçoit rien ; en production le rattachement d'abonnement reste manuel. C'est le premier obstacle au « zéro manipulation admin ».
- Fichiers de paiement gelés : inchangés (`tests/paiements-geles.test.ts` vert).

**Sécurité de la production (lecture du code, rien appliqué)**
- `docs_insert_own` ne vérifie pas que le dossier appartient à l'appelant (`supabase/migrations/20260615201942_clair_dossier_init.sql:62`) : une pièce peut être rattachée au dossier d'un tiers connaissant son identifiant, et un client peut insérer une ligne `kind='deliverable'`. Correctif proposé (migration additive, **à valider avant application**) :
  ```sql
  drop policy if exists docs_insert_own on public.dossier_documents;
  create policy docs_insert_own on public.dossier_documents for insert to authenticated
    with check (auth.uid() = user_id and kind = 'piece'
      and exists (select 1 from public.dossiers d where d.id = dossier_id and d.user_id = auth.uid()));
  ```
- Bucket `documents` sans limite de taille ni de type côté serveur ; compte gratuit sans plafond de stockage.

## 6. Engagements à mettre à jour avant toute activation (projets, non publiés)

À valider par vous ; références à vérifier sur Légifrance / EUR-Lex avant publication.

- **CGV art. 2** (aujourd'hui : le compte gratuit « permet de créer des dossiers et de déposer des pièces »). Projet : « La création de compte est gratuite. Le dépôt de pièces et leur traitement sont réservés aux titulaires d'un abonnement actif, vérifié automatiquement auprès du prestataire de paiement ; sans abonnement actif, aucune pièce n'est reçue ni conservée. »
- **CGV art. 6** (aujourd'hui : « aucune lecture, extraction ou analyse automatique des documents »). Projet : « À partir des seules pièces déposées par le Client, le Service produit automatiquement un résumé, une chronologie, un relevé de dates et une proposition de prochaine action. Chaque élément cite la pièce et le passage dont il est tiré et signale ses incertitudes. Ces documents doivent être vérifiés par le Client ; ils ne constituent pas une consultation juridique. »
- **État du produit** (`src/data/product-status.ts`, revu le 18/09/2026) : passer « traitement automatique » et « rattachement d'abonnement automatique » en opérationnel uniquement après mise en service réelle.
- **Données personnelles** : sous-traitants à déclarer (hébergement Vercel ; fournisseur IA via la passerelle, transfert hors UE possible), contrat de sous-traitance (RGPD art. 28), encadrement des transferts (art. 44 s.), analyse d'impact (art. 35) à apprécier compte tenu de la nature des pièces. Obligations du règlement européen sur l'IA (transparence) : à analyser, non tranché ici.

## 7. Prérequis avant la production (décisions du titulaire)

1. **Stripe** : créer l'endpoint webhook live vers la fonction `stripe-webhook` et son secret (modification de paiement : hors de mon mandat).
2. **IA** : crédits payants sur la passerelle Vercel, ou clé Anthropic fournie par votre coffre ; puis un seul essai sur le scan fictif (`npm run recette:vercel` + aperçu) — CGV art. 6 et approbation écrite d'abord.
3. **Parité production** : brancher le cœur du moteur (`supabase/functions/_shared/engine`, port `EngineStore`) sur Supabase (migrations moteur 20261023/20261102/20261104 non appliquées) et remplacer l'ancien `ai-worker`.
4. Correctif RLS `docs_insert_own` (§5).
5. `CRON_SECRET` sur le projet de démo (réconciliation quotidienne ; sans lui la tâche planifiée répond 401 — la reprise se fait à la consultation et par relance automatique).
6. Envoi réel des notifications (aujourd'hui boîte de recette).
7. Essai MCP depuis vos outils : `claude mcp add --transport http clairdossier-recette https://clairdossier-recette-20b5a2.vercel.app/mcp` ; dans ChatGPT, connecteur personnalisé sur la même URL.

## 8. Coût observé

- IA : 0 € (tous les appels refusés par la passerelle, offre gratuite).
- Vercel : projet et Blob dans le plan existant, aucun achat. Stockage : quelques Mo de pièces fictives.

## 9. Retour arrière

- Production intacte : aucun push sur `main`, aucune modification Supabase, Stripe, DNS ou protection.
- Code de production modifié (inactif par défaut) : drapeaux `VITE_RECETTE`, `VITE_HOME_CLARTE`, `VITE_NOINDEX` éteints ; seuls changements actifs si fusion : sélecteur unique suivi/cartes (`packages/core`, `DossierDetail.tsx`, `DeliverablesGrid.tsx`).
- Dossiers de démo déjà analysés : la chronologie est calculée à la consolidation puis conservée ; après déploiement de ce correctif, relancer la consolidation de ces dossiers (un nouveau dépôt suffit) ou repartir d'une base de démo neuve, faute de quoi leurs jalons gardent l'avertissement « extrait non retrouvé dans la pièce ».
- Supprimer la démo : projet Vercel `clairdossier-recette-20b5a2` + magasin Blob `clairdossier-recette-20b5a2`.

## 10. Consentements à obtenir

- Votre accord explicite sur cette version avant toute fusion vers `main` (= mise en production GitHub Pages).
- Accords séparés pour : webhook Stripe live, dépense IA, migration RLS, publication des textes CGV / État du produit.
