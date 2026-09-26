---
title: "Sécurité & centre de confiance ClairDossier"
description: "Sous-traitants nommés, localisation et durées de conservation, secret professionnel, continuité, DPA sur demande, journal daté des changements de sécurité."
lastUpdate: 2026-09-18
url: https://www.clair-dossier.com/securite
---

# Sécurité & centre de confiance

Ce centre de confiance expose ce que nous faisons concrètement : chiffrement, isolation par utilisateur, sous-traitants nommés, durées de conservation et journal des changements. Ce que nous ne pouvons pas encore prouver est marqué « À CONFIRMER » — jamais maquillé.

*Dernière mise à jour : 2026-09-18*

## Ce qui est en place

- Connexion chiffrée (HTTPS) entre le navigateur et l'application ; données chiffrées au repos côté hébergeur.
- Isolation des données par utilisateur appliquée en base (Row Level Security) — y compris pour le stockage des pièces (bucket privé, liens signés temporaires).
- Accès à l'espace par authentification (compte confirmé par e-mail) ; consultation support limitée à un administrateur unique.
- Aucune lecture, extraction ou analyse automatique des documents déposés — engagement contractuel (CGV).
- Transmission d'un dossier uniquement sur action explicite de l'utilisateur (e-mail ou WhatsApp).

## Sous-traitants

### Supabase

- **Finalité** : Base de données, authentification, stockage privé des pièces, fonctions serveur (dont la notification interne de l’équipe).
- **Données** : Comptes et profils, dossiers, pièces déposées, notifications internes.
- **Localisation** : Région cloud du projet : en cours de confirmation — sera affichée ici. *(À CONFIRMER)*
- **Conservation** : Durée du contrat, puis délais de la politique de confidentialité (comptes : 12 mois après résiliation).
- **DPA** : Cadre de sous-traitance Supabase : référence à publier ici. *(À CONFIRMER)*

### Stripe Payments Europe Ltd

- **Finalité** : Paiement des abonnements par pages de paiement hébergées (Payment Links).
- **Données** : Coordonnées de paiement et de facturation — traitées par Stripe directement, jamais par nos serveurs.
- **Localisation** : Entité européenne (Irlande) ; transferts encadrés par Stripe.
- **Conservation** : Données de facturation : 10 ans (obligation légale, C. com. L. 123-22).
- **DPA** : Accord de traitement des données Stripe (public, stripe.com/legal/dpa).

### Resend

- **Finalité** : Envoi des e-mails : confirmation de compte et notifications internes à l’équipe (nouvelle inscription, nouveau dossier).
- **Données** : Adresse e-mail du destinataire et contenu du message. Les notifications internes ne contiennent ni pièce ni contenu de dossier.
- **Localisation** : Société américaine — encadrement des transferts (clauses contractuelles types) : à confirmer. *(À CONFIRMER)*
- **Conservation** : Journaux d’envoi côté prestataire : durée à confirmer.
- **DPA** : DPA Resend : référence à publier ici. *(À CONFIRMER)*

### GitHub Pages (GitHub, Inc.)

- **Finalité** : Diffusion du site public (fichiers statiques) sur le domaine clair-dossier.com.
- **Données** : Aucune donnée de dossier — journaux techniques de diffusion (dont l’adresse IP) côté hébergeur.
- **Localisation** : Société américaine, réseau de diffusion mondial (contenu public uniquement) — encadrement des transferts : à confirmer. *(À CONFIRMER)*
- **Conservation** : Journaux techniques selon la politique de l’hébergeur.
- **DPA** : Conditions de traitement des données de GitHub : référence à publier ici. *(À CONFIRMER)*

### WhatsApp (Meta)

- **Finalité** : Canal de contact optionnel : vous choisissez d’écrire à l’équipe par WhatsApp.
- **Données** : Uniquement ce que vous décidez d’y écrire ou d’y joindre — régi par les conditions de WhatsApp. Le service n’y envoie jamais vos dossiers.
- **Localisation** : Hors de notre périmètre serveur : rien n’y transite sans votre action explicite.
- **Conservation** : Selon vos réglages WhatsApp.
- **DPA** : Sans objet (canal externe choisi par vous).

## Durées de conservation (politique publiée)

- **Données de compte** : Durée du contrat, puis 12 mois après résiliation.
- **Données de dossier** : Durée du contrat ; à la résiliation, copie transmise sur demande sous 30 jours, puis suppression ou anonymisation.
- **Données de facturation** : 10 ans (Code de commerce, art. L. 123-22).
- **Journaux de connexion** : 12 mois (LCEN).

## Secret professionnel

Aucune lecture automatique des pièces (engagement contractuel, CGV). Cloisonnement entre comptes appliqué en base, pas seulement dans l'interface. Rien ne sort de l'espace d'un utilisateur sans son action explicite ; le professionnel destinataire, choisi par l'utilisateur, reste responsable de son propre cadre déontologique. Accès support limité à un administrateur unique et identifié.

## Sauvegarde, restauration & incident

- Sauvegardes automatiques de la base par l'hébergeur ; fréquence et profondeur exactes selon le plan souscrit *(À CONFIRMER)*.
- Test de restauration documenté et daté : à publier au journal *(À CONFIRMER)*.
- Incident : notification CNIL sous 72 h et information des personnes en cas de risque élevé (RGPD art. 33-34). Procédure écrite détaillée *(À CONFIRMER)*.

## DPA

Le DPA s'obtient sans formulaire : demande par e-mail à contact.clairdossier@icloud.com, envoi sous 24 h ouvrées. Téléchargement direct depuis la page /securite en préparation *(À CONFIRMER)*.

## Journal des changements de sécurité

- **2026-09-18** — Tests SQL de cloisonnement entre comptes rejoués hors production sur l’ensemble des migrations du dépôt ; le relevé daté alimente les indicateurs de cette page.
- **2026-08-30** — Pré-rendu des pages publiques. En-têtes HTTP renforcés (HSTS, CSP stricte, nosniff, anti-framing) préparés pour une cible d’hébergement alternative, non active sur le domaine à ce jour. Capture des demandes de contact conçue (table verrouillée sans accès public direct, écriture par fonction serveur validée, limitation de débit par hachés salés) : écrite, non activée en production.
- **2026-08-23** — Baseline de sécurité et matrice de non-régression établies (inventaire complet du code, des accès et des flux Stripe/Supabase).
- **2026-06-21** — Accès support restreint à un administrateur unique : liste d’admins hors d’atteinte des utilisateurs (aucune policy applicative), vérification par fonction dédiée, politiques de lecture additives — l’isolation entre clients reste inchangée.
- **2026-06-15** — Isolation par utilisateur appliquée en base dès l’initialisation (Row Level Security sur dossiers, documents, profils et stockage) ; bucket de pièces privé, accès par liens signés temporaires.

## En attente de vérification (affiché tel quel)

- À CONFIRMER : Localisation exacte (région cloud) du projet de base de données : à confirmer puis afficher.
- À CONFIRMER : DPA ClairDossier téléchargeable directement depuis cette page (aujourd’hui : envoyé par e-mail sur simple demande).
- À CONFIRMER : Analyse d’impact (AIPD) : évaluation de la nécessité à documenter.
- À CONFIRMER : Procédure d’incident rédigée et publiée (l’engagement réglementaire s’applique déjà — voir Continuité).
- À CONFIRMER : Test de restauration des sauvegardes : à réaliser puis dater ici.
- À CONFIRMER : Encadrement des transferts hors Union européenne (Resend, GitHub) : mécanisme à confirmer puis afficher.

## Divulgation responsable

Vulnérabilités à signaler à contact.clairdossier@icloud.com — réponse sous 24 h ouvrées. Aucune action en justice contre les chercheurs de bonne foi qui respectent une démarche responsable.


---

*Source : https://www.clair-dossier.com/securite — éditeur : Roman Gomes (SIREN 105 490 734, Château-Gombert, 13013 Marseille). Site réalisé par Nouh BENZIDANE.*

*Citation suggérée : « ClairDossier, [titre de la page], https://www.clair-dossier.com/securite ».*
