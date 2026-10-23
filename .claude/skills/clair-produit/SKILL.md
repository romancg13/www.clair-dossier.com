---
name: clair-produit
description: À utiliser dès qu'un contenu décrit ce que ClairDossier fait, propose ou promet — page du site, argumentaire, e-mail de prospection, post social, réponse à un prospect, PDF commercial, texte de tarif, description de fonctionnalité, réponse à une question « est-ce que ClairDossier peut… ». Fournit l'inventaire réel du produit, la règle des trois niveaux de vérité (public / prototype / roadmap) et la frontière juridique à ne jamais franchir. S'applique aussi quand quelqu'un demande une démonstration, une fiche produit, une comparaison concurrentielle ou une liste de fonctionnalités.
---

# clair-produit — vérité produit ClairDossier

Une promesse fausse coûte plus cher qu'une fonctionnalité manquante. Ce skill
existe pour qu'aucun contenu ClairDossier n'annonce ce qui n'existe pas.

Source de vérité : le code du dépôt `www.clair-dossier.com`
(`src/data/features.ts`, `src/data/pricing.ts`, `src/data/statuses.ts`,
`src/pages/*`). Ni un ancien document, ni une conversation, ni ce fichier
s'il diverge du code.

## Règle des trois niveaux de vérité

Tout élément produit appartient à un et un seul niveau. **Les niveaux ne se
mélangent jamais dans une même phrase.**

| Niveau | Définition | Formulation autorisée |
|---|---|---|
| **1 — Public et fonctionnel** | Déployé, accessible à un utilisateur réel aujourd'hui | Présent de l'indicatif : « ClairDossier range vos pièces dans un espace privé. » |
| **2 — Prototype / privé** | Existe mais n'est pas ouvert, ou en accès restreint | Mention explicite : « en démonstration », « en accès restreint », « prototype » |
| **3 — Roadmap** | Prévu, non construit | Conditionnel + horizon : « prévu pour… », « à l'étude ». Jamais au présent |

Interdits :
- Décrire une capacité de niveau 3 au présent.
- Montrer une interface simulée sans mention visible qu'il s'agit d'une démonstration.
- Annoncer une certification comme obtenue quand elle est visée ou en cours.
- Agréger des fonctionnalités de niveaux différents dans une même liste à puces
  sans distinction.

## Ce que ClairDossier est — et n'est pas

**Est** : une plateforme de structuration et de suivi de dossiers administratifs
et juridiques, pour artisans, indépendants, professions libérales, TPE et PME.
Une assistance technologique.

**N'est pas** : un cabinet d'avocats, un service de conseil juridique, un
prestataire qui garantit une issue procédurale, ni un outil qui décide à la
place de l'utilisateur.

Position officielle publiée sur le site : l'IA prépare le dossier (structuration,
récapitulatif, chronologie, projet de réponse) ; la validation juridique est un
service **optionnel** assuré par un professionnel du droit inscrit. L'IA ne
délivre jamais de conseil juridique.

Formulations à bannir : « ClairDossier vous conseille », « remplace votre avocat »,
« garantit », « gagnez votre procédure », « juridiquement validé par l'IA ».

## Inventaire réel — niveau 1

**9 fonctionnalités publiées** (`src/data/features.ts`) :
`creation-guidee` · `pieces-ocr` · `chronologie` · `validation-avocat` ·
`suivi-statuts` · `messagerie-securisee` · `coffre-fort` · `calendrier-relances` ·
`reponse-auto-mails`

**Tunnel de création : 5 étapes** (`src/pages/DossierFlow.tsx`) —
profil, nature du dossier, informations, dépôt des documents, récapitulatif.
Le nom du dossier est obligatoire. Brouillon persisté en `localStorage`.

**6 statuts de dossier** (`src/data/statuses.ts`) —
Brouillon → Complété → Transmis → En cours → Validé → Archivé.

**7 formules** (`src/data/pricing.ts`), en euros HT par mois, facturation
annuelle à −10 % :
Essentiel 19 · Entrepreneur 39 · Business PME 20 → 49 · Business PME 50 → 89 ·
Business / PME Pro 169 · Business / PME Premium 299 · Business / PME
personnalisée sur devis.
Création de compte gratuite, sans engagement.

**Transmission** : par e-mail ou WhatsApp, déclenchée explicitement par
l'utilisateur. Aucun envoi automatique. C'est un argument différenciant : le dire
tel quel, ne pas le transformer en « envoi intelligent ».

**Comptes et données** : authentification Supabase avec confirmation par e-mail,
isolation par utilisateur, pièces en stockage privé accessibles par liens signés
temporaires, un administrateur unique côté support.

**Stack** : React 19, TypeScript strict, Vite 6, Tailwind v4, Motion,
React Router 7, Supabase (auth, base, stockage, edge function de notification),
paiements par Stripe Payment Links.

## Points à ne pas affirmer sans vérification

Ces éléments apparaissent dans certains contenus du dépôt mais **ne sont pas
corroborés par la page Sécurité publiée ni par la stack observable**. Ne pas les
reprendre dans un nouveau contenu sans confirmation écrite de Roman :

- hébergement bare-metal OVHcloud France (Roubaix, Strasbourg) ;
- chiffrement AES-256 avec KMS et rotation de clés à 90 jours ;
- bastion, WAF, VPN administrateur, 2FA obligatoire ;
- sauvegardes 3-2-1, RPO 15 min, RTO < 4 h ;
- audit annuel par cabinet de pentest indépendant ;
- HDS « en cours », ISO 27001 « objectif 2027 ».

Ce que la page `/securite` affirme réellement, et qui est sûr à reprendre :
hébergement chez un sous-traitant conforme au RGPD, chiffrement en transit
(HTTPS) et au repos côté hébergeur, liens de téléchargement signés et
temporaires, authentification obligatoire, isolation des données par
utilisateur, droits RGPD exerçables sur demande, transmission déclenchée par
l'utilisateur.

## Mentions obligatoires

- Tout contenu commercial ou public rappelle, au moins une fois, que
  ClairDossier est une assistance technologique et non un conseil juridique.
- Tout contenu du journal traitant d'une question de droit précise qu'il est
  pédagogique et ne constitue pas un conseil personnalisé.
- Toute mention de l'IA précise ce qu'elle fait (préparer, structurer, résumer)
  et ce qu'elle ne fait pas (conseiller, décider, valider juridiquement).

Inventaire détaillé et sources : `references/verite-produit.md`.
