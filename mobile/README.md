# ClairDossier — application mobile (iOS · iPadOS · Android)

Extension native de [www.clair-dossier.com](https://www.clair-dossier.com) : **mêmes comptes,
mêmes dossiers, mêmes pièces, même base de données**. Aucune duplication de backend,
aucun compte à recréer.

> Le site web reste à la racine du dépôt (Vite · React). Cette application ne le modifie pas :
> elle consomme le même Supabase et partage sa logique métier via `packages/core`.

## Démarrer

```bash
cd mobile
npm install
cp .env.example .env     # renseigner EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY
npm start                # Expo (développement)
```

Les modules natifs utilisés (caméra, notifications, biométrie, stockage sécurisé) ne
fonctionnent pas dans Expo Go : utiliser un *development build* (`eas build --profile development`).

## Commandes

| Commande | Effet |
|---|---|
| `npm start` | serveur de développement Expo |
| `npm run typecheck` | TypeScript strict (application + `packages/core`) |
| `npm test` | tests unitaires (node:test) |
| `npm run doctor` | `expo-doctor` : cohérence des versions et des dépendances |
| `npm run bundle:check` | bundle de production Metro (vérifie tout le graphe d'imports) |

## Architecture

Voir [`../docs/mobile-architecture.md`](../docs/mobile-architecture.md).

```
mobile/
├── app/            routes (expo-router) : onglets, dossiers, scanner, paramètres
├── src/theme/      jetons de design repris du site (couleurs, typo, espacements)
├── src/ui/         composants de base (boutons, cartes, champs, feuilles…)
├── src/features/   composants métier (cartes de dossier, import, échéances…)
├── src/lib/        Supabase, authentification, fichiers, scanner, notifications…
├── src/data/       requêtes et mutations (TanStack Query)
└── assets/         icônes et écran de lancement (logo officiel réutilisé)
```

## Règles du projet

- **Aucun secret dans le bundle.** Seules des variables `EXPO_PUBLIC_*` (publiques par nature).
  La clé Supabase « anon » est protégée par les policies RLS.
- **Aucune lecture automatique des documents** : engagement contractuel ClairDossier.
  L'application ne contient donc aucune fonction d'analyse de contenu.
- **Le serveur est la source de vérité** pour les droits et l'abonnement ; l'application
  n'en déduit rien par elle-même.
- **Rien n'est transmis sans action explicite de l'utilisateur.**
