# Tâches planifiées à ajouter au dispositif SPA-CD

**Aucune tâche existante n'est supprimée ni modifiée.** Les cinq tâches ci-dessous
sont des ajouts, à créer côté SPA-CD (elles ne sont pas exécutables depuis ce
dépôt).

| # | Tâche | Fréquence | Créneau | Registre alimenté | Skill / commande |
|---|---|---|---|---|---|
| A | Sourcing officiel — Annuaire des Entreprises + Sirene, segment P1 | tous les 2 jours | 9 h 00 | 02 pipeline | `/prospect` |
| B | Veille appels d'offres GED et dématérialisation (BOAMP) | 2×/semaine | 9 h 30 | 02 pipeline | `clair-acquisition` |
| C | Contenu multicanal depuis les livrables de la semaine | 2×/semaine | 10 h 00 | 05 calendrier | `clair-contenu` |
| D | Audit CLAIR-VERIF de clair-dossier.com | 1×/semaine | 9 h 30 | 01 journal site | `/verif` |
| E | Contrôle d'intégrité du registre d'opposition et de la délivrabilité | 1×/semaine | 10 h 00 | 09 + 10 | `clair-verif` |

## Notes

**Tâches A et B** remplacent fonctionnellement ce qu'un scraping de réseaux
sociaux aurait cherché à obtenir, sans l'exposition juridique et avec une
meilleure adéquation aux cibles P1.

**Tâche D** : l'audit hebdomadaire du site doit inclure la cohérence entre les
pages React, les miroirs `public/*.md` générés par `scripts/gen-markdown.ts` et
`public/llms.txt`. C'est là qu'un écart de vérité produit apparaît en premier
(voir l'écart déjà identifié dans `decisions.md`).

**Tâche E** : la délivrabilité se dégrade silencieusement. Le contrôle doit
vérifier SPF, DKIM et DMARC du domaine d'envoi, le taux de rebond et
l'exhaustivité du registre d'opposition. Un écart sur ce registre est un
incident, pas une anomalie mineure.

## Avant d'automatiser

Chaque tâche est d'abord exécutée manuellement au moins deux fois, et sa sortie
relue. Une tâche planifiée qui produit un résultat non contrôlé produit surtout
du volume.
