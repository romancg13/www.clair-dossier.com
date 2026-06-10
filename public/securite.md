---
title: "Sécurité & conformité ClairDossier"
description: "Hébergement OVH France, chiffrement AES-256 et TLS 1.3, RGPD natif, conformité RIN, audit annuel par tiers."
url: https://www.clair-dossier.com/securite
---

# Sécurité et conformité

La sécurité juridique commence par la sécurité technique. Pour une legaltech, la conformité n'est pas une case à cocher — c'est la condition d'existence.

## Architecture

1. **Client** — navigateur, application, API.
2. **TLS 1.3** — HSTS preload, pinning.
3. **Bastion** — WAF, rate-limit, audit.
4. **Application** — hébergée en France, 2FA admin obligatoire.
5. **Coffre chiffré** — AES-256, réplique France.

Chaque flèche est chiffrée. Chaque nœud est journalisé. Aucune donnée client n'est lisible en clair sur les sauvegardes.

## Six piliers

### Infrastructure
Datacenters OVH France (Roubaix, Strasbourg). Aucun datacenter hors UE, ni pour la production, ni pour les sauvegardes. Bare-metal souverain, pas de cloud public américain. Architecture trois tiers avec bastion de sortie et VPN administrateur 2FA obligatoire.

### Chiffrement
AES-256 au repos pour la base de données et le coffre-fort de pièces. TLS 1.3 obligatoire pour tous les flux client ↔ serveur (HSTS preload). Clés chiffrées par KMS, rotation automatique tous les 90 jours, séparation stricte clés / données.

### Accès
Authentification obligatoire à deux facteurs pour les accès administrateurs internes. Journalisation des consultations sensibles avec conservation des logs 12 mois. Aucune donnée client accessible par défaut aux équipes ClairDossier — accès sur demande tracée et justifiée.

### Conformité
RGPD (UE 2016/679) appliqué dès la conception : registre des traitements, DPIA réalisée, DPA standard et version renforcée disponibles. Conformité RIN (Règlement Intérieur National des avocats) sur le périmètre IA : préparation autorisée, conseil interdit. Hébergement HDS en cours pour les dossiers contenant des données de santé.

### Continuité
Sauvegardes 3-2-1 : trois copies de chaque donnée, sur deux supports différents, dont une hors site. Restauration testée chaque trimestre. RPO 15 minutes, RTO inférieur à 4 heures.

### Audit et incident
Audit annuel par cabinet de pentest indépendant — rapport remis aux clients Entreprise. Politique de divulgation responsable publiée. Procédure d'incident documentée avec notification CNIL sous 72 h, notification client sous 24 h.

## Cadres réglementaires

- **RGPD** : conforme.
- **RIN 2024** : conforme — IA encadrée.
- **HDS** : en cours (objectif 2026 T3).
- **ISO 27001** : objectif 2027.

## Divulgation responsable

Vulnérabilités à signaler à contact.clairdossier@icloud.com. Réponse sous 24 h ouvrées. Programme de récompense informel pour les contributions confirmées. Aucune action en justice contre les chercheurs de bonne foi.


---

*Source : https://www.clair-dossier.com/securite — éditeur : Roman Gomes (SIREN 105 490 734, Château-Gombert, 13013 Marseille). Site réalisé par Nouh BENZIDANE.*

*Citation suggérée : « ClairDossier, [titre de la page], https://www.clair-dossier.com/securite ».*
