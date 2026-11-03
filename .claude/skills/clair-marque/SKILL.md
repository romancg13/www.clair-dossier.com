---
name: clair-marque
description: À utiliser dès qu'un élément visuel, rédactionnel ou d'interface ClairDossier est produit ou modifié — page ou composant du site, PDF, visuel social, slide, e-mail, maquette, illustration, nouvelle section, choix de couleur ou de typographie. Fournit la palette exacte, les typographies, les règles de composition et le ton éditorial de ClairDossier, pour que toute nouvelle production semble appartenir naturellement à la marque. S'applique aussi quand l'utilisateur parle de design, de charte, d'identité visuelle, de « premium », ou demande un rendu « dans le style du site ».
---

# clair-marque — identité ClairDossier

Source de vérité : `src/index.css` (bloc `@theme`) du dépôt `www.clair-dossier.com`.
En cas d'écart entre ce document et le code, **le code gagne** et ce document doit
être corrigé.

## Palette — valeurs exactes

```
--color-navy-900  #0d1b3d   texte fort, sections sombres, fond dominant
--color-navy-800  #152348   cards sombres, hover navy
--color-navy-700  #1e2c52   séparateurs
--color-navy-600  #2a3960   nuance profonde

--color-gold-500  #c4a456   CTA, accents
--color-gold-400  #e6c97d   hover or, highlights doux
--color-gold-300  #f0d99a   halo, dégradés discrets
--color-gold-700  #7a5f28   OR EN TEXTE sur fond clair uniquement (AA, 5.3:1 sur cream-50)

--color-cream-50  #fbf9f4   fond principal
--color-cream-100 #f5f0e6   cards alternées
--color-cream-200 #ebe2cf   bordures douces

--color-ink       #0a1228   texte ultra-fort, h1
--color-slate-500 #5a6378   texte secondaire
--color-slate-400 #7c8497   texte tertiaire
--color-slate-300 #a3aab9   texte désactivé

--color-sky-marker      rgba(179,210,239,0.6)   surligneur animé
--color-sky-marker-deep rgba(150,190,230,0.8)
```

Règles d'usage :
- **L'or occupe 5 à 8 % de la surface visible, jamais plus.** C'est l'accent, pas le fond.
- L'or `#c4a456` ne passe pas AA en texte sur fond clair : utiliser `gold-700` pour
  du texte or sur cream, `gold-400` pour du texte or sur navy.
- Hairlines : `rgba(13,27,61,0.08)` — classe `.hairline`. Version or :
  `rgba(196,164,86,0.35)` — classe `.hairline-gold`.
- Jamais de gris pur ni de noir pur : `ink` et la famille `slate` uniquement.

## Typographies

| Rôle | Police | Où |
|---|---|---|
| Titres, citations | **Cormorant Garamond** (`--font-display`) | h1, h2, citations éditoriales, drop caps |
| Texte courant, UI | **Inter** (`--font-sans`) | paragraphes, boutons, formulaires |
| Surtitres, références, statuts | **JetBrains Mono** (`--font-mono`) | eyebrows, `#CD-2026-0421`, libellés techniques |

Auto-hébergées via `@fontsource` — aucun appel à Google Fonts, pour la CSP et la performance.

## Signatures visuelles à préserver

Ces détails font l'identité. Ne pas les remplacer par des équivalents génériques.

1. **Marker sky animé** (`clip-path` / `scaleX`) sur les mots-clés du h1 — pas un gras, pas un souligné.
2. **Sheen** sur les CTA primaires or : balayage en gradient 600 ms au hover (`.sheen`).
3. **Pills** cream, texte navy, bordure or 1px très faible opacité — pas le pill SaaS blanc-gris.
4. **Timeline de statuts** en SVG `pathLength` liée au scroll.
5. **Drop cap Cormorant** et citations pleine largeur en italique sur les articles.
6. **Mockups en JSX/SVG custom** — jamais de capture d'écran photographique.
7. **Hairlines** plutôt que bordures franches ; ombres larges et très diffuses
   (`--shadow-card` : `0 2px 24px rgba(13,27,61,0.06)`).

Easings maison : `--ease-out-expo` `cubic-bezier(0.16,1,0.3,1)`,
`--ease-out-soft` `cubic-bezier(0.22,1,0.36,1)`.

## Animation

- Toute animation dégrade proprement sous `prefers-reduced-motion`.
- Reveal au scroll : `y: 18px → 0`, opacité, `once: true`, ~0.65 s.
- Pas d'animation qui bloque la lecture, ni de mouvement permanent en arrière-plan
  du texte principal.

## Ton éditorial

Le lecteur cible est un artisan, un indépendant, une profession libérale ou un
dirigeant de TPE/PME. Il lit vite et se méfie du marketing.

À faire :
- Phrases courtes, affirmatives, concrètes.
- Nommer le problème vécu avant de nommer la solution.
- Chiffrer uniquement ce qui est vrai et vérifiable.
- Vouvoiement, présent de l'indicatif.

À ne jamais faire :
- **Aucun emoji dans le copy public.**
- Aucune formule générique : « solution tout-en-un », « boostez votre productivité »,
  « révolutionner », « game changer ».
- Aucune statistique fabriquée. Pas de chiffre plutôt qu'un chiffre inventé.
- Aucune promesse de résultat juridique ou de position dans les moteurs de recherche.

## Éléments verrouillés

- **H1 de la page d'accueil** (valeur en production) :
  « Votre dossier administratif et juridique, clair, structuré et suivi. »
  Ne pas le réécrire sans demande explicite.
- **Logo** : carré navy, monogramme « CD » or, coins arrondis.
- **Éditeur** : Roman Gomes, entrepreneur individuel, SIREN 105 490 734,
  Château-Gombert, 13013 Marseille. Contact : contact.clairdossier@icloud.com.

## Typographie française

Espaces insécables avant `: ; ! ?` et à l'intérieur des guillemets français
« … ». Tirets cadratins pour les incises. Pas de majuscules décoratives.

## À vérifier avant réutilisation

La signature « L'IA organise. Vous décidez. » circule dans les documents de travail
mais **n'apparaît nulle part dans le code du site à ce jour**. Ne pas la présenter
comme la baseline officielle sans confirmation de Roman.

Détail complémentaire : `references/tokens.md`.
