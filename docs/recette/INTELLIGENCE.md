# ClairDossier Intelligence — état au 25/11/2026

Assistant exécutif intégré au dossier. Bouton « ClairDossier IA » à droite de « Vos résultats », panneau latéral
rétractable (feuille plein écran sur mobile), sans bulle flottante.

## Ce qui fonctionne réellement (VÉRIFIÉ EN LOCAL — `tests/intelligence.test.ts`, 11 tests ; parcours navigateur ordinateur + mobile)

| Capacité | Comment |
|---|---|
| Résumer le dossier, faits sourcés | lecture de l'analyse vérifiée ; sources pièce/page |
| Prochaines démarches (3 priorités) | règles de la boîte d'attention |
| Échéances à venir / passées | date de référence unique ; une date passée n'est jamais « à venir » |
| Rechercher une information | faits, événements, échéances, parties, noms de pièces de l'analyse |
| Comparer deux pièces | éléments relevés par pièce ; pas de « contradiction » par défaut |
| Préparer une relance | brouillon marqué comme tel, jamais envoyé |
| Ouvrir un document (six rendus) | fichiers déjà générés ; aucune nouvelle analyse |
| Rappel, automatisation en langage naturel | traduits en workflow structuré, **préparés puis à confirmer** |
| Refus des actions sensibles | envoi, suppression, paiement, signature, accès : toujours refusés |
| Résistance à l'injection | seule la demande choisit les outils, jamais le contenu d'une pièce |

Architecture : `supabase/functions/_shared/intelligence/core.ts` (pur TypeScript) — registre d'outils fermé, trois
niveaux d'autonomie, droits revérifiés avant chaque outil, 5 actions au plus par demande, port `Planner`.

## Limites dites sans détour

- **Aucun modèle de langage n'est appelé** : le planificateur est déterministe (règles d'intention en français). Il ne
  remplace pas un assistant conversationnel général ; l'adaptateur modèle (tool-use) reste à brancher côté serveur
  dès qu'une clé d'API de recette existe — DIFFÉRÉ, aucune capacité annoncée sans lui.
- **Monté sur la démonstration fictive uniquement** (`/demo`, exécution dans le navigateur, rien n'est conservé).
  Non monté dans l'espace client de production (moteur IA désactivé, CGV art. 6).
- **Recherche** : porte sur l'analyse, pas sur le texte intégral des pièces.
- **Automatisations et rappels** : la confirmation est notée dans le journal de la démo ; l'exécution planifiée
  (scheduler, persistance) n'est pas branchée — IMPLÉMENTÉ NON TESTÉ côté serveur : à faire.
- Historique et mémoire par client persistants, route serveur, pièces jointes, production de documents sur mesure
  (Word/Excel hors des six rendus) : DIFFÉRÉ.

## Prochaine étape

Route serveur (session, propriété du dossier, débit, historique privé) + adaptateur modèle derrière `Planner`,
puis montage dans l'espace client derrière un drapeau de build, après validation juridique.
