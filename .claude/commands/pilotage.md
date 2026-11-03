---
description: Rapport de pilotage ClairDossier — état du site, du produit et des chantiers ouverts
argument-hint: [semaine | mois | vide]
---

Produis un rapport de pilotage ClairDossier pour la période : `$ARGUMENTS`
(défaut : la semaine écoulée).

Sources à utiliser, dans cet ordre :

1. **Le dépôt** — `git log` sur la période, fichiers modifiés, état de la branche
   par rapport à `main`, pull requests ouvertes.
2. **L'état du produit** — cohérence entre `src/data/*`, les pages React, les
   miroirs `public/*.md` et `public/llms.txt` (skill `clair-produit`).
3. **Les registres SPA-CD** (02 pipeline, 05 calendrier éditorial, 09 délivrabilité,
   10 opposition) si les connecteurs Drive ou Notion sont disponibles dans la
   session. S'ils ne le sont pas, l'écrire au lieu de produire des chiffres.

Structure du rapport :

- **Ce qui a avancé** — livrables réels, avec les commits ou fichiers concernés.
- **État du site** — build, typecheck, incohérences de contenu détectées.
- **Acquisition** — volumes, taux de réponse, oppositions reçues, si les données
  sont accessibles.
- **Contenu** — publications faites, publications prévues.
- **Risques et écarts** — ce qui dérive, ce qui vieillit, ce qui contredit la
  vérité produit.
- **Décisions attendues de Roman** — liste courte, chaque point formulé comme une
  question fermée.

Terminer par le bloc CONTRÔLE CLAIRDOSSIER (skill `clair-verif`).

Aucun chiffre n'est estimé : soit il vient d'une source consultée dans cette
session, soit il est marqué « non disponible ».
