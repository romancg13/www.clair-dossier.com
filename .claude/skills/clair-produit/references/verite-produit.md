# Inventaire produit détaillé — sources dans le dépôt

Chaque affirmation ci-dessous est traçable à un fichier. Si le fichier change,
ce document doit être mis à jour dans le même commit.

## Fonctionnalités — `src/data/features.ts`

| Slug | Titre publié |
|---|---|
| `creation-guidee` | Création guidée par typologie |
| `pieces-ocr` | Dépôt de pièces dans un espace privé |
| `chronologie` | Avancement du dossier en 5 étapes |
| `validation-avocat` | Validation par un professionnel (option) |
| `suivi-statuts` | Suivi par statuts |
| `messagerie-securisee` | Transmission par e-mail ou WhatsApp |
| `coffre-fort` | Espace privé multi-dossiers |
| `calendrier-relances` | Échéances affichées sur le dossier |
| `reponse-auto-mails` | Préparation de réponses |

Vérifier les titres exacts dans le fichier avant publication : ils ont déjà été
réalignés une fois sur le produit réel (commit « content: réaligner le site
public sur le produit réel »).

## Statuts — `src/data/statuses.ts`

| Statut | Qui agit | Ce qui est vrai |
|---|---|---|
| Brouillon | client | tunnel 5 étapes, nom obligatoire, rien n'est transmis |
| Complété | client | informations saisies, pièces déposées, récapitulatif visible |
| Transmis | client | envoi e-mail ou WhatsApp **déclenché par l'utilisateur** |
| En cours | plateforme | 5 étapes métier cliquables depuis la page détail |
| Validé | plateforme | dossier complet, pièces en espace privé, liens signés |
| Archivé | plateforme | données isolées par compte, conservation selon délais légaux |

## Tarifs — `src/data/pricing.ts`

| Formule | Public | € HT / mois | Dossiers | Utilisateurs |
|---|---|---|---|---|
| Essentiel | Indépendant / EI | 19 | 5 | 1 |
| Entrepreneur | Entrepreneur / prof. libérale | 39 | 10 | 2 |
| Business PME 20 | TPE / PME | 49 | 20 | 5 |
| Business PME 50 | PME | 89 | 50 | 5 |
| Business / PME Pro | PME / multi-sites | 169 | — | — |
| Business / PME Premium | Entreprise | 299 | — | — |
| Business / PME personnalisée | Grand compte | sur devis | — | — |

`YEARLY_DISCOUNT = 0.1` — la facturation annuelle affiche −10 %.
Les liens de paiement sont des Stripe Payment Links stockés dans `ctaHref` et
`ctaHrefYearly`. Ne jamais recopier un lien de paiement dans un contenu externe
sans vérifier qu'il est toujours actif.

Volumétries des formules Pro et Premium : lire les champs `specs` du fichier
avant de les citer. Ne pas écrire « illimité » sans l'avoir vu dans le code.

## Piliers de confiance affichés — `TRUST_PILLARS` dans `src/data/pricing.ts`

1. Données protégées — chiffrement en transit (HTTPS) et au repos côté hébergeur,
   pièces en espace privé, accès par authentification.
2. Vous gardez la main — la transmission est déclenchée par l'utilisateur.
3. Sans engagement — résiliation à tout moment, accès / export / suppression
   des données sur demande.

## Page Sécurité publiée — `src/pages/Security.tsx`

Six blocs : Hébergement · Chiffrement · Accès · Conformité · Vos pièces ·
Maîtrise & contact. Le ton est volontairement sobre et sans certification
annoncée. **C'est la version de référence** pour tout nouveau contenu sécurité.

## Écart connu à arbitrer

`scripts/gen-markdown.ts` (fonction `generateSecurity`) et `public/llms.txt`
contiennent une version antérieure, nettement plus affirmative, de la page
Sécurité : OVHcloud bare-metal, KMS avec rotation 90 jours, bastion et WAF,
sauvegardes 3-2-1 avec RPO/RTO chiffrés, audit annuel de pentest, HDS en cours,
ISO 27001 visée. Ces contenus sont publiés sur `/securite.md` et `/llms.txt`,
donc lus par les moteurs et les crawlers d'IA.

Deux lectures possibles, une seule décision — celle de Roman :
1. l'infrastructure décrite est réelle → il faut aligner la page React vers le haut ;
2. elle ne l'est pas → il faut aligner le générateur markdown et `llms.txt`
   vers le bas, sur la page React.

Tant que l'arbitrage n'est pas rendu : ne reprendre aucune de ces affirmations
dans un nouveau contenu.

## Éditeur et mentions — `src/data/legal.ts`

Roman Gomes, entrepreneur individuel, SIREN 105 490 734
(SIRET siège 105 490 734 00016), Château-Gombert, 13013 Marseille.
APE 4791A. TVA non applicable, article 293 B du CGI.
Contact : contact.clairdossier@icloud.com — WhatsApp +33 7 82 98 36 44.
