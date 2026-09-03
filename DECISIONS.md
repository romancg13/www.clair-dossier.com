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

**Statut.** Appliquée à l'étape 3 (migration `20260903090000_clair_ia_socle.sql`, voir D-005).

---

## D-005 — Socle de données de l'IA : choix de conception (2026-09-03)

**Contexte.** Étape 3 du plan de build : traduire le modèle minimal de la PARTIE 7.2 en une migration Supabase applicable sur la base de production, sans régression (I11).

**Décisions.**
1. **Tenant additif.** Table `tenants` (`type` personnel / organisation, `plan`, `statut_abonnement`) et `tenant_members` (rôles `proprietaire`, `administrateur`, `membre`, `lecteur`). Chaque utilisateur existant reçoit un tenant personnel dont il est propriétaire (backfill sur `auth.users`), le trigger `on_new_profile_tenant` le crée à l'inscription, et le trigger `dossiers_default_tenant` rattache tout nouveau dossier au tenant personnel quand `tenant_id` n'est pas fourni : **le code client actuel n'a pas à changer**. `dossiers.tenant_id` est `NOT NULL` après backfill.
2. **Policies tenant à côté des `_own`, plus des policies restrictives.** Les policies historiques par `user_id` sont conservées. Des policies permissives par tenant sont ajoutées. Deux policies **restrictives** (`dossiers_tenant_coherent_*`, `docs_tenant_coherent_*`) exigent en plus l'appartenance au tenant à l'insertion et à la mise à jour : sans elles, un utilisateur aurait pu insérer ou déplacer son dossier dans un tenant étranger via la policy `_own` (faille détectée par le test d'isolation, corrigée avant commit). Ces policies utilisent une variante VOLATILE `is_tenant_member_now()` pour voir la membership créée à la volée par le trigger dans la même instruction (une fonction STABLE lit le snapshot de début d'instruction). Effet de bord voulu : l'anomalie m1 de l'inventaire (insertion d'une pièce dans le dossier d'un autre utilisateur) est fermée.
3. **`tenant_id` imposé par trigger** (`set_tenant_from_dossier`) sur toutes les tables rattachées à un dossier : le client ne choisit jamais le tenant, la couche données le dérive et refuse toute incohérence.
4. **Ancrage obligatoire (I2)** par contraintes différées : `entites`, `evenements`, `echeances`, `pieces_manquantes` doivent avoir ≥ 1 ligne source au commit, et la dernière source ne peut pas être supprimée. Exemption conforme à la PARTIE 6 pour `nature in ('declaration_client','deduction')`. Les échéances n'ont pas de nature : ancrage toujours requis, `base_de_calcul NOT NULL` (F4).
5. **Journal d'audit en écriture seule** : insertion uniquement via `journaliser()` (SECURITY DEFINER), privilèges d'écriture révoqués pour `anon` / `authenticated`, triggers `BEFORE UPDATE / DELETE / TRUNCATE` qui lèvent une exception quel que soit le rôle. Alimentation automatique : dossiers (création, statut, suppression), pièces (dépôt, suppression), productions (création, statut), membres.
6. **Validation humaine (I4, I5)** : `productions.statut_validation` suit exactement Brouillon IA → À relire → À valider juridiquement → Validé humainement → Envoyé ; les deux derniers exigent `valide_par`.
7. **Mémoire des corrections (F11)** : colonnes `verrouille_humain`, `modifie_par`, `modifie_le` ; un agent doit poser `set local clair.acteur = 'agent'` et se voit refuser toute écriture sur une ligne verrouillée.
8. **Abonnement côté serveur (I7)** : `tenants.plan` / `statut_abonnement` non modifiables par un client authentifié (trigger), lecture via `plan_actuel()`. Le webhook Stripe qui les alimentera est prévu à l'étape 26.
9. **Chunks** : `document_chunks` avec `tsvector` français généré (recherche lexicale) et `embedding extensions.vector` **sans dimension** : la dimension et l'index HNSW seront fixés à l'étape 7 avec le choix du modèle d'embedding.
10. **Ce qui n'est pas contraint maintenant** : `dossiers.status` / `typology` (valeurs réelles en production à inventorier d'abord, § 12 de l'inventaire), immutabilité physique des originaux (le bucket reste géré par les policies existantes ; le versionnage logique `version` / `parent_version_id` est en place, la protection contre la suppression d'un original sera traitée à l'étape 5).

**Durcissement après revue par exécution (étape 4).** Les revues automatiques indépendantes ont échoué (limite de session) avant de livrer leurs conclusions ; leurs hypothèses d'attaque ont donc été rejouées une à une en SQL, dans des transactions annulées, sur la base de test. Dix se sont confirmées et sont corrigées dans la même migration (non encore déployée, donc sans migration corrective) ; chaque scénario est désormais un test de `tests/db/isolation.test.ts` :

11. **Journal non forgeable.** `journaliser()` était appelable par tout utilisateur avec un `p_tenant_id` étranger et un `p_acteur_type = 'admin'`. Désormais : type d'acteur déduit dès qu'une identité humaine est présente ; un appel direct (hors trigger, `pg_trigger_depth() = 0`) exige l'appartenance au tenant et la cohérence dossier ↔ tenant (`AUDIT_TENANT_INTERDIT`, `AUDIT_DOSSIER_INCOHERENT`). Les appels serveur gardent `p_acteur_type` (`agent` / `systeme`).
12. **Séquence du journal protégée.** Les privilèges par défaut de Supabase donnent `USAGE, UPDATE` sur les séquences à `authenticated` ; un `setval()` n'est pas transactionnel et faisait échouer **toutes** les écritures suivantes (clé dupliquée sur `audit_log`, donc création de dossier et dépôt de pièce impossibles). Privilèges révoqués ; test de schéma sur toutes les séquences de `public`.
13. **Verrou humain fermé par défaut (F11, interdit 12).** Le verrou ne couvrait que `UPDATE` et ne s'appliquait que si `clair.acteur = 'agent'` était posé : un `DELETE`, ou une écriture serveur sans contexte, l'écrasait. Désormais `UPDATE` **et** `DELETE`, et sans identité humaine (`auth.uid()` nul) l'acteur est réputé agent sauf `clair.acteur in ('humain', 'systeme')` explicite. `modifie_par` / `modifie_le` sont posés à chaque correction humaine d'une ligne verrouillée.
14. **Métadonnées d'ingestion réservées au serveur.** La nouvelle policy d'update par tenant laissait un client réécrire `kind`, `file_path`, `hash_sha256`, `statut_ingestion`, `version`, `user_id`… Trigger `dossier_documents_proteger_metadonnees` (`METADONNEES_PIECE_SERVEUR_UNIQUEMENT`) ; restent modifiables par le client `file_name`, `nom_normalise`, `categorie`.
15. **Dossier et rattachement immuables.** Un membre de deux tenants pouvait déplacer un dossier en laissant pièces, chunks et analyses dans l'ancien tenant. `tenant_id` d'un dossier immuable (`TENANT_DOSSIER_IMMUABLE`), `user_id` non réassignable par un client, `dossier_id` immuable sur toutes les lignes rattachées (`DOSSIER_IMMUABLE`). Un transfert de dossier sera une procédure serveur atomique (roadmap).
16. **Aucune insertion client sur les preuves et analyses (I1).** Les policies `_insert_tenant` et `_write_tenant` permettaient à un client d'insérer des chunks (fabrication de preuve), des entités et des ancrages. Supprimées : `document_chunks`, `*_sources`, `entites`, `evenements`, `echeances`, `contradictions`, `pieces_manquantes`, `productions` ne s'écrivent que côté serveur ; le client lit, corrige par `UPDATE` (sous verrou) et, s'il est administrateur du tenant, supprime — sauf les chunks, jamais supprimés à la main. Les déclarations du client entreront par une procédure dédiée à l'écran de corrections (étape 20). Test de schéma : aucune policy `INSERT`/`ALL` sur ces tables.
17. **Suppression d'une pièce.** Elle était bloquée par l'ancrage dès qu'une entité en dépendait (régression du flux `handleDelete`). Règle retenue : si le passage source a disparu, une assertion IA non verrouillée est supprimée et journalisée (`analyse.orpheline_supprimee`) ; si un humain l'a verrouillée, la suppression de la pièce est refusée (`PIECE_FONDE_CORRECTION_HUMAINE`) tant que la correction n'est pas levée (I3, F11). Retirer un ancrage à la main alors que le chunk existe reste refusé (`ANCRAGE_REQUIS`). `piece_manquante_sources` reçoit le même trigger que les autres tables de sources.
18. **Gouvernance des membres.** Un `administrateur` pouvait se promouvoir `proprietaire` puis retirer le propriétaire. Trigger `tenant_members_garde` : seul un propriétaire nomme ou modifie un propriétaire (`ROLE_PROPRIETAIRE_RESERVE`), le dernier propriétaire ne peut être ni rétrogradé ni retiré (`DERNIER_PROPRIETAIRE`) ; amorçage autorisé pour le premier membre d'un tenant vide (tenant personnel créé à la volée) ; le serveur (suppression de compte en cascade, support) n'est pas soumis à ces gardes.
19. **Productions (I4, I5).** Un client pouvait poser `valide_par` sur un tiers : côté client, `valide_par` doit être l'utilisateur authentifié (`VALIDATEUR_INCOHERENT`). Une production validée ou envoyée ne change plus de contenu (`PRODUCTION_VALIDEE_IMMUABLE`, nouvelle version à créer) et « envoyé » est irréversible (`ENVOI_IRREVERSIBLE`).
20. **Divers.** `tenants.type` rejoint `plan` / `statut_abonnement` dans les colonnes serveur ; le critère « appel client » est centralisé dans `est_appel_client()` (identité `auth.uid()`, rôle courant ou revendication JWT `anon` / `authenticated`, jamais `service_role`) ; `consentements_update_own` exige explicitement l'appartenance au tenant cible. Fait observé et utile pour la suite : PostgreSQL applique aussi les policies `SELECT` à la **nouvelle** ligne d'un `UPDATE`, ce qui bloquait déjà le déplacement d'un consentement vers un tenant étranger — la garde explicite évite de dépendre de ce comportement.

**Ce qui reste volontairement ouvert.** Un agent qui écrit côté serveur sans poser `clair.acteur` est traité comme un agent (fermé par défaut) : le pipeline (étapes 6 et suivantes) devra poser `set local clair.acteur = 'systeme'` pour ses opérations techniques légitimes (purge RGPD, re-versionnage), et jamais pour écraser une correction. Les rôles de tenant (`administrateur`, `membre`, `lecteur`) n'ont pas encore d'interface : ils sont posés par le serveur uniquement.

**Vérification.** Cluster Postgres 16 local + shim Supabase (`tests/db/`), application des 7 migrations, replay de la migration CLAIR-IA sans erreur, 29 tests `vitest` (schéma + isolation + invariants + scénarios d'attaque + non-régression) au vert ; `typecheck`, `typecheck:tests` et `build` sans erreur.

**Statut.** Appliquée (localement ; le déploiement sur le projet Supabase de production est une action humaine, voir la fin de l'étape 4).

---

## D-006 — Stockage documentaire immuable et empreinte SHA-256 (2026-09-03)

**Contexte.** Étape 5 du plan de build (pipeline 7.1, étapes 2 EMPREINTE et 3 STOCKAGE). Critère de sortie : « doublon strict détecté sur le jeu d'essai ». Il n'existe aucun serveur applicatif : le navigateur parle à Supabase, et une seule Edge Function existe.

**Décisions.**
1. **Empreinte calculée au dépôt par le client, confirmée par le serveur.** `src/lib/documents.ts` calcule le SHA-256 avec WebCrypto avant l'envoi et le transmet avec la ligne (`hash_sha256`, `mime`). Le pipeline (étape 6) recalcule à partir de l'objet stocké et enregistre l'empreinte qui fait foi via `enregistrer_empreinte()` (réservée au rôle de service) : `hash_verifie_le` est posé, toute divergence est journalisée (`document.empreinte_divergente`). Un client menteur ne peut nuire qu'à lui-même.
2. **Détection de doublon strict en SQL, déterministe** (règle 0.2 : jamais un modèle pour ce qu'une requête résout). Trigger `dossier_documents_detecter_doublon` : même empreinte, même dossier, pièces actives (`kind = 'piece'`, non retirées). Le doublon n'est pas rejeté : il est enregistré avec `statut_ingestion = 'doublon'` et `doublon_de_id` (montré au client, jamais traité). Les copies pointent toutes l'original (pas de chaîne) ; un livrable ou une pièce d'un autre dossier n'est jamais un doublon ; une empreinte posée après coup par le serveur relance la détection. Mesure sur le dossier étalon : **2 doublons stricts sur 2 détectés, 0 faux positif** (le quasi-doublon, même texte et rendu différent, reste une pièce à traiter — son rapprochement relève d'ATLAS, étape 10).
3. **Un original n'est jamais détruit par l'application (I3).** Trigger `dossier_documents_original_immuable` : toute suppression physique par un client échoue (`PIECE_ORIGINALE_CONSERVEE`), sauf les livrables (flux admin existant conservé, I11). Le client dispose d'une **suppression logique** (`supprime_le`, `supprime_par` posés par la base, irréversible côté client, journalisée `document.retire`) ; une pièce retirée n'est plus une référence de doublon et n'apparaît plus dans les listes. La suppression physique reste possible côté serveur (purge RGPD) ; en contexte `clair.acteur = 'systeme'`, elle emporte aussi les analyses verrouillées par un humain qui reposaient sur la pièce, avec journalisation (`verifier_ancrage_restant` redéfinie ; complète D-005 §17).
4. **Bucket sans écrasement ni suppression d'original.** Aucune policy `UPDATE` n'existe sur `storage.objects` (vérifié par test : un dépôt ne peut pas être remplacé, `upsert: false` reste la règle côté client). Policy **restrictive** `docs_storage_delete_originaux_conserves` : dans le bucket `documents`, seul un objet dont la ligne est un livrable peut être supprimé. Le chiffrement au repos est celui de la plateforme Supabase (S3) : constaté, pas revendiqué au-delà (I12).
5. **Résilience à l'ordre de déploiement.** L'application se déploie sur push `main` alors que la migration s'applique à la main. Les insertions réessaient sans les nouvelles colonnes et la lecture retombe sur les colonnes historiques quand PostgREST répond « colonne inconnue » (`PGRST204` / `42703`, `isUnknownColumnError`). À retirer à l'étape 26, une fois la migration en production.
6. **Dossier étalon amorcé** (`tests/fixtures/dossier-etalon/`, PARTIE 10.1) : manifeste, vérité terrain partielle (sections `doublons_stricts`, `quasi_doublons`, le reste listé dans `a_completer`), 7 PDF **générés de façon déterministe** par `scripts/gen-dossier-etalon.ts` (texte natif, Helvetica, WinAnsi, aucune date ni identifiant aléatoire) : la CI régénère et échoue si les fichiers commités diffèrent. Données fictives : domaines `.invalid`, SIREN `000 000 00x`, IBAN nul — vérifié par test. Le jeu grandira à chaque étape qui l'exige jusqu'à 40–60 pièces.
7. **Interface** : la liste des pièces affiche « Doublon » (libellé mono, discret) ; aucune autre modification d'écran avant l'étape 20.

**Ce qui reste volontairement ouvert.** Contrôle MIME, taille, antivirus et quota d'abonnement à la réception (pipeline étape 1) : côté serveur uniquement, donc avec l'Edge Function d'ingestion de l'étape 6 (les limites par plan sont une décision produit, § 12 de l'inventaire). Rapprochement des quasi-doublons : ATLAS (étape 10). Nettoyage des objets orphelins du bucket (dépôt réussi, ligne non créée) : procédure serveur, étape 6.

**Vérification.** Migration appliquée et rejouée ; `npm run test:unit` (8 tests : empreinte, générateur, intégrité et caractère fictif du jeu d'essai) ; `npm run test:db` (35 tests dont 6 nouveaux : détection à 100 % sur le jeu d'essai, absence de faux positif, journal, empreinte serveur, suppression logique, bucket) ; `typecheck`, `typecheck:tests`, `build` sans erreur.

**Statut.** Appliquée (localement ; déploiement de la migration : action humaine).
