# Dossier étalon (jeu d'essai obligatoire — PARTIE 10.1)

Dossier **fictif** d'impayé : « Atelier Fictif SAS c/ Société Exemple SARL ». Toutes
les personnes, sociétés, adresses, numéros et coordonnées bancaires sont inventés
(domaine `.invalid`, SIREN `000 000 00x`). Aucune donnée réelle de client n'y entre
jamais (interdit n° 15).

## Fichiers

- `manifest.json` : la liste des pièces, leur rôle (`original`, `doublon_strict`,
  `quasi_doublon`, …) et, pour les originaux, le texte rendu dans le PDF.
- `verite-terrain.json` : le résultat attendu, écrit à la main (PARTIE 10.2). Les
  tests comparent la sortie du système à ce fichier.
- `NN-*.pdf` : les pièces, **générées** par `npm run gen:etalon` à partir du manifeste.

## Génération déterministe

`scripts/gen-dossier-etalon.ts` produit des PDF 1.4 minimaux (texte natif, police
Helvetica, encodage WinAnsi) sans date ni identifiant aléatoire : mêmes entrées, mêmes
octets. Un `doublon_strict` est la copie octet pour octet de son original ; un
`quasi_doublon` reprend le même texte avec un rendu différent (taille, marge,
producteur) et n'a donc pas la même empreinte. La CI régénère les pièces et échoue si
les fichiers commités diffèrent.

## État par étape

| Étape | Contenu ajouté |
|---|---|
| 5 | 7 pièces : 2 doublons stricts, 1 quasi-doublon (`doublons_stricts`, `quasi_doublons`) |
| 6 | 1 document illisible : PDF image sans couche texte (`documents_illisibles`, `ingestion_attendue`) |
| 11 | tentative d'injection de prompt (à venir) |
| 14–15 | dates contradictoires, montants divergents, pièces citées absentes, échéances (à venir) |

Cible finale : 40 à 60 pièces.
