# Audit PHASE 0 — Identité publique & mentions légales (clair-dossier.com)

**Repository audité :** `/Users/Roman_784/Documents/Codex/2026-07-02/contrainte-absolue-ne-pas-toucher-aux/work/www.clair-dossier.com` (branche `main`, HEAD `865f86c`, arbre propre)
**Date de l'audit :** 2026-08-23
**Mode :** lecture seule. Aucun fichier du repository n'a été modifié. Aucun fichier `.env` n'a été lu (seul `.env.example`, qui ne contient que des placeholders, a été ouvert).
**Objet :** préparer la règle I.5 — remplacer les nom/prénom personnels par « ClairDossier » dans les zones commerciales, remplacer l'ancien téléphone par « Service Assistance ClairDossier — 04 91 95 90 32 », conserver dans les Mentions légales ce que la loi impose.

---

## 0. Méthode et périmètre

### 0.1 Fichiers lus intégralement

| Fichier | Lignes | Rôle |
|---|---|---|
| `src/data/legal.ts` | 465 | Source unique des 4 pages légales (React + génération markdown) |
| `src/pages/LegalPage.tsx` | 201 | Rendu React des pages légales |
| `public/mentions-legales.md` | 57 | Copie markdown (générée) |
| `public/cgv.md` | 67 | Copie markdown (générée) |
| `public/politique-confidentialite.md` | 79 | Copie markdown (générée) |
| `public/cookies.md` | 46 | Copie markdown (générée) |
| `src/components/Footer.tsx` | 89 | Pied de page de toutes les pages |
| `src/pages/Contact.tsx` | 258 | Page /contact |
| `src/data/authors.ts` | 18 | Auteurs du journal |
| `src/lib/whatsapp.ts` | 20 | Source unique du numéro WhatsApp |
| `src/lib/seo.tsx` | 126 | Composant Seo + JSON-LD Organization / WebSite / Breadcrumb |
| `index.html` | 56 | Shell HTML (meta author, noscript) |
| `public/llms.txt` | 105 | Fiche d'identité pour crawlers IA (fichier statique, suivi par git, NON généré) |
| `public/og-default.svg` | 45 | Image Open Graph |
| `supabase/functions/notify-lead/index.ts` | 69 | Edge Function de notification e-mail |
| `supabase/config.toml` | 384 | Config Supabase (SMTP, sender) |
| `public/contact.md`, `public/securite.md`, `public/index.md` (extraits), `scripts/gen-markdown.ts` (extraits : l. 1-60, 120-135, 360-368, 395-525), `src/pages/Pricing.tsx` (l. 268-335, 410-425), `src/pages/Security.tsx` (l. 300-330), `src/pages/DossierFlow.tsx` (l. 30-50, 375-420), `src/pages/BlogPost.tsx` (l. 30-60), `src/pages/Home.tsx` (l. 15-61), `src/components/Logo.tsx`, `src/lib/supabase.ts`, `supabase/migrations/20260617110728_dossier_lead_notification.sql`, `supabase/migrations/20260621144123_admin_global_access.sql`, `supabase/migrations/20260622062648_admin_user_emails.sql`, `.github/workflows/deploy.yml`, `netlify.toml`, `public/CNAME`, `.gitignore`, `.env.example`, `README.md`, `package.json` | — | Lus pour contexte / vérification |

### 0.2 Grep exécutés (racine du repo, hors `node_modules`, `dist`, `.git`, `package-lock.json`)

Termes demandés : `BENZIDANE`, `Benzidane`, `Nouh`, `Roman`, `Gomes`, `Cottant`, `13'UP`, `13UP`, `prestige.seller`, `icloud`, `+33`, `06`, `07`, `04`, `wa.me`, `whatsapp` (insensible à la casse), `SIREN`, `Dalbret`, `Château-Gombert`, `Marseille`. Complétés par une regex téléphone (`\+33`, `0033`, `33[1-9]\d{8}`, `0[1-9]( ?\d{2}){4}`) et une regex e-mail générique.

### 0.3 Point structurel important : chaîne de génération

- `src/data/legal.ts` est la **source unique** des 4 pages légales. Le composant `src/pages/LegalPage.tsx:17` lit `legalPages[slug]`.
- `scripts/gen-markdown.ts` (lancé par `npm run build`, cf. `package.json:9` : `"build": "npm run gen:md && tsc ... && vite build"`) **régénère** `public/*.md` à chaque build à partir des mêmes fichiers de données (`legal.ts`, `features.ts`, `pricing.ts`, `blog/*`, etc.). Les 28 fichiers `.md` de `public/` sont **également suivis par git** (`git ls-files public` : 29 fichiers dont `CNAME`).
- La fonction `footer()` de `scripts/gen-markdown.ts:40-49` ajoute à **chacun** des 28 fichiers `.md` la ligne : `*Source : … — éditeur : Roman Gomes (SIREN 105 490 734, Château-Gombert, 13013 Marseille). Site réalisé par Nouh BENZIDANE.*`
- **Conséquence pour I.5 :** toute correction doit être faite dans `src/data/legal.ts`, `src/lib/whatsapp.ts`, `scripts/gen-markdown.ts`, `index.html`, `public/llms.txt`, `src/components/Footer.tsx` (sources), puis les `.md` régénérés (`npm run gen:md`). Corriger uniquement les `.md` serait écrasé au build suivant.
- `public/llms.txt` n'est **pas** généré par le script (aucune occurrence de `llms` dans `scripts/gen-markdown.ts`) : c'est un fichier statique à éditer à la main.
- Un dossier `dist/` local (gitignoré, `.gitignore:2`, build du 2026-08-23 08:38) existe ; il est hors périmètre mais reflète l'état actuel (8 fichiers contiennent l'ancien numéro, 30 « Roman Gomes », 31 « BENZIDANE », 0 « prestige.seller »).

---

## 1. Tableau exhaustif de chaque occurrence

Légende des zones : **COM** = commerciale publique (React, visible sur le site) · **ML** = mentions légales · **CGV** · **CONF** = politique de confidentialité · **COOK** = cookies · **SEO/IA** = fichiers markdown pour crawlers, `llms.txt`, meta, JSON-LD · **TECH** = config technique / build · **MAIL** = e-mail transactionnel · **ADMIN** = code / SQL admin.

Légende des recommandations : **R-NOM** = remplacer le nom personnel par « ClairDossier » · **R-TEL** = remplacer par « Service Assistance ClairDossier — 04 91 95 90 32 » · **R-DEV** = retirer le crédit développeur (non imposé par la loi) · **C-LEG** = CONSERVER (obligation légale) · **C-TECH** = CONSERVER (technique, à traiter séparément) · **ARB** = à arbitrer (voir section 5).

### 1.1 `src/data/legal.ts` (source des pages légales)

| Fichier:ligne | Texte exact (extrait) | Zone | Recommandation I.5 |
|---|---|---|---|
| `src/data/legal.ts:36` | `Le site clair-dossier.com est édité par Roman Gomes, entrepreneur individuel immatriculé au Répertoire National des Entreprises (RNE) sous le numéro SIREN 105 490 734 (SIRET siège : 105 490 734 00016), dont le siège social est situé Château-Gombert, 13013 Marseille, France.` | ML — Éditeur | **C-LEG** (LCEN art. 6-III-1 : nom, prénom, domicile de la personne physique ; RCS/RNE ; adresse). Le nom « Roman Gomes » doit rester ici. Formulation possible : « …édité par ClairDossier, nom commercial de Roman Gomes, entrepreneur individuel… » (nom conservé). |
| `src/data/legal.ts:40` | `Code APE : 4791A — Vente à distance sur catalogue général.` | ML — Éditeur | **C-LEG** (pas strictement obligatoire mais usuel ; aucune donnée personnelle). |
| `src/data/legal.ts:44` | `TVA non applicable, article 293 B du Code général des impôts (régime de la franchise en base).` | ML — Éditeur | **C-LEG** — mais **incohérent** avec CGV art. 3 (`legal.ts:164` : « La TVA française à 20 % s'applique ») → voir §5.4. |
| `src/data/legal.ts:48` | `Contact : contact.clairdossier@icloud.com — WhatsApp : +33 7 82 98 36 44.` | ML — Éditeur (contact) | **R-TEL** : « Contact : contact.clairdossier@icloud.com — Service Assistance ClairDossier — 04 91 95 90 32. » L'e-mail est un moyen de contact exigé (LCEN art. 6-III-1 : « numéro de téléphone et adresse de courrier électronique ») → conserver un e-mail et un téléphone. |
| `src/data/legal.ts:52` | `Réalisation et développement du site : Nouh BENZIDANE — https://nouhbenzidane.fr.` | ML — crédit prestataire | **R-DEV / ARB** : la LCEN n'impose pas de nommer le prestataire de réalisation. Suppression possible sauf clause contractuelle de crédit avec le prestataire (non vérifiable dans le repo). |
| `src/data/legal.ts:62` | `Le directeur de la publication du site clair-dossier.com est Roman Gomes, en sa qualité d'éditeur du service. Toute correspondance peut lui être adressée à contact.clairdossier@icloud.com.` | ML — Directeur de publication | **C-LEG** (LCEN art. 6-III-1-c : nom du directeur de la publication — personne physique). |
| `src/data/legal.ts:72` | `Le site clair-dossier.com est hébergé sur l'infrastructure GitHub Pages, opérée par GitHub Inc. (88 Colin P Kelly Jr St, San Francisco, CA 94107, États-Unis).` | ML — Hébergement | **C-LEG** (hébergeur obligatoire) — exactitude à vérifier, voir §5.1. |
| `src/data/legal.ts:76` | `Les données client du service ClairDossier — dossiers, pièces, échanges — sont hébergées chez un sous-traitant technique conforme au RGPD…` | ML — Hébergement | **C-LEG / ARB** : hébergeur des données non nommé (Supabase en réalité, cf. §5.1). |
| `src/data/legal.ts:86`, `:90`, `:100`, `:104` | « …propriété exclusive de la société ClairDossier… », « ClairDossier ne saurait être tenue responsable… » | ML — PI / responsabilité | Rien à remplacer (déjà « ClairDossier »). Remarque §5.5 : « société ClairDossier » alors que l'éditeur est un EI. |
| `src/data/legal.ts:114` | `Pour toute question relative aux présentes mentions légales : contact.clairdossier@icloud.com. …` | ML — Contact | **C-LEG** (e-mail de contact). |
| `src/data/legal.ts:136` | `…conditions dans lesquelles Roman Gomes, entrepreneur individuel (SIREN 105 490 734), ci-après « ClairDossier » ou « l'Éditeur », fournit au client…` | CGV art. 1 | **C-LEG** (identification du vendeur/prestataire dans les CGV : C. conso L. 221-5 / R. 221-2 pour les consommateurs ; C. com. L. 441-1). Le nom personnel est ici l'identité juridique du cocontractant. |
| `src/data/legal.ts:164` | `…La TVA française à 20 % s'applique aux clients établis en France…` | CGV art. 3 | Pas d'identité, mais **incohérence** avec `legal.ts:44` (franchise en base) → §5.4. |
| `src/data/legal.ts:168` | `…Les paiements sont opérés via le prestataire Stripe (Stripe Payments Europe Ltd., Irlande).` | CGV art. 3 | Sous-traitant cité — conserver. |
| `src/data/legal.ts:178` | `…la demande est adressée via l'espace client ou par e-mail à contact.clairdossier@icloud.com…` | CGV art. 4 | **C-LEG** (canal de résiliation). |
| `src/data/legal.ts:182` | `…Une copie lui est transmise sur demande adressée à contact.clairdossier@icloud.com…` | CGV art. 4 | Conserver (e-mail). |
| `src/data/legal.ts:216` | `…Data Processing Agreement) est disponible sur simple demande à contact.clairdossier@icloud.com…` | CGV art. 7 | Conserver (e-mail). |
| `src/data/legal.ts:240` | `…porté devant les tribunaux compétents de Paris…` | CGV art. 9 | Pas d'identité ; remarque §5.6 (siège à Marseille, tribunaux de Paris). |
| `src/data/legal.ts:262` | `Le responsable du traitement des données personnelles collectées sur clair-dossier.com est Roman Gomes, entrepreneur individuel, SIREN 105 490 734, dont le siège est situé Château-Gombert, 13013 Marseille. Pour toute question … : contact.clairdossier@icloud.com.` | CONF — Responsable du traitement | **C-LEG** (RGPD art. 13.1.a : identité et coordonnées du responsable du traitement). |
| `src/data/legal.ts:322` | `Notre hébergeur, sous-traitant technique conforme au RGPD…` | CONF — Destinataires | Sous-traitant non nommé → §5.1. |
| `src/data/legal.ts:323` | `Stripe Payments Europe Ltd. (gestion des paiements) — Irlande.` | CONF — Destinataires | Conserver. |
| `src/data/legal.ts:325` | `Les éventuels sous-traitants techniques (mail transactionnel) listés dans le registre des sous-traitants, fourni sur demande.` | CONF — Destinataires | Resend non nommé → §5.1. |
| `src/data/legal.ts:370` | `Pour exercer ces droits, contactez-nous à contact.clairdossier@icloud.com …` | CONF — Droits | **C-LEG** (RGPD art. 13.1.a/b coordonnées). |
| `src/data/legal.ts:380` | `…L'accès aux données côté support est strictement limité à un administrateur habilité.` | CONF — Sécurité | Pas d'identité ; cohérent avec le SQL admin (§1.9). |
| `src/data/legal.ts:387-458` | Page cookies | COOK | **Aucune** occurrence de nom, téléphone ou e-mail. |

### 1.2 `src/pages/LegalPage.tsx`

| Fichier:ligne | Texte exact | Zone | Recommandation |
|---|---|---|---|
| `src/pages/LegalPage.tsx:134` | `href="mailto:contact.clairdossier@icloud.com"` | ML/CGV/CONF/COOK (bloc « Documents associés » commun) | Conserver (e-mail de contact). |
| `src/pages/LegalPage.tsx:137` | `contact.clairdossier@icloud.com` (texte du lien) | idem | Conserver. |

Aucun nom personnel ni téléphone en dur dans ce composant ; tout le contenu vient de `legal.ts`.

### 1.3 Copies markdown générées des 4 pages légales (`public/*.md`)

Ces fichiers sont régénérés par `scripts/gen-markdown.ts:473-508` (`generateLegal`) + `footer()` (`:40-49`). Les corrections se font dans `legal.ts` et `gen-markdown.ts:45`.

| Fichier:ligne | Texte exact (extrait) | Zone | Recommandation |
|---|---|---|---|
| `public/mentions-legales.md:16` | `…édité par Roman Gomes, entrepreneur individuel … SIREN 105 490 734 (SIRET siège : 105 490 734 00016) … Château-Gombert, 13013 Marseille, France.` | ML (copie SEO/IA) | **C-LEG** (miroir de `legal.ts:36`). |
| `public/mentions-legales.md:22` | `Contact : contact.clairdossier@icloud.com — WhatsApp : +33 7 82 98 36 44.` | ML (copie) | **R-TEL** (miroir de `legal.ts:48`). |
| `public/mentions-legales.md:24` | `Réalisation et développement du site : Nouh BENZIDANE — https://nouhbenzidane.fr.` | ML (copie) | **R-DEV / ARB** (miroir de `legal.ts:52`). |
| `public/mentions-legales.md:28` | `Le directeur de la publication … est Roman Gomes … contact.clairdossier@icloud.com.` | ML (copie) | **C-LEG**. |
| `public/mentions-legales.md:32` | `…hébergé sur l'infrastructure GitHub Pages, opérée par GitHub Inc. …` | ML (copie) | **C-LEG** (vérifier exactitude §5.1). |
| `public/mentions-legales.md:50` | `…contact.clairdossier@icloud.com…` | ML (copie) | Conserver. |
| `public/mentions-legales.md:55` | `*Source : https://www.clair-dossier.com/mentions-legales — éditeur : Roman Gomes (SIREN 105 490 734, Château-Gombert, 13013 Marseille). Site réalisé par Nouh BENZIDANE.*` | SEO/IA (footer générique) | **R-NOM + R-DEV** (via `gen-markdown.ts:45`). |
| `public/cgv.md:16` | `…Roman Gomes, entrepreneur individuel (SIREN 105 490 734), ci-après « ClairDossier »…` | CGV (copie) | **C-LEG**. |
| `public/cgv.md:34`, `:36`, `:50` | `contact.clairdossier@icloud.com` | CGV (copie) | Conserver. |
| `public/cgv.md:65` | footer `éditeur : Roman Gomes (…). Site réalisé par Nouh BENZIDANE.` | SEO/IA | **R-NOM + R-DEV**. |
| `public/politique-confidentialite.md:16` | `…responsable du traitement … est Roman Gomes, entrepreneur individuel, SIREN 105 490 734, … Château-Gombert, 13013 Marseille. … contact.clairdossier@icloud.com.` | CONF (copie) | **C-LEG**. |
| `public/politique-confidentialite.md:68` | `…contact.clairdossier@icloud.com…` | CONF (copie) | Conserver. |
| `public/politique-confidentialite.md:77` | footer `éditeur : Roman Gomes (…). Site réalisé par Nouh BENZIDANE.` | SEO/IA | **R-NOM + R-DEV**. |
| `public/cookies.md:44` | footer `éditeur : Roman Gomes (…). Site réalisé par Nouh BENZIDANE.` | SEO/IA | **R-NOM + R-DEV**. (Seule occurrence dans cette page.) |

### 1.4 Zones commerciales publiques (React)

| Fichier:ligne | Texte exact | Zone | Recommandation |
|---|---|---|---|
| `src/components/Footer.tsx:46` | `© 2026 ClairDossier · Édité par Roman Gomes · SIREN 105 490 734` | COM — pied de page de **toutes** les pages | **R-NOM** : ex. `© 2026 ClairDossier · SIREN 105 490 734` (le SIREN n'est pas obligatoire en pied de page dès lors que les mentions légales sont accessibles — lien `Footer.tsx:19`). |
| `src/components/Footer.tsx:49` | `Hébergeur conforme RGPD · Pièces chiffrées au repos ·` | COM | Pas d'identité ; rien à changer. |
| `src/pages/Contact.tsx:61` | `Une réponse sur WhatsApp, dans l'heure.` (H1) | COM — /contact | **ARB** : toute la page repose sur WhatsApp (§5.2). |
| `src/pages/Contact.tsx:70` | `href={buildWhatsAppUrl('Bonjour ClairDossier, j\'aimerais vous poser une question.')}` | COM — /contact (lien `wa.me`) | **R-TEL** via `whatsapp.ts` + **ARB** (§5.2). |
| `src/pages/Contact.tsx:80` | `WhatsApp` (libellé de la carte) | COM | **ARB** → « Service Assistance ClairDossier ». |
| `src/pages/Contact.tsx:83` | `{WHATSAPP_DISPLAY}` → affiche `+33 7 82 98 36 44` | COM — /contact | **R-TEL** (source `whatsapp.ts:6`). |
| `src/pages/Contact.tsx:86` | `Réponse en moyenne sous 1 h en journée (9 h – 19 h, lundi-vendredi).` | COM | Horaires à confirmer pour le nouveau service. |
| `src/pages/Contact.tsx:98-99` | `value="contact.clairdossier@icloud.com"` / `href="mailto:contact.clairdossier@icloud.com"` | COM — /contact | Conserver (e-mail). |
| `src/pages/Contact.tsx:104` | `value="Château-Gombert, 13013 Marseille"` (libellé « Siège ») | COM — /contact | **ARB** : adresse du siège d'un EI (= potentiellement domicile) affichée en zone commerciale ; peut être réduite à « Marseille, France — voir mentions légales ». Non visée explicitement par I.5. |
| `src/pages/Contact.tsx:120-121`, `:176`, `:185`, `:188` | « Continuer sur WhatsApp », « Le message sera envoyé via WhatsApp », « On vous recontacte sur le numéro WhatsApp depuis lequel vous écrivez. » | COM — formulaire | **ARB** (§5.2). |
| `src/pages/Pricing.tsx:276-278` | `href={buildWhatsAppUrl("Bonjour ClairDossier, je souhaite un devis sur-mesure …")}` | COM — /tarifs (bloc devis) | **R-TEL** via `whatsapp.ts` + **ARB**. |
| `src/pages/Pricing.tsx:289` | `WhatsApp · réponse sous 1 h` | COM | **ARB**. |
| `src/pages/Pricing.tsx:291` | `{WHATSAPP_DISPLAY}` → `+33 7 82 98 36 44` | COM — /tarifs | **R-TEL**. |
| `src/pages/Pricing.tsx:304` | `href="mailto:contact.clairdossier@icloud.com?subject=Demande%20de%20devis%20sur-mesure&body=…"` | COM | Conserver (e-mail). |
| `src/pages/Pricing.tsx:327` | `contact.clairdossier@icloud.com` | COM | Conserver. |
| `src/pages/Pricing.tsx:416` | `Notre équipe répond aux questions tarifs sous 1 h en journée via WhatsApp.` | COM | **ARB**. |
| `src/pages/Security.tsx:316`, `:319` | `href="mailto:contact.clairdossier@icloud.com"` / `contact.clairdossier@icloud.com` (divulgation responsable) | COM — /securite | Conserver. |
| `src/pages/DossierFlow.tsx:39` | `const TEAM_EMAIL = "contact.clairdossier@icloud.com";` (utilisé `:389` pour le `mailto:` de transmission d'un dossier) | COM/app — /dossier/nouveau | Conserver (e-mail de réception des dossiers) — **ARB** si changement d'adresse. |
| `src/pages/DossierFlow.tsx:385-386` | `if (method === "whatsapp") { openWhatsApp(synthesis); }` | COM/app | **R-TEL** via `whatsapp.ts` + **ARB** (§5.2). |
| `src/components/Logo.tsx:14`, `:19` | `CD` / `ClairDossier` | COM | Rien à changer. |
| `src/data/authors.ts:12-13` | `name: 'Rédaction ClairDossier', role: 'Cellule éditoriale'` | COM — journal | Rien à changer : aucun nom personnel. |

Les autres occurrences du mot « WhatsApp » dans `src/data/features.ts`, `faq.ts`, `pricing.ts`, `workspaces.ts`, `statuses.ts`, `legal.ts:136/206/294/324`, `components/sections/*.tsx`, `pages/FeaturesIndex.tsx:21`, `pages/Security.tsx:68/71` décrivent la **fonctionnalité produit** « transmission par e-mail ou WhatsApp » (par le client vers son destinataire), pas le canal de contact de ClairDossier. Elles ne contiennent ni numéro ni nom : **hors périmètre I.5** (liste exhaustive obtenue par grep, 38 lignes, non reproduite).

### 1.5 Source unique du numéro : `src/lib/whatsapp.ts`

| Fichier:ligne | Texte exact | Zone | Recommandation |
|---|---|---|---|
| `src/lib/whatsapp.ts:3` | `* Numéro au format international sans + ni espaces (requis par wa.me).` | TECH (commentaire) | Mettre à jour le commentaire. |
| `src/lib/whatsapp.ts:5` | `export const WHATSAPP_NUMBER = '33782983644';` | TECH — utilisé par `buildWhatsAppUrl` (`:9` → `https://wa.me/33782983644?text=…`) | **R-TEL** : `33491959032` **si et seulement si** le 04 91 95 90 32 est enregistré sur WhatsApp Business ; sinon remplacer les liens `wa.me` par `tel:+33491959032` (§5.2). |
| `src/lib/whatsapp.ts:6` | `export const WHATSAPP_DISPLAY = '+33 7 82 98 36 44';` | TECH — affiché sur /contact et /tarifs | **R-TEL** : `'Service Assistance ClairDossier — 04 91 95 90 32'` (ou constante renommée). |

Consommateurs de ce module (grep) : `src/pages/Contact.tsx:5`, `src/pages/Pricing.tsx:28`, `src/pages/DossierFlow.tsx:6`.

### 1.6 SEO / JSON-LD / meta / crawlers IA

| Fichier:ligne | Texte exact | Zone | Recommandation |
|---|---|---|---|
| `index.html:18` | `<meta name="author" content="Nouh BENZIDANE" />` | SEO | **R-NOM** → `content="ClairDossier"`. |
| `index.html:49` | `<a href="mailto:contact.clairdossier@icloud.com">contact.clairdossier@icloud.com</a>` (noscript) | COM/SEO | Conserver. |
| `src/lib/seo.tsx:85-100` | `orgSchema` : `name: 'ClairDossier'`, `contactPoint: { contactType: 'customer support', availableLanguage: ['French'], areaServed: 'FR' }` | SEO/JSON-LD Organization | Aucun nom personnel, aucun `telephone`. **Opportunité** : ajouter `telephone: '+33-4-91-95-90-32'` au `ContactPoint` une fois le numéro en service. |
| `src/lib/seo.tsx:102-113` | `websiteSchema` | SEO | Rien. |
| `src/pages/BlogPost.tsx:44-57` | `author: { '@type': 'Organization', name: author.name … }`, `publisher: { '@type': 'Organization', name: 'ClairDossier' … }` | SEO/JSON-LD BlogPosting | Rien (déjà Organization ClairDossier). |
| `src/pages/Home.tsx:15-30` | `softwareSchema` `name: "ClairDossier"` | SEO | Rien. |
| `public/llms.txt:5` | `ClairDossier édité par Roman Gomes, entrepreneur individuel (SIREN 105 490 734), Château-Gombert, 13013 Marseille, France. Site web : https://www.clair-dossier.com — contact : contact.clairdossier@icloud.com — WhatsApp : +33 7 82 98 36 44. Site réalisé par Nouh BENZIDANE (https://nouhbenzidane.fr).` | SEO/IA (fichier statique) | **R-NOM + R-TEL + R-DEV** : « ClairDossier — SIREN 105 490 734 — Marseille, France … — Service Assistance ClairDossier — 04 91 95 90 32. » (identité légale complète : renvoyer à /mentions-legales). |
| `public/llms.txt:7` | `L'éditeur peut être contacté pour toute citation…` | SEO/IA | Rien. |
| `public/llms.txt:105` | `…contact.clairdossier@icloud.com — réponse sous 24 h ouvrées.` | SEO/IA | Conserver. |
| `public/og-default.svg:24-41` | Textes : `CD`, `ClairDossier`, `LEGALTECH · CLIENTS · PME · CABINETS`, `Votre dossier juridique, clair, structuré et suivi.`, `Plateforme legaltech française · OVH France · RGPD natif`, `clair-dossier.com` | SEO (image OG) | **Aucun** nom, téléphone ou e-mail. Attention : « OVH France » (l. 38) → §5.1. |
| `public/favicon.svg:3` | `CD` | — | Rien. |

### 1.7 Fichiers markdown générés hors pages légales (`public/`)

Toutes ces lignes sont produites par `scripts/gen-markdown.ts` ; corriger le script, puis régénérer.

| Fichier:ligne | Texte exact (extrait) | Zone | Recommandation |
|---|---|---|---|
| `public/contact.md:13` | `- **WhatsApp** : +33 7 82 98 36 44 — réponse en moyenne sous 1 h en journée (9 h – 19 h, lundi-vendredi).` | SEO/IA (COM) | **R-TEL** (source `gen-markdown.ts:456`). |
| `public/contact.md:14` | `- **Email général** : contact.clairdossier@icloud.com — réponse sous 24 h ouvrées.` | SEO/IA | Conserver (source `:457`). |
| `public/contact.md:15` | `- **Sécurité (divulgation responsable)** : contact.clairdossier@icloud.com — réponse sous 24 h.` | SEO/IA | Conserver (source `:458`). |
| `public/contact.md:20` | `Roman Gomes — entrepreneur individuel — SIREN 105 490 734 — Château-Gombert, 13013 Marseille, France.` (section « Coordonnées de l'éditeur ») | SEO/IA (COM) | **R-NOM** : « ClairDossier — SIREN 105 490 734 — Marseille, France (identité complète : /mentions-legales) » (source `:463`). |
| `public/contact.md:22` | `Site réalisé et développé par Nouh BENZIDANE — https://nouhbenzidane.fr.` | SEO/IA (COM) | **R-DEV** (source `:465`). |
| `public/contact.md:27` | footer générique | SEO/IA | **R-NOM + R-DEV** (source `:45`). |
| `public/index.md:119` et `public/page.md:119` | `- WhatsApp : +33 7 82 98 36 44 (réponse en moyenne sous 1 h en journée)` | SEO/IA (COM) | **R-TEL** (source `:129`). |
| `public/index.md:120-121` et `public/page.md:120-121` | `- Email : contact.clairdossier@icloud.com …` / `- Sécurité (divulgation responsable) : contact.clairdossier@icloud.com` | SEO/IA | Conserver (source `:130-131`). |
| `public/index.md:126` et `public/page.md:126` | footer générique | SEO/IA | **R-NOM + R-DEV**. |
| `public/tarifs.md:153` | `…Contact : contact.clairdossier@icloud.com ou WhatsApp +33 7 82 98 36 44.` | SEO/IA (COM) | **R-TEL** (source `:365`). |
| `public/tarifs.md:164` | footer générique | SEO/IA | **R-NOM + R-DEV**. |
| `public/securite.md:50` | `Vulnérabilités à signaler à contact.clairdossier@icloud.com…` | SEO/IA | Conserver (source `:433`). |
| `public/securite.md:55` | footer générique | SEO/IA | **R-NOM + R-DEV**. |
| `public/fonctionnalites/index.md:68`, `calendrier-relances.md:27`, `chronologie.md:29`, `coffre-fort.md:29`, `creation-guidee.md:29`, `messagerie-securisee.md:29`, `pieces-ocr.md:29`, `reponse-auto-mails.md:27`, `suivi-statuts.md:29`, `validation-avocat.md:29` | footer générique `éditeur : Roman Gomes (SIREN 105 490 734, Château-Gombert, 13013 Marseille). Site réalisé par Nouh BENZIDANE.` | SEO/IA | **R-NOM + R-DEV** (10 fichiers, 1 occurrence chacun). |
| `public/blog/index.md:72`, `chronologie-prud-homale.md:89`, `conservation-documents.md:120`, `ia-droit.md:102`, `mediation-contentieux.md:95`, `mise-en-demeure.md:113`, `preparer-rendez-vous-avocat.md:104`, `rgpd-legaltech.md:97` | footer générique (idem) | SEO/IA | **R-NOM + R-DEV** (8 fichiers, 1 occurrence chacun). |

### 1.8 Script générateur `scripts/gen-markdown.ts` (source des lignes ci-dessus)

| Fichier:ligne | Texte exact (extrait) | Zone | Recommandation |
|---|---|---|---|
| `scripts/gen-markdown.ts:45` | `` `*Source : ${SITE}${path} — éditeur : Roman Gomes (SIREN 105 490 734, Château-Gombert, 13013 Marseille). Site réalisé par Nouh BENZIDANE.*` `` | TECH (footer de 28 fichiers) | **R-NOM + R-DEV** — correction prioritaire (1 ligne → 28 fichiers). |
| `scripts/gen-markdown.ts:129` | `'- WhatsApp : +33 7 82 98 36 44 (réponse en moyenne sous 1 h en journée)'` | TECH | **R-TEL**. |
| `scripts/gen-markdown.ts:130-131` | e-mail contact / sécurité | TECH | Conserver. |
| `scripts/gen-markdown.ts:365` | `'…Contact : contact.clairdossier@icloud.com ou WhatsApp +33 7 82 98 36 44.'` | TECH | **R-TEL**. |
| `scripts/gen-markdown.ts:433` | `'Vulnérabilités à signaler à contact.clairdossier@icloud.com…'` | TECH | Conserver. |
| `scripts/gen-markdown.ts:456` | `'- **WhatsApp** : +33 7 82 98 36 44 — réponse en moyenne sous 1 h en journée (9 h – 19 h, lundi-vendredi).'` | TECH | **R-TEL**. |
| `scripts/gen-markdown.ts:457-458` | e-mails | TECH | Conserver. |
| `scripts/gen-markdown.ts:463` | `'Roman Gomes — entrepreneur individuel — SIREN 105 490 734 — Château-Gombert, 13013 Marseille, France.'` | TECH | **R-NOM**. |
| `scripts/gen-markdown.ts:465` | `'Site réalisé et développé par Nouh BENZIDANE — https://nouhbenzidane.fr.'` | TECH | **R-DEV**. |

### 1.9 Back-end / e-mail transactionnel / admin (Supabase)

| Fichier:ligne | Texte exact | Zone | Recommandation |
|---|---|---|---|
| `supabase/functions/notify-lead/index.ts:7` | `const FROM = 'ClairDossier <noreply@clair-dossier.com>';` | MAIL (expéditeur) | Rien à changer (déjà « ClairDossier »). |
| `supabase/functions/notify-lead/index.ts:8` | `const TO = 'prestige.seller@icloud.com';` | MAIL (destinataire des notifications « nouveau compte / nouveau dossier ») | **C-TECH** : e-mail admin personnel, non exposé publiquement ; à traiter séparément (migration éventuelle vers une boîte de service). |
| `supabase/functions/notify-lead/index.ts:22`, `:27`, `:31`, `:46` | `'ClairDossier — nouvelle activité'`, `'ClairDossier — nouveau compte'`, `'ClairDossier — nouveau dossier'`, `Notification automatique — ClairDossier.` | MAIL | Rien. |
| `supabase/config.toml:222` | `admin_email = "noreply@clair-dossier.com"` | TECH (SMTP Resend, e-mails d'auth) | Rien à changer. |
| `supabase/config.toml:223` | `sender_name = "ClairDossier"` | TECH | Rien à changer. |
| `supabase/config.toml:102-103` | `# admin_email = "admin@email.com"` / `# sender_name = "Admin"` | TECH (commentaires template Inbucket, inactifs) | Rien. |
| `supabase/migrations/20260621144123_admin_global_access.sql:1` | `-- Admin global UNIQUE (prestige.seller@icloud.com) : lecture/téléchargement de TOUT.` | ADMIN (commentaire SQL) | **C-TECH**. |
| `supabase/migrations/20260621144123_admin_global_access.sql:21` | `select id from auth.users where email = 'prestige.seller@icloud.com'` | ADMIN (désignation de l'admin global) | **C-TECH** : lié au compte Supabase Auth ; changer l'e-mail implique une nouvelle migration + un compte utilisateur existant. |
| `supabase/migrations/20260617110728_dossier_lead_notification.sql:15-18` | URL du projet Supabase `buzgokfmxpmyceppvjpp` + clé anon | TECH | Pas d'identité ; confirme que le back-end est Supabase (§5.1). |

### 1.10 Déploiement (pour §5.1)

| Fichier:ligne | Texte exact (extrait) | Zone | Constat |
|---|---|---|---|
| `.github/workflows/deploy.yml:1`, `:3-6` | `name: Deploy to GitHub Pages` ; `# Le domaine clair-dossier.com pointe (DNS chez whois.com) vers GitHub Pages. Tant que le DNS n'est pas basculé vers Netlify, on publie le site sur Pages … (Netlify reste déployé en parallèle sur clair-dossier.netlify.app comme cible finale.)` | TECH | Front réellement servi par **GitHub Pages** (à la date du fichier), Netlify en parallèle. |
| `.github/workflows/deploy.yml:42` | `VITE_SUPABASE_URL: https://buzgokfmxpmyceppvjpp.supabase.co` | TECH | Back-end Supabase. |
| `netlify.toml:1-37` | Config Netlify (redirects SPA, CSP autorisant `buzgokfmxpmyceppvjpp.supabase.co` et `buy.stripe.com`) | TECH | Netlify + Supabase + Stripe. |
| `public/CNAME:1` | `www.clair-dossier.com` | TECH | Domaine custom GitHub Pages. |
| `supabase/config.toml:152` | `additional_redirect_urls = [… "https://clair-dossier.netlify.app" …]` | TECH | Confirme Netlify parallèle. |
| `supabase/config.toml:218` | `host = "smtp.resend.com"` | TECH | E-mails d'authentification via **Resend**. |

---

## 2. Numéros de téléphone trouvés

**Un seul numéro existe dans tout le repository**, sous 3 formats :

| Format | Valeur | Occurrences (fichier:ligne) |
|---|---|---|
| International affiché | `+33 7 82 98 36 44` | `src/lib/whatsapp.ts:6` · `src/data/legal.ts:48` · `public/mentions-legales.md:22` · `public/llms.txt:5` · `public/contact.md:13` · `public/index.md:119` · `public/page.md:119` · `public/tarifs.md:153` · `scripts/gen-markdown.ts:129` · `scripts/gen-markdown.ts:365` · `scripts/gen-markdown.ts:456` |
| Numérique `wa.me` | `33782983644` | `src/lib/whatsapp.ts:5` (→ URL `https://wa.me/33782983644?text=…` construite `:9`, utilisée par `Contact.tsx:70`, `Contact.tsx:37`, `Pricing.tsx:276`, `DossierFlow.tsx:386`) |
| Rendu dynamique `{WHATSAPP_DISPLAY}` | idem `+33 7 82 98 36 44` | `src/pages/Contact.tsx:83` · `src/pages/Pricing.tsx:291` |

**Total : 11 occurrences littérales + 1 constante numérique + 2 rendus dynamiques.** Les grep `06`, `07`, `04` isolés ne retournent que des décimales CSS/animation (`src/index.css:54`, `:297`, `Hero.tsx:33`, `:65`, `Reveal.tsx:79`) : **aucun numéro en 06 / 07 / 04 national, aucun `0033`, aucun `tel:`** dans le repo. Le nouveau numéro `04 91 95 90 32` n'apparaît nulle part aujourd'hui.

Liste à remplacer par « Service Assistance ClairDossier — 04 91 95 90 32 » : les 11 littéraux + `whatsapp.ts:5` (voir §5.2 pour la question WhatsApp vs ligne fixe). Après correction des sources, 7 des 11 littéraux (`public/*.md`) se régénèrent automatiquement via `npm run gen:md`.

---

## 3. E-mails trouvés et rôle

| E-mail | Rôle | Exposition | Occurrences | Recommandation |
|---|---|---|---|---|
| `contact.clairdossier@icloud.com` | Contact général, commercial, support, divulgation responsable, exercice des droits RGPD, résiliation, DPA, réception des dossiers transmis par e-mail (`DossierFlow.tsx:39`) | **Publique** (site, pages légales, llms.txt, .md, noscript) | **43** (grep) : `src/data/legal.ts` ×8 (`:48, :62, :114, :178, :182, :216, :262, :370`) · `src/pages/LegalPage.tsx` ×2 · `src/pages/Contact.tsx` ×2 · `src/pages/Pricing.tsx` ×2 · `src/pages/Security.tsx` ×2 · `src/pages/DossierFlow.tsx` ×1 · `index.html` ×1 (2 sur la même ligne) · `public/llms.txt` ×2 · `scripts/gen-markdown.ts` ×6 · `public/*.md` ×15 | Hors périmètre strict I.5 (pas de nom personnel). **Remarque :** domaine `icloud.com` (boîte personnelle Apple) alors que le domaine `clair-dossier.com` est déjà configuré pour l'envoi via Resend (`config.toml:215-223`). Une adresse `@clair-dossier.com` serait cohérente avec l'identité « ClairDossier » — **ARB**. |
| `prestige.seller@icloud.com` | Destinataire des notifications de lead (nouveau compte / nouveau dossier) **et** identité de l'admin global Supabase (RLS `is_admin()`) | **Non publique** (Edge Function + SQL) | 3 : `supabase/functions/notify-lead/index.ts:8` · `supabase/migrations/20260621144123_admin_global_access.sql:1` · `:21` | **C-TECH** : à traiter séparément (changement = nouvelle migration + compte Auth). |
| `noreply@clair-dossier.com` | Expéditeur des e-mails transactionnels (notification lead via Resend ; e-mails d'auth Supabase via SMTP Resend) | Reçu par les utilisateurs (expéditeur) | 2 : `supabase/functions/notify-lead/index.ts:7` · `supabase/config.toml:222` | Rien à changer (sender name déjà « ClairDossier », `config.toml:223`). |
| `vous@cabinet.fr` | Placeholder du champ e-mail du formulaire | Publique (placeholder) | 1 : `src/pages/Contact.tsx:149` | Rien. |
| `admin@email.com` | Valeur d'exemple commentée (template Supabase Inbucket) | Inactive | 1 : `supabase/config.toml:102` (commentée) | Rien. |

Aucune adresse `nouhbenzidane.fr`, `gmail`, `outlook` ou autre. L'URL `https://nouhbenzidane.fr` (site du développeur) apparaît dans `src/data/legal.ts:52`, `public/mentions-legales.md:24`, `public/contact.md:22`, `public/llms.txt:5`, `scripts/gen-markdown.ts:465`.

---

## 4. Contenu actuel des 4 pages légales (résumé factuel)

Source : `src/data/legal.ts` (copies identiques dans `public/*.md`). Date « Dernière mise à jour » commune : **2026-05-26** (`legal.ts:26, :126, :252, :392`).

### 4.1 Mentions légales (`/mentions-legales`, `legal.ts:21-119`)

| Rubrique | Contenu déclaré | Référence |
|---|---|---|
| Éditeur | Roman Gomes, entrepreneur individuel, immatriculé au RNE | `legal.ts:36` |
| SIREN / SIRET | SIREN **105 490 734** ; SIRET siège **105 490 734 00016** | `legal.ts:36` |
| Code APE | **4791A** — Vente à distance sur catalogue général | `legal.ts:40` |
| TVA | Non applicable, art. 293 B CGI (franchise en base) | `legal.ts:44` |
| Siège social | **Château-Gombert, 13013 Marseille, France** (pas de numéro ni de rue) | `legal.ts:36` |
| Directeur de la publication | Roman Gomes (éditeur) | `legal.ts:62` |
| Contact | `contact.clairdossier@icloud.com` ; WhatsApp `+33 7 82 98 36 44` | `legal.ts:48`, `:62`, `:114` |
| Réalisation du site | Nouh BENZIDANE — https://nouhbenzidane.fr | `legal.ts:52` |
| Hébergeur du site | **GitHub Pages**, GitHub Inc., 88 Colin P Kelly Jr St, San Francisco, CA 94107, États-Unis | `legal.ts:72` |
| Hébergeur des données client | « un sous-traitant technique conforme au RGPD » (non nommé), chiffrement HTTPS + au repos, stockage privé authentifié | `legal.ts:76` |
| Propriété intellectuelle | Contenus propriété de « la société ClairDossier ou de ses partenaires » | `legal.ts:86-90` |
| Responsabilité | Informations indicatives, pas de conseil juridique ; ClairDossier = outil de structuration documentaire | `legal.ts:100-104` |
| Sous-traitants cités | GitHub Inc. (explicite) ; hébergeur données (anonyme) | `legal.ts:72, :76` |

### 4.2 CGV (`/cgv`, `legal.ts:121-245`)

| Rubrique | Contenu déclaré | Référence |
|---|---|---|
| Vendeur | Roman Gomes, EI, SIREN 105 490 734, « ci-après ClairDossier ou l'Éditeur » | `legal.ts:136` |
| Objet | Accès au service : création de dossiers, dépôt de pièces, suivi, transmission e-mail/WhatsApp à l'initiative du client ; pas de conseil juridique | `legal.ts:136-140` |
| Souscription | Compte gratuit ; abonnement payant, sans engagement | `legal.ts:150-154` |
| Tarifs | Page /tarifs, euros HT, **TVA 20 %** pour clients France, autoliquidation UE | `legal.ts:164` |
| Facturation | Mensuelle d'avance, prorata ; paiement via **Stripe Payments Europe Ltd., Irlande** | `legal.ts:168` |
| Résiliation | À tout moment, via espace client ou e-mail ; remboursement prorata ; copie des données sous 30 jours | `legal.ts:178-182` |
| SLA | Moyens raisonnables, pas de disponibilité chiffrée | `legal.ts:192` |
| Traitement | Aucune lecture/extraction automatique des documents | `legal.ts:202` |
| Données | Renvoi à la politique de confidentialité ; DPA sur demande | `legal.ts:216` |
| Responsabilité | Plafonnée aux sommes des 12 derniers mois | `legal.ts:226` |
| Droit / juridiction | Droit français ; **tribunaux de Paris** | `legal.ts:240` |
| Contact | `contact.clairdossier@icloud.com` (×3) | `legal.ts:178, :182, :216` |
| Sous-traitants cités | Stripe | `legal.ts:168` |

### 4.3 Politique de confidentialité (`/politique-confidentialite`, `legal.ts:247-385`)

| Rubrique | Contenu déclaré | Référence |
|---|---|---|
| Responsable du traitement | Roman Gomes, EI, SIREN 105 490 734, Château-Gombert, 13013 Marseille ; contact `contact.clairdossier@icloud.com` | `legal.ts:262` |
| DPO | **Non mentionné** | — |
| Données collectées | Compte (nom, prénom, e-mail, mot de passe chiffré, structure) ; dossier (typologie, contexte, dates, pièces) ; paiement (Stripe) ; techniques (IP, navigateur, logs) | `legal.ts:277-280` |
| Finalités | Fournir le service, facturation, transmission à l'initiative du client, support, sécurité/fraude | `legal.ts:292-296` |
| Bases légales | Contrat (6.1.b) ; intérêt légitime (6.1.f) sécurité ; consentement (6.1.a) formulaire de contact | `legal.ts:307` |
| Destinataires / sous-traitants | Hébergeur (non nommé) ; Stripe Payments Europe Ltd. (Irlande) ; destinataires choisis par le client ; « éventuels sous-traitants techniques (mail transactionnel) » via registre sur demande ; aucune cession commerciale | `legal.ts:322-330` |
| Durées de conservation | Compte : durée du contrat + **12 mois** ; dossiers : durée du contrat puis copie sous 30 jours puis suppression/anonymisation ; facturation : **10 ans** (C. com. L. 123-22) ; logs de connexion : **12 mois** (LCEN) | `legal.ts:341-344` |
| Droits | Accès, rectification, effacement, portabilité, opposition, limitation, retrait du consentement ; réponse sous 30 jours ; réclamation CNIL | `legal.ts:360-370` |
| Sécurité | HTTPS, chiffrement au repos par l'hébergeur, stockage privé, isolation par utilisateur, accès support limité à « un administrateur habilité » | `legal.ts:380` |
| Transferts hors UE | **Non abordés** (alors que l'hébergeur déclaré du site est GitHub Inc., États-Unis) | — |

### 4.4 Cookies (`/cookies`, `legal.ts:387-458`)

| Rubrique | Contenu déclaré | Référence |
|---|---|---|
| Principe | Cookies strictement nécessaires uniquement ; aucun marketing / mesure d'audience tierce | `legal.ts:394`, `:412` |
| Cookies listés | Session (durée : session) ; préférence (thème, langue — **1 an**) ; sécurité CSRF (session) | `legal.ts:417-419` |
| Tiers | Aucun par défaut ; Stripe peut déposer ses cookies lors du paiement (`stripe.com/cookies-policy`) | `legal.ts:430` |
| Analytics | Aucun (Google Analytics, Matomo Cloud exclus) ; bannière si activation future | `legal.ts:434` |
| Gestion | Instructions Chrome / Firefox / Safari / Edge | `legal.ts:449-452` |
| Identité / contact | **Aucune** occurrence de nom, téléphone, e-mail | — |

Remarque technique : le client Supabase stocke la session sous la clé `localStorage` `clairdossier-auth` (`src/lib/supabase.ts:22`) et le brouillon de dossier sous `clairdossier_draft` (`DossierFlow.tsx:38`) ; il ne s'agit pas de cookies au sens strict, mais la page cookies ne mentionne pas le stockage local. Le « cookie de préférence (thème, langue) » et le « cookie CSRF » déclarés n'ont pas de correspondance identifiée dans le code lu (non vérifié exhaustivement — hors périmètre).

---

## 5. Points d'attention juridiques

### 5.1 Hébergeur déclaré vs hébergeurs réels

| Source | Hébergement déclaré | Référence |
|---|---|---|
| Mentions légales | Site : **GitHub Pages (GitHub Inc., San Francisco, USA)** ; données : « sous-traitant technique conforme au RGPD » non nommé | `legal.ts:72`, `:76` |
| Politique de confidentialité | « Notre hébergeur, sous-traitant technique conforme au RGPD » (non nommé) ; mail transactionnel : « éventuels sous-traitants » (non nommés) | `legal.ts:322`, `:325` |
| `public/llms.txt` | **« Hébergement : OVHcloud France (Roubaix, Strasbourg). Aucun transfert hors UE. »** | `llms.txt:66` |
| `public/securite.md` | **« Datacenters OVH France (Roubaix, Strasbourg) … Bare-metal souverain, pas de cloud public américain »**, « HDS en cours », « ISO 27001 objectif 2027 », « 2FA admin obligatoire », « RPO 15 min, RTO < 4 h » | `securite.md:3`, `:16`, `:24`, `:33`, `:45-46` (source `gen-markdown.ts:381-437`) |
| `public/og-default.svg` | « Plateforme legaltech française · **OVH France** · RGPD natif » | `og-default.svg:38` |
| `index.html` (OG description) | « Hébergement UE, RGPD natif. » | `index.html:25` |
| Blog | « Hébergement OVH France exclusif, chiffrement AES-256… » | `src/data/blog/rgpd-legaltech.ts:99` |
| Page React /securite | Formulation prudente : « hébergée chez un sous-traitant conforme au RGPD » (pas d'OVH) | `src/pages/Security.tsx:18`, `:48` |
| **Réalité technique (repo)** | Front : **GitHub Pages** (`.github/workflows/deploy.yml:1-6`, `public/CNAME`) + **Netlify** en parallèle (`netlify.toml`, `config.toml:152`). Back-end / auth / base / stockage des pièces : **Supabase** projet `buzgokfmxpmyceppvjpp` (`deploy.yml:42`, `netlify.toml:26`, migration `20260617110728:15`). E-mails : **Resend** (`config.toml:218`, `notify-lead/index.ts:49`). Paiement : **Stripe** (`netlify.toml:26`, `legal.ts:168`). | — |

Constats :
1. **OVH n'apparaît dans aucun fichier de configuration ou de déploiement.** Les affirmations « OVH France », « bare-metal souverain », « pas de cloud public américain », « aucun transfert hors UE » (`llms.txt:66`, `securite.md:24`, `og-default.svg:38`, `blog/rgpd-legaltech.ts:99`) sont **contredites** par les mentions légales elles-mêmes (GitHub Inc., USA) et par l'usage de Supabase (la région du projet Supabase n'est pas vérifiable dans le repo — je ne l'ai pas vérifiée). Risque : pratique commerciale trompeuse (C. conso L. 121-2) et incohérence RGPD (art. 13.1.f : transferts hors UE non documentés).
2. Supabase (hébergeur des données client, des pièces et de l'auth) et Resend (mail transactionnel) ne sont **nommés nulle part** dans les pages légales ; seul Stripe l'est. La LCEN exige le nom/dénomination, l'adresse et le téléphone de **l'hébergeur** ; la politique de confidentialité devrait lister les sous-traitants (ou au minimum les catégories + pays).
3. Si le DNS bascule vers Netlify (cf. commentaire `deploy.yml:4-6`), `legal.ts:72` devient faux (Netlify, Inc., San Francisco).
4. `securite.md` / `llms.txt` annoncent « HDS en cours », « ISO 27001 objectif 2027 », « audit annuel par cabinet de pentest », « 2FA obligatoire pour les admins » : `config.toml:281-289` montre la MFA TOTP **désactivée** (`enroll_enabled = false`). Non lié à I.5, mais à signaler.

### 5.2 WhatsApp vs « Service Assistance ClairDossier — 04 91 95 90 32 »

- Le canal de contact principal du site est **entièrement construit sur WhatsApp** : H1 de /contact (`Contact.tsx:61`), carte WhatsApp (`:69-93`), formulaire qui compose un message WhatsApp (`:29-37`, `:185`), bloc devis /tarifs (`Pricing.tsx:274-300`, `:416`), transmission de dossier (`DossierFlow.tsx:385-386`), description SEO de /contact (`Contact.tsx:44`, `contact.md:3`).
- Un numéro en **04** (géographique fixe) ne peut être utilisé sur `wa.me` que s'il est enregistré sur **WhatsApp Business** (possible pour un fixe, mais à vérifier). Sinon, les liens `https://wa.me/…` (`whatsapp.ts:9`) doivent devenir des liens `tel:` et tout le wording « WhatsApp » des zones de contact doit être réécrit (liste §1.4).
- Décision à prendre avant I.5 : (a) 04 91 95 90 32 enregistré sur WhatsApp Business → seul `whatsapp.ts:5-6` + libellés changent ; (b) ligne vocale seule → refonte du parcours de contact et de la promesse « réponse sous 1 h » (`Contact.tsx:86`, `Pricing.tsx:289`, `:416`, `contact.md:13`).
- Les mentions d'horaires « 9 h – 19 h, lundi-vendredi » (`Contact.tsx:86`, `gen-markdown.ts:456`) doivent correspondre au nouveau service.

### 5.3 Cohérence des identités entre pages

| Donnée | Mentions légales | CGV | Confidentialité | Footer | /contact (React) | contact.md | llms.txt | Footer .md générique |
|---|---|---|---|---|---|---|---|---|
| Nom éditeur | Roman Gomes | Roman Gomes | Roman Gomes | Roman Gomes | — (adresse seulement) | Roman Gomes | Roman Gomes | Roman Gomes |
| SIREN | 105 490 734 + SIRET | 105 490 734 | 105 490 734 | 105 490 734 | — | 105 490 734 | 105 490 734 | 105 490 734 |
| Adresse | Château-Gombert, 13013 Marseille, France | — | Château-Gombert, 13013 Marseille | — | Château-Gombert, 13013 Marseille | Château-Gombert, 13013 Marseille, France | Château-Gombert, 13013 Marseille, France | Château-Gombert, 13013 Marseille |
| Téléphone | +33 7 82 98 36 44 | — | — | — | +33 7 82 98 36 44 | +33 7 82 98 36 44 | +33 7 82 98 36 44 | — |
| Développeur | Nouh BENZIDANE | — | — | — | — | Nouh BENZIDANE | Nouh BENZIDANE | Nouh BENZIDANE |
| Forme | « entrepreneur individuel » | « entrepreneur individuel » | « entrepreneur individuel » | — | — | « entrepreneur individuel » | « entrepreneur individuel » | — |

Les identités sont **cohérentes entre elles** (même nom, même SIREN, même adresse, même numéro) — le remplacement I.5 est donc mécanique. Incohérence de forme : `legal.ts:86` parle de « la société ClairDossier » alors que l'éditeur est un EI (pas de société) ; « ClairDossier » n'est pas présenté comme nom commercial/enseigne déclaré (à vérifier au RNE — non vérifiable dans le repo).

### 5.4 TVA : contradiction interne

- Mentions légales : « TVA non applicable, article 293 B du CGI (régime de la franchise en base) » (`legal.ts:44`).
- CGV art. 3 : « Les prix sont exprimés en euros, hors taxes. **La TVA française à 20 % s'applique** aux clients établis en France … autoliquidation » (`legal.ts:164`). `llms.txt:52` : « Tarifs (en euros HT, mensuel) ».
- Les deux ne peuvent pas être vrais simultanément. Hors périmètre I.5 mais à corriger dans la même passe sur `legal.ts`.

### 5.5 Adresse du siège = domicile probable

L'adresse « Château-Gombert, 13013 Marseille » est celle d'un entrepreneur individuel : elle est obligatoire dans les mentions légales (LCEN) et dans la politique de confidentialité (RGPD art. 13), mais **pas** en zone commerciale (`Contact.tsx:104`, `contact.md:20`, `llms.txt:5`, footer des 28 `.md`). I.5 ne la vise pas explicitement ; recommandation : ne la laisser que dans les pages légales (**ARB**). Note : la LCEN permet aux personnes physiques éditant à titre non professionnel de ne pas publier leur identité, mais ce n'est pas le cas ici (activité commerciale, SIREN).

### 5.6 Autres points relevés

- Juridiction : « tribunaux compétents de Paris » (`legal.ts:240`) alors que le siège est à Marseille ; pour les consommateurs, la clause attributive est de toute façon réputée non écrite (C. conso R. 212-2-10°). À revoir hors I.5.
- Délai de réponse RGPD « 30 jours maximum » (`legal.ts:370`) : le RGPD prévoit 1 mois prorogeable de 2 mois (art. 12.3) — formulation acceptable.
- Pas de mention du **DPO** ni de l'absence de DPO ; pas de section « transferts hors UE » malgré GitHub Inc. (USA).
- `index.html:18` `meta author = "Nouh BENZIDANE"` : crédite le développeur comme auteur du site entier sur chaque page indexée — à remplacer par « ClairDossier » (I.5).
- Le crédit développeur (`legal.ts:52`, `contact.md:22`, `llms.txt:5`, footer des 28 `.md`) n'est pas une obligation légale ; sa suppression dépend d'un éventuel engagement contractuel avec le prestataire (non documenté dans le repo).
- `DossierFlow.tsx:389` : la transmission « par e-mail » d'un dossier ouvre un `mailto:` vers `contact.clairdossier@icloud.com` — les dossiers clients (potentiellement sensibles) arrivent donc sur une boîte iCloud personnelle ; à considérer lors du passage à une adresse `@clair-dossier.com`.
- `notify-lead/index.ts:16-19` : la fonction est conçue pour ne pas inclure de données nominatives dans les notifications (minimisation) — cohérent avec `legal.ts:380`.
- `config.toml:152` liste `http://localhost:5173` et `http://127.0.0.1:5173` comme redirect URLs autorisées en production — point sécurité mineur, hors périmètre.

---

## 6. Termes recherchés sans aucune occurrence

| Terme | Résultat |
|---|---|
| `Cottant` | 0 |
| `13'UP`, `13UP`, `13 UP` | 0 |
| `Dalbret` | 0 |
| `Roman` hors « Roman Gomes » | 0 (toutes les 30 occurrences sont « Roman Gomes ») |
| `Gomes` hors « Roman Gomes » | 0 |
| `Benzidane` (casse mixte) / `benzidane` | 0 hors l'URL `nouhbenzidane.fr` ; la forme utilisée est toujours `Nouh BENZIDANE` (majuscules) |
| Numéros en `06 …`, `04 …`, `0033…`, liens `tel:` | 0 |
| `04 91 95 90 32` (nouveau numéro) | 0 |
| `PLAN.md` : Roman / Gomes / Benzidane / icloud / +33 / SIREN / Marseille / OVH / GitHub / Netlify / Supabase / Resend | 0 |
| `README.md` : identités / téléphones | 0 |

---

## 7. Synthèse chiffrée pour la règle I.5

| Catégorie | Fichiers source à éditer (git-tracked) | Fichiers régénérés automatiquement |
|---|---|---|
| Nom personnel « Roman Gomes » à remplacer (zones commerciales / SEO) | `src/components/Footer.tsx:46` · `public/llms.txt:5` · `scripts/gen-markdown.ts:45` · `scripts/gen-markdown.ts:463` | 28 fichiers `public/**/*.md` (footer) + `public/contact.md:20` |
| Nom personnel à **conserver** (obligation légale) | `src/data/legal.ts:36` (éditeur) · `:62` (directeur de publication) · `:136` (CGV cocontractant) · `:262` (responsable du traitement) | `public/mentions-legales.md:16, :28` · `public/cgv.md:16` · `public/politique-confidentialite.md:16` |
| Crédit développeur « Nouh BENZIDANE » (non imposé par la loi) | `index.html:18` · `src/data/legal.ts:52` · `public/llms.txt:5` · `scripts/gen-markdown.ts:45` · `:465` | `public/mentions-legales.md:24` · `public/contact.md:22` · footer des 28 `.md` |
| Téléphone `+33 7 82 98 36 44` / `33782983644` → « Service Assistance ClairDossier — 04 91 95 90 32 » | `src/lib/whatsapp.ts:5-6` · `src/data/legal.ts:48` · `public/llms.txt:5` · `scripts/gen-markdown.ts:129, :365, :456` | `public/mentions-legales.md:22` · `public/contact.md:13` · `public/index.md:119` · `public/page.md:119` · `public/tarifs.md:153` ; rendus `Contact.tsx:83`, `Pricing.tsx:291` |
| E-mail admin technique (hors I.5) | `supabase/functions/notify-lead/index.ts:8` · `supabase/migrations/20260621144123_admin_global_access.sql:1, :21` | — |
| Décisions préalables nécessaires | WhatsApp Business sur le 04 ou non (§5.2) · conservation ou non du crédit développeur (§5.6) · adresse du siège hors pages légales (§5.5) · hébergeur réel à déclarer (§5.1) · TVA (§5.4) | — |

Ordre d'exécution recommandé pour I.5 (quand la phase d'écriture sera autorisée) : 1) `src/lib/whatsapp.ts` ; 2) `src/data/legal.ts` (l. 48, 52 ; garder 36, 62, 136, 262) ; 3) `src/components/Footer.tsx:46` ; 4) `index.html:18` ; 5) `scripts/gen-markdown.ts` (l. 45, 129, 365, 456, 463, 465) ; 6) `public/llms.txt:5` ; 7) `npm run gen:md` pour régénérer les 28 `.md` ; 8) vérification par grep que `33782983644`, `+33 7 82`, `BENZIDANE` n'apparaissent plus hors pages légales, et que « Roman Gomes » ne subsiste que dans `legal.ts:36, :62, :136, :262` et leurs copies `.md`.
