# Couche agentique ClairDossier — v1.0

Cette couche rend permanentes les règles de travail ClairDossier. Elle ne
remplace pas le dispositif SPA-CD ni les tâches planifiées existantes : elle se
pose par-dessus.

Principe : ce qui était un document markdown qu'il fallait penser à coller
devient un **skill auto-déclenché**, actif dans toute session de travail sur le
projet, sans rappel manuel.

## Contenu

```
.claude/
├── skills/
│   ├── clair-verif/      protocole d'auto-contrôle avant tout livrable
│   ├── clair-marque/     palette, typographies, ton, signatures visuelles
│   ├── clair-produit/    vérité produit, 3 niveaux, frontière juridique
│   ├── clair-pdf/        normes de rendu des documents PDF
│   ├── clair-acquisition/ sourcing B2B conforme, scoring, RGPD
│   └── clair-contenu/    LinkedIn, Instagram, journal, calendrier éditorial
└── commands/
    ├── prospect.md       /prospect [ville] [segment] [nombre]
    ├── verif.md          /verif [chemin | URL]
    └── pilotage.md       /pilotage [semaine | mois]

.claude-plugin/
├── plugin.json           manifeste du plugin « clairdossier »
└── marketplace.json      rend le dépôt installable comme marketplace
```

## Deux façons de l'utiliser

**1. Dans ce dépôt — rien à faire.**
Les skills de `.claude/skills/` sont chargés automatiquement par Claude Code à
l'ouverture d'une session dans le dépôt. Les commandes `/prospect`, `/verif` et
`/pilotage` sont disponibles de la même façon.

**2. Partout ailleurs — installer le plugin.**

```bash
/plugin marketplace add romancg13/www.clair-dossier.com
/plugin install clairdossier@clairdossier
```

Les six skills et les trois commandes deviennent alors disponibles dans toutes
les sessions Claude Code, y compris sur d'autres projets.

## Vérifier que ça fonctionne

Ouvrir une nouvelle session dans le dépôt et lancer :

| Test | Attendu |
|---|---|
| « Vérifie cette page avant que je la publie » | `clair-verif` s'active, les 7 passes sont déroulées, le bloc de contrôle apparaît |
| « Quelle couleur pour ce bouton ? » | `clair-marque` s'active, or `#c4a456` avec la règle des 5-8 % |
| « Est-ce que ClairDossier fait de la signature électronique ? » | `clair-produit` s'active et répond depuis le code, pas de mémoire |
| « Trouve-moi 10 cabinets d'avocats à Aix » | `clair-acquisition` s'active, sources officielles imposées |
| « Fais-moi un post LinkedIn » | `clair-contenu` s'active, demande un livrable réel comme matière |
| « Prépare la plaquette en PDF » | `clair-pdf` s'active, A4 et polices de marque |
| `/verif` sans argument | audit du diff courant |

Si un skill ne se déclenche pas, c'est sa `description` qu'il faut corriger :
c'est elle, et elle seule, qui décide du déclenchement.

## Architecture

```
                    ┌─────────────────────────────┐
                    │      SPA-CD (existant)      │
                    │  tâches planifiées, registres│
                    │      Drive, Gmail           │
                    └──────────────┬──────────────┘
                                   │
        ┌──────────────┬───────────┴────────┬──────────────────┐
   ┌────▼────┐   ┌─────▼─────┐      ┌───────▼──────┐   ┌───────▼──────┐
   │ Brique 1│   │ Brique 2  │      │  Brique 3    │   │  Brique 4    │
   │ Skills  │   │Acquisition│      │  Contenu     │   │  Agent 24/7  │
   │ + plugin│   │  conforme │      │  multicanal  │   │  (spécifié)  │
   └─────────┘   └───────────┘      └──────────────┘   └──────────────┘
    ce dépôt      clair-acquisition   clair-contenu      agent-24-7.md
                  + /prospect         + calendrier 05    non construit
```

Briques 1, 2 et 3 : livrées et utilisables.
Brique 4 : spécifiée dans `agent-24-7.md`, non construite — voir la note d'ordre
d'exécution ci-dessous.

## Ordre d'exécution recommandé

1. Utiliser les skills sur le travail courant pendant une à deux semaines,
   corriger les descriptions qui ne se déclenchent pas au bon moment.
2. Lancer un premier cycle `/prospect Marseille "cabinets d'avocats" 25` à la
   main, vérifier la qualité du fichier avant toute automatisation.
3. Brancher `clair-contenu` sur les livrables réels, alimenter le calendrier
   éditorial.
4. Seulement ensuite, construire l'agent 24/7 (`agent-24-7.md`). Il suppose une
   machine allumée en permanence et un domaine d'envoi authentifié.

## Documents

- `agent-acquisition.md` — master prompt de l'agent Acquisition, utilisable seul.
- `agent-contenu.md` — master prompt de l'agent Contenu, utilisable seul.
- `agent-24-7.md` — spécification de l'agent Telegram à mémoire persistante.
- `taches-planifiees.md` — les tâches à ajouter au dispositif SPA-CD.
- `decisions.md` — arbitrages rendus et arbitrages en attente.

## Connecteurs

Aucun fichier `.mcp.json` n'est fourni : les connecteurs utilisés (Gmail, Google
Drive, Notion, Slack) sont des connecteurs de compte Claude, activés côté
utilisateur, et non des serveurs MCP locaux. Écrire un `.mcp.json` reviendrait à
inventer des commandes de démarrage inexistantes. Les connecteurs nécessaires
sont indiqués dans chaque commande qui en dépend, et l'absence d'un connecteur
doit être signalée par l'agent au lieu d'être compensée par une estimation.
