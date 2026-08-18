# Feuille de route LDI — phases 4, 5 et 6

*Évaluations produites après la phase 3. Conformément au mandat, **rien de ce qui
suit n'est implémenté** : chaque module attend une validation explicite.*

---

## Avertissement préalable — un désaccord de périmètre à trancher

La phase 4 du mandat décrit une chaîne de production **civile** : conclusions
selon les art. 768 et 954 du code de procédure **civile**, bordereau de
communication de pièces, analyse des « écritures adverses », chiffrage
principal/intérêts/indexation.

L'agent construit est **pénal**. En procédure pénale :

- les conclusions ne relèvent pas des art. 768 et 954 CPC ; devant le tribunal
  correctionnel et la chambre de l'instruction, ce sont d'autres textes du CPP
  qui régissent la forme et le dépôt des conclusions ;
- il n'y a pas d'échange d'écritures au sens civil : le ministère public requiert,
  le plus souvent oralement à l'audience. « Analyser les écritures adverses »
  n'a pas d'objet identique ;
- le bordereau de communication de pièces est un acte de la procédure civile ;
  au pénal, le dossier est tenu par le greffe et la défense y accède ;
- le chiffrage principal/intérêts concerne surtout l'action civile, accessoire.

**Ce n'est pas un détail de vocabulaire.** Si la cible est réellement
multi-matières — le bloc `MATIERES` du mandat liste civil, commercial,
prud'homal, famille, baux, pénal, administratif — alors ce n'est pas un
incrément du système actuel : c'est un autre produit, avec un autre corpus,
d'autres points de contrôle et d'autres trames. Le noyau (chronologie,
contradictions, pseudonymisation, vérificateur de citations) se réemploie ; les
modules 3, 5 et 6 sont à réécrire par matière.

Les évaluations ci-dessous supposent le périmètre **pénal**, celui du système
existant. Chaque module marqué « à redéfinir » l'est pour cette raison.

---

## PHASE 4 — chaîne de production documentaire

### 6.1 Ingestion et mise en état

| # | Module | Verdict | Effort | Motif |
|---|---|---|---|---|
| M1 | Extraction de texte + OCR, confiance par page | **PERTINENT — priorité 1** | L | C'est l'obstacle principal à l'usage réel : la saisie du dossier est aujourd'hui manuelle en JSON. Le score de confiance par page et la mise en quarantaine sont la bonne conception : une page mal océrisée doit être signalée, jamais devinée. |
| M2 | Classement et nommage automatiques | **PERTINENT** | M | Dépend de M1. À contraindre par schéma : nature, date, auteur — jamais deviné, `[INFORMATION MANQUANTE]` sinon. |
| M3 | Bordereau de communication de pièces | **À REDÉFINIR** | S | Acte de procédure civile. Au pénal, l'équivalent utile est un inventaire coté du dossier de la défense. Utile, mais ce n'est pas le module décrit. |
| M4 | Détection des pièces manquantes | **PERTINENT — priorité 2** | M | Déjà amorcé : les points `non-etabli` du module 3 sont exactement cette liste. Il reste à la présenter comme une checklist de pièces à réclamer. Rapport valeur/effort excellent. |
| M5 | Doublons et versions | **PERTINENT** | S | Dépend de M1. |

### 6.2 Analyse

| # | Module | Verdict | Effort | Motif |
|---|---|---|---|---|
| M6 | Chronologie rattachée à pièce/page | **FAIT, à compléter** | S | Le module 1 le fait, au niveau pièce. Le niveau **page** suppose M1. |
| M7 | Fiche de synthèse 2 pages | **PERTINENT** | M | Sortie structurée d'abord, mise en forme ensuite. |
| M8 | Analyse des écritures adverses | **À REDÉFINIR** | M | Sans objet tel quel au pénal. Équivalent : analyse du réquisitoire définitif et de l'ordonnance de renvoi, qui sont écrits. |
| M9 | Matrice de contradiction | **PERTINENT, reformulé** | M | Très utile au pénal si l'on remplace « moyen adverse » par « élément constitutif à établir par l'accusation ». Les cases `non couvert` remontent en tête, comme prévu. |
| M10 | Recherche via API officielles | **FAIT en phase 3** | — | `src/ldi/sourcage.ts`. Reste à éprouver contre l'API PISTE réelle. |
| M11 | Fiche par fondement, conditions cumulatives | **PERTINENT — priorité 3** | M | C'est la forme naturelle du raisonnement pénal : pour chaque élément constitutif, la pièce qui l'établit ou `[À ÉTABLIR]`. |
| M12 | Prescription et délais, code déterministe | **PERTINENT** | M | Amorcé (PRESC-01), volontairement non calculé faute de règle sûre sur les actes interruptifs. Un calcul complet exige la liste des actes, donc M1. |
| M13 | Chiffrage | **NON PERTINENT au pénal** | — | Accessoire (action civile). À reconsidérer si le périmètre s'élargit au civil. |

### 6.3 Rédaction

| # | Module | Verdict | Effort | Motif |
|---|---|---|---|---|
| M14 | Projet de conclusions | **À REDÉFINIR** | L | Les art. 768 et 954 CPC ne s'appliquent pas. Le module doit viser les textes du CPP propres à la juridiction saisie — et, comme le mandat le demande justement, les **vérifier lui-même** plutôt que les supposer. |
| M15 | Conclusions récapitulatives + diff | **NON PERTINENT au pénal** | — | Notion civile. |
| M16 | Note de plaidoirie | **PERTINENT** | M | Directement utile. S'appuie sur les axes déjà produits. |
| M17 | Courrier au client + « ce que je vous demande » | **PERTINENT** | S | Alimenté par M4. Bon rapport valeur/effort. |
| M18 | Demandes de communication de pièces | **PERTINENT** | S | Formulation strictement procédurale, conformément à R4. |
| M19 | Gabarits `.docx` du cabinet | **PERTINENT** | M | Sortie `.docx` : condition d'usage réel. Aujourd'hui markdown. |

### 6.4 Contrôle qualité

| # | Module | Verdict | Effort | Motif |
|---|---|---|---|---|
| M20 | Vérificateur de citations | **FAIT en phase 3** | — | `src/ldi/citations.ts`, câblé documents + fonction edge. |
| M21 | Agent contradicteur | **PERTINENT** | M | Rejouer le dossier côté accusation. Coût : un appel LLM supplémentaire par dossier. |
| M22 | Traçabilité phrase → source | **PERTINENT — priorité 4** | L | Répond à l'axe G, aujourd'hui noté 1/5. Suppose une sortie structurée (phase 5, point 3). |
| M23 | Vue de relecture avocat | **PERTINENT** | M | Dépend de M22. |
| M24 | Filet anti-injection | **FAIT en phase 3** | — | Cloisonnement + test de non-régression. |
| M25 | Contrôle de conflit d'intérêts | **PERTINENT** | S | Suppose un répertoire du cabinet, qui n'existe pas encore. |

---

## PHASE 5 — socle technique

| # | Point | Verdict | Effort | Remarque |
|---|---|---|---|---|
| 1 | Orchestrateur explicite | **PERTINENT** | M | Le pipeline actuel est déjà une suite d'étapes typées, mais synchrone et non reprenable. |
| 2 | Sous-agents spécialisés | **PRÉMATURÉ** | L | Un seul appel LLM aujourd'hui. Découper avant d'avoir M1 multiplierait le coût sans gain. À reprendre après M1/M11. |
| 3 | Sorties structurées garanties | **PERTINENT — priorité 1** | S | `output_config.format` + validation + échec explicite. Corrige P1-09. Le meilleur rapport valeur/effort de la phase. |
| 4 | RAG sur le dossier | **PERTINENT** | L | Suppose M1. Cloisonnement par dossier impératif. |
| 5 | RAG sur la base du cabinet | **PERTINENT, avec réserve** | L | Pour le style uniquement. La réserve du mandat — jamais pour les références — est exactement la bonne, et le vérificateur de citations la rend désormais opposable. |
| 6 | Prompt caching | **FAIT** | — | Sur l'invite système. À étendre au corpus du dossier quand M1 existera. |
| 7 | Routage multi-modèles + repli | **PARTIEL** | S | Le repli côté serveur est actif. Le routage par tâche suppose plusieurs appels (point 2). |
| 8 | Plafond de coût par dossier | **PERTINENT — priorité 2** | S | Corrige P1-10. Suppose une décision de produit sur le plafond. |
| 9 | Journal rejouable | **PERTINENT — priorité 3** | M | Corrige P1-05 et l'axe G. |
| 10 | Mode simulation | **PERTINENT** | S | Sans appel payant. Facilite les évaluations. |
| 11 | Boucle de retour avocat | **PERTINENT** | M | Capturer les corrections de l'avocat pour alimenter les évaluations. |
| 12 | Harnais d'évaluation | **PERTINENT — priorité 4** | L | Corrige P1-06. Sans lui, rien ne mesure ce que les autres points corrigent. |
| 13 | CI lint + tests + évaluation | **PARTIEL** | S | CI en place (typecheck, tests, build). Manquent : un lint, `deno check` — qui suppose une **action GitHub supplémentaire, non introduite sans accord** — et l'évaluation (point 12). |

---

## PHASE 6 — validation finale

État réel, sans complaisance. Coché = vérifié avec preuve d'exécution.

- [x] **Aucun secret exploitable dans le code ni l'historique.** Le JWT présent
      porte `"role":"anon"` : public par conception, protégé par RLS, activé sur
      4 tables.
- [x] **`grep` de citations codées en dur : zéro occurrence hors fixtures.**
- [x] **Refus de citer sans source.** Le vérificateur rejette tout pourvoi non
      retourné par une API et tout article absent du contexte — démontré sur une
      sortie piégée.
- [x] **Demande d'une jurisprudence inexistante → refus documenté.** Le
      vérificateur annote sur place et remonte la citation. Testé.
- [x] **Pièce contenant une instruction cachée → sans effet sur le
      comportement.** Cloisonnement `<donnees_dossier>`, tentative d'évasion
      neutralisée, 6 tests.
- [x] **Périmètre exclu affiché.** Dans `docs/LDI.md` et en pied de la page
      publique.
- [x] **Mention de responsabilité de l'avocat sur chaque export.** Pied de tout
      document généré.
- [ ] **`git clone` → premier dossier traité en moins de 10 minutes.** Faisable
      pour la CLI, mais la saisie manuelle du dossier en JSON rend la borne
      irréaliste sur un dossier réel. Bloqué par M1.
- [ ] **Jeu d'évaluation exécuté, 100 % de citations vérifiées.** Le harnais
      n'existe pas (P1-06).
- [ ] **Pseudonymisation vérifiée par capture des données réellement
      transmises.** Impossible ici : aucun appel LLM n'a été exécuté, faute de
      clé configurée dans cet environnement.
- [ ] **Coût par dossier mesuré.** Même raison. Aucun chiffre ne sera produit
      sans mesure.
- [ ] **Projet de conclusions complet relu, corrections consignées.** Suppose
      M14, lui-même à redéfinir (voir l'avertissement de périmètre).
- [ ] **Zéro P0, zéro P1 restant.** 3 P0 corrigés sur 3. 1 P1 corrigé sur 8.
      Restent : P1-05, P1-06, P1-07, P1-08, P1-09, P1-10, P1-11.

**Verdict.** Le système n'est pas validable au sens de la phase 6, et il serait
malhonnête de cocher davantage. Ce qui a changé en phase 3 est toutefois
substantiel : les trois défauts qui permettaient à une référence fausse
d'atteindre l'avocat sont fermés, et fermés par du code exécuté, pas par une
consigne d'invite.
