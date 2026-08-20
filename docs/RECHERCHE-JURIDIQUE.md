# Recherche juridique — analyse d'options et état réel

> **Mise à jour (mandat v4).** La décision retenue a changé : le relais serveur
> décrit plus bas (option 2) a été SUPPRIMÉ avec l'infrastructure serveur.
> L'architecture v4 est : **CLI → pack de sources → import dans l'atelier**
> (`npm run ldi -- pack-sources`). L'atelier ne contient aucun code d'appel
> d'API (B8) et n'émet aucune requête (B7). Ce qui suit reste utile pour deux
> choses : l'analyse des options écartées, et la section « ce qui n'a pas été
> vérifié », toujours exacte — l'intégration PISTE n'a jamais été exercée
> contre le service réel.


*Analyse d'options, décision, et ce qui reste invérifié.*

## Le problème, tel qu'il se pose

Le moteur sait interroger Légifrance et Judilibre : `src/ldi/modules/recherche.ts`
le fait depuis la première tranche. Mais il ne le fait **que depuis la ligne de
commande**, parce que la configuration lui est passée explicitement et qu'aucun
secret n'est lu depuis `import.meta.env` — décision prise pour qu'une clé PISTE
ne puisse jamais se retrouver dans un bundle navigateur par inadvertance.

Résultat : la barre latérale annonce « Recherche juridique » dans les capacités
**non couvertes**, avec ce motif. C'est honnête, et c'est inconfortable : l'avocat
travaille dans le navigateur, pas dans un terminal.

## Ce qui est en jeu, et qui n'est pas seulement technique

Une référence de jurisprudence inventée est indétectable à l'œil. Un numéro de
pourvoi a la même tête qu'il soit réel ou fabriqué, et il ne se découvre faux
qu'à l'audience, quand le magistrat cherche l'arrêt. C'est pourquoi le moteur
**n'a aucun chemin de code capable d'en produire un** : il ne restitue que ce
qu'une API officielle lui a renvoyé pendant l'exécution.

Toute option retenue ici doit conserver cette propriété. Une option qui la
perd est écartée, quel que soit son confort.

## Options

### Option 1 — Clé PISTE dans le bundle navigateur

| | |
|---|---|
| Coût | Nul |
| Confidentialité | Aucune requête ne transite par nos serveurs |
| **Écartée** | La clé serait lisible par quiconque ouvre les outils de développement |

Un secret livré au navigateur n'est pas un secret. Les quotas PISTE sont
attachés à l'opérateur : une clé exposée, c'est le service coupé pour tout le
cabinet, et un tiers qui interroge en notre nom. Aucune obfuscation ne change
cela. Écartée sans discussion.

### Option 2 — Relais côté serveur, avec liste blanche

| | |
|---|---|
| Coût | Une fonction *edge* de plus à déployer et à tenir |
| Confidentialité | La référence recherchée sort du poste — voir ci-dessous |
| **Retenue** | Seul dispositif qui garde le secret côté serveur et la garantie R1 intacte |

Le navigateur envoie **une référence de texte** — `CPP, art. 63-4-2` — et rien
d'autre. Le serveur détient les identifiants PISTE, interroge Judilibre, et
renvoie ce que Judilibre a répondu.

Ce qui sort du poste est donc un **article de code**, c'est-à-dire une
information publique qui ne désigne ni le client, ni le dossier, ni les faits.
Deux garde-fous le tiennent :

1. Le client n'envoie que des références **tirées du corpus local**, jamais un
   texte libre saisi par l'avocat. Un champ de recherche libre laisserait
   passer « garde à vue Dupont 14 mars stupéfiants » — et cette phrase-là ne
   doit pas quitter le cabinet.
2. Le **serveur revérifie**. Ce qui arrive dans une requête est un allégué,
   quoi qu'il prétende : la référence est intersectée avec le corpus détenu
   côté serveur, exactement comme les citations autorisées le sont déjà dans
   `ldi-analyze`. L'appelant peut restreindre, jamais élargir.

### Option 3 — Corpus élargi, embarqué dans l'application

| | |
|---|---|
| Coût | Poids du corpus, mise à jour manuelle |
| Confidentialité | Parfaite : aucun appel réseau |
| **Écartée** | Un corpus embarqué vieillit en silence |

Séduisante, et fausse. Un article de code est modifié sans prévenir ; une copie
livrée avec l'application continue de s'afficher, identique, longtemps après.
L'outil citerait alors un texte abrogé avec l'aplomb d'un texte en vigueur —
c'est-à-dire exactement la faute qu'il existe pour empêcher, en plus lent.

Pour la jurisprudence, c'est pire encore : un instantané d'arrêts ne dit rien
des revirements postérieurs.

Le corpus local actuel reste ce qu'il est : un **index de références**, dont les
énoncés sont marqués `a-verifier` tant que Légifrance ne les a pas confirmés.
C'est la position honnête, et elle ne change pas.

### Option 4 — Statu quo : ligne de commande seulement

| | |
|---|---|
| Coût | Nul |
| **Écartée** | L'écran annonce une capacité qu'il n'a pas |

## Décision

**Option 2.** Un relais côté serveur, alimenté par le corpus, revérifié côté
serveur, avec l'authentification déjà en place devant.

## Ce qui n'a PAS été vérifié — à lire avant de déployer

Ce dépôt ne détient aucun identifiant PISTE, et l'environnement de
développement n'a pas d'accès sortant vers `piste.gouv.fr`. En conséquence :

> **L'intégration n'a jamais été exercée contre le service réel.** Elle est
> testée contre un service simulé, ce qui vérifie la logique du relais et sa
> résistance aux réponses inattendues — pas la forme exacte des requêtes que
> PISTE attend, ni celle des réponses qu'il renvoie.

Ce qui reste donc à confirmer, identifiants en main :

| À vérifier | Pourquoi cela peut différer |
|---|---|
| Chemin et verbe de l'appel de recherche | La documentation PISTE évolue ; `search` est le chemin documenté, pas une certitude |
| Nom des paramètres de requête | `query`, `field`, `resolve_references` viennent de la documentation Judilibre |
| Forme du jeton OAuth | Flux `client_credentials`, portée `openid` — à confirmer pour l'API souscrite |
| Nom des champs de réponse | La lecture est déjà défensive : plusieurs noms sont acceptés, et une entrée incomplète est ignorée plutôt que complétée |
| Quotas et limitation de débit | Inconnus ; le relais borne déjà le nombre de références par appel |

**L'interface dit cet état.** Tant que les secrets ne sont pas configurés, la
vue de recherche affiche « source non configurée » et ne produit aucune
décision — jamais un résultat plausible en attendant mieux.

## Ce que le relais refuse, par construction

- Une référence absente du corpus serveur → **422**, avec la liste de ce qui a
  été écarté. Pas de recherche « au cas où ».
- Un texte libre → il n'existe aucun champ pour en envoyer un.
- Une réponse de Judilibre dont il manque le numéro ou la date → l'entrée est
  **ignorée**. Mieux vaut perdre un arrêt réel que produire une référence
  incomplète qu'un lecteur pressé citerait telle quelle.
- Un appel non authentifié → **401**. Le relais consomme un quota facturé à
  l'opérateur : il ne peut pas être ouvert.

## Secrets attendus par la fonction

```
LDI_PISTE_CLIENT_ID       identifiant d'application PISTE
LDI_PISTE_CLIENT_SECRET   secret associé
LDI_PISTE_OAUTH_URL       défaut : https://oauth.piste.gouv.fr/api/oauth/token
LDI_JUDILIBRE_URL         défaut : https://api.piste.gouv.fr/cassation/judilibre/v1.0/
LDI_LEGIFRANCE_URL        optionnel — vérification du texte d'un article
```

Absents, la fonction répond **503 « source non configurée »**. Elle ne dégrade
pas vers un résultat approximatif.
