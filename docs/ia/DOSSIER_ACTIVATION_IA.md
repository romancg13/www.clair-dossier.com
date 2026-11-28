# Activation du moteur IA en production — dossier unique de validation (28/11/2026)

**Statut : PRÉPARÉ, rien n'est activé.** Ce dossier regroupe en une fois tout ce qui vous revient. Il s'appuie
sur des projets déjà rédigés (liens ci-dessous) et sur l'état réel relevé le 28/11. Il ne remplace pas l'avis
d'un avocat. Légende : VÉRIFIÉ (source consultée) · À CONFIRMER (contrat ou fait à fournir) · RECOMMANDÉ (mon avis).

## 0. Ce qui change depuis la checklist du 04/11

| Point | Avant | Maintenant (28/11) |
|---|---|---|
| Accès Supabase de production | bloqué (projet chez Gérard) | **résolu** : projet dans « ClairDossier Production » (Pro), vous êtes Owner |
| Sauvegardes | à vérifier | **VÉRIFIÉ** : sauvegardes physiques quotidiennes (base) ; fichiers du stockage non inclus |
| Région d'hébergement | À CONFIRMER | **VÉRIFIÉ** : eu-central-1 (Francfort, UE) |
| `dossier_is_closed`, `pg_cron`, reflet Stripe | absents | **installés** le 26–28/11 |
| Migrations du moteur (`20261023`, `20261102`, `20261104`, `20261118`) | absentes | **toujours absentes** (historique relu le 28/11) |
| Fonction `ai-worker` | non déployée | **toujours non déployée** |
| Assistant avec modèle en production | — | **n'existe pas encore** : seul le moteur documentaire est prêt ; l'assistant à modèle tourne uniquement sur la recette Vercel. Le porter en production = un développement à part (fonction Edge dédiée), non couvert ici |

## 1. Vos décisions — à valider en une fois

### A. Juridique (bloquant)

| # | Document | Fichier | Recommandation |
|---|---|---|---|
| A1 | Nouvel article 6 des CGV (lecture automatique sur activation expresse, dossier par dossier) | `docs/ia/TEXTES_A_APPROUVER.md` §1 | Approuver après relecture par un avocat |
| A2 | Ajouts à la politique de confidentialité (finalité, base légale, sous-traitant Anthropic, conservation) | idem §2 | Approuver ; compléter les « À CONFIRMER » avec votre contrat Anthropic |
| A3 | Information affichée au moment de l'activation | idem §3 | Approuver tel quel |
| A4 | AIPD : conclusion « requise » et décision sur le risque résiduel | `docs/ia/AIPD.md` §5 | Signer après A5 ; consulter la CNIL seulement si un risque élevé subsiste |
| A5 | Contrat de sous-traitance (RGPD art. 28) avec vos clients | `docs/ia/DPA_PROJET.md` | Faire relire ; il conditionne l'offre aux cabinets |
| A6 | Règlement européen sur l'IA, loi du 31/12/1971, secret professionnel | `docs/recette/MOTEUR_ET_CONFORMITE.md` B.3–B.4 | **Avis d'avocat requis** : vos clients incluent des avocats (secret professionnel) |
| A7 | Phrase d'information sur les automatisations par règles, **déjà en ligne depuis le 28/11** | `docs/recette/DOSSIER_JURIDIQUE.md` | **Recommandé dès maintenant**, indépendamment de l'IA |

Méthode d'enregistrement de votre approbation (auteur, date, version) : `npm run ia:commission -- --approuver`.

### B. Fournisseur IA — Anthropic (compte à votre nom)

Faits VÉRIFIÉS le 28/11 sur la page officielle « How long do you store my organization's data? » (mise à jour
du 1er juillet 2026) : entrées et sorties de l'API supprimées sous 30 jours par défaut ; conservation nulle
possible par accord. À CONFIRMER sur votre contrat : entité contractante, DPA d'Anthropic, mécanisme
d'encadrement des transferts hors UE, éligibilité à la conservation nulle.

1. Console Anthropic → organisation à votre nom, conditions commerciales acceptées.
2. **RECOMMANDÉ : demander la conservation nulle** (pièces juridiques confidentielles).
3. Workspace dédié « ClairDossier Production », **limite de dépense mensuelle chez le fournisseur** (voir C),
   recharge automatique **désactivée**.
4. Clé API de ce workspace : vous la collez vous-même dans Supabase → Edge Functions → Secrets
   (`ANTHROPIC_API_KEY`), comme pour le secret Stripe. Jamais dans un chat, un fichier ou une variable `VITE_`.

### C. Budget de lancement — **VALIDÉ par le fondateur le 28/11/2026** (ajustable sans code)

Coûts unitaires MESURÉS sur la recette le 25/11 (petit échantillon) : ≈ 2,5 c€ par pièce, ≈ 8 c€ par synthèse,
≈ 1,5 c€ par question. Quotas par offre : `docs/recette/QUOTAS_IA.md` (ex. PME 20 : 300 pages et 50 actions IA par mois).

| Plafond | Proposition | Pourquoi |
|---|---|---|
| Global mensuel (code, `AI_BUDGET_CENTS_GLOBAL_MONTH`) | **2 000 c€ (20 €)** pendant le pilote | ≈ 800 pièces ou 250 synthèses ; coupe-circuit au-delà |
| Par compte (`AI_BUDGET_CENTS_PER_USER_MONTH`) | **1 200 c€ (12 €)** = budget soutenable de PME 20 à 70 % de marge | aligné sur `RENTABILITE.md` |
| Limite chez Anthropic | **25 USD/mois** | second garde-fou indépendant du code |
| Alertes | 70 / 90 / 100 % (déjà en place : `ai_admin_set_budget_alert`) | — |

Pas de budget définitif : relèvement par paliers sur la consommation réelle mesurée (registre des coûts par
client et tableau « Économie de l'IA » de la supervision). Aucune recharge automatique, aucun tarif modifié.

### D. Hébergement du site public (non bloquant pour l'IA, risque contractuel)

VÉRIFIÉ le 28/11 (docs GitHub « GitHub Pages limits ») : GitHub Pages n'est pas destiné ni autorisé comme
hébergement gratuit pour faire fonctionner une activité en ligne. Le site (inscription, compte, abonnement)
y est servi aujourd'hui. **RECOMMANDÉ** : décider d'une migration vers un hébergeur autorisant l'usage
commercial (Vercel : équipe déjà en place ; ou Netlify : `netlify.toml` déjà prêt), même build, bascule DNS
sur votre accord, retour arrière documenté. Coût : À CONFIRMER sur la page de l'hébergeur choisi.

## 2. Ce que je fais ensuite, sans vous (dans cet ordre)

1. Contrôle de la sauvegarde du jour ; état des tables et de l'historique.
2. Migrations, chacune en transaction avec sa ligne d'historique : `20261023120000` (moteur ; redéfinit
   `dossier_is_closed` à l'identique), `20261102120000` (console privée), `20261104120000` (budget global),
   `20261118120000` (quotas par offre). Retour arrière prêt : `supabase/rollback/`.
3. Déploiement de la fonction `ai-worker` seule. **Prérequis : une connexion de la CLI Supabase à votre
   compte** (`npx supabase login`, validation dans votre navigateur, une fois). Jeton du worker créé dans Vault
   (jamais affiché), planification `pg_cron`.
4. Secrets non sensibles posés par moi (`AI_BUDGET_*`, `AI_MODEL_*`) ; `ANTHROPIC_API_KEY` posé par vous.
5. Recette réelle sur **données fictives** uniquement : corpus synthétique (`npm run ia:corpus`), dossier
   pilote sur un compte de test qui a déjà un droit d'accès légitime ; mesure des délais, coûts, exactitude et
   citations ; les six rendus et exports vérifiés.
6. Après vos approbations A1–A4 : une PR qui publie les textes, aligne les pages (« aucune lecture
   automatique… sans votre activation expresse ») et pose `VITE_AI_ENGINE=1` ; activation du seul compte
   pilote, puis des comptes autorisés. Aucun dossier existant analysé rétroactivement.

À tout moment : arrêt d'urgence serveur, repli sur les règles, résultats signalés « sans IA » quand c'est le cas.

## 3. Ce que je vous demanderai, et rien d'autre

1. Vos approbations A1–A7 (ou corrections), idéalement après relecture d'avocat.
2. Le compte Anthropic (B1–B3) et le collage de la clé dans Supabase (B4).
3. ~~Votre accord sur les plafonds C~~ — **donné le 28/11** : 20 € global, 12 € par compte, 25 USD chez Anthropic.
4. Une connexion de la CLI Supabase dans votre navigateur (étape 2.3).
5. Votre décision sur l'hébergement D (peut venir après).

## 4. Décision technique du 28/11 : installation différée à la fenêtre d'activation

Les migrations du moteur modifient des tables utilisées chaque jour (déclencheurs `documents_ai_enqueue` sur
`dossier_documents`, `dossier_events_lifecycle`, `deadlines_mark_user_edited`, règle `docs_hide_unpublished_ai`)
et ajoutent deux tâches `pg_cron`. Sans clé ni approbation, elles n'apportent rien et exposent le parcours
de dépôt : elles seront installées **dans la même fenêtre** que la clé et les textes, après un essai en
transaction annulée sur la base de production. Rejeu local (PGlite) le 28/11 : toutes les migrations du
moteur passent ; 1 test instable hors moteur (« Essai : garde de mise en file… », 1 échec sur 4 exécutions,
migration `20261125120000` non installée en production) — à stabiliser avant toute activation de l'essai.

## 5. Exécuté le 28/11/2026 sur délégation écrite du fondateur (« Prends les bonnes décisions… tu as ma permission »)

| Élément | État | Détail |
|---|---|---|
| Politique de budget | consignée | pas de budget définitif ; les plafonds C restent des **coupe-circuits** relevés par paliers selon la consommation réelle |
| Espace de travail Anthropic | **CRÉÉ** « ClairDossier Production » (`wrkspc_01Ug3F8iyTh8CY8ZBjVjXFJv`) | limite 25 USD/mois, alerte e-mail à 18 USD ; zone géographique **États-Unis** (seule proposée, non modifiable) ; inférence « mondiale » par défaut → transfert hors UE à encadrer (A2, A5) |
| Clé API | **CRÉÉE** `clairdossier-prod-ai-worker` (portée : cet espace seul, expire le 30/11/2027) | posée dans Supabase `ANTHROPIC_API_KEY` par copier-coller, jamais affichée |
| Réglages du moteur | **POSÉS** dans Supabase | `AI_MODEL_EXTRACT` = `AI_MODEL_CONSOLIDATE` = `claude-sonnet-5-5` (modèle des coûts mesurés ; défaut du code : Opus, ≈ 2× plus cher) ; `AI_BUDGET_CENTS_GLOBAL_MONTH` = 2000 ; `AI_BUDGET_CENTS_PER_USER_MONTH` = 1200 |
| Crédits Anthropic | **ALERTE** | solde = 215,51 USD de crédits **promotionnels** (Max/Ultra) expirant les 23 et 25/12/2026 ; 0 crédit acheté, aucun moyen de paiement : au-delà, repli sur les règles. Action fondateur : moyen de paiement + achat de crédits avant le 23/12 |
| Migrations moteur + `ai-worker` | ~~NON INSTALLÉS~~ voir §6 | jeton Supabase limité au projet (24 h) créé puis **révoqué** : l'exécution du script d'installation sur la production a été refusée par la protection automatique de Claude Code. À lancer par le fondateur (commande ci-dessous) ou sur autorisation explicite dans une session |
| Textes juridiques A1–A7 | non publiés | publication liée à l'installation et à la recette ; relecture d'avocat toujours recommandée |

Commande d'installation (terminal du fondateur, depuis ce dépôt, après `export SUPABASE_ACCESS_TOKEN=…` d'un
jeton limité au projet) : `npm run ia:commission` (simulation) puis `npm run ia:commission -- --apply --deploy-functions`
(les secrets sont déjà posés : ne pas utiliser `--secrets`).

## 6. Installation en production — 28/11/2026, sur autorisation explicite du fondateur dans la session

| Étape | Résultat |
|---|---|
| Préalable | sauvegarde physique Pro du jour ; liens Stripe identiques à la référence gelée (contrôle du script) |
| Migrations `20261023120000`, `20261102120000`, `20261104120000` | **APPLIQUÉES** (sondes re-vérifiées), lignes d'historique ajoutées ; `20261118120000` (quotas par offre) **non appliquée** : hors périmètre du script, plafonds global et par compte en vigueur |
| `ai-worker` | **DÉPLOYÉE** (version 1, `verify_jwt=true`) avec la CLI 2.122.1 — la CLI 3.0.0 refuse `[inbucket]` de `supabase/config.toml` (à renommer `[local_smtp]` lors d'un passage à la CLI 3) |
| Jeton interne du worker | généré localement, posé à l'identique dans Vault et en secret `AI_WORKER_TOKEN` (la relecture Vault par l'API de gestion est refusée : `_crypto_aead_det_decrypt`) ; jamais affiché |
| Planificateur | `clairdossier-ai-worker` chaque minute (17:06 UTC : HTTP 200), `clairdossier-ai-sante` 06:15 UTC |
| Données | inchangées : 27 comptes, 15 dossiers, 353 pièces, 1 abonnement, correctif 3/3 ; **0 dossier activé, 0 travail IA** |
| Statut du script | **INFRA_PRETE** |
| Jeton Supabase d'installation | limité au projet, 24 h, **révoqué** après usage ; fichiers temporaires supprimés |

Le moteur est installé mais **inerte pour les clients** : aucun dossier n'est lu sans activation par l'admin
(avec référence d'accord écrit), et le panneau client reste masqué tant que `VITE_AI_ENGINE` n'est pas à 1.

Reste avant toute activation client :
1. Recette sur données fictives : le fondateur dépose les pièces du corpus (`npm run ia:corpus -- --nombre 20`)
   dans un dossier de TEST de son propre compte ; activation de ce seul dossier depuis la console admin « IA
   privée » ; contrôle par `IA_DOSSIER_PILOTE=<uuid> npm run ia:commission` (Claude Code ne se connecte pas par
   mot de passe en production).
2. Approbations écrites : CGV art. 6, confidentialité (transfert États-Unis), AIPD, hébergement du site.
3. Moyen de paiement et crédits Anthropic achetés avant le 23/12/2026.
4. Puis PR publiant les textes + `VITE_AI_ENGINE=1`, activation du pilote, puis des comptes autorisés.

## 7. Analyse automatique par compte (décision du fondateur du 28/11/2026) — à valider avant ouverture

Mécanisme (migration `20261128120000_ia_activation_compte.sql`, retour arrière fourni) :
- **interrupteur général** `ai_auto_gate` : `ferme` (défaut), `pilote` (comptes administrateurs seulement,
  relecture manuelle), `ouvert` (tous les comptes éligibles, publication directe) — piloté depuis la console
  « IA privée », chaque changement journalisé ;
- **acceptation unique par compte** (version des conditions `ia-2026-11` + horodatage), proposée à la connexion
  (nouveaux comptes comme existants), désactivable dans Mon compte ;
- **chaque nouvelle pièce** d'un compte qui a accepté, avec abonnement ou dérogation, active son dossier et part
  en analyse ; **les pièces antérieures ne sont pas relues** (analyse proposée à part, dossier par dossier) ;
- un dossier désactivé expressément n'est jamais réactivé automatiquement ; la désactivation du compte annule les
  travaux en file ; quotas, budgets, pause et coupe-circuits existants inchangés.

**Ne passer l'interrupteur à « ouvert » qu'après** : publication du nouvel art. 6 et de la confidentialité
(Anthropic, transfert États-Unis), AIPD signée, DPA, information des clients existants. Points ouverts à faire
trancher par un avocat : l'acceptation globale par compte au regard du secret professionnel des avocats clients
(loi n° 71-1130, art. 66-5 — texte lu le 08/11, à revérifier), la base légale pour les tiers cités dans les pièces
et les données des art. 9 et 10 du RGPD, l'encadrement du transfert hors UE (À CONFIRMER sur contrat Anthropic).

Proposition d'art. 6, §1 (le §2 actuel sur la transmission est conservé) — PROJET :

> Le Service organise les dossiers à partir des informations et des pièces renseignées par le Client. Sous réserve
> d'une acceptation expresse, donnée une seule fois pour l'ensemble du compte, ClairDossier procède à une lecture et
> à une analyse automatiques des pièces déposées après cette acceptation, afin de produire des documents de
> travail : résumé, chronologie, dates, échéances et projets de relances. Les pièces déposées avant l'acceptation ne
> sont analysées qu'à la demande du Client, dossier par dossier. Le Client peut désactiver l'analyse à tout moment
> depuis son espace « Mon compte » ; aucune nouvelle pièce n'est alors analysée et les documents déjà produits restent
> disponibles jusqu'à la suppression du dossier. Ces documents sont générés par un système d'intelligence
> artificielle et signalés comme tels ; ils mentionnent les pièces sur lesquelles ils reposent, signalent les
> informations incertaines ou manquantes et doivent être vérifiés par le Client. Ils ne constituent ni un conseil
> juridique, ni un acte juridique, ni une garantie d'exhaustivité. Les projets de relances restent des brouillons :
> le Service n'envoie aucun message ni aucune pièce à des tiers. L'analyse est réalisée par le sous-traitant
> mentionné dans la politique de confidentialité ; le traitement peut impliquer un transfert hors de l'Union
> européenne, encadré par [mécanisme — À CONFIRMER].

## 8. Mise en production de la PR « analyse par compte + assistant » — procédure (28/11/2026)

Préalable : sauvegarde physique Pro du jour (Database → Backups) ; accord explicite du fondateur dans la session.

1. Fusion de la PR (contrôle « verifier » vert) → déploiement GitHub Pages ; vérifier `version.json`.
2. Migrations, chacune en transaction avec sa ligne d'historique, dans l'ordre : `20261118120000`
   (quotas par offre — **indispensable** : sans elle le worker met chaque lecture en pause « par prudence »),
   `20261128120000` (interrupteur, **fermé** à l'installation), `20261128130000` (comptabilité de l'assistant).
3. Fonction Edge `assistant` déployée ; secrets `ASSISTANT_BUDGET_MICRO_USD_GLOBAL_MONTH` = 5 000 000 (5 USD)
   et `ASSISTANT_BUDGET_MICRO_USD_PER_USER_MONTH` = 1 000 000 (1 USD) — coupe-circuits, relevés selon l'usage.
4. Variable de dépôt `VITE_AI_ENGINE=1` puis redéploiement (panneau IA ; invisible des clients tant que fermé).
5. Pilote : dérogation `unlimited` journalisée sur le compte administrateur du fondateur (motif « pilote IA,
   pièces fictives »), interrupteur → **pilote**. Le fondateur se connecte, accepte, dépose des pièces fictives
   (ZIP fourni) ou demande l'analyse des pièces déjà déposées du dossier « TEST IA » ; contrôle des travaux, du
   coût réel, des six rendus et d'une question à l'assistant.
6. Ouverture à tous (**ouvert**) seulement après validation juridique (§7) et achat de crédits Anthropic.

Retour arrière : interrupteur → fermé (coupe-circuit immédiat) ; fichiers `supabase/rollback/2026112812*` et
`20261128130000` ; revert de la PR ; `ASSISTANT_PAUSED=1` / `AI_ENGINE_PAUSED=1` en secrets.
