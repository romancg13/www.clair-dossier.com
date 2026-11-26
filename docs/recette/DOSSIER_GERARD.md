# Dossier technique — intervention Supabase de production (projet `buzgokfmxpmyceppvjpp`)

À l'attention de Gérard, responsable de l'organisation Supabase qui héberge la base de ClairDossier.
Préparé le 25/11/2026. Durée estimée : **15 minutes**. Aucun accès administrateur global n'est demandé,
et **aucun autre projet de l'organisation n'est concerné**.

## Ce qui est demandé, et rien d'autre

| # | Étape | Écrit en base ? | Obligatoire | Fichier |
|---|---|---|---|---|
| 1 | Sauvegarde base + fichiers | non | **oui** | commandes ci-dessous |
| 2 | Diagnostic d'isolation (lecture seule) | non | **oui** | `supabase/verification/20261125_isolation_lecture_seule.sql` |
| 3 | Correctif de sécurité | oui (2 règles RLS) | **oui, si le bloc [1] du diagnostic ne renvoie pas `correctif_applique = true`** | `supabase/migrations/20261125150000_pieces_dossier_proprietaire.sql` |
| 4 | Contrôle après correctif | non | **oui** | requête ci-dessous |
| 5 | Vue de supervision (compteurs, aucune donnée client) | oui | facultatif | `supabase/migrations/20261125140000_supervision_fondateur.sql` |

Le correctif (étape 3) est **autorisé par le fondateur** (décision du 25/11/2026), après sauvegarde vérifiée.
Les autres migrations (moteur IA, messagerie, intelligence) **ne doivent pas** être appliquées maintenant :
elles attendent la validation juridique (CGV art. 6) et un accord distinct — voir `DEPLOIEMENT_PRODUCTION.md`.
Ne pas lancer `npm run ia:commission` ni `scripts/mise-en-service-supabase.mjs`.

## 1. Sauvegarde (avant toute écriture)

Chaîne de connexion : Supabase → projet → **Connect** → « Session pooler » (mot de passe de la base : jamais
transmis à ClairDossier, jamais collé dans un chat).

```bash
supabase db dump --db-url "$DB_URL" -f clairdossier_schema_20261125.sql
supabase db dump --db-url "$DB_URL" --data-only -f clairdossier_donnees_20261125.sql
# Fichiers du bucket privé « documents » (la base ne les contient pas) :
supabase storage cp -r ss:///documents ./documents_20261125 --experimental --linked
```

Vérifier que les trois sorties ne sont pas vides, puis les conserver **hors** de l'ordinateur de travail
(stockage chiffré). Sur l'offre payante, une sauvegarde quotidienne existe aussi dans Database → Backups.
Restauration testée : `psql "$URL_BASE_DE_TEST" -f clairdossier_schema_20261125.sql` puis le fichier de données,
sur un projet ou une base **locale** de test — jamais sur la production.

## 2. Diagnostic (lecture seule, ≈ 2 min)

SQL Editor → coller `supabase/verification/20261125_isolation_lecture_seule.sql` → **Run**, bloc par bloc.
Le script ne contient que des `SELECT` et ne renvoie que des définitions et des comptages, jamais un contenu.
Résultats attendus et lecture : `SECURITE_ISOLATION.md`.

**À renvoyer au fondateur** : une capture ou une copie des résultats des blocs [1] à [3] (des nombres).
Si le bloc [2] ou [3] renvoie autre chose que **0**, le signaler **immédiatement** : il faudra distinguer une
vulnérabilité d'une violation effective (RGPD, articles 33 et 34 — grille dans `SECURITE_ISOLATION.md`),
et **conserver** ces lignes en l'état (ne rien supprimer : ce sont des preuves).

## 3. Correctif (si nécessaire, ≈ 1 min)

SQL Editor → coller `supabase/migrations/20261125150000_pieces_dossier_proprietaire.sql` → **Run**.
Effet : une pièce ou une échéance ne peut plus être rattachée au dossier d'un autre compte. Les parcours normaux
(site, application mobile, administration) ne changent pas — vérifié par 124 tests SQL.
Retour arrière (à n'utiliser qu'en cas de blocage avéré, il rouvre la faille) :
`supabase/rollback/20261125150000_pieces_dossier_proprietaire.down.sql`.

## 4. Contrôle après correctif

```sql
select policyname, (coalesce(with_check,'') ilike '%dossiers%') as correctif_applique
from pg_policies
where schemaname = 'public' and policyname in ('docs_insert_own','docs_update_own','deadlines_update_own')
order by policyname;
-- Attendu : 3 lignes, correctif_applique = true.
```

Puis, depuis un compte client **de test** sur www.clair-dossier.com : déposer une pièce dans son propre dossier —
le dépôt doit réussir.

## Capacité Supabase (point soulevé par le fondateur)

- **Production** : reste dans l'organisation de Gérard, sur le projet actuel. Aucune capacité supplémentaire
  n'est nécessaire pour les étapes 1 à 5.
- **Recette** : décision du fondateur du 25/11 — elle reste sur une base Supabase **locale** (gratuite,
  isolée, données fictives). L'organisation « ClairDossier » du fondateur est à sa limite gratuite
  (2 projets actifs, tous deux étrangers à ClairDossier). Une recette hébergée demanderait soit de mettre en pause
  l'un de ces projets (gratuit, décision du fondateur), soit l'offre Pro (payante, accord requis).
- **Accès pour la suite (sans droits globaux)** : les rôles Supabase s'appliquent à toute une organisation
  (les rôles par projet sont réservés aux offres Team/Enterprise). Pour ne donner accès à **aucun autre projet**,
  la voie recommandée reste celle-ci : **Gérard exécute lui-même** les fichiers fournis, et renvoie les
  résultats. Alternative, si Gérard le préfère : transférer le seul projet `buzgokfmxpmyceppvjpp` vers
  l'organisation du fondateur (Project Settings → General → Transfer project), ce qui suppose d'y libérer une
  place gratuite ou de passer en Pro.

## Après l'intervention

Le fondateur transmet les résultats (étapes 2 et 4). La suite — fusion de la PR #71, déploiement du site,
puis activation progressive — est préparée et ne demandera rien d'autre à Gérard avant la mise en service
du moteur IA, qui fera l'objet d'un dossier distinct (ordre des migrations, secrets, contrôles).

---

# Volet 2 — après le 26/11 (abonnements, automatisations, e-mail entrant)

Les étapes 1 à 5 sont faites (voir `ETAT_REPRISE.md`, « Production Supabase — 26/11 »). Constats Stripe lus le
26/11 en **lecture seule** (compte LIVE) : **aucun webhook** enregistré ; **4 abonnements** au total, dont
**1 seul actif** (offre PME 20, 49 €/mois) et 3 paiements jamais aboutis (`incomplete_expired`). La table
`subscriptions` vide en production est donc normale : un seul abonnement réel est à refléter, aucun n'est à
inventer. Les 26 autres comptes n'ont pas d'abonnement payant.

| # | Étape | Qui | Écrit | Préalable |
|---|---|---|---|---|
| 6 | Refléter Stripe en base : `scripts/sync-stripe-subscriptions.ts` (simulation, puis `--apply`) | Gérard (session locale) | `subscriptions` seulement (upsert) | sauvegarde de l'étape 1 |
| 7 | Déployer `stripe-webhook` + secrets | Gérard | fonction Supabase | 6 |
| 8 | Enregistrer le webhook dans Stripe | fondateur ou Gérard (tableau de bord Stripe) | configuration Stripe (aucun prix, aucun lien) | 7 |
| 9 | Fonction `dossier_is_closed` seule | Gérard | 1 fonction | — |
| 10 | Activer `pg_cron` | Gérard | extension | — |
| 11 | `20261126120000_intelligence_espace_client.sql` | Gérard | tables + planification | 6, 10, **accord du fondateur** |

### 6. Reflet des abonnements (idempotent, ne modifie rien dans Stripe)

```bash
export STRIPE_SECRET_KEY=rk_live_…   # clé RESTREINTE, lecture seule : Customers + Subscriptions (Stripe → Développeurs → Clés API)
export SUPABASE_URL=https://buzgokfmxpmyceppvjpp.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=…    # jamais collée dans un chat ni un fichier versionné
node --import tsx scripts/sync-stripe-subscriptions.ts          # simulation : doit annoncer 1 abonnement actif rattaché
node --import tsx scripts/sync-stripe-subscriptions.ts --apply  # écriture
```

Le rattachement se fait par l'e-mail du client Stripe = e-mail du compte ClairDossier. Un abonnement sans compte
correspondant est **signalé, pas créé**. Contrôle : `select plan_id, status from public.subscriptions;`.

### 7–8. Webhook signé et idempotent (nouveaux paiements, renouvellements, résiliations)

```bash
supabase functions deploy stripe-webhook --no-verify-jwt --project-ref buzgokfmxpmyceppvjpp
```

Stripe → Développeurs → Webhooks → **Ajouter un point de terminaison** :
URL `https://buzgokfmxpmyceppvjpp.supabase.co/functions/v1/stripe-webhook` ; événements :
`checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`,
`customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`.
Copier le secret de signature (`whsec_…`) **directement** dans Supabase → Edge Functions → Secrets :
`STRIPE_WEBHOOK_SECRET` (et `STRIPE_SECRET_KEY`, clé restreinte). Contrôle : « Envoyer un événement de test »
depuis Stripe → réponse 200, puis une ligne dans `stripe_events`. Signature fausse → 400 (vérifié par les tests).
Aucun prix, produit, lien de paiement ni abonnement n'est modifié par ces étapes.

### 9. `dossier_is_closed`

SQL Editor → `supabase/migrations/20261126100000_fonction_dossier_clos.sql` → Run. Définition identique à celle du
moteur IA, rejouable, aucun droit public. Contrôle : `select to_regprocedure('public.dossier_is_closed(uuid)');`
→ non nul.

### 10. `pg_cron`

Database → Extensions → `pg_cron` → **Enable** (gratuit, inclus dans toutes les offres). Contrôle :
`select extname from pg_extension where extname = 'pg_cron';` → 1 ligne.

### 11. Espace client enrichi (seulement après accord du fondateur)

SQL Editor → `supabase/migrations/20261126120000_intelligence_espace_client.sql` → Run (retour arrière :
`supabase/rollback/20261126120000_intelligence_espace_client.down.sql`). Elle crée l'historique de l'assistant,
les préférences, les notifications internes et les automatisations **par règles** (aucun appel de modèle IA),
exécutées toutes les heures par `pg_cron`. Contrôle :
`select jobname, schedule from cron.job where jobname = 'clairdossier-automatisations';` → `7 * * * *`.
Seuls les comptes à abonnement actif peuvent programmer une automatisation (règle serveur) : après l'étape 6,
1 compte réel ; les autres reçoivent « Un abonnement actif est nécessaire ».

Ce qui reste HORS de ce dossier (accords distincts) : moteur IA (`20261023` → `20261118`, CGV art. 6),
messagerie Gmail/Outlook (`20261125130000`, applications OAuth à créer), e-mail entrant (`20261118130000`,
domaine Resend `mail.clair-dossier.com` et enregistrements DNS à valider).
