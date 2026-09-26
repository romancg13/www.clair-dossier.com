# Application mobile ClairDossier — architecture

**Date : 2026-09-16 · branche `feature/mobile-app`**

Extension native iOS / iPadOS / Android du site existant. Mêmes comptes, mêmes
dossiers, mêmes pièces, même base. Le site n'est pas modifié dans son
fonctionnement : il gagne seulement une logique métier partagée.

---

## 1. Ce qui existait (audit du 2026-09-16)

| Élément | Constat |
|---|---|
| Web | Vite 6 · React 19 · React Router 7 (SPA) · Tailwind v4 · Motion · pré-rendu de 32 routes, déployé sur GitHub Pages à chaque push sur `main` |
| Backend | Supabase `buzgokfmxpmyceppvjpp` : `profiles`, `dossiers`, `dossier_documents`, `dossier_deadlines`, `dossier_events`, `prospects`, `app_admins`, `audit_logs`, `admin_notes` ; bucket privé `documents` ; RLS `_own` sur toutes les tables utilisateur |
| Auth | Supabase Auth, e-mail + mot de passe, confirmation par e-mail, métadonnées `full_name` / `company_name` / `company_type` lues par un déclencheur SQL qui crée le profil |
| Paiement | Stripe par **liens de paiement hébergés** (7 formules). **Aucun webhook, aucune table d'abonnement** : le rapprochement est manuel (voir `/etat-du-produit`) |
| IA | **Aucune.** Le produit s'engage contractuellement à ne procéder à aucune lecture ni exploitation automatique des pièces (CGV + `/etat-du-produit`) |
| Notifications | Aucune émission automatique (relances « prévu ») |

Ces constats commandent tout ce qui suit : **l'application ne peut pas
promettre ce que le produit ne fait pas.**

---

## 2. Disposition du dépôt

```
/                     site web (inchangé : Vite, à la racine)
├── packages/core/    logique métier partagée — TypeScript pur, zéro dépendance
├── mobile/           application Expo (React Native)
├── supabase/         migrations + fonctions Edge (une migration additive ajoutée)
└── docs/
```

La structure `apps/web` + `apps/mobile` du prompt initial a été **écartée** :
déplacer le site casserait `.github/workflows/deploy.yml`, `netlify.toml`, le
pré-rendu et les chemins publics, pour un gain nul. Le partage réel de code est
obtenu par `packages/core`, sans déménagement.

---

## 3. Logique partagée (`packages/core`)

Sans dépendance, sans DOM, sans réseau : consommable par Vite **et** par Metro.

| Module | Contenu | Pourquoi partagé |
|---|---|---|
| `documents.ts` | catégories de pièces, classification par nom de fichier, validation d'upload, doublons, chemin de stockage | les deux plateformes écrivent la même `category` et le même `file_path` |
| `dossiers.ts` | statuts, étapes, typologies (héritées comprises), profils, champs du tunnel, libellés de réponses | un dossier créé sur mobile est identique à un dossier créé sur le web |
| `deadlines.ts` | statut, tri, compteurs, libellés relatifs, instants de rappel | même lecture des échéances partout |
| `events.ts` | types et libellés du journal | le journal reste homogène quelle que soit la plateforme |
| `entitlements.ts` | contrat de droits agnostique du prestataire | le serveur reste seul juge des droits |
| `errors.ts` | messages utilisateur français | même langue, mêmes formulations |
| `links.ts` | URL du site → route de l'application | liens profonds testables |

Le site consomme ce cœur **sans changer son API publique** :
`src/lib/dossier-workspace.ts` le réexporte, `DossierFlow.tsx` et
`DossierDetail.tsx` importent au lieu de redéfinir (−432 lignes dupliquées).

---

## 4. Pile mobile

Expo SDK 57 · React Native 0.86 · React 19 · TypeScript strict · expo-router ·
TanStack Query · supabase-js · SecureStore · react-native-svg.

Choix notables :

- **Pas d'AsyncStorage** : session et préférences vivent dans le magasin
  sécurisé du système (session fragmentée, SecureStore plafonnant ~2 Ko).
- **Pas de bibliothèque d'état globale** : `useState` + TanStack Query suffisent.
- **Scanner sans module natif tiers** : `expo-camera` + `expo-image-manipulator`
  + `expo-print` (PDF A4 multi-pages). Aucune dépendance à la maintenance
  incertaine ; la correction de perspective automatique n'est donc pas promise.
- **Envoi de fichiers en flux** (`File.createUploadTask` vers l'API Storage avec
  le jeton de l'utilisateur) : progression réelle, aucun fichier chargé en mémoire.
- **Aucun traceur** : pas de Sentry ni d'analytics — ce serait un sous-traitant
  RGPD de plus, décision produit et juridique, pas technique.

---

## 5. Flux critiques

```
Connexion      → Supabase Auth (comptes existants) → session dans le Keychain/Keystore
Import / scan  → contrôle (format, 25 Mo, doublon) → envoi en flux vers le bucket privé
                 → ligne dossier_documents → journal d'activité
Consultation   → lien signé 2 min → visionneuse système → copie cache effacée
Transmission   → synthèse relue par l'utilisateur → WhatsApp ou e-mail → statut « transmis »
Échéances      → CRUD dossier_deadlines → rappels LOCAUX optionnels (aucun envoi serveur)
Suppression    → fonction Edge delete-account (jeton vérifié) → fichiers + utilisateur
```

---

## 6. Sécurité

- Le bucket reste privé ; le chemin commence toujours par `<user_id>/`, clé du
  cloisonnement RLS. `storagePath()` assainit le nom (aucune remontée `..`).
- Chaque requête ajoute `.eq('user_id', …)` en plus des policies : défense en
  profondeur, et l'application reste un espace client même pour un compte admin.
- Aucun secret dans le bundle : seules des variables `EXPO_PUBLIC_*`.
- Les journaux applicatifs n'enregistrent qu'un code d'événement et une
  catégorie d'erreur — jamais de document, de jeton, d'e-mail ou d'identifiant.
- Liens profonds : correspondance explicite, toute URL inconnue est ignorée ;
  une notification ne peut pas rediriger vers une adresse arbitraire.

---

## 7. Décisions produit assumées

| Sujet | Décision | Motif |
|---|---|---|
| Onglet « IA » | **Non implémenté** | Le produit ne lit pas les documents (engagement CGV). Le contrat d'API et la couche de droits sont prêts ; l'activation est une décision produit **et juridique**. |
| Achats intégrés | **Aucun achat dans l'application** | Les règles des magasins encadrent strictement la vente d'abonnements numériques et varient selon le pays et la date ; l'abonnement reste géré par l'équipe. |
| Rappels d'échéances | **Locaux, optionnels, désactivés par défaut** | Aucune relance serveur n'existe ; un rappel local n'est pas une promesse de service. |
| Notifications à distance | Infrastructure prête, émission nulle | Table `device_push_tokens` + consentement ; l'interface dit explicitement qu'aucune notification n'est émise aujourd'hui. |
| Téléchargement groupé | Non repris sur mobile | Le partage se fait pièce par pièce via la feuille système. |

---

## 8. Vérifications

| Contrôle | Résultat |
|---|---|
| `npm run typecheck` (web) | OK |
| `node --import tsx --test tests/*.test.ts` (web + cœur partagé) | 70/70 |
| `npm run build` + pré-rendu (web) | 32 routes, OK |
| `npx tsc --noEmit` (mobile, strict) | OK |
| `npm test` (mobile) | 6/6 |
| `npx expo export` iOS / Android | bundles produits (5,2 Mo / 5,4 Mo) |
| `npx expo-doctor` | 19/21 (2 contrôles nécessitent l'API Expo, injoignable depuis l'environnement d'exécution) |
| `npx expo prebuild` iOS | projet natif généré ; Info.plist (permissions FR), entitlements (liens universels), PrivacyInfo.xcprivacy vérifiés |
| `npx expo prebuild` Android | AndroidManifest vérifié : permissions, filtres d'intention `autoVerify`, RECORD_AUDIO retiré, `targetSdkVersion 36` |
| Absence de dérive web | contrôle automatisé : tous les libellés déplacés dans `packages/core` sont mot pour mot ceux des pages d'origine, aucune clé perdue |
| Build natif iOS/Android (compilation) | **impossible sur ce poste** : ni Xcode, ni CocoaPods, ni JDK, ni SDK Android. Passe par EAS Build (compte Expo requis) — voir `mobile-store-checklist.md` |
