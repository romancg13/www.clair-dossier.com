# UX simplifiée, premium intact — 2026-11-04

Branche `feature/ux-simplifiee` (depuis `main` e3e19bd). Objectif : moins lire, mieux comprendre,
agir plus vite — sans toucher au design, aux couleurs, aux cinématiques, aux paiements ni au moteur IA.

## Mesures réelles (même outil avant / après : `node scripts/mesure-ux.mjs <dist>`)

Texte visible dans `<main>` hors `aria-hidden`, page entièrement parcourue, mouvement réduit.

| Page (390 px) | Mots avant → après | Sections | Liens/boutons | Hauteur |
|---|---|---|---|---|
| Accueil | 2 112 → 708 (−66 %) | 17 → 9 (5 blocs) | 47 → 19 | 25 086 → 12 412 px (−51 %) |
| /fonctionnalites | 933 → 973 (+4 %, absorbe 5 sections de l'accueil) | 7 → 8 | 17 → 23 | 9 658 → 11 253 px |
| /securite | 1 628 → 1 661 (synthèse en tête) | 5 | 21 → 26 (ancres) | 7 231 → 7 453 px |
| /blog | 579 → 549 | 2 | 18 | 6 956 → 6 878 px |
| /tarifs | inchangé (gelé) | | | |

La FAQ de l'accueil (4 questions) est un accordéon : les réponses repliées ne sont pas comptées.

## Accueil : 5 sections

1. **Hero** — H1 inchangé ; « Centralisez vos documents, retrouvez vos dossiers et suivez vos
   échéances au même endroit. » ; cible « Entreprises, indépendants et cabinets » ; CTA
   « Créer un dossier » (visiteur : `/inscription?next=/dossier/nouveau`, compte : `/dossier/nouveau`)
   et « Voir comment ça fonctionne ».
2. **Comment ça fonctionne** — 01 Déposez vos documents (StoryScene), 02 Organisez votre dossier
   (formulaire de création en 5 étapes), 03 Suivez l'essentiel (échéances et état du suivi).
3. **Le résultat concret** — la page dossier de démonstration réduite à 3 informations : état du suivi
   (4 états), échéance, prochaine action (texte réel `STEP_NEXT_ACTIONS`).
4. **Sécurité et confiance** — 4 faits vérifiables dans le dépôt + liens /securite et /etat-du-produit.
5. **Offres et action** — tarifs (fichier gelé, inchangé), 4 questions fréquentes, CTA final.

Vocabulaire : « étapes » = formulaire de création (5) ; « états » = suivi d'un dossier (4).

## Animations : rien supprimé

| Animation | Avant | Après |
|---|---|---|
| 3D hero, mots du H1, marqueur, carte inclinée au pointeur, satellites | Accueil | Accueil |
| Convergence épinglée + 3D « story » | Accueil | Accueil (geste 01) |
| Remplissage du tunnel + surlignage | Accueil | Accueil (geste 02) |
| Anneau du calendrier | Accueil | Accueil (geste 03) |
| Assemblage épinglé du tableau de bord | Accueil | Accueil (résultat concret) |
| 3D finale + recentrage | Accueil | Accueil |
| Sélecteur de tarifs, accordéon FAQ | Accueil | Accueil |
| Trait dessiné + pastilles (suivi) | Accueil (6 statuts inexacts) | /fonctionnalites (4 états réels) |
| Coche + fondu de la transmission | Accueil | /fonctionnalites |
| Paires avant / avec | Accueil | /fonctionnalites |
| Halo `.cd-tile` du bento | Accueil | /fonctionnalites (remplace les cartes verbeuses) |
| Pilule `layoutId` « Pour qui » | Accueil | /fonctionnalites |
| Onglets « Espaces dédiés », reveal MidCTA / Journal | Accueil | retirés de l'accueil (mécaniques non distinctes, contenu partiellement inexact ; composants conservés) |

## Navigation

Menu : Fonctionnalités · Tarifs · Sécurité ; Se connecter / Mon compte ; Créer un dossier. Journal,
Contact, État du produit et parcours métier restent dans le pied de page (déjà présents). Menu mobile :
fermeture à chaque navigation, focus au premier lien, Escape rend le focus au bouton, panneau ancré
sous la barre réelle et défilant (paysage).

## Corrections d'exactitude (publiques)

- Accueil : « Six statuts » (dont « Complété », inexistant) → 4 états réels ; onglet « DashBoard
  ClairDossier » inexistant retiré ; « Dernier envoi : 14 sept. · e-mail » (aucun envoi enregistré)
  retiré ; action affichée = texte réel du produit.
- Formulaire de création : « Option — question IA préparatoire : obtenez un premier résumé… » (aucune
  IA appelée : la case pose seulement `legal_review_requested`) → « Option — signaler un besoin d'avis
  juridique : la demande est indiquée sur votre dossier ». Logique inchangée.
- `llms.txt` et Markdown généré (`index.md`, `fonctionnalites/index.md`) : IA « qui prépare les
  dossiers », avocat optionnel, « hébergement OVH France », « 100 % conforme RGPD », « 6 statuts »,
  anciens slugs, tunnel « 4 étapes » → faits vérifiés.
- « contenu jamais lu » → « n'est pas lu » (vrai aujourd'hui, sans figer l'avenir) ; FAQ et fiches :
  « hébergeur conforme RGPD » (non vérifiable : localisation et DPA à confirmer) → sous-traitants
  nommés ; « via votre espace » (non disponible) → « via le contact ».

## Accessibilité : contenu invisible en « mouvement réduit » (défaut en production)

Avec `prefers-reduced-motion: reduce`, la production rend **invisibles** (opacité 0) 228 éléments de
l'accueil, 162 de /tarifs et du contenu sur 32 pages publiques (CGV, confidentialité, mentions
légales, fiches…). Cause : le HTML prérendu contient les états initiaux des animations
(`opacity:0`) ; le hook de motion lit la préférence dès l'hydratation, le rendu client diffère et
React conserve l'attribut du serveur. Correctif : `useReducedMotionSafe` (préférence lue après
montage) dans `Reveal`/`Stagger` et `useSectionProgress` (progression figée à 1, styles toujours
pilotés). Après : 0 élément invisible sur les 36 pages, mouvement réduit comme normal. Aucun fichier
de paiement modifié (`/tarifs` bénéficie de la primitive partagée).

## Évaluation heuristique (documentée, pas un test utilisateur)

Grille de Nielsen appliquée par l'agent sur le build ; aucune session avec des utilisateurs réels.

| Heuristique | Constat avant | Après |
|---|---|---|
| Visibilité de l'état | Suivi décrit en 6 statuts puis 4 étapes | 4 états partout, « étapes » réservé à la création |
| Correspondance avec le réel | Libellés d'interface inventés (onglet, envoi, action) | Libellés réels du produit |
| Contrôle et liberté | Menu mobile bloqué ouvert après navigation | Fermeture à la navigation, Escape |
| Cohérence | 3 CTA « Commencer » différents du menu « Créer un compte » | « Créer un dossier » partout |
| Prévention des erreurs | Visiteur envoyé sur /inscription puis /compte | Retour direct dans le formulaire (`next`) |
| Reconnaissance plutôt que rappel | 17 sections, message répété ~12 fois | 5 sections, une idée par section |
| Esthétique et minimalisme | 2 112 mots | 708 mots, design inchangé |
| Aide et documentation | FAQ de 8 questions | 4 questions ciblées, détail sur /securite |

## Non vérifié

- Comportement réel des visiteurs (aucun test utilisateur) ; parcours authentifiés (la preview n'a
  aucune clé Supabase, par conception).
- Contraste « non inclus » de /tarifs (fichier gelé) : inchangé.
- /tarifs (gelé) et la FAQ « tarification » mentionnent des fonctions d'équipe : non modifiés.

## Retour arrière

Après fusion : `git revert -m 1 <commit de fusion>` sur `main` (redéploiement automatique) — jamais un
retour global vers un ancien commit. Version servie : `https://www.clair-dossier.com/version.json`.
