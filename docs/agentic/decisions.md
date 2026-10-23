# Arbitrages — couche agentique v1.0

## Rendus

### 1. Pas de scraping de leads sur les réseaux sociaux

**Décision : le sourcing passe exclusivement par des sources officielles et
publiques.** Le scraping d'Instagram, LinkedIn, Facebook ou TikTok est interdit
par le skill `clair-acquisition`.

Motifs :
- **Conditions d'utilisation** — la collecte automatisée est interdite par les
  plateformes. Risque concret : blocage du compte ClairDossier et perte d'un
  canal déjà utilisé.
- **RGPD** — un profil social est une donnée personnelle. Constituer un fichier à
  partir de profils collectés, sans information des personnes et sans base légale
  documentée, expose à une sanction. L'origine de la donnée ne serait pas
  documentable, donc la base légale non plus.
- **Qualité** — les cibles P1 (cabinets d'avocats de 3 à 30 collaborateurs,
  experts-comptables, syndics) ne sont pas présentes sur Instagram en tant que
  décideurs professionnels. Le risque juridique achèterait un fichier médiocre.

Remplacé par : Annuaire des Entreprises, API Sirene/INSEE, annuaires des ordres
professionnels, sites officiels des entreprises, BOAMP. Détail dans
`.claude/skills/clair-acquisition/references/sources.md`.

Instagram reste un canal de **diffusion et de social selling manuel** — c'est le
périmètre du skill `clair-contenu`.

### 2. Pas de fichier `.mcp.json` fourni

Les connecteurs Gmail, Google Drive, Notion et Slack utilisés sont des
connecteurs de compte Claude, pas des serveurs MCP locaux. Écrire un `.mcp.json`
supposerait d'inventer des commandes de démarrage. Les commandes qui dépendent
d'un connecteur doivent signaler son absence plutôt que d'estimer un chiffre.

## En attente — décision de Roman

### 3. Écart sur les affirmations de sécurité — à trancher

La page `/securite` publiée (`src/pages/Security.tsx`) est sobre : hébergement
chez un sous-traitant conforme au RGPD, chiffrement en transit et au repos côté
hébergeur, liens signés temporaires, isolation par utilisateur.

`scripts/gen-markdown.ts` (fonction `generateSecurity`) et `public/llms.txt`
publient une version nettement plus affirmative, sur `/securite.md` et
`/llms.txt` — donc lue par les moteurs et les crawlers d'IA :
OVHcloud bare-metal (Roubaix, Strasbourg), AES-256 avec KMS et rotation à
90 jours, bastion et WAF, VPN administrateur 2FA, sauvegardes 3-2-1 avec RPO
15 min et RTO < 4 h, audit annuel de pentest, HDS en cours, ISO 27001 visée.

Ces deux versions ne peuvent pas être vraies en même temps. Deux issues :

1. **L'infrastructure décrite est réelle** → aligner la page React vers le haut,
   et conserver les preuves (contrat d'hébergement, rapport d'audit) pour pouvoir
   les produire si un client Entreprise les demande.
2. **Elle ne l'est pas** → aligner `gen-markdown.ts` et `llms.txt` sur la page
   React, en supprimant les affirmations non démontrables.

Enjeu : des affirmations de conformité non démontrables sur un site de legaltech
sont une exposition commerciale et réglementaire, pas une maladresse de
rédaction. Tant que l'arbitrage n'est pas rendu, aucun nouveau contenu ne reprend
ces affirmations (règle inscrite dans `clair-produit`).

**Rien n'a été modifié sur ce point : c'est une décision produit, pas une
correction technique.**

### 4. Volume d'envois et domaine d'expédition

Plafond posé à 40 envois par jour dans la spécification de l'agent 24/7.
Au-delà, la réputation d'expéditeur se dégrade rapidement. Monter en volume
suppose un domaine d'envoi dédié `@clair-dossier.com` avec SPF, DKIM et DMARC
correctement configurés. C'est un préalable technique, pas une option.

### 5. Adhésion à une formation externe

Décision d'achat, hors périmètre technique. Ce que ce type de formation apporte
en skills et en configuration MCP est construit ici pour ClairDossier
spécifiquement. L'intérêt résiduel porte sur la communauté et les mises à jour.
