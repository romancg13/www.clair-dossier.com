# Liens universels — fichiers à publier sur le site

Ces deux fichiers font qu'un lien `https://www.clair-dossier.com/compte/dossier/<id>`
**ouvre l'application** quand elle est installée, et le site sinon.

Ils ne sont PAS encore publiés : ils contiennent des identifiants que seuls les
comptes développeur fournissent. Publier un fichier incomplet casserait la
vérification côté Apple et Google.

## Ce qu'il faut récupérer (action humaine)

| Valeur | Où la trouver |
|---|---|
| `TEAM_ID` Apple | App Store Connect → Membership (identifiant à 10 caractères) |
| Empreinte SHA-256 Android | `eas credentials` → Android → *Keystore* → SHA-256 Fingerprint |

## Installation

```bash
# depuis mobile/
node scripts/install-well-known.mjs --team-id ABCDE12345 --sha256 AA:BB:CC:...
```

Le script écrit `public/.well-known/apple-app-site-association` et
`public/.well-known/assetlinks.json` à la racine du site ; le déploiement
habituel (push sur `main`) les met en ligne.

## Vérifications après mise en ligne

- `curl -sI https://www.clair-dossier.com/.well-known/apple-app-site-association`
  doit répondre `200` avec `content-type: application/json` (et **sans** extension `.json`).
- `curl -s https://www.clair-dossier.com/.well-known/assetlinks.json | jq .`
- Android : `adb shell pm verify-app-links --re-verify com.clairdossier.app`
