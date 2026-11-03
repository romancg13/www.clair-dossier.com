# Sources de sourcing — points d'entrée

Vérifier la disponibilité de chaque source au moment de l'usage : les API
publiques changent d'URL et de conditions d'accès. Ne jamais présenter une
donnée comme issue d'une source qui n'a pas répondu.

## 1. Annuaire des Entreprises

`https://annuaire-entreprises.data.gouv.fr`

Recherche par nom, SIREN, dirigeant, adresse, activité. Donne le SIREN, la
tranche d'effectif, le code NAF, la date de création, l'adresse du siège et les
dirigeants déclarés. Service public, réutilisation libre.

Codes NAF utiles pour les segments ClairDossier :
- `69.10Z` — activités juridiques (avocats, notaires, huissiers)
- `69.20Z` — comptabilité, contrôle, conseil fiscal
- `68.32A` — administration d'immeubles résidentiels (syndics)
- `68.31Z` — agences immobilières
- `41.20A` / `41.20B` — construction de bâtiments
- `45.11Z` — commerce de voitures

## 2. API Sirene / INSEE

`https://api.insee.fr` (portail développeur) — nécessite un compte et une clé.
Permet un filtrage structuré : tranche d'effectif salarié, code NAF, commune ou
département, date de création, état administratif (actif / cessé).

Vérifier systématiquement l'état administratif : une entreprise cessée ne doit
jamais entrer au pipeline.

## 3. Annuaires des ordres professionnels

- Avocats : annuaires des barreaux (Marseille, Aix-en-Provence, Nice, Toulon,
  Grasse, Draguignan) et annuaire du Conseil national des barreaux.
- Experts-comptables : annuaire de l'Ordre des experts-comptables.
- Notaires : annuaire du Conseil supérieur du notariat.
- Immobilier et syndics : annuaires FNAIM et UNIS.

Ces annuaires publient nom du cabinet, adresse et souvent un contact
professionnel. Ils sont publics par nature, mais restent des données
personnelles : la finalité de la collecte doit rester la prospection B2B.

## 4. Site officiel de l'entreprise

C'est la seule source d'adresse e-mail acceptée. Pages à consulter :
`/contact`, `/mentions-legales`, `/equipe`, `/cabinet`, pied de page.

Règle : l'adresse est copiée telle qu'elle est affichée, avec l'URL exacte de la
page où elle a été lue. Une adresse affichée en image ou protégée par script et
non lisible est traitée comme absente.

Les mentions légales donnent aussi le nom du responsable de publication — souvent
le décideur recherché.

## 5. BOAMP et marchés publics

`https://www.boamp.fr` — avis d'appel public à la concurrence.

Mots-clés : gestion électronique de documents, GED, dématérialisation,
archivage, numérisation, workflow documentaire, coffre-fort numérique.

Un avis publié est un signal d'actualité fort : il indique un budget identifié et
un besoin daté. Il vaut aussi comme preuve de la source.

## Ce qui n'est pas une source

Les agrégateurs commerciaux de contacts, les extensions de navigateur
d'extraction, les bases revendues, les exports d'annuaires tiers non officiels.
Même quand la donnée y est exacte, l'origine n'est pas documentable — donc la
base légale ne l'est pas non plus.
