---
name: clair-verif
description: À utiliser avant de livrer tout élément ClairDossier — document, PDF, page web, composant React, e-mail de prospection, visuel, tâche planifiée, master prompt, message client. Déclenche le protocole d'auto-contrôle CLAIR-VERIF : relecture factuelle, non-régression, sécurité, RGPD, vérité produit, frontière juridique, puis ajout du bloc « CONTRÔLE CLAIRDOSSIER » en fin de livrable. S'applique aussi quand l'utilisateur demande un audit, une vérification, une relecture, ou dit « vérifie », « contrôle », « avant d'envoyer », « c'est bon ? ».
---

# CLAIR-VERIF — protocole d'auto-contrôle ClairDossier

Aucun livrable ClairDossier ne sort sans être passé par ce protocole. Il ne s'agit
pas d'une relecture de confort : c'est un filtre qui bloque trois familles d'erreurs
coûteuses — l'affirmation fausse, la régression silencieuse, et l'engagement
juridique involontaire.

## Quand l'appliquer

Systématiquement, avant de considérer un travail comme terminé :
document, PDF, page ou composant du site, e-mail sortant, contenu social,
tâche planifiée, prompt, script, migration, réponse à un prospect.

Ne pas l'appliquer aux échanges conversationnels courts sans livrable.

## Niveaux de contrôle

| Niveau | Quand | Ce qui est exigé |
|---|---|---|
| **N1** | Note interne, brouillon, exploration | Passes 1, 4 et 6 |
| **N2** | Défaut. Tout livrable destiné à Roman ou à un usage réel | Les 7 passes |
| **N3** | Contenu public, e-mail sortant, contenu juridique, code touchant l'auth, le stockage ou les données personnelles | Les 7 passes + relecture adverse (§ Relecture adverse) |

En cas de doute sur le niveau : appliquer N2. Ne jamais descendre en dessous de
N2 sans que l'utilisateur l'ait demandé.

## Les 7 passes

### Passe 1 — Exactitude factuelle
Chaque chiffre, date, nom, référence légale, nom de fonctionnalité et prix
présent dans le livrable est-il vérifiable dans une source ?
- Source de vérité du produit : le code du dépôt (`src/data/*`, `src/pages/*`),
  jamais un souvenir de conversation ni un ancien document.
- Source de vérité juridique : texte officiel (Légifrance, EUR-Lex, CNIL).
- Rien d'inventé : pas de jurisprudence fabriquée, pas de statistique estimée
  présentée comme mesurée, pas d'e-mail reconstruit, pas de nom de client fictif
  présenté comme réel.
- Une donnée non vérifiée est soit retirée, soit explicitement marquée comme estimée.

### Passe 2 — Non-régression
Le livrable modifie-t-il quelque chose qui fonctionnait ?
- Identifier ce qui existait avant, ce qui a été touché, ce qui aurait pu casser.
- Sur le code : `npm run typecheck` puis `npm run build` doivent passer.
  Ne jamais affirmer que ça compile sans avoir lancé la commande.
- Sur le contenu : les routes, ancres, liens internes et fichiers `.md` miroirs
  restent cohérents.
- Rien n'est supprimé sans que la suppression ait été demandée explicitement.

### Passe 3 — Vérité produit
Voir le skill `clair-produit` pour la règle des trois niveaux.
- Aucune fonctionnalité de roadmap présentée comme disponible.
- Aucune capacité d'IA exagérée : l'IA prépare et structure, elle ne décide pas.
- Aucune interface simulée présentée sans mention de démonstration.
- Aucune certification annoncée comme obtenue si elle est en cours ou visée.

### Passe 4 — Frontière juridique
- ClairDossier est une assistance technologique de structuration documentaire.
  Ce n'est ni un cabinet d'avocats, ni un service de conseil juridique.
- Aucune formulation ne doit laisser entendre que la plateforme remplace un avocat,
  garantit une issue, ou délivre un conseil personnalisé.
- Les contenus du journal sont pédagogiques : mention explicite quand le sujet
  touche à une décision juridique.
- La validation juridique éventuelle est un service optionnel assuré par un
  professionnel du droit inscrit — jamais par l'IA.

### Passe 5 — Sécurité
- Aucune clé API, aucun token, aucun mot de passe, aucune chaîne de connexion
  dans le livrable ni dans le dépôt. Variables d'environnement uniquement.
- Vérifier `.gitignore` avant tout ajout de fichier de configuration.
- Sur le code : validation des entrées, pas de secret côté client, pas de
  contournement d'authentification, pas d'élargissement de permission non demandé.
- Sur Supabase : toute nouvelle table ou policy est vérifiée en isolation
  par utilisateur (un compte ne voit jamais les données d'un autre).

### Passe 6 — RGPD et données personnelles
- Minimisation : le livrable collecte-t-il plus que nécessaire ?
- Finalité et base légale identifiées quand des données personnelles sont traitées.
- Prospection B2B : intérêt légitime, objet professionnel, identification de
  l'expéditeur, lien de désinscription, opposition traitée immédiatement et
  définitivement.
- Aucune donnée de client ou de dossier réel utilisée en exemple, même anonymisée,
  sans accord écrit.

### Passe 7 — Qualité et cohérence de marque
- Identité visuelle conforme au skill `clair-marque` (palette, typographies, ton).
- Pas d'emoji dans le copy public. Pas de formule générique
  (« solution tout-en-un », « boostez votre productivité »).
- Orthographe, typographie française (espaces insécables, guillemets français),
  cohérence des titres et de la hiérarchie.
- Accessibilité quand il s'agit d'interface : un `h1` par page, focus visible,
  contraste AA, `prefers-reduced-motion` respecté.

## Relecture adverse (N3 uniquement)

Avant de livrer, relire le travail en cherchant activement à le mettre en défaut :
1. Quelle phrase un concurrent citerait-il pour dire que c'est faux ?
2. Quelle affirmation un avocat relèverait-il comme un conseil juridique déguisé ?
3. Quelle donnée la CNIL demanderait-elle de justifier ?
4. Qu'est-ce qui casse si l'utilisateur fait exactement l'inverse de ce qui est prévu ?

Corriger ce qui est trouvé avant de rendre la main. Ne pas se contenter de le signaler.

## Bloc de contrôle — obligatoire en fin de livrable

Terminer tout livrable N2 ou N3 par ce bloc, rempli honnêtement. Un bloc vide ou
complaisant est pire que pas de bloc.

```
── CONTRÔLE CLAIRDOSSIER ──

**Vérifié**
- (ce qui a été effectivement contrôlé, et contre quelle source)

**Non vérifiable**
- (ce qui n'a pas pu être vérifié, et pourquoi — jamais « rien »)

**Anomalies corrigées**
- (ce qui a été trouvé et corrigé en cours de route)

**Points restants**
- (ce qui reste à faire, et par qui)

**Validation humaine requise**
- (décisions produit, commerciales, juridiques ou financières hors périmètre)

**Verdict : PRÊT | PRÊT SOUS RÉSERVE | NON PRÊT** — une phrase de justification.
```

## Interdits absolus

- Affirmer qu'une commande a été exécutée sans l'avoir lancée.
- Écrire « tout est vérifié » quand une partie ne l'est pas.
- Combler une information manquante par une valeur plausible.
- Livrer sans bloc de contrôle un élément destiné à un usage réel.
