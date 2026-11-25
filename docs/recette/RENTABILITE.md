# Rentabilité — calculateur privé

Généré par `node scripts/rentabilite.mjs --md`. Taux retenu : 1 USD = 0.9122 EUR (taux de référence BCE du 24/11/2026 : 1 EUR = 1,0963 USD, sauf variable USD_EUR).

**Officiel** : prix des offres (nets, TVA non applicable) et tarifs API. **Hypothèses** : tous les volumes d’usage, la taille des appels, Stripe, hébergement et support — aucun usage client réel n’a encore été mesuré. Les remplacer par le registre des coûts (`/api/admin/ia`) dès que la recette tourne avec une clé.

## Coûts unitaires estimés

| Opération | Coût API estimé |
|---|---|
| Lecture d’une pièce (≈ 3 pages, 40 % lues par les règles seules) | 0,0115 € |
| Révision d’un dossier (synthèse + six rendus) | 0,0447 € |
| Message à l’assistant (1.4 appel en moyenne, modèle choisi selon la demande) | 0,0073 € |
| Téléchargement, ZIP, automatisation « bilan », rappel d’échéance | 0 € (aucun appel IA) |

## Marge par offre et par scénario

Marge = (prix net − coûts directs) / prix net. Cible : 70 %.

| Offre | Prix | Scénario | Coût API | Coûts directs | Marge mensuel | Marge annuel (−10 %) | Budget API soutenable |
|---|---|---|---|---|---|---|---|
| Essentiel | 19 € | faible | 0,09 € | 2,12 € | 89 % | 88 % | 3,66 € |
| Essentiel | 19 € | normal | 0,47 € | 2,51 € | 87 % | 85 % | 3,66 € |
| Essentiel | 19 € | intensif | 2,99 € | 5,10 € | 73 % | 70 % | 3,59 € |
| Entrepreneur | 39 € | faible | 0,17 € | 2,51 € | 94 % | 93 % | 9,36 € |
| Entrepreneur | 39 € | normal | 0,93 € | 3,29 € | 92 % | 91 % | 9,35 € |
| Entrepreneur | 39 € | intensif | 5,99 € | 8,46 € | 78 % | 76 % | 9,22 € |
| Business PME 20 | 49 € | faible | 0,35 € | 2,84 € | 94 % | 94 % | 12,21 € |
| Business PME 20 | 49 € | normal | 1,87 € | 4,39 € | 91 % | 90 % | 12,18 € |
| Business PME 20 | 49 € | intensif | 11,98 € | 14,74 € | ⚠ 70 % | 67 % | 11,93 € |
| Business PME 50 | 89 € | faible | 0,87 € | 3,96 € | 96 % | 95 % | 23,60 € |
| Business PME 50 | 89 € | normal | 4,67 € | 7,85 € | 91 % | 90 % | 23,53 € |
| Business PME 50 | 89 € | intensif | 29,94 € | 33,73 € | ⚠ 62 % | 58 % | 22,91 € |
| Pro | 169 € | faible | 1,73 € | 6,04 € | 96 % | 96 % | 46,39 € |
| Pro | 169 € | normal | 9,35 € | 13,81 € | 92 % | 91 % | 46,24 € |
| Pro | 169 € | intensif | 59,88 € | 65,57 € | ⚠ 61 % | 57 % | 45,01 € |
| Premium | 299 € | faible | 3,46 € | 9,75 € | 97 % | 97 % | 83,41 € |
| Premium | 299 € | normal | 18,69 € | 25,28 € | 92 % | 91 % | 83,11 € |
| Premium | 299 € | intensif | 119,75 € | 128,80 € | ⚠ 57 % | 52 % | 80,65 € |

« Budget API soutenable » = dépense d’API mensuelle maximale par client pour tenir la marge cible : c’est le plafond à appliquer côté serveur (quota), pas un prix à facturer.

## Lecture

- Sous la cible : Business PME 20 (intensif, 70 %, prix minimal 49,14 €) ; Business PME 50 (intensif, 62 %, prix minimal 112,42 €) ; Pro (intensif, 61 %, prix minimal 218,56 €) ; Premium (intensif, 57 %, prix minimal 429,33 €).
- Réponse recommandée : ne pas augmenter les prix, mais plafonner l’API par client au « budget soutenable » ; au-delà, lecture par les règles et résultat annoncé partiel (déjà en place).

## Options

| Option | Prix | Budget API indicatif | Marge | Budget API maximal pour 70 % |
|---|---|---|---|---|
| Automation Pro | 19 € | 3 € | 83 % | 5,42 € |
| Vigilance Pro | 29 € | 5 € | 81 % | 8,27 € |
| Pilotage Pro | 39 € | 7 € | 81 % | 11,12 € |

Les trois options tiennent la cible aux budgets indicatifs. Tarifs provisoires, non commercialisés.

## Crédits API inclus (200 USD par mois)

Avantage temporaire de trésorerie, non nécessaire au modèle : toutes les marges ci-dessus sont calculées SANS crédits. Avec eux, l’API est couverte pour environ : 390 clients Essentiel, 195 clients Entrepreneur, 97 clients Business PME 20, 39 clients Business PME 50, 19 clients Pro, 9 clients Premium (usage normal).

## Gros consommateur (tous les dossiers actifs, 120 pièces, 8 révisions et 40 messages par dossier et par mois)

| Offre | Prix | Coût API sans quota | Marge sans quota | Quota API serveur | Marge avec quota |
|---|---|---|---|---|---|
| Essentiel | 19 € | 10,15 € | ⚠ 34 % | 3,40 € | 70 % |
| Entrepreneur | 39 € | 20,30 € | ⚠ 41 % | 8,84 € | 70 % |
| Business PME 20 | 49 € | 40,60 € | ⚠ 10 % | 11,16 € | 70 % |
| Business PME 50 | 89 € | 101,50 € | ⚠ -20 % | 20,98 € | 70 % |
| Pro | 169 € | 202,99 € | ⚠ -26 % | 41,14 € | 70 % |
| Premium | 299 € | 405,98 € | ⚠ -41 % | 72,92 € | 70 % |

Sans plafond, un seul gros consommateur peut rendre une offre déficitaire. Le quota serveur (réservation avant appel, repli sur les règles au plafond, résultat annoncé partiel) borne la perte : c’est lui, et non le prix, qui protège la marge. ESTIMÉ.

## Coûts par unité (usage normal, ESTIMÉS)

| Unité | Coût direct |
|---|---|
| Un document lu | 0,0115 € |
| Un dossier actif par mois | 0,2336 € |
| Une conversation (un message et sa réponse) | 0,0073 € |
| Une automatisation (5 exécutions par mois, par règles) | 0,0000 € d’API |
| Un client Essentiel par mois (tous coûts directs) | 2,51 € |
| Un client Entrepreneur par mois (tous coûts directs) | 3,29 € |
| Un client Business PME 20 par mois (tous coûts directs) | 4,39 € |
| Un client Business PME 50 par mois (tous coûts directs) | 7,85 € |
| Un client Pro par mois (tous coûts directs) | 13,81 € |
| Un client Premium par mois (tous coûts directs) | 25,28 € |

Leviers non comptés ici (prudence) : lecture du cache à 10 % du prix d’entrée pour les consignes répétées ; traitement différé (Batch) à −50 % pour les analyses non urgentes. Coût d’un traitement échoué : nul côté API si l’appel n’aboutit pas (réservation libérée), sinon celui de l’appel — à mesurer.

## Seuil de rentabilité

Coûts fixes retenus : 250,00 € par mois (HYPOTHÈSE — `FIXES_EUR=… node scripts/rentabilite.mjs --md` pour vos chiffres). Répartition des clients : Essentiel 35 %, Entrepreneur 30 %, Business PME 20 15 %, Business PME 50 10 %, Pro 7 %, Premium 3 % (hypothèse).

- Revenu moyen par client : 55,40 € ; contribution moyenne après coûts directs : 50,37 €.
- **Seuil : 5 clients payants** couvrent les coûts fixes, sans aucun crédit.

## Scénarios de croissance (résultat mensuel après coûts directs et fixes)

| Scénario | Horizon | Clients | Revenu | Coût API | Résultat SANS crédits | Résultat AVEC crédits |
|---|---|---|---|---|---|---|
| prudent | 6 mois | 5 | 277,00 € | 12,03 € | 1,84 € | 13,87 € |
| prudent | 12 mois | 15 | 831,00 € | 36,10 € | 505,51 € | 541,61 € |
| prudent | 24 mois | 30 | 1662,00 € | 72,20 € | 1261,02 € | 1333,21 € |
| central | 6 mois | 10 | 554,00 € | 24,07 € | 253,67 € | 277,74 € |
| central | 12 mois | 40 | 2216,00 € | 96,26 € | 1764,69 € | 1860,95 € |
| central | 24 mois | 100 | 5540,00 € | 240,65 € | 4786,72 € | 4969,16 € |
| ambitieux | 6 mois | 25 | 1385,00 € | 60,16 € | 1009,18 € | 1069,34 € |
| ambitieux | 12 mois | 100 | 5540,00 € | 240,65 € | 4786,72 € | 4969,16 € |
| ambitieux | 24 mois | 300 | 16620,00 € | 721,95 € | 14860,17 € | 15042,61 € |

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

