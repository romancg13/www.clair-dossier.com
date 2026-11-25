# Isolation des comptes en production — état, diagnostic, correctif

Mis à jour : 2026-11-25. Projet Supabase de production : `buzgokfmxpmyceppvjpp`.

## État exact

| Point | Statut |
|---|---|
| Accès des outils de cette session au projet de production | **BLOQUÉ** : le projet n'apparaît pas dans l'organisation Supabase reliée (4 projets visibles, aucun n'est celui-ci). Rien n'a été lu ni écrit. |
| Correctif `20261125150000_pieces_dossier_proprietaire.sql` appliqué en production | **NON VÉRIFIÉ** — à considérer comme **absent** tant que le bloc [1] du diagnostic n'a pas répondu `true` trois fois |
| Correctif testé | VÉRIFIÉ EN LOCAL : `tests/sql/migrations.pglite.mjs` (118 tests), cas A/B : rattachement, déplacement de pièce et d'échéance refusés |
| Diagnostic en lecture seule | VÉRIFIÉ EN LOCAL : joué avant et après correctif, il distingue les deux états et compte une pièce intruse |

## Le risque, sans l'exagérer

Sans le correctif, un compte **connecté** peut créer une ligne de pièce (ou déplacer une de ses échéances) en la
rattachant au dossier d'un **autre** compte, à condition de connaître l'identifiant technique de ce dossier
(un UUID aléatoire, jamais affiché à un autre client).

Ce que cela **ne** permet **pas** : lire les dossiers, les pièces ou les fichiers d'un autre compte (les règles de
lecture et le stockage sont cloisonnés et testés). L'effet possible est une **pollution** du dossier d'autrui
(une ligne parasite visible de la victime), pas une fuite de ses documents.

C'est une **vulnérabilité**. Ce n'est une **violation de données** que si le bloc [2] ou [3] du diagnostic
renvoie un nombre supérieur à zéro.

## La manipulation (≈ 5 minutes, une seule fois)

1. Supabase → projet de production → **Database → Backups** : vérifier qu'une sauvegarde du jour existe.
2. **SQL Editor** → coller `supabase/verification/20261125_isolation_lecture_seule.sql` → exécuter les blocs [1] à [4].
   Ce fichier ne contient que des `SELECT` (contrôlé par un test).
3. Si le bloc [1] ne répond pas `true` sur ses trois lignes : coller et exécuter
   `supabase/migrations/20261125150000_pieces_dossier_proprietaire.sql` (rejouable, aucun effet sur les parcours normaux),
   puis rejouer le bloc [1].
4. M'envoyer les **nombres** des blocs [2], [3], [4] (aucun contenu) — ou seulement « tout est à zéro ».

Retour arrière : `supabase/rollback/20261125150000_pieces_dossier_proprietaire.down.sql` **rétablit la faille** ;
ne l'utiliser que si un parcours client légitime était bloqué, et me le signaler aussitôt.

Ne pas appliquer en même temps : `20261125120000` (essai prospect : dépend du moteur IA), `20261125130000`
(messagerie : attend les applications OAuth). `20261125140000` (supervision) est facultative et indépendante.
Ne jamais lancer `npm run ia:commission` pour cela.

## Lire le résultat

| Bloc | Résultat attendu | Sinon |
|---|---|---|
| [1] correctif | 3 lignes `true` | appliquer le correctif (étape 3) |
| [2] pièces hors propriétaire | 0 | anomalie : noter le nombre, les dates, le nombre de comptes ; **ne rien supprimer** ; me prévenir |
| [3] échéances hors propriétaire | 0 | idem |
| [4] chemins hors titulaire | 0 | une ligne pointe vers le fichier d'un autre compte : à examiner en priorité |
| [5] tables sans règles d'accès | `rls_active = true` partout | table à protéger avant toute donnée cliente |
| [6] règles du stockage | uniquement « own » et « admin » | toute règle ouverte à `anon` est à retirer |
| [7] fonctions privilégiées | liste à relire | une fonction appelable par un visiteur doit être voulue (ex. formulaire de contact) |
| [8] rôles qui contournent les règles | rôles techniques Supabase seulement | jamais `anon` ni `authenticated` |

Les administrateurs sont exclus des comptages [2] à [4] : ils déposent légitimement les livrables dans les dossiers des clients.

## RGPD, articles 33 et 34 — grille factuelle (la décision vous appartient)

Texte : règlement (UE) 2016/679, https://eur-lex.europa.eu/eli/reg/2016/679/oj — articles 4(12), 33 et 34.

- Une **violation de données à caractère personnel** suppose une destruction, perte, altération, divulgation ou
  accès non autorisés **effectifs** (art. 4(12)). Une faille non exploitée n'en est pas une.
- Le délai de **72 heures** de l'article 33 court à partir du moment où le responsable de traitement **a
  connaissance** d'une violation. Il ne court donc pas tant que le diagnostic n'a rien révélé.
- **Blocs [2], [3], [4] à zéro** : aucune violation constatée. Bonne pratique : consigner la vulnérabilité, la
  date du diagnostic et celle du correctif dans le registre interne (art. 33(5) impose de documenter les
  violations ; documenter aussi l'incident évité est prudent).
- **Un bloc supérieur à zéro** : il y a eu altération du dossier d'un tiers. Il faut alors qualifier le risque
  (qui, combien, quelles données, quel effet), décider de la notification à la CNIL (sauf si la violation n'est
  pas susceptible d'engendrer un risque pour les personnes) et, en cas de risque élevé, de l'information des
  personnes (art. 34). Si ClairDossier agit comme **sous-traitant** pour les pièces d'un client professionnel,
  il doit prévenir ce client « dans les meilleurs délais » (art. 33(2)).
- Rôle de ClairDossier (responsable pour les comptes, sous-traitant pour les pièces confiées par des
  professionnels) : **à confirmer par vous**, avec votre conseil si un bloc n'est pas à zéro.

Aucun journal de production n'a pu être consulté depuis cette session : l'absence d'exploitation n'est donc
établie que par le diagnostic ci-dessus, pas par une analyse de journaux.
