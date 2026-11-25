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

## Assistant côté serveur (V5) — `recette/server/assistant.ts`

Le modèle PROPOSE des appels d'outils, le serveur les contrôle et les exécute (même registre fermé).

| Point | Réalisation | Statut |
|---|---|---|
| Choix du modèle | par la demande, jamais par le client : Haiku 5.5 (simple), Sonnet 5.5 (courante), Opus 5.5 (complexe) ; Fable 5.2 seulement par configuration | VÉRIFIÉ EN LOCAL (qualification) |
| Outils | schémas stricts, droits revérifiés à chaque appel, 5 actions et 4 tours au plus ; outil inconnu ou sensible = sans effet | VÉRIFIÉ EN LOCAL |
| Sources, fichiers, actions à confirmer | pris dans les résultats d'outils, jamais dans le texte du modèle | VÉRIFIÉ EN LOCAL |
| Budget | coût maximal réservé avant chaque appel, réconcilié après ; plafond global et par compte ; registre sans contenu client | VÉRIFIÉ EN LOCAL (y compris en concurrence) |
| Pannes | clé invalide, quota, délai : pas de nouvelle tentative, repli sur les règles, annoncé | VÉRIFIÉ EN LOCAL |
| Historique | privé, par compte et par dossier, effaçable ; dossier d'autrui introuvable | VÉRIFIÉ EN LOCAL |
| Montage | bouton « ClairDossier IA » à droite de « Vos résultats » dans l'espace de recette (abonné) et sur `/demo` | VÉRIFIÉ SUR RECETTE (mode règles) |
| Réponse d'un vrai modèle | **BLOQUÉ** : aucune clé d'API dans le coffre de la recette — une manipulation, voir `ACTIVATION_API.md`. Les tests ci-dessus utilisent un modèle SIMULÉ | BLOQUÉ |

## Limites dites sans détour

- **Sans clé d'API, aucun modèle n'est appelé** : l'assistant répond par règles (déterministe) et le dit. L'adaptateur
  modèle est écrit et testé avec un modèle simulé ; il s'active dès que la clé est dans le coffre.
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
