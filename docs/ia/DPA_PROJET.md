# Contrat de sous-traitance (DPA) — PROJET à valider

**Statut : projet rédigé le 26/11/2026 à partir de l'article 28 du RGPD et des faits vérifiés dans le dépôt.
Rien n'est publié. À relire par un avocat avant toute signature. Les mentions « À CONFIRMER » sont des faits
que ClairDossier doit établir (contrat fournisseur, région d'hébergement) : aucune n'a été supposée.**

Référence : règlement (UE) 2016/679, art. 28 § 3, points a) à h) (contenu obligatoire), art. 32 (sécurité),
art. 33-34 (violations), art. 44 et suivants (transferts). À vérifier sur EUR-Lex dans sa version en vigueur.

## Parties et rôles

- **Responsable du traitement** : le Client (professionnel abonné) pour les données contenues dans ses dossiers.
- **Sous-traitant** : ClairDossier, éditeur du Service (identité légale, SIREN et adresse : À CONFIRMER, reprendre
  les mentions légales).
- ClairDossier est **responsable de traitement** pour ses propres données de gestion (compte, facturation,
  sécurité) : hors du présent contrat, couvert par la politique de confidentialité.

## 1. Objet, durée, nature et finalité (art. 28 § 3, phrase 1)

| Élément | Contenu |
|---|---|
| Objet | Hébergement, organisation et, sur activation expresse du Client, analyse automatique des pièces déposées dans ses dossiers |
| Durée | Durée de l'abonnement, puis restitution ou suppression (§ 9) |
| Nature | Stockage, structuration, consultation, extraction de texte, génération de documents de travail, notifications |
| Finalité | Permettre au Client de suivre ses dossiers (résumé, chronologie, échéances, relances) — jamais une consultation juridique |
| Données | Contenu des pièces et des résultats structurés ; identité, coordonnées, montants, dates et références qui y figurent ; le cas échéant données sensibles (santé) ou relatives à des infractions **contenues dans les pièces**, non recherchées par le Service |
| Personnes concernées | Le Client et ses collaborateurs ; les tiers cités dans les pièces (clients, contreparties, bailleurs, administrations…) |

## 2. Instructions documentées (point a)

ClairDossier ne traite les données que sur instruction documentée du Client : le présent contrat, les CGV et les
paramètres choisis dans le Service (activation de l'analyse dossier par dossier, automatisations programmées).
ClairDossier informe le Client si une instruction lui paraît contraire au RGPD. Aucune donnée de dossier n'est
utilisée pour entraîner un modèle, ni partagée entre comptes.

## 3. Confidentialité (point b)

Toute personne autorisée à accéder aux données (équipe, prestataire) est soumise à une obligation de
confidentialité. Accès administratif journalisé ; aucun accès au contenu des pièces par défaut.

## 4. Sécurité (point c, art. 32)

Mesures en place, vérifiables dans le dépôt : isolation par compte en base (RLS, vérifiée en production le
26/11/2026 par diagnostic et tests sur comptes fictifs) ; stockage privé des pièces ; chiffrement en transit
(HTTPS) ; secrets côté serveur uniquement ; journal d'audit des actions d'administration ; plafonds et
coupe-circuit des traitements automatiques. Chiffrement au repos et région : selon l'hébergeur (À CONFIRMER).

## 5. Sous-traitants ultérieurs (points d et § 2, § 4)

Autorisation **générale** écrite, avec information préalable du Client de tout ajout ou remplacement et droit
d'objection (préavis proposé : 30 jours — À VALIDER). Liste à la date du projet :

| Sous-traitant | Rôle | Données | Localisation / transferts |
|---|---|---|---|
| Supabase | Base de données, authentification, stockage des pièces, fonctions serveur | Toutes les données de dossier | Région du projet : À CONFIRMER |
| Stripe | Paiement (pages hébergées) | Facturation — hors données de dossier | Entité irlandaise ; transferts encadrés par Stripe |
| Resend | Envoi des notifications par e-mail | Adresse e-mail, message (sans pièce ni contenu de dossier) | Société américaine ; clauses contractuelles types : À CONFIRMER |
| Fournisseur d'IA (Anthropic) — **seulement si l'analyse automatique est activée** | Lecture et synthèse des pièces | Contenu des pièces analysées | Entité, lieu de traitement, durée de conservation côté fournisseur et non-utilisation pour l'entraînement : À CONFIRMER par le contrat commercial du fournisseur |

ClairDossier impose à chaque sous-traitant ultérieur des obligations équivalentes (art. 28 § 4) et reste
responsable de leur exécution.

## 6. Droits des personnes (point e)

ClairDossier aide le Client à répondre aux demandes (accès, rectification, effacement, limitation, opposition,
portabilité) : export du dossier, suppression d'une pièce ou d'un dossier, désactivation de l'analyse par
dossier. Toute demande reçue directement est transmise au Client sans délai.

## 7. Assistance (point f, art. 32 à 36)

- **Violation de données** : notification au Client **sans délai injustifié** — délai contractuel proposé :
  48 heures après en avoir pris connaissance (À VALIDER), avec la nature de la violation, les catégories et le
  nombre approximatif de personnes et d'enregistrements, les conséquences probables et les mesures prises,
  pour permettre au Client de respecter les 72 heures de l'art. 33.
- **AIPD** : ClairDossier met à disposition son analyse (`docs/ia/AIPD.md`, projet) et les informations
  nécessaires à celle du Client.

## 8. Démonstration et audits (point h)

Mise à disposition des informations nécessaires (registre, liste des sous-traitants, description des mesures) ;
audit par le Client ou un auditeur mandaté, sur préavis raisonnable, au plus une fois par an hors incident
(À VALIDER), à ses frais.

## 9. Fin du contrat (point g)

Au choix du Client : restitution (export) puis suppression, ou suppression, dans un délai proposé de 30 jours
après la fin de l'abonnement (À VALIDER), sauf obligation légale de conservation. Les sauvegardes sont
effacées à l'expiration de leur cycle (durée : À CONFIRMER selon l'offre de l'hébergeur).

## Points à trancher avant signature

1. Mentions légales exactes de l'éditeur. 2. Région d'hébergement Supabase de la production. 3. Contrat du
fournisseur d'IA (rétention, entraînement, lieu de traitement) avant toute activation. 4. Délais proposés
(préavis, notification, suppression, audit). 5. Position des avocats clients au regard du secret professionnel
(loi n° 71-1130 du 31 décembre 1971, art. 66-5) : le contrat ne la tranche pas ; voir
`docs/recette/MOTEUR_ET_CONFORMITE.md` B.3.
