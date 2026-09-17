# @clairdossier/core

Logique métier **partagée** entre :

- le site web `www.clair-dossier.com` (Vite · React · racine du dépôt) ;
- l'application mobile iOS/Android (`mobile/`, Expo · React Native).

## Règles

1. **Aucune dépendance** (ni npm, ni Node, ni DOM, ni React Native). Du TypeScript pur,
   consommable par Vite, par Metro et par `node --test`.
2. **Aucun accès réseau, aucun secret.** Les appels Supabase vivent dans chaque application.
3. **Aucune rupture de contrat** : ces modules ont été extraits de code déjà en production
   (`src/lib/dossier-workspace.ts`, `src/pages/DossierFlow.tsx`). Toute évolution doit rester
   rétrocompatible avec les données déjà enregistrées (`dossiers.answers`, catégories de pièces).
4. Les données écrites en base par le web et par le mobile doivent être **identiques** :
   c'est la raison d'être de ce paquet.

## Contenu

| Module | Rôle |
|---|---|
| `documents.ts` | Catégories de pièces, classification déterministe par nom de fichier, validation d'upload, doublons, formatage des tailles |
| `deadlines.ts` | Statut d'une échéance (retard / à venir / terminée), tri, regroupement |
| `dossiers.ts` | Statuts de dossier, profils, typologies, champs du tunnel en 5 étapes, titres génériques |
| `events.ts` | Types et libellés du journal d'activité |
| `entitlements.ts` | Droits/quotas — le serveur reste la source de vérité, le client ne fait que lire |
| `errors.ts` | Messages d'erreur utilisateur en français (jamais de détail technique) |

Aucune lecture du **contenu** des documents n'est faite ici : la classification n'utilise
que le nom du fichier (engagement contractuel ClairDossier, voir `/cgv` et `/etat-du-produit`).
