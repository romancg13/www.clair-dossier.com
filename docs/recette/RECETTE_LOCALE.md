# Recette réelle sur Supabase local isolé

Script : `scripts/recette/recette-locale.mjs` (+ `scripts/recette/lib/`). Exécuté le
2026-11-25 sur une pile Supabase locale (docker, 23 migrations appliquées),
données 100 % fictives (`@recette.clairdossier.test`). Aucun accès à la
production, à Stripe, à Resend ni à un Supabase distant ; aucune clé Anthropic.

## Relancer

```bash
# 1. Pile locale dans un workdir HORS dépôt (copie de supabase/, config adaptée)
cd <workdir> && npx supabase start          # migrations appliquées au démarrage
cp -r <dépôt>/supabase/functions <workdir>/supabase/   # si le code des fonctions a changé

# 2. Recette (≈ 2 min 30, relançable à volonté)
cd <dépôt>
RECETTE_WORKDIR=<workdir> node scripts/recette/recette-locale.mjs --json=/tmp/recette.json
```

- Code de sortie : `1` s'il reste au moins un `ÉCHEC`, `0` sinon, `2` si la pile est inutilisable.
- Idempotent : comptes fictifs et fichiers purgés puis recréés à chaque exécution (`--nettoyer` purge aussi en sortant).
- Le script refuse toute URL non locale et tout workdir situé dans le dépôt.
- Il sert lui-même les fonctions Edge (`supabase functions serve --no-verify-jwt --env-file …`), fichiers d'environnement écrits hors dépôt (`RECETTE_RUN_DIR`, défaut : répertoire temporaire), et les laisse servies « sans clé » en sortant.
- Derrière un proxy sortant, le certificat racine (`SSL_CERT_FILE` / `NODE_EXTRA_CA_CERTS`) est copié dans `<workdir>/supabase/functions/_ca/` pour que le conteneur edge-runtime puisse télécharger ses dépendances npm.

### Garde réseau (à connaître)

Trois déclencheurs du schéma appellent, via `pg_net`, des fonctions de
**production** avec l'URL en dur (`notify-lead` à chaque profil créé et à chaque
dossier validé ; `ai-worker` si `pg_cron` est présent au moment des migrations).
Sur une pile locale ces appels partiraient réellement. Le script résout donc
l'hôte de production vers `127.0.0.1` dans le conteneur de base locale
(`/etc/hosts`), vérifie l'effet par un appel témoin, et s'arrête si la garde
échoue. Constat après trois exécutions : 67 appels refusés (« Could not connect
to server »), aucun n'a atteint la production.

## Résultats (dernière des 3 exécutions : 146,5 s ; les deux premières ont servi à corriger deux erreurs du script lui-même)

63 tests : **51 VÉRIFIÉ · 9 SIMULÉ · 1 BLOQUÉ · 2 ÉCHEC** (même défaut, voir plus bas).

| Bloc | Durée | Ce qui est prouvé en réel |
|---|---|---|
| 1 Auth | 0,7 s | 4 comptes créés par l'API admin GoTrue (e-mail confirmé), connexion par mot de passe, profil créé par déclencheur, mauvais mot de passe refusé |
| 2 Isolation | 0,2 s | Dossier + dépôt par le chemin du site (objet Storage → présence → ligne). B et l'anonyme : ni ligne, ni liste, ni téléchargement, ni lien signé, ni écriture, ni clôture ; URL publique fermée ; double validation = un seul dossier. **1 ÉCHEC** (défaut RLS ci-dessous) |
| 3 Offres | 0,8 s | Pour les 7 offres : limite de dossiers opposée par le déclencheur (`DOSSIER_QUOTA_EXCEEDED`, parcours intégral pour Essentiel, consommation préremplie au-delà), illimité réel (501ᵉ dossier accepté), quotas IA pages/actions résolus et opposés par les RPC serveur (fermées au client), e-mail entrant inclus ou `FEATURE_NOT_INCLUDED`. Anti-abus : 11ᵉ validation en 10 min refusée |
| 4a IA sans clé | 0,2 s | Dossier non activé jamais mis en file ; activation refusée sans abonnement / par un tiers ; mise en file réelle (4 extractions + consolidation temporisée 90 s) ; worker : 401 sans jeton, **503 sans clé Anthropic, rien réclamé** (5 travaux intacts, 0 tentative) |
| 5 E-mail entrant | 0,5 s | Fonction réelle : 5 signatures Svix refusées en 401 (absente, mauvais secret, ±10 min, corps altéré) ; signature valide → routage par destinataire, provenance journalisée ; rejeu sans second traitement ; adresse révoquée ignorée. **BLOQUÉ** : récupération du contenu et des pièces jointes chez Resend (aucun compte : HTTP 400, ligne « error », aucune pièce) |
| 6 Import massif | 3,5 à 4,6 s | 250 fichiers en séquentiel : **54 à 70 fichiers/s** (14 à 18 ms/fichier), 250 lignes et 250 objets ; aucun plafond quotidien ; même chemin refusé (409) |
| 4b IA simulée | 128 s dont 123 s d'attente | **SIMULÉ** (faux serveur local via `ANTHROPIC_BASE_URL`) : 4 extractions en 0,15 s, pages = 5, coût = 1,29 centime/appel ; consolidation déclenchée par **pg_cron + pg_net + Vault** sans appel du script (3 exécutions cron) ; révision 1 en relecture, 13 fichiers (6 rendus) sous `ai-review/`, invisibles du titulaire ; 1 référence inventée retirée ; second passage neutre (5 appels au modèle au total) ; approbation administrateur → publication, fichiers déplacés, échéance créée, notification « not_configured » ; quota de pages atteint → refus avant tout appel au modèle ; désactivation → travaux annulés |

## Défauts produit constatés (non corrigés ici)

1. **RLS — rattachement d'une pièce au dossier d'autrui** (`supabase/migrations/20260615201942_clair_dossier_init.sql:62`, même forme pour `docs_update_own`, `20260915120000_gestion_documentaire.sql:27` — non testée). La policy `docs_insert_own` ne vérifie que `user_id = auth.uid()`, pas que le dossier appartient à l'appelant (les policies des échéances et des événements, elles, le vérifient). Reproduction : B insère dans `dossier_documents` `{dossier_id: <dossier de A>, user_id: <B>, …}` → accepté. Conséquences constatées quand le dossier de A est activé pour l'IA : le déclencheur `documents_ai_enqueue` crée un travail au nom de A ; le worker (clé de service) télécharge le `file_path` choisi par B — ici celui d'une pièce de A — et enregistre une extraction que B peut lire, sans abonnement et hors quota. Il faut connaître l'identifiant du dossier (et le chemin du fichier pour la lecture) ; la pièce injectée entrerait aussi dans la consolidation de A.
2. **E-mail entrant — pas de reprise après échec de récupération** (`supabase/functions/email-inbound/index.ts:163` et `:186`). Si l'API du fournisseur échoue, la ligne passe « error » et tout rejeu du webhook est ignoré (unicité de `provider_email_id`) : l'e-mail reste chez le fournisseur mais n'est jamais réintégré sans action manuelle.

Observations (non bloquantes) : la détection de doublons n'existe que dans l'interface (`duplicateWarning`) ; un compte sans abonnement n'a pas de limite de dossiers (seul l'anti-abus s'applique) ; l'offre sur mesure n'a aucun plafond IA sans dérogation.

## Limites

- Tout ce qui passe par le faux modèle prouve la plomberie (file, stockage, statuts, compteurs), jamais la qualité d'une analyse ni le coût réel.
- Planification : même requête que la migration, URL remplacée par la passerelle locale ; `pg_cron` est créé puis retiré par le script. Fonctions servies en `--no-verify-jwt`.
- Limites de dossiers 10/20/50 : consommation préremplie côté serveur (limite – 1) pour rester sous l'anti-abus ; quotas d'actions au-delà de 50 : idem.
- Débit d'import mesuré en local (même machine, fichiers de 155 octets) : ne préjuge pas du débit en production.
- Non couverts : Stripe (gelé), envoi d'e-mails, arrêt d'urgence `AI_ENGINE_PAUSED`, interface web et mobile.
