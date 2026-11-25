# Capacité — mesures du 25/11/2026

Outil : `npx tsx scripts/recette/capacite.ts` (corpus synthétique : PDF texte, texte, CSV, doublons, une pièce illisible ; lecture par règles, **aucun appel de modèle**). Données brutes : `docs/recette/mesures/`.

## MESURÉ EN LOCAL — un dossier, un lot de N fichiers (serveur de recette en mémoire, sans latence réseau)

| Fichiers | Dépôt | Toutes pièces lues | Premier résultat | Six rendus | Accès au stockage | Doublons détectés | Mémoire (pic) |
|---|---|---|---|---|---|---|---|
| 10 | 0,1 s | 0,1 s | 1,2 s | 3,2 s | 614 | 1/1 | 260 Mo |
| 25 | 0,1 s | 0,2 s | 1,3 s | 3,7 s | 1 525 | 2/2 | 277 Mo |
| 50 | 0,2 s | 0,2 s | 1,3 s | 4,3 s | 3 090 | 4/4 | 282 Mo |
| 100 | 0,2 s | 0,3 s | 1,5 s | 7,1 s | 6 207 | 8/8 | 309 Mo |
| **250** | 0,5 s | 0,7 s | 2,9 s | **21,7 s** | 15 930 | 20/20 | 339 Mo |

À 250 fichiers : 229 pièces lues, 1 illisible signalée, 20 doublons écartés, six rendus disponibles, téléchargement des 14 fichiers en 6 ms, archive ZIP (1,6 Mo) en 66 ms.

**Défaut trouvé et corrigé pendant cette mesure** : le rendu « Résumé » prenait 52 s à 160 fichiers et 288 s à 250 (la tâche expirait puis recommençait : c'est l'échec du premier essai). Cause : une mise en forme typographique complète à chaque mot lors du découpage en lignes. Correctif : `supabase/functions/_shared/rendus/pdf.ts` (mesure exacte seulement près de la marge) → 13,6 s à 250 fichiers ; 40 tests de rendus verts.

## MESURÉ EN LOCAL — capacité logique 20 dossiers × 250 fichiers (aucune analyse lancée)

5 000 pièces déposées en 37 s, 5 000 travaux en file, 0 analyse ; liste des 20 dossiers en 0,16 s ; ouverture d'un dossier de 250 pièces en 29 ms ; 21e dossier refusé par la formule (402) ; dépôt au-delà du plafond de volume refusé (413). Mémoire au pic : 304 Mo.

## MESURÉ SUR LA RECETTE HÉBERGÉE (stockage distant)

4 pièces : premier résultat 15 s, six rendus 23 s (37–39 s avant le lot performance). Fichiers de 9 et 12 Mo déposés en 11,6 s.

## NON TESTÉ

- 250 fichiers sur la recette hébergée : non lancé. La même mesure avec une latence simulée de 60–120 ms par accès n'a pas abouti en 5 minutes.
- Fichiers au-delà de 25 Mo, reprise après coupure réseau (transfert reprenable non développé), antivirus.

## EXTRAPOLÉ — ce que ces chiffres impliquent pour un stockage distant

Un fichier coûte environ **64 accès au stockage** (15 930 pour 250), dont un quart en écriture. Sur un stockage objet à ~90 ms par accès, un lot de 250 fichiers représente de l'ordre de 16 000 opérations : plusieurs minutes de traitement, et une part importante d'un quota gratuit d'opérations (à vérifier dans Vercel → Storage → Usage). C'est la limite réelle de l'architecture de recette (un fichier JSON par objet). En production, la même charge sur une base indexée (Supabase/Postgres) se compte en requêtes, pas en objets : c'est l'architecture cible, à mesurer avant d'annoncer 250 fichiers par dossier aux clients.

## Plafonds applicatifs relevés

| Plafond | Où | Avis |
|---|---|---|
| 25 Mo par fichier | dépôt direct (`recette/server/api.ts`) | à relever avec un transfert reprenable ; justifié tant qu'il n'existe pas |
| 50 Mo de pièces par compte | `LIMITES.octetsParCompte` | **propre à la recette** (stockage gratuit de 1 Go) ; à ne pas reprendre en production |
| Nombre de dossiers par formule | droits serveur | commercial, voulu |
| Nombre de fichiers par dossier, dépôts par jour | aucun plafond dans le code | conforme à l'objectif |
| 10 automatisations actives, 40 messages par heure à l'assistant | garde-fous | protègent le budget, à conserver |

Aucun essai fini ne prouve une capacité illimitée : ce document établit que 250 fichiers par dossier et 5 000 pièces par compte fonctionnent en local, pas davantage.
