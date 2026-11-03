# Textes à approuver avant toute activation client — version ia-2026-11

**Statut : PROPOSITION, non publiée, non validée.** Ces textes ne s'appliquent qu'après votre approbation
écrite (`npm run ia:commission -- --approuver`), leur publication sur le site et l'activation du panneau.
Ils ne remplacent pas l'avis d'un professionnel du droit ; les mentions « À CONFIRMER » dépendent de vos
contrats et ne doivent pas être publiées telles quelles.

## 1. CGV — article 6 « Traitement des dossiers » (`src/data/legal.ts`)

**Texte actuellement publié (1er paragraphe) :**

> Le Service organise les dossiers à partir des informations et des pièces renseignées par le Client. Il ne
> procède à aucune lecture, extraction ou analyse automatique des documents : le contenu des dossiers est
> saisi et structuré par le Client lui-même.

**Texte proposé (remplace le 1er paragraphe ; le 2e, sur la transmission, est conservé) :**

> Le Service organise les dossiers à partir des informations et des pièces renseignées par le Client. Sur
> activation expresse et révocable du Client, dossier par dossier, ClairDossier procède à une lecture et à une
> analyse automatiques des pièces de ce dossier afin de produire des documents de travail : résumé, tableau de
> bord, chronologie, dates, échéances et projets de relances. Ces documents sont générés par un système
> d'intelligence artificielle et signalés comme tels ; ils mentionnent les pièces sur lesquelles ils reposent,
> signalent les informations incertaines ou manquantes et doivent être vérifiés par le Client. Ils ne
> constituent ni un conseil juridique, ni un acte juridique, ni une garantie d'exhaustivité. Aucune pièce n'est
> analysée sans activation, aucun dossier n'est analysé rétroactivement et aucun message n'est envoyé à un tiers
> par le Service : les projets de relances restent des brouillons. L'analyse est réalisée par le sous-traitant
> mentionné dans la politique de confidentialité. Le Client peut désactiver le traitement à tout moment ; les
> documents déjà produits restent disponibles jusqu'à la suppression du dossier.

## 2. Politique de confidentialité — ajouts (`src/data/legal.ts`, `src/data/trust.ts`)

**Finalité ajoutée :** production de documents de travail par analyse automatique des pièces d'un dossier,
uniquement sur activation expresse du Client pour ce dossier.
**Base légale :** exécution du contrat (option activée par le Client) — **À CONFIRMER** au regard de l'AIPD,
notamment si les pièces contiennent des données sensibles ou relatives aux infractions.
**Données traitées :** contenu des pièces déposées dans le dossier activé ; résultats structurés (faits, dates,
échéances, sources) ; journal technique sans contenu.
**Destinataire ajouté (sous-traitant) :** Anthropic (service d'IA). Faits vérifiés sur ses pages officielles
au 2026-11-04 : suppression des entrées et sorties API sous 30 jours par défaut ; pas d'utilisation pour
l'entraînement par défaut ; conservation nulle possible par accord. **À CONFIRMER sur contrat :** entité
contractante et localisation, mécanisme d'encadrement des transferts hors Union européenne, conservation
applicable à votre compte.
**Conservation chez ClairDossier :** analyses et documents produits supprimés avec le dossier ; bilans
d'exploitation chiffrés (sans contenu) conservés 90 jours.
**Droits :** inchangés ; la désactivation du traitement s'exerce depuis le dossier ou sur demande.

## 3. Information dans l'espace client (au moment de l'activation)

> En activant l'analyse automatique, vous autorisez ClairDossier à faire lire les pièces de ce dossier par un
> service d'intelligence artificielle afin de préparer un résumé, une chronologie, vos dates et échéances et des
> projets de relances. Ces documents sont des aides de travail à vérifier, pas un conseil juridique. Rien n'est
> envoyé à un tiers. Vous pouvez désactiver l'analyse à tout moment.

## 4. Pages à aligner lors de la publication (même PR)

Les mentions absolues « aucune lecture automatique » (page Sécurité, état du produit, segments, FAQ, accueil,
application mobile, `llms.txt`) deviennent : « Aucune lecture automatique de vos pièces sans votre activation
expresse, dossier par dossier (CGV, art. 6). » Les tests qui figent l'ancienne phrase évoluent dans la même PR.
