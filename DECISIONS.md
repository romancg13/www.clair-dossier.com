# DECISIONS — registre des décisions autonomes (mandat v4, §0.5)

Format : `[étape] — [décision] — [écarté] — [règle §0.3] — [réversibilité] — [test]`.

---

**[1] — Le site vitrine ClairDossier est supprimé du dépôt, l'atelier devient
la racine de l'application.** — Écarté : conserver les pages en les renommant
(elles décrivent un autre produit, pour un autre public). — Règle : mandat
explicite (« toute trace… est à supprimer ») + §0.3-6 simplicité. —
Réversibilité : `git log` conserve tout ; restaurer = `git checkout <commit
antérieur> -- src/pages src/data public`. — Test : recherche automatisée de la
chaîne « clairdossier » dans `src/`, `scripts/`, `index.html` (suite de
non-régression).

**[1] — Le nom du dépôt distant (`www.clair-dossier.com`) n'est pas modifiable
depuis cette session.** — Écarté : rien (hors de portée d'un commit). — Règle :
§0.4-3 par analogie, consigné plutôt que bloquant. — Réversibilité : renommage
côté hébergeur Git par le propriétaire. — Test : aucun (hors dépôt).

**[1] — La conservation locale reste CHIFFRÉE (coffre AES-256-GCM existant),
alors que B9 la décrit « non chiffrée ».** — Écarté : rétrograder vers un
stockage en clair pour coller à la lettre. — Règle : §0.3-2 (le chiffrement
préserve mieux le secret professionnel) ; les trois exigences opérantes de B9
— désactivée par défaut, activation explicite avec avertissement, effacement
total en un geste sans la phrase — sont toutes tenues. — Réversibilité :
`stockage.ts` isole le support ; un mode clair se réintroduirait dans ce seul
fichier. — Test : `coffre.test.ts`, `atelier-etat.test.ts`.

**[1] — Le mode distant (D-3) est reconstruit côté CLI et non plus en fonction
edge Supabase.** — Écarté : conserver les fonctions edge (elles exigent un
déploiement serveur, contredisent « sans serveur » §3.1, et portaient le
domaine ClairDossier en CORS). — Règle : §0.3-2 (moins de surface hors poste)
puis 6 (plus simple). — Réversibilité : les fonctions supprimées restent dans
l'historique git (`supabase/functions/`), et la logique métier (prompt,
citations, plafond, structure) reste dans `src/ldi/` — seul le transport a
changé. — Test : invariants du mode distant dans la suite CLI.

**[1] — Les extracteurs bureautiques (docx, xlsx, eml, zip) rejoignent le PDF
derrière l'interrupteur « niveau 1 » au lieu d'être supprimés.** — Écarté :
suppression pure (D-1 ne cite que le PDF au niveau 1). — Règle : §0.3-4
(réversible : un interrupteur se retire, du code testé supprimé se réécrit) et
§0.3-5 (code déjà couvert par 60+ tests). Ces extracteurs sont locaux, sans
réseau, sans OCR — même nature exacte que le niveau 1. — Réversibilité :
constante `FORMATS_NIVEAU_1` dans un seul fichier. — Test :
`ingestion-niveaux.test.ts` (niveau 0 par défaut, niveau 1 sur activation).

**[1] — `piste.ts` (jetons OAuth, appels Judilibre) reste dans `src/ldi/` mais
n'est importable que par la CLI.** — Écarté : le déplacer dans `scripts/`
(perdrait la couverture tsc/tests). — Règle : §0.3-5. — Réversibilité :
déplacement de fichier. — Test : le test « aucun code d'appel API dans le
bundle navigateur » balaie les imports de `src/components` et `src/pages`.

**[12-14] — Les étapes 12, 13 et 14 sont livrées en un lot, le module de
livrables AVANT l'écran Écritures.** — Écarté : suivre l'ordre strict 12→13→14
en construisant un écran Écritures sans générateur derrière. — Règle : §1.4
(exactitude > complétude) — un menu qui mène à un écran vide est un mensonge
d'interface. — Réversibilité : sans objet (ordre d'écriture, pas de code). —
Test : `livrables.test.ts` précède l'écran dans l'historique.

**[12] — Pas d'annulation/rétablissement global (§5.3).** — Écarté : un
journal d'états complet de l'atelier. — Règle : §0.3-6 (simplicité) ; la
saisie passe par des formulaires courts, corrigeables par édition, et les
consignes se RÉVISENT sans perte (B21). — Réversibilité : un futur
gestionnaire d'états peut envelopper `setDossiers`. — Test : aucun (limite
consignée, reprise au rapport final).

**[13] — Police de texte : Inter (déjà embarquée) plutôt qu'une humane
stricte.** — Écarté : ajouter une nouvelle famille de polices. — Règle :
« aucune dépendance nouvelle » + B10 (déjà en woff2 local) ; Inter tient la
lisibilité en petit corps et les tableaux denses, ce qui est la fonction
demandée. — Réversibilité : un seul jeton `--font-sans`. — Test : la CI
échoue sur toute police externe (balayage des sources).

**[15] — Le mode distant appelle l'API par `fetch` natif, sans SDK.** —
Écarté : ajouter le SDK fournisseur en dépendance. — Règle : « aucune
dépendance nouvelle » + §0.3-6. — Réversibilité : le transport est isolé dans
`creerMoteurDistant`. — Test : `moteur.test.ts` (verrous, B11).

**[15] — `pack-sources` n'inscrit au pack que les références VÉRIFIÉES pendant
l'exécution.** — Écarté : verser aussi les énoncés « à vérifier » de l'index
(ils n'ont pas d'horodatage de récupération : B3 les rendrait inaffichables et
l'import les rejetterait — autant le dire à la production). — Règle : §0.3-3
(ne pas inventer). — Réversibilité : filtre local dans la commande. — Test :
`livrables.test.ts` (rejet B3 nommé à l'import).

**[16] — La forme « fichier ouvert en local » est le build AUTONOME (IIFE, un
seul fichier), pas le build modules.** — Écarté : prétendre que `dist/`
s'ouvre en file:// (les modules ES y sont bloqués — constaté dans Chromium,
page blanche). — Règle : §0.3-5 (testable) ; vérifié par capture d'écran en
file://. — Réversibilité : le build modules reste le mode servi
(`npm run dev` / hébergement statique). — Test : assemblage refusé si le
repli ne produit pas exactement 1 js + 1 css.

**[17] — Le « dossier réel » de la Definition of Done est tenu par le dossier
FICTIF de démonstration.** — Écarté : rien (aucun dossier réel n'existe ni ne
doit exister dans un dépôt). — Règle : §11.1-17 impose d'ailleurs un dossier
« entièrement fictif et clairement identifié comme tel ». — Réversibilité :
sans objet. — Test : `conformite.test.ts` (bout en bout + mention « fictif »
exigée dans le fichier).
