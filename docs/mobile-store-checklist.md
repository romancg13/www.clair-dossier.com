# Publication de l'application mobile — préparation et actions humaines

**2026-09-16 · branche `feature/mobile-app`**

Ce document rassemble (1) ce qui est déjà prêt dans le code, (2) ce que seul un
humain peut faire, (3) les réponses aux questionnaires des magasins, rédigées à
partir de ce que l'application **fait réellement**.

> Les règles d'App Store et de Google Play évoluent. Les points marqués
> **[à revérifier]** doivent être confrontés à la documentation officielle à la
> date du dépôt.

---

## 1. Prêt dans le code

| Élément | Où |
|---|---|
| Identifiants | `com.clairdossier.app` (+ `.preview`, `.dev`) — `mobile/app.config.ts` |
| Version / build | 1.0.0 · build incrémenté par EAS (`appVersionSource: remote`) |
| Icône, icône adaptative, monochrome, écran de lancement | `mobile/assets/` (logo officiel réutilisé) |
| Permissions justifiées en français | `app.config.ts` + `mobile/locales/fr.json` |
| Privacy manifest iOS | `ios.privacyManifests` (4 catégories d'API déclarées) |
| Export compliance | `ITSAppUsesNonExemptEncryption = false` (HTTPS standard uniquement) |
| Suppression de compte dans l'app | Compte → Supprimer mon compte (+ fonction Edge `delete-account`) |
| Liens universels | `mobile/config/well-known/` + `mobile/scripts/install-well-known.mjs` |
| Profils de build | `mobile/eas.json` (development / preview / production) |
| CI | `.github/workflows/mobile-ci.yml` (types, tests, bundles) |

---

## 2. Actions humaines — rien de tout cela ne peut être automatisé

### 2.1 Comptes et contrats

| Action | Détail |
|---|---|
| Compte **Apple Developer** (99 $/an) | Personne morale : numéro D-U-N-S requis ; contrats *Paid Apps* et *Free Apps* à accepter dans App Store Connect |
| Compte **Google Play Console** (25 $ une fois) | Vérification d'identité / d'organisation obligatoire ; compter plusieurs jours |
| Compte **Expo** (EAS) | `npx eas login` puis `npx eas init` — écrit `extra.eas.projectId` dans `app.config.ts` |
| **Vérifier la disponibilité** de `com.clairdossier.app` | L'identifiant ne pourra plus être changé après le premier dépôt |

### 2.2 Variables d'environnement EAS (jamais dans le dépôt)

```bash
cd mobile
npx eas env:create --name EXPO_PUBLIC_SUPABASE_URL      --value https://buzgokfmxpmyceppvjpp.supabase.co --environment production --visibility plaintext
npx eas env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "<clé anon publique>"                    --environment production --visibility plaintext
```
(La clé « anon » est publique par conception — la protection est assurée par les policies RLS.)

### 2.3 Backend

| Action | Commande | Effet |
|---|---|---|
| Appliquer la migration | `supabase db push` | crée `device_push_tokens` (additive, sans impact sur le site) |
| Déployer la suppression de compte | `supabase functions deploy delete-account` | active la suppression depuis l'application (sans elle, l'app propose la demande écrite) |

⚠️ Ces deux commandes touchent la **production** : à lancer en connaissance de cause.

### 2.4 Liens universels

Récupérer le Team ID Apple et l'empreinte SHA-256 du keystore Android
(`npx eas credentials`), puis :

```bash
cd mobile && node scripts/install-well-known.mjs --team-id XXXXXXXXXX --sha256 "AA:BB:…"
```
puis déployer le site (les fichiers partent avec `public/`).

### 2.5 Builds et dépôts

```bash
cd mobile
npx eas build --platform ios      --profile production   # → TestFlight
npx eas build --platform android  --profile production   # → .aab
npx eas submit --platform ios     --latest
npx eas submit --platform android --latest               # piste interne, brouillon
```

Compte de démonstration pour la revue Apple (obligatoire : l'app exige une
connexion) : créer un compte de test avec un dossier d'exemple et transmettre
identifiants + mot de passe dans les notes de revue.

---

## 3. App Privacy (Apple) — réponses tirées du code

| Catégorie | Collecté ? | Usage | Lié à l'identité | Suivi publicitaire |
|---|---|---|---|---|
| Adresse e-mail | **Oui** | Fonctionnement de l'app (compte) | Oui | Non |
| Nom, nom de la structure, téléphone | **Oui** (facultatifs, saisis par l'utilisateur) | Fonctionnement de l'app | Oui | Non |
| Contenu utilisateur (documents, notes de dossier) | **Oui** | Fonctionnement de l'app | Oui | Non |
| Identifiants d'appareil (jeton de notification) | **Oui, si l'utilisateur l'active** | Fonctionnement de l'app | Oui | Non |
| Données de diagnostic | **Non transmises** (journal local, envoyé seulement si l'utilisateur écrit à l'assistance) | — | — | Non |
| Localisation, contacts, santé, finances, historique de navigation, publicité | **Non** | — | — | Non |

- **App Tracking Transparency : non applicable** — aucun SDK publicitaire, aucun traceur tiers, aucun partage à des fins de suivi.
- **Sign in with Apple : non requis** — aucune connexion sociale tierce n'est proposée (uniquement e-mail + mot de passe). **[à revérifier si un OAuth est ajouté]**
- **Suppression de compte : dans l'application** (exigence 5.1.1(v)).

## 4. Data Safety (Google Play) — mêmes faits

| Question | Réponse |
|---|---|
| Données collectées | E-mail, nom/structure/téléphone (facultatifs), fichiers et documents, jeton de notification (si activé) |
| Données partagées avec des tiers | **Aucune** (hébergement et envoi d'e-mails = sous-traitants techniques, pas un « partage » au sens du formulaire) **[à confirmer juridiquement]** |
| Chiffrement en transit | Oui (HTTPS/TLS) |
| Suppression des données | Oui, depuis l'application |
| Collecte obligatoire ? | L'e-mail est nécessaire au compte ; le reste est facultatif |
| Publicité / analyse | Aucune |

## 5. Fiche produit (proposition, à valider)

- **Nom** : ClairDossier
- **Sous-titre (30 car.)** : `Vos dossiers, enfin clairs`
- **Description courte Play (80 car.)** : `Réunissez, classez et suivez les pièces de vos dossiers administratifs.`
- **Description longue** : reprendre `/fonctionnalites` et `/etat-du-produit` — **n'annoncer que ce qui existe** : dossiers, dépôt et classement des pièces, scanner, échéances affichées, transmission décidée par l'utilisateur, espace privé cloisonné. **Ne pas** écrire « analyse par IA », « relances automatiques » ni « validé par un avocat ».
- **URL d'assistance** : https://www.clair-dossier.com/contact
- **URL de confidentialité** : https://www.clair-dossier.com/politique-confidentialite
- **URL marketing** : https://www.clair-dossier.com
- **Catégorie** : Productivité (secondaire : Économie et entreprise)
- **Classification** : 4+ / Tout public
- **Captures d'écran** (à produire sur appareil réel ou simulateur, avec un dossier de démonstration — jamais de données client) : Accueil, Dossiers, Dossier → Pièces, Scanner, Échéances. Formats : iPhone 6,9" et 6,5" ; iPad 13" si l'app est proposée sur iPad ; Play : téléphone 16:9 + 2 tablettes.

## 6. Points à trancher avant publication

1. **Abonnements dans l'application** : aujourd'hui l'app ne vend rien et ne renvoie vers aucun paiement. Toute évolution (achat intégré, lien externe) dépend des règles en vigueur **à la date du dépôt**, du pays et de la nature du service — décision produit **et** juridique. **[à revérifier]**
2. **Notifications à distance** : l'infrastructure est prête mais rien n'est émis ; décider si un envoi serveur est ouvert (et, si oui, mettre à jour `/etat-du-produit` et la politique de confidentialité).
3. **Politique de confidentialité** : y ajouter l'application mobile (données locales conservées, jeton de notification, suppression de compte). **Validation humaine requise.**
4. **Numéro WhatsApp de transmission** : l'application reprend celui du site (`+33 7 82 98 36 44`), devenu aussi le numéro d'appel officiel le 2026-09-18 (source unique web : `src/data/contact.ts` ; mobile : `mobile/src/lib/config.ts`).
