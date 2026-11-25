# Rentabilité — calculateur privé

> **Coûts unitaires MESURÉS le 25/11/2026** sur la recette hébergée (API réelle) : ≈ 2,5 c€ par pièce, ≈ 8 c€ par synthèse, ≈ 1,5 c€ par question à l’assistant (mix Haiku/Sonnet/Opus). Petit échantillon de pièces fictives : à confirmer sur volume. Les volumes d’usage restent des hypothèses.

Généré par `node scripts/rentabilite.mjs --md`. Taux retenu : 1 USD = 0.9122 EUR (taux de référence BCE du 24/11/2026 : 1 EUR = 1,0963 USD, sauf variable USD_EUR).

**Officiel** : prix des offres (nets, TVA non applicable) et tarifs API. **Hypothèses** : tous les volumes d’usage, la taille des appels, Stripe, hébergement et support — aucun usage client réel n’a encore été mesuré. Les remplacer par le registre des coûts (`/api/admin/ia`) dès que la recette tourne avec une clé.

## Coûts unitaires estimés

| Opération | Coût API estimé |
|---|---|
| Lecture d’une pièce (≈ 3 pages, 40 % lues par les règles seules) | 0,0250 € |
| Révision d’un dossier (synthèse + six rendus) | 0,0800 € |
| Message à l’assistant (1.4 appel en moyenne, modèle choisi selon la demande) | 0,0148 € |
| Téléchargement, ZIP, automatisation « bilan », rappel d’échéance | 0 € (aucun appel IA) |

## Marge par offre et par scénario

Marge = (prix net − coûts directs) / prix net. Cible : 70 %.

| Offre | Prix | Scénario | Coût API | Coûts directs | Marge mensuel | Marge annuel (−10 %) | Budget API soutenable |
|---|---|---|---|---|---|---|---|
| Essentiel | 19 € | faible | 0,17 € | 2,21 € | 88 % | 87 % | 3,66 € |
| Essentiel | 19 € | normal | 0,94 € | 2,98 € | 84 % | 83 % | 3,66 € |
| Essentiel | 19 € | intensif | 6,17 € | 8,27 € | ⚠ 56 % | 52 % | 3,59 € |
| Entrepreneur | 39 € | faible | 0,34 € | 2,68 € | 93 % | 93 % | 9,36 € |
| Entrepreneur | 39 € | normal | 1,88 € | 4,23 € | 89 % | 88 % | 9,35 € |
| Entrepreneur | 39 € | intensif | 12,34 € | 14,81 € | ⚠ 62 % | 58 % | 9,22 € |
| Business PME 20 | 49 € | faible | 0,68 € | 3,17 € | 94 % | 93 % | 12,21 € |
| Business PME 20 | 49 € | normal | 3,75 € | 6,27 € | 87 % | 86 % | 12,18 € |
| Business PME 20 | 49 € | intensif | 24,67 € | 27,44 € | ⚠ 44 % | 38 % | 11,93 € |
| Business PME 50 | 89 € | faible | 1,70 € | 4,80 € | 95 % | 94 % | 23,60 € |
| Business PME 50 | 89 € | normal | 9,38 € | 12,56 € | 86 % | 84 % | 23,53 € |
| Business PME 50 | 89 € | intensif | 61,68 € | 65,47 € | ⚠ 26 % | 18 % | 22,91 € |
| Pro | 169 € | faible | 3,40 € | 7,71 € | 95 % | 95 % | 46,39 € |
| Pro | 169 € | normal | 18,77 € | 23,23 € | 86 % | 85 % | 46,24 € |
| Pro | 169 € | intensif | 123,36 € | 129,05 € | ⚠ 24 % | 15 % | 45,01 € |
| Premium | 299 € | faible | 6,79 € | 13,08 € | 96 % | 95 % | 83,41 € |
| Premium | 299 € | normal | 37,54 € | 44,12 € | 85 % | 84 % | 83,11 € |
| Premium | 299 € | intensif | 246,72 € | 255,77 € | ⚠ 14 % | 5 % | 80,65 € |

« Budget API soutenable » = dépense d’API mensuelle maximale par client pour tenir la marge cible : c’est le plafond à appliquer côté serveur (quota), pas un prix à facturer.

## Lecture

- Sous la cible : Essentiel (intensif, 56 %, prix minimal 27,58 €) ; Entrepreneur (intensif, 62 %, prix minimal 49,37 €) ; Business PME 20 (intensif, 44 %, prix minimal 91,46 €) ; Business PME 50 (intensif, 26 %, prix minimal 218,23 €) ; Pro (intensif, 24 %, prix minimal 430,17 €) ; Premium (intensif, 14 %, prix minimal 852,56 €).
- Réponse recommandée : ne pas augmenter les prix, mais plafonner l’API par client au « budget soutenable » ; au-delà, lecture par les règles et résultat annoncé partiel (déjà en place).

## Options

| Option | Prix | Budget API indicatif | Marge | Budget API maximal pour 70 % |
|---|---|---|---|---|
| Automation Pro | 19 € | 3 € | 83 % | 5,42 € |
| Vigilance Pro | 29 € | 5 € | 81 % | 8,27 € |
| Pilotage Pro | 39 € | 7 € | 81 % | 11,12 € |

Les trois options tiennent la cible aux budgets indicatifs. Tarifs provisoires, non commercialisés.

## Crédits API inclus (200 USD par mois)

Avantage temporaire de trésorerie, non nécessaire au modèle : toutes les marges ci-dessus sont calculées SANS crédits. Avec eux, l’API est couverte pour environ : 194 clients Essentiel, 97 clients Entrepreneur, 48 clients Business PME 20, 19 clients Business PME 50, 9 clients Pro, 4 clients Premium (usage normal).

## Gros consommateur (tous les dossiers actifs, 120 pièces, 8 révisions et 40 messages par dossier et par mois)

| Offre | Prix | Coût API sans quota | Marge sans quota | Quota API serveur | Marge avec quota |
|---|---|---|---|---|---|
| Essentiel | 19 € | 21,16 € | ⚠ -23 % | 3,40 € | 70 % |
| Entrepreneur | 39 € | 42,32 € | ⚠ -16 % | 8,84 € | 70 % |
| Business PME 20 | 49 € | 84,64 € | ⚠ -80 % | 11,16 € | 70 % |
| Business PME 50 | 89 € | 211,60 € | ⚠ -144 % | 20,98 € | 70 % |
| Pro | 169 € | 423,20 € | ⚠ -156 % | 41,14 € | 70 % |
| Premium | 299 € | 846,40 € | ⚠ -189 % | 72,92 € | 70 % |

Sans plafond, un seul gros consommateur peut rendre une offre déficitaire. Le quota serveur (réservation avant appel, repli sur les règles au plafond, résultat annoncé partiel) borne la perte : c’est lui, et non le prix, qui protège la marge. ESTIMÉ.

## Coûts par unité (usage normal, ESTIMÉS)

| Unité | Coût direct |
|---|---|
| Un document lu | 0,0250 € |
| Un dossier actif par mois | 0,4692 € |
| Une conversation (un message et sa réponse) | 0,0148 € |
| Une automatisation (5 exécutions par mois, par règles) | 0,0000 € d’API |
| Un client Essentiel par mois (tous coûts directs) | 2,98 € |
| Un client Entrepreneur par mois (tous coûts directs) | 4,23 € |
| Un client Business PME 20 par mois (tous coûts directs) | 6,27 € |
| Un client Business PME 50 par mois (tous coûts directs) | 12,56 € |
| Un client Pro par mois (tous coûts directs) | 23,23 € |
| Un client Premium par mois (tous coûts directs) | 44,12 € |

Leviers non comptés ici (prudence) : lecture du cache à 10 % du prix d’entrée pour les consignes répétées ; traitement différé (Batch) à −50 % pour les analyses non urgentes. Coût d’un traitement échoué : nul côté API si l’appel n’aboutit pas (réservation libérée), sinon celui de l’appel — à mesurer.

## Seuil de rentabilité

Coûts fixes retenus : 250,00 € par mois (HYPOTHÈSE — `FIXES_EUR=… node scripts/rentabilite.mjs --md` pour vos chiffres). Répartition des clients : Essentiel 35 %, Entrepreneur 30 %, Business PME 20 15 %, Business PME 50 10 %, Pro 7 %, Premium 3 % (hypothèse).

- Revenu moyen par client : 55,40 € ; contribution moyenne après coûts directs : 47,94 €.
- **Seuil : 6 clients payants** couvrent les coûts fixes, sans aucun crédit.

## Scénarios de croissance (résultat mensuel après coûts directs et fixes)

| Scénario | Horizon | Clients | Revenu | Coût API | Résultat SANS crédits | Résultat AVEC crédits |
|---|---|---|---|---|---|---|
| prudent | 6 mois | 5 | 277,00 € | 24,16 € | -10,30 € | 13,87 € |
| prudent | 12 mois | 15 | 831,00 € | 72,49 € | 469,11 € | 541,61 € |
| prudent | 24 mois | 30 | 1662,00 € | 144,98 € | 1188,23 € | 1333,21 € |
| central | 6 mois | 10 | 554,00 € | 48,33 € | 229,41 € | 277,74 € |
| central | 12 mois | 40 | 2216,00 € | 193,31 € | 1667,64 € | 1850,08 € |
| central | 24 mois | 100 | 5540,00 € | 483,28 € | 4544,10 € | 4726,54 € |
| ambitieux | 6 mois | 25 | 1385,00 € | 120,82 € | 948,52 € | 1069,34 € |
| ambitieux | 12 mois | 100 | 5540,00 € | 483,28 € | 4544,10 € | 4726,54 € |
| ambitieux | 24 mois | 300 | 16620,00 € | 1449,83 € | 14132,29 € | 14314,73 € |

Les crédits (200 USD ≈ 182,44 € par mois) ne réduisent que la part d’API réellement consommée : ils améliorent la trésorerie, ils ne changent ni les marges ni le seuil. Leurs conditions d’emploi pour un service commercial restent à confirmer dans la Console.

## Recommandations (propositions — aucun tarif n’est modifié)

1. **Garder les sept prix actuels** : sous ces hypothèses, l’usage normal tient la cible sur toutes les offres ; le risque vient des usages intensifs, pas des prix.
2. **Plafonner l’API par client** au « budget API soutenable » de chaque offre, côté serveur, avec repli annoncé : c’est le volume inclus.
3. **Options** : conserver +19 / +29 / +39 € avec des budgets API de 3 / 5 / 7 € ; ne pas les vendre avant d’avoir mesuré dix clients réels.
4. **Ne pas compter sur les crédits** dans le prix : ils financent la recette et les premiers clients.
5. Revoir ces chiffres dès que le registre des coûts contient des appels réels (aujourd’hui : 0 appel, 0 USD).

## À mesurer avant toute décision tarifaire

1. Jetons réels par pièce, par révision et par message (registre des coûts).
2. Part réelle des pièces lisibles par les règles seules.
3. Frais Stripe constatés et taux de change du jour.
4. Usage réel par offre après un mois de recette.

