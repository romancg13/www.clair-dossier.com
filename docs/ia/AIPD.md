# Analyse d'impact (AIPD) — moteur documentaire IA — PROJET à valider

**Statut : projet préparé à partir du code et de faits vérifiés ; la conclusion appartient au responsable de
traitement (ClairDossier). Points marqués « À VALIDER » : décision ou information du propriétaire.**

## 1. Nécessité de l'AIPD

Les lignes directrices européennes (CEPD, WP248) retiennent qu'une AIPD est en principe requise lorsque le
traitement réunit au moins deux critères parmi neuf. Critères présents ici :

- **données sensibles ou à caractère hautement personnel** : les pièces de dossiers administratifs ou
  juridiques peuvent contenir des données de santé, des données relatives à des infractions ou des éléments
  couverts par un secret professionnel ;
- **usage innovant de technologies** : analyse des pièces par un système d'IA générative ;
- **personnes vulnérables ou tiers non informés** : les pièces concernent souvent des tiers (cocontractants,
  salariés, adversaires) qui ne sont pas clients.

Conclusion proposée : **AIPD requise avant toute activation sur des dossiers réels.** À VALIDER.

## 2. Description du traitement (VÉRIFIÉ dans le code)

- Déclenchement : uniquement sur un dossier activé expressément (RPC dédiée, journalisée) ; jamais rétroactif.
- Flux : pièce déposée → file `ai_jobs` → fonction `ai-worker` (serveur Supabase) → API du fournisseur IA →
  extraction structurée avec citations → consolidation → six livrables → publication après relecture
  (mode manuel par défaut) → notification e-mail sans contenu.
- Données envoyées au fournisseur : contenu des pièces du dossier activé ; aucune autre donnée de compte.
- Pas d'outil ni d'action laissés au modèle : sorties à schéma strict, références vérifiées côté serveur,
  instructions contenues dans les pièces traitées comme de simples données.
- Isolation : règles d'accès par compte en base (testées : accès croisé refusé), stockage privé, liens signés.
- Coûts et arrêt : budgets mensuels obligatoires (par compte et global), arrêt d'urgence serveur.

## 3. Risques principaux et mesures

| Risque | Mesures en place | À VALIDER |
|---|---|---|
| Accès illégitime aux pièces d'autrui | Isolation par compte (RLS testées), stockage privé, rôles vérifiés côté serveur | Revue des comptes administrateurs |
| Transfert et conservation chez le fournisseur | Suppression sous 30 j par défaut, pas d'entraînement par défaut | DPA, transferts hors UE, conservation nulle |
| Résultat erroné présenté comme fiable | Sources citées, incertitudes signalées, couverture partielle affichée, relecture humaine par défaut | Procédure de relecture avant publication |
| Injection d'instructions dans une pièce | Aucun outil exposé, schéma strict, aucun envoi à des tiers | — |
| Fuite par les journaux | Journaux sans contenu (statuts seulement), détails en base réservés à l'admin | — |
| Dépense non maîtrisée | Budgets obligatoires sans défaut, réserve avant appel, pause explicite | Montants des budgets |
| Données de tiers non informés | Information dans CGV et confidentialité | Mention d'information des tiers |

## 4. Droits et conservation

Suppression du dossier ⇒ suppression des analyses et livrables (cascade en base). Désactivation possible à
tout moment. Bilans d'exploitation : chiffres seuls, 90 jours.

## 5. Décision

À compléter par le responsable de traitement : risques résiduels acceptables ou non ; consultation préalable de
la CNIL si un risque élevé subsiste malgré les mesures ; date et signataire.
