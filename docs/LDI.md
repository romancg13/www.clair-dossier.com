# LDI — Legal Defense Intelligence

Moteur d'analyse de dossier pénal destiné à un avocat de la défense.
Implémentation du cahier des charges « Legal Defense Intelligence OS », avec les
écarts documentés au § 7.

---

## 1. Principe d'architecture

Le système est coupé en deux étages, et cette coupure est la décision de
conception principale.

```
┌──────────────────────────── LOCAL (navigateur ou CLI) ─────────────────────────┐
│                                                                                │
│  Dossier ──▶ Module 1  chronologie & contradictions                            │
│              Module 3  points de contrôle procéduraux                          │
│              Module 4  signaux textuels                                        │
│              Module 5  axes de défense                                         │
│              Module 6  squelettes d'actes                                      │
│                   │                                                            │
│                   ▼                                                            │
│            Rapport déterministe ──▶ pseudonymisation                           │
│                                          │                                     │
└──────────────────────────────────────────┼─────────────────────────────────────┘
                                           │  (sur action explicite seulement)
┌──────────────────────────────────────────┼─────────────────────────────────────┐
│  RÉSEAU                                  ▼                                     │
│   Module 2  Légifrance / Judilibre    ldi-analyze (Edge Function)              │
│   → textes et arrêts réels             → rédaction par modèle de langage       │
└────────────────────────────────────────────────────────────────────────────────┘
```

**Tout ce qui compte est déterministe.** Les heures, les durées, l'ordre des
actes, les points de contrôle : calculés, reproductibles, testés. Même entrée,
même sortie, sans appel réseau.

**Ce qui peut halluciner est hors du chemin critique.** Le modèle de langage
intervient en aval, sur un rapport déjà établi, et ne recalcule rien. Les
références juridiques viennent d'API officielles ou n'existent pas.

---

## 2. Utilisation

### En ligne de commande (recommandé sur dossier réel)

Aucun appel réseau, rien ne quitte la machine.

```bash
npm run ldi -- analyse examples/dossier-exemple.json      # rapport markdown
npm run ldi -- analyse dossier.json --json > rapport.json # sortie structurée
npm run ldi -- document requete-nullite dossier.json      # squelette d'acte
npm run ldi -- minimise notes.txt --noms "Jean Dupont"    # pseudonymisation
```

`analyse` sort en code 2 lorsqu'au moins une anomalie est relevée, pour un
enchaînement en script.

### Console web

`/ldi`, derrière authentification, absente de la navigation publique et en
`noindex`. L'analyse tourne dans le navigateur ; l'appel au service de rédaction
est un geste distinct et explicite.

### Page autonome (hors ligne)

```bash
npm run ldi:artifact          # → artifact/dist/ldi.html
```

Construit une page HTML unique qui embarque le noyau déterministe (bundle
esbuild en IIFE injecté dans `artifact/ldi.html`). **Aucune requête sortante,
sans exception** : ni script, ni feuille de style, ni fonte distante. La
typographie repose sur des piles locales — une requête de fonte divulguerait
l'adresse IP, l'agent utilisateur et le référent du lecteur à un tiers, à chaque
ouverture d'un outil qui traite du secret professionnel.

Deux fichiers sont produits :

| Fichier | Usage |
|---|---|
| `ldi.html` | publication sur une plateforme qui fournit elle-même `<!doctype>`, `<head>` et `<body>` |
| `ldi.standalone.html` | ouverture depuis le disque ou auto-hébergement — document complet, `lang="fr"`, mode standards |

C'est la forme partageable de l'outil : elle n'expose que ce qui se calcule hors
ligne, jamais le module de recherche ni l'étage génératif.

### Comme bibliothèque

```ts
import { analyser, rendreMarkdown, genererDocument } from './src/ldi';

const rapport = analyser(dossier);
console.log(rendreMarkdown(rapport));

const requete = genererDocument('requete-nullite', rapport.dossier, rapport.strategie);
```

---

## 3. Format d'entrée

```jsonc
{
  "reference": "CAB-2026-001",
  "qualifications": ["CP, art. 222-37"],
  "regime": "droit-commun",          // | criminalite-organisee | terrorisme
  "pieces": [
    { "id": "P1", "cote": "D1", "nature": "proces-verbal",
      "intitule": "PV de placement", "date": "2026-03-14",
      "texte": "…"                   // facultatif — alimente le module 4
    }
  ],
  "evenements": [
    { "id": "E1", "nature": "debut-garde-a-vue",
      "horodatage": "2026-03-14T08:00",
      "description": "Placement en garde à vue",
      "sourcePieceId": "P1",         // la pièce qui établit l'événement
      "personne": "MIS_EN_CAUSE",    // pseudonyme
      "lieu": "Commissariat",
      "dureeMinutes": 60
    }
  ]
}
```

Le `regime` conditionne les durées applicables. `sourcePieceId` est déterminant :
un événement sans pièce n'est pas établi, et le rapport le signale.

Voir `examples/dossier-exemple.json` pour un dossier fictif complet, et
`src/ldi/types.ts` pour les 19 natures d'événement reconnues.

---

## 4. Politique de sourçage

Trois règles, tenues par le code et par les tests.

**1. L'index n'est pas une source.** `src/ldi/corpus/references.ts` associe une
référence à une URL Légifrance et à un énoncé court. Toutes les entrées naissent
au statut `a-verifier`. Seul `verifierTexte()`, après lecture effective de la
source, peut faire passer une entrée à `verifie`. Un rapport produit hors ligne
affiche « à vérifier » partout : c'est le comportement voulu.

Le CPP bouge. Au moment de l'écriture, Légifrance expose des versions 2026 des
articles 63-1 et 63-2 CPP. Un énoncé figé dans un fichier TypeScript est périmé
par construction.

**2. Aucune jurisprudence n'est produite hors API.** `modules/recherche.ts`
n'embarque pas de base locale d'arrêts, n'en déduit pas, n'en complète pas. Sans
configuration, il renvoie une liste vide et un avertissement. Une entrée
d'API à laquelle il manque le numéro ou la date est écartée plutôt que complétée.

C'est la contrepartie technique de l'exigence « zéro hallucination » : un numéro
de pourvoi inventé est indétectable à la relecture et se découvre à l'audience.
Le seul moyen sûr de ne pas en produire est de n'avoir aucun chemin de code
capable d'en fabriquer. Six tests verrouillent cette propriété
(`src/ldi/__tests__/sources.test.ts`).

**3. L'invite système interdit la citation de mémoire.** Le modèle ne cite que
ce qui figure dans le contexte fourni, et doit écrire explicitement qu'aucune
jurisprudence n'a été versée lorsque c'est le cas.

### Configurer les sources officielles

```ts
const config = {
  judilibre: { urlBase: 'https://api.piste.gouv.fr/cassation/judilibre/v1.0/',
               enteteAuth: 'KeyId', valeurAuth: process.env.PISTE_KEY! },
  legifrance: { urlBase: 'https://api.piste.gouv.fr/dila/legifrance/lf-engine-app/',
                enteteAuth: 'Authorization', valeurAuth: `Bearer ${jeton}` },
};
const resultat = await rechercher('CPP, art. 63', config);
```

Les identifiants sont passés explicitement en paramètre — le module ne lit jamais
`import.meta.env`, pour qu'aucune clé ne puisse se retrouver dans un bundle
navigateur par inadvertance. Les URL et le mode d'authentification exacts de
PISTE doivent être repris de la documentation en vigueur de la plateforme.

---

## 5. Points de contrôle procéduraux

Dix points, chacun rattaché à un texte (`src/ldi/modules/nullites.ts`).

| Id | Objet | Fondement |
|---|---|---|
| GAV-01 | Conditions du placement | CPP, art. 62-2 |
| GAV-02 | Notification immédiate des droits | CPP, art. 63-1 |
| GAV-03 | Suite donnée à la demande d'avocat | CPP, art. 63-3-1 |
| GAV-04 | Délai de deux heures avant première audition | CPP, art. 63-4-2 |
| GAV-05 | Durée et régularité des prolongations | CPP, art. 63 |
| GAV-06 | Examen médical | CPP, art. 63-3 |
| CTRL-01 | Fondement du contrôle d'identité | CPP, art. 78-2 |
| PERQ-01 | Assentiment exprès en enquête préliminaire | CPP, art. 76 |
| PREUVE-01 | Traçabilité des scellés | CPP, art. 171 |
| PRESC-01 | Prescription de l'action publique | CPP, art. 8 |

Trois résultats possibles : `conforme`, `anomalie`, `non-etabli`. **`non-etabli`
est l'état par défaut** — le dossier doit apporter la preuve positive de la
régularité pour qu'un point devienne `conforme`. Un dossier silencieux n'est pas
un dossier régulier, et c'est le silence qui se plaide.

Le module signale des anomalies, jamais des nullités acquises : la nullité
suppose une formalité substantielle **et** un grief (art. 171 et 802 CPP).

---

## 6. Seuils et calibration

Deux familles de seuils, qui ne sont ni l'une ni l'autre des règles de droit.

**Seuils de tri chronologique** (`modules/chronologie.ts`) — 30 minutes pour
signaler un délai de notification des droits, par exemple. L'art. 63-1 CPP exige
une notification immédiate sans fixer de durée ; le seuil décide de ce qui est
porté à l'attention de l'avocat, pas de ce qui est irrégulier. Seul le délai de
deux heures de l'art. 63-4-2 CPP est un délai légal.

**Seuils de signaux textuels** (`modules/detection-ia.ts`) — ⚠️ **valeurs de
départ non calibrées.** Elles ont été fixées par jugement d'ingénierie, pas
mesurées sur un corpus annoté de procédures françaises. Avant tout usage
sérieux : constituer un échantillon de pièces authentiques du ressort concerné,
mesurer la distribution de chaque signal, et repositionner les seuils sur cette
distribution. En l'état, le module sert à motiver une demande de pièce, à rien
de plus.

---

## 7. Écarts assumés avec le cahier des charges

Le cahier des charges d'origine comporte des inexactitudes juridiques et des
exigences qui contredisent son propre principe de rigueur. Elles n'ont pas été
reprises. Chaque écart est vérifiable.

| # | Cahier des charges | Ce qui a été retenu |
|---|---|---|
| 1 | « Durée gardes à vue (72h max) » | **Aucun régime du CPP ne prévoit 72 heures.** Droit commun : 24 h, prolongeable une fois de 24 h (art. 63 CPP). Criminalité organisée : jusqu'à 96 h (art. 706-88 CPP). Terrorisme : régime propre (art. 706-88-1 CPP). |
| 2 | « Art. 803 — violation : non-notification droits » | **L'art. 803 CPP porte sur le port des menottes et entraves.** La notification des droits en garde à vue relève de l'art. 63-1 CPP. L'exemple de stratégie du cahier des charges fondait aussi une attaque de l'admissibilité de la preuve sur l'art. 803 : sans objet. |
| 3 | « Fraude (art. 313+) », « Blanchiment (art. 324+) », « Corruption (art. 432+) » | Références précisées : escroquerie art. 313-1 CP, blanchiment art. 324-1 CP, corruption **passive** d'une personne exerçant une fonction publique art. 432-11 CP — à distinguer de la corruption **active** de l'art. 433-1 CP, que « art. 432+ » masquait. |
| 4 | Art. 222-37 CP → « prescription : 10 ans » | Confusion entre le quantum de la peine (dix ans d'emprisonnement) et le délai de prescription. L'art. 222-37 CP est un **délit** : six ans (art. 8 CPP), sous réserve des actes interruptifs et de l'art. 9-1 CPP. |
| 5 | « chance_succes : 72 % » | **Refusé.** Voir § 7.1. |
| 6 | « confiance_human : 87 % », « probabilite_ia : 60 % » | **Refusé.** Voir § 7.2. |
| 7 | Exemple : arrêt de véhicule sans motif → nullité, « 68 % » | L'art. 78-2 CPP prévoit expressément que la découverte, à l'occasion d'un contrôle, d'infractions autres que celles visées par les réquisitions **n'est pas une cause de nullité**. Le moyen doit viser l'absence ou l'irrégularité des réquisitions, ou l'absence de raisons plausibles. Ce contre-argument est inscrit dans le point CTRL-01. |
| 8 | Exemple : « Cass. crim., 25/01/2023, n° 22-82456 » | Référence non vérifiée, citée dans un document qui interdit par ailleurs les hallucinations. Aucune jurisprudence n'est codée en dur nulle part dans le système. |
| 9 | « Ne jamais partager données avec tiers (y compris Anthropic) » **et** appel à l'API Anthropic | Contradiction interne du cahier des charges. Résolue par l'architecture : le noyau déterministe est local, l'étage génératif est facultatif et ne reçoit qu'un rapport pseudonymisé. |
| 10 | « Jamais consommer heures travail supplémentaires pour IA » | Formulation obscure, non transposable en code. La question — facturation et information du client sur l'usage d'un outil d'assistance — relève de la déontologie et se règle avec l'ordre, pas dans un fichier TypeScript. |

### 7.1 Pas de pronostic chiffré

Un pourcentage de succès supposerait une base de décisions comparables,
appariées sur la juridiction, la formation, la qualification et le profil du
prévenu. Cette base n'existe pas en accès ouvert : Judilibre ne publie pas
l'intégralité des décisions du fond et la couverture des cours d'appel est
incomplète. Un chiffre produit sans elle serait une opinion déguisée en
statistique, et le premier contradicteur demanderait la méthode.

À la place, une échelle ordinale de trois niveaux dont la règle d'attribution est
jointe à chaque axe :

- **étayée** — une pièce ou une heure du dossier établit positivement
  l'irrégularité ; reste à démontrer le grief ;
- **plausible** — incohérence sérieuse, vérification documentaire non faite ;
- **exploratoire** — rien n'établit l'irrégularité, l'axe repose sur une pièce
  à réclamer.

### 7.2 Pas de score de détection d'IA

Aucune méthode statistique publique ne détermine de façon fiable si un texte a
été généré. Les détecteurs existants ont des taux de faux positifs élevés sur les
écrits techniques normés — ce qu'est précisément un rapport d'expertise ou un
procès-verbal. Un style homogène est le produit normal d'une trame imposée.

Le module produit des mesures brutes et reproductibles, assorties de leur portée,
et sert à motiver une demande de fichier natif ou de métadonnées. Un score
affiché transformerait une intuition en apparence de mesure — exactement ce qu'un
contradicteur démonterait à l'audience.

---

## 8. Confidentialité

Le dossier pénal est couvert par le secret professionnel.

- Le noyau déterministe ne fait **aucun appel réseau**.
- `confidentialite.ts` remplace identifiants directs (e-mail, téléphone, IBAN,
  NIR, plaque) et noms déclarés par des pseudonymes stables. La table de
  correspondance ne quitte pas l'appelant.
- **Les patronymes ne sont pas détectés automatiquement** : ils doivent être
  déclarés. `alertesResiduelles()` signale adresses, dates de naissance et
  suites de mots capitalisés restées en clair. La fonction alerte, elle ne
  rassure pas.
- La fonction `ldi-analyze` ne reçoit jamais le dossier, seulement le rapport
  pseudonymisé, et exige une session authentifiée.

---

## 9. Déploiement de la fonction `ldi-analyze`

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-…
supabase secrets set LDI_MODEL=claude-opus-5             # facultatif
supabase secrets set LDI_PLAFOND_DOSSIER_DOLLARS=5       # facultatif, défaut 5
supabase functions deploy ldi-analyze
```

La fonction utilise `claude-opus-5` avec réflexion adaptative et `effort: high`.
Le repli côté serveur (`fallbacks: "default"`) est activé : si la requête
déclenche un refus de classification, elle est rejouée sur un modèle de repli
dans le même appel, plutôt que de renvoyer une réponse vide à l'avocat.

Trois fichiers existent en deux exemplaires — `prompt.ts`, `citations.ts` et
`reponse.ts` — parce que Deno ne peut pas importer un module TypeScript sans
extension depuis `src/`. La source canonique est celle de `src/ldi/` ; le test
`prompt-sync.test.ts` interdit toute divergence. Pour resynchroniser :

```bash
npm run ldi:sync-edge
```

### 9.1 Contrôles appliqués à la réponse du modèle

Trois contrôles s'exécutent côté serveur, dans cet ordre. Ils ne sont pas des
consignes d'invite : ce sont du code, donc vérifiables et testés.

| Contrôle | Moment | Effet |
|---|---|---|
| Plafond de dépense | **avant** l'appel | l'appel n'est pas lancé (HTTP 429) |
| Structure de la réponse | après génération | une relance corrective, puis constat renvoyé |
| Citations | sur le texte final | annotation sur place et rapport à l'avocat |

**Structure.** L'invite impose huit sections. `validerStructure()` nomme celles
qui manquent et produit la consigne corrective. La fonction relance **une fois**
(`TENTATIVES_MAX = 2` : chaque tentative est un appel facturé), en conservant le
fil de conversation. Une réponse tronquée par `max_tokens` n'est pas relancée —
la relance produirait la même troncature, en double. Si la structure reste
incomplète, ce n'est pas une erreur : le texte est renvoyé avec la liste des
rubriques absentes, parce que l'absence de « ⚠️ RISQUES POUR LE CLIENT » ou de
« LIMITES » se lit à tort comme un feu vert.

**Plafond de dépense.** Contrôlé avant l'appel — seul moment où le contrôle
évite une dépense. Le cumul du dossier est tenu par l'appelant et renvoyé à
chaque requête (`coutEngage`) ; le serveur ne détient aucun compteur.

> **Ce que ce plafond n'est pas.** Un quota. Il borne une boucle qui s'emballe,
> pas un client hostile : le cumul est déclaratif. Un vrai quota suppose un
> compteur par utilisateur en base — décision de produit, non prise ici. La
> console web ne le persiste d'ailleurs pas d'une session à l'autre, car il
> faudrait le rattacher à une référence de dossier, donnée couverte par le
> secret professionnel.

**Tarifs.** `TARIFS_PAR_MILLION` est une **valeur déclarée**, saisie à la main
dans `src/ldi/reponse.ts` (`verifieLe: null`). Aucune API n'est interrogée : le
programme ne sait pas ce qu'un appel coûte réellement, et le modèle servi peut
différer du modèle demandé (repli côté serveur). L'estimation est un ordre de
grandeur destiné à borner une boucle, jamais un montant opposable — la
facturation fait foi. Aucune conversion en euros n'est faite : elle supposerait
un taux de change que le module n'a pas.

---

## 10. Tests

```bash
npm run test:ldi     # 104 tests
npm run typecheck
```

Ces trois vérifications — plus `npm run build` et un contrôle que `gen:md` n'a
pas divergé — tournent sur chaque pull request via `.github/workflows/ci.yml`.
Le workflow `deploy.yml` ne se déclenche, lui, que sur `push` vers `main`.

Les suites couvrent notamment : l'indépendance au fuseau horaire des
horodatages, un **témoin négatif** (une procédure régulière ne doit déclencher
aucune alerte), chaque détecteur de contradiction, la garantie anti-fabrication
du module de recherche, l'aller-retour de pseudonymisation, l'absence de tout
pourcentage dans les sorties, et l'absence de numéro de pourvoi dans les
documents générés.

---

## 11. Limites

- L'analyse ne porte que sur les éléments **saisis**. Une pièce non saisie est
  invisible, et son absence n'est pas signalée.
- La saisie du dossier reste manuelle : ni OCR, ni extraction PDF, ni analyse
  d'image ne sont implémentés. Le cahier des charges les prévoyait ; ils ne sont
  pas là, et l'annoncer vaut mieux que le simuler.
- Les seuils du module 4 ne sont pas calibrés (§ 6).
- Les points de contrôle couvrent la garde à vue, le contrôle d'identité, la
  perquisition en enquête préliminaire, les scellés et la prescription. Ils ne
  couvrent ni l'instruction, ni la détention provisoire, ni les interceptions,
  ni la procédure d'audience.
- **Ce n'est pas une consultation juridique.** L'outil prépare le travail de
  l'avocat, qui décide seul des moyens soulevés et en assume la responsabilité.
