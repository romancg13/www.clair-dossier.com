---
name: clair-acquisition
description: À utiliser pour toute recherche de prospects, sourcing de leads, qualification B2B, enrichissement de fichier, scoring ou séquence de prospection pour ClairDossier. Impose les sources officielles et publiques (Annuaire des Entreprises, API Sirene/INSEE, annuaires des ordres professionnels, sites officiels des entreprises, BOAMP), interdit le scraping de réseaux sociaux et toute adresse e-mail devinée ou reconstruite, et exige une URL source vérifiable pour chaque contact. S'applique dès que l'utilisateur dit « trouve-moi des prospects », « des cabinets à Marseille », « une liste de leads », « enrichis ce fichier », ou demande une campagne de prospection.
---

# clair-acquisition — sourcing B2B conforme

Un fichier de prospection ClairDossier doit être défendable devant la CNIL et
utilisable sans risquer le domaine d'envoi. Ces deux contraintes déterminent tout
le reste.

## Sources autorisées — exclusivement

1. **Annuaire des Entreprises** — `annuaire-entreprises.data.gouv.fr`
   SIREN, effectif, code NAF, dirigeants, adresse. Open data public.
2. **API Sirene / INSEE** — filtrage par effectif, NAF, date de création,
   géolocalisation. API officielle.
3. **Annuaires publics des ordres professionnels** — barreaux, Ordre des
   experts-comptables, chambres des notaires, FNAIM, UNIS. Publication publique.
4. **Site web officiel de l'entreprise** — adresse e-mail **réellement lue** sur
   une page consultée, nom et fonction du décideur tels que publiés.
5. **BOAMP et plateformes de marchés publics** — mots-clés : GED, gestion
   documentaire, dématérialisation, archivage, numérisation, workflow documentaire.

## Sources interdites

Scraping d'Instagram, Facebook, LinkedIn, TikTok ou de tout réseau social.
Bases d'e-mails achetées ou revendues. Générateurs de patterns d'adresses.
Extensions d'extraction de contacts. Toute donnée personnelle collectée en
dehors d'une publication volontaire par la personne ou l'entreprise.

Motif, à rappeler si la question revient : violation des conditions
d'utilisation des plateformes, absence de base légale RGPD documentable, et
qualité médiocre sur les cibles réelles de ClairDossier.

## Interdits absolus

- Inventer une adresse e-mail, un nom, une fonction, un effectif, un chiffre
  d'affaires ou une date.
- **Reconstruire une adresse par format** (`prenom.nom@domaine`) même si le
  format est visible ailleurs sur le site. Une adresse non lue n'existe pas.
- Livrer une ligne de contact sans URL source.
- Recontacter une entreprise inscrite au registre d'opposition (registre 10)
  ou déjà présente au pipeline (registre 02).
- Présenter une donnée déduite comme vérifiée.

## Segments, par priorité

- **P1** — cabinets d'avocats de 3 à 30 collaborateurs · experts-comptables ·
  syndics de copropriété et administrateurs de biens.
- **P2** — TPE et PME de 10 à 50 salariés (BTP, immobilier, automobile,
  services) · professions libérales.
- **P3** — structures à fort volume documentaire, multi-établissements.

Cohérence produit : les formules du site vont de 19 € (indépendant, 5 dossiers)
à 299 € (entreprise). Un prospect P1 typique se positionne sur Business PME 20
ou 50. Ne pas prospecter un grand compte avec un argumentaire Essentiel.

## Zones, par priorité

Bouches-du-Rhône → PACA → Monaco → axe Marseille-Cannes-Nice-Saint-Tropez →
reste de la France.

## Scoring — note sur 100

| Critère | Points | Ce qui est évalué |
|---|---|---|
| Volume documentaire présumé | 30 | effectif, secteur, nombre d'établissements, mentions de gestion de dossiers ou d'archives sur le site |
| Accessibilité du décideur | 25 | e-mail nominatif publié (25) > e-mail de service (15) > formulaire seul (5) |
| Maturité numérique | 20 | site récent, outils métier mentionnés, espace client existant |
| Proximité géographique | 15 | Bouches-du-Rhône 15 · PACA 12 · Monaco 12 · France 6 |
| Signal d'actualité | 10 | recrutement administratif, croissance, nouvel établissement, appel d'offres, évolution réglementaire du secteur |

Détail et cas limites : `references/scoring.md`.

## Format de sortie

Un tableau markdown, une ligne par prospect :

```
| # | Raison sociale | SIREN | Segment | Ville | Effectif | Décideur (nom, fonction) | E-mail | Téléphone | URL source e-mail | Score | Angle d'accroche | Statut donnée |
```

- **Angle d'accroche** : une phrase, spécifique à ce prospect, tirée de ce qui a
  été réellement lu sur son site. Pas de formule réutilisable d'une ligne à l'autre.
- **Statut donnée** : `VÉRIFIÉ` (lu sur une page consultée) ou `ESTIMÉ` (déduit).
- **Aucune ligne ne sort avec un e-mail marqué `ESTIMÉ`.** Si l'adresse n'a pas
  été lue, la colonne reste vide et la ligne indique le formulaire de contact.

Après le tableau, trois blocs obligatoires :
1. Récapitulatif — nombre trouvé, score moyen, répartition par segment, doublons écartés.
2. Ce qui n'a pas pu être vérifié, nommément.
3. Les cinq prospects prioritaires et pourquoi.

## RGPD — séquences d'e-mails issues de cette liste

- Prospection B2B, base légale : intérêt légitime, objet strictement professionnel.
- Identification claire de l'expéditeur et de ClairDossier dans chaque envoi.
- Lien de désinscription fonctionnel dans chaque envoi.
- Toute opposition reçue → inscription immédiate et définitive au registre
  d'opposition, avant tout autre traitement.
- Mention explicite : ClairDossier est une assistance technologique, pas un
  conseil juridique (voir `clair-produit`).
- Pas d'envoi entre 20 h et 8 h, heure de Paris.

Détail : `references/rgpd.md`.

## Réputation d'expéditeur

Au-delà de quelques dizaines d'envois par jour, un domaine sans SPF, DKIM et
DMARC correctement configurés se dégrade rapidement. Avant toute montée en
volume, l'envoi doit passer par un domaine dédié authentifié. C'est un préalable
technique, pas une option — le signaler plutôt que d'augmenter le plafond.

Liste des sources avec leurs points d'entrée : `references/sources.md`.
