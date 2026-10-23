---
description: Force un audit CLAIR-VERIF niveau N2 sur un fichier, une page ou le diff courant
argument-hint: [chemin | URL | vide pour le diff courant]
---

Applique le protocole CLAIR-VERIF (skill `clair-verif`) au niveau **N2** — ou
**N3** si la cible est un contenu public, un e-mail sortant, un contenu juridique,
ou du code touchant l'authentification, le stockage ou des données personnelles.

Cible : `$ARGUMENTS`
Si aucune cible n'est donnée, auditer les modifications non commitées
(`git status` puis `git diff`).

Déroulé :

1. Lire réellement la cible. Ne pas auditer de mémoire.
2. Dérouler les 7 passes, dans l'ordre, en indiquant pour chacune ce qui a été
   contrôlé et contre quelle source.
3. Pour du code : exécuter `npm run typecheck`, puis `npm run build` si le
   changement touche le rendu ou les données. Reporter la sortie réelle.
4. Corriger ce qui peut l'être sans décision produit, commerciale ou juridique.
   Signaler le reste au lieu de trancher à la place de Roman.
5. Terminer par le bloc CONTRÔLE CLAIRDOSSIER complet, avec un verdict
   PRÊT / PRÊT SOUS RÉSERVE / NON PRÊT.

Ne jamais rendre un verdict PRÊT si une passe n'a pas pu être menée à son terme :
dans ce cas, verdict PRÊT SOUS RÉSERVE et motif nommé.
