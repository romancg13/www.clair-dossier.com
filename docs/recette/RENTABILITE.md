# Rentabilité — calculateur privé

Généré par `node scripts/rentabilite.mjs --md`. Taux retenu : 1 USD = 0.92 EUR (hypothèse à actualiser).

**Officiel** : prix des offres (nets, TVA non applicable) et tarifs API. **Hypothèses** : tous les volumes d’usage, la taille des appels, Stripe, hébergement et support — aucun usage client réel n’a encore été mesuré. Les remplacer par le registre des coûts (`/api/admin/ia`) dès que la recette tourne avec une clé.

## Coûts unitaires estimés

| Opération | Coût API estimé |
|---|---|
| Lecture d’une pièce (≈ 3 pages, 40 % lues par les règles seules) | 0,0116 € |
| Révision d’un dossier (synthèse + six rendus) | 0,0451 € |
| Message à l’assistant (1.4 appel en moyenne, modèle choisi selon la demande) | 0,0074 € |
| Téléchargement, ZIP, automatisation « bilan », rappel d’échéance | 0 € (aucun appel IA) |

## Marge par offre et par scénario

Marge = (prix net − coûts directs) / prix net. Cible : 70 %.

| Offre | Prix | Scénario | Coût API | Coûts directs | Marge mensuel | Marge annuel (−10 %) | Budget API soutenable |
|---|---|---|---|---|---|---|---|
| Essentiel | 19 € | faible | 0,09 € | 2,12 € | 89 % | 88 % | 3,66 € |
| Essentiel | 19 € | normal | 0,47 € | 2,52 € | 87 % | 85 % | 3,66 € |
| Essentiel | 19 € | intensif | 3,02 € | 5,12 € | 73 % | 70 % | 3,59 € |
| Entrepreneur | 39 € | faible | 0,17 € | 2,51 € | 94 % | 93 % | 9,36 € |
| Entrepreneur | 39 € | normal | 0,94 € | 3,30 € | 92 % | 91 % | 9,35 € |
| Entrepreneur | 39 € | intensif | 6,04 € | 8,51 € | 78 % | 76 % | 9,22 € |
| Business PME 20 | 49 € | faible | 0,35 € | 2,84 € | 94 % | 94 % | 12,21 € |
| Business PME 20 | 49 € | normal | 1,89 € | 4,41 € | 91 % | 90 % | 12,18 € |
| Business PME 20 | 49 € | intensif | 12,08 € | 14,84 € | ⚠ 70 % | 67 % | 11,93 € |
| Business PME 50 | 89 € | faible | 0,87 € | 3,97 € | 96 % | 95 % | 23,60 € |
| Business PME 50 | 89 € | normal | 4,71 € | 7,89 € | 91 % | 90 % | 23,53 € |
| Business PME 50 | 89 € | intensif | 30,19 € | 33,98 € | ⚠ 62 % | 58 % | 22,91 € |
| Pro | 169 € | faible | 1,74 € | 6,06 € | 96 % | 96 % | 46,39 € |
| Pro | 169 € | normal | 9,43 € | 13,89 € | 92 % | 91 % | 46,24 € |
| Pro | 169 € | intensif | 60,39 € | 66,08 € | ⚠ 61 % | 57 % | 45,01 € |
| Premium | 299 € | faible | 3,49 € | 9,78 € | 97 % | 97 % | 83,41 € |
| Premium | 299 € | normal | 18,85 € | 25,44 € | 91 % | 91 % | 83,11 € |
| Premium | 299 € | intensif | 120,78 € | 129,82 € | ⚠ 57 % | 52 % | 80,65 € |

« Budget API soutenable » = dépense d’API mensuelle maximale par client pour tenir la marge cible : c’est le plafond à appliquer côté serveur (quota), pas un prix à facturer.

## Lecture

- Sous la cible : Business PME 20 (intensif, 70 %, prix minimal 49,48 €) ; Business PME 50 (intensif, 62 %, prix minimal 113,27 €) ; Pro (intensif, 61 %, prix minimal 220,26 €) ; Premium (intensif, 57 %, prix minimal 432,74 €).
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

## À mesurer avant toute décision tarifaire

1. Jetons réels par pièce, par révision et par message (registre des coûts).
2. Part réelle des pièces lisibles par les règles seules.
3. Frais Stripe constatés et taux de change du jour.
4. Usage réel par offre après un mois de recette.

