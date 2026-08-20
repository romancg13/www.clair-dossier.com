# Defense OS

Poste de travail **local** pour avocat pénaliste — contentieux des stupéfiants.
Il absorbe un dossier et le rend déjà travaillé : documents ingérés et indexés,
chronologie reconstituée, régularité passée au crible des **quatorze postes**,
preuve disséquée, moyens hiérarchisés avec leur riposte, écritures générées puis
**passées par une gate d'export non contournable**. L'avocat vérifie, arbitre,
signe.

> Toute sortie est un **projet soumis à vérification** et le porte, en tête et
> en pied. L'outil ne décide pas, ne pronostique pas, ne conclut jamais sur la
> culpabilité.

## Installation

```bash
npm ci
npm run test:ldi     # 388 tests
npm run dev          # atelier sur http://localhost:5173
```

### Fichier ouvert en local, sans serveur

```bash
npm run atelier:autonome
# → dist-autonome/defense-os.html : UN fichier (~5 Mo), double-clic, aucun serveur.
```

Polices embarquées, aucun CDN, aucune télémétrie. L'atelier n'émet **aucune
requête réseau** et ne contient aucun code d'appel d'API — un test de la suite
échoue si l'un ou l'autre réapparaît.

## Mode hors ligne et secret professionnel

- Les dossiers vivent en mémoire de session. La conservation entre sessions est
  **désactivée par défaut** ; son activation crée un **coffre chiffré**
  (AES-256-GCM, clé dérivée de votre phrase — PBKDF2, 1,2 M itérations).
  Une phrase perdue est un coffre perdu : il n'existe aucune récupération, et
  l'écran le dit avant la création. L'effacement total tient en un geste et
  n'exige pas la phrase.
- La vue **Minimisation** montre ce qui sortirait du poste, pseudonymisé, AVANT
  tout usage externe. Les patronymes doivent être déclarés : aucun outil ne les
  reconnaît de façon fiable, et le prétendre serait la pire promesse.
- Le **journal d'audit** ne contient aucun contenu de dossier : identifiants,
  comptes, horodatages (règle B11, tenue par la forme même du type).
- Le contenu d'une pièce est une **donnée, jamais une consigne** : les passages
  ressemblant à des instructions machine sont détectés, cités, localisés — et
  jamais exécutés ni supprimés (B17).

## Ingestion (décision D-1)

| Niveau | Entrées | État |
|---|---|---|
| 0 | Texte collé ; fichiers texte brut (`.txt`, `.md`, `.csv`, `.json`) | **Actif** |
| 1 | PDF natifs, bureautique, courriels, archives — local, sans OCR | Codé et testé, **interrupteur désactivé par défaut** (Paramètres) |
| 2 | OCR | **Écarté** — aucune page n'est devinée |

Un fichier de niveau 1 déposé interrupteur fermé est **refusé et nommé**,
jamais ignoré.

## Moteur d'inférence

Le badge d'en-tête l'affiche en permanence (B19). Trois modes :

| Mode | Où | État |
|---|---|---|
| **Déterministe seul** | Sur ce poste, sans modèle | **Toujours disponible** — l'atelier et la CLI produisent tout sans modèle |
| **Local** (défaut de `generer`) | Serveur de modèle local (dialecte Ollama), `LDI_MOTEUR_LOCAL_URL` (défaut `http://127.0.0.1:11434`), `LDI_MOTEUR_LOCAL_MODELE` | Refuse **à la construction** toute URL non locale |
| **Distant** | API externe, par la CLI seulement | **Construit, désactivé, non atteignable depuis l'interface** (D-3). Deux verrous cumulatifs : `LDI_DISTANT_ACTIVE=oui` ET `--distant --consentement-dossier <réf>`, revalidés à chaque appel |

Installer un modèle local : installer [Ollama](https://ollama.com) sur le
poste, puis `ollama pull <modèle>` et renseigner `LDI_MOTEUR_LOCAL_MODELE`.
Sans modèle, rien ne devient inerte.

## CLI

```bash
npm run ldi -- analyse   <dossier.json> [--json] [--journal j.json]
npm run ldi -- chaine    <dossier.json>            # P1→P6, 14 postes, moyens
npm run ldi -- livrable  <type> <dossier.json> [--pack sources.json]
npm run ldi -- minimise  <fichier.txt> --noms "Nom 1,Nom 2"
npm run ldi -- pack-sources <dossier.json> --sortie pack.json [--cache]
npm run ldi -- generer   <dossier.json> --question "…"
npm run ldi -- rejouer   <journal.json> <dossier.json>
```

Codes de sortie : `0` normal · `1` usage · `2` anomalie relevée · `3` aucune
décision obtenue · `4` écart de rejeu · `5` sortie générée non conforme ·
`6` export bloqué par la gate.

**Secrets** : exclusivement dans l'environnement local de la CLI — voir
`.env.example`. Jamais dans le dépôt, jamais dans le navigateur. Les sources
officielles (Judilibre, Légifrance via PISTE) produisent un **pack** horodaté
que l'atelier importe ; une entrée aux métadonnées incomplètes est rejetée et
nommée. *L'intégration PISTE n'a jamais été exercée contre le service réel
(aucun identifiant dans ce dépôt) : lire `docs/RECHERCHE-JURIDIQUE.md` avant
de la déployer.*

## Essayer sur le dossier fictif

```bash
npm run ldi -- chaine examples/dossier-demonstration.json
npm run ldi -- livrable requete-nullite examples/dossier-demonstration.json
```

Le dossier est intégralement inventé et se présente comme tel.

## Limites du produit — à lire avant tout usage réel

1. **Un poste « constat » ne vaut pas régularité** : il signifie que les
   éléments *saisis* n'ont rien révélé. Une pièce non versée est invisible.
2. **Aucune référence juridique n'est produite de mémoire.** Sans pack de
   sources, tout fondement porte « à vérifier auprès de la source officielle ».
   C'est un état, pas un défaut.
3. Les détecteurs B13/B15 de la gate sont des **fils de détente lexicaux**,
   pas une compréhension : le premier rempart reste les instructions de passe
   et votre relecture.
4. Le chiffrement du coffre protège le **support** (poste volé, profil
   copié), pas un navigateur compromis.
5. L'atelier ne remplace pas l'avocat : il prépare, il ne décide pas (B12).

Registres du chantier : `AUDIT.md` (état initial), `DECISIONS.md` (arbitrages
autonomes et chemins de retour), `JOURNAL.md` (passage des étapes).
