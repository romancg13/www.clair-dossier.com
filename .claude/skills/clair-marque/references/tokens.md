# Tokens ClairDossier — référence complète

Extrait du bloc `@theme` de `src/index.css`. À resynchroniser si le CSS change.

## Rayons

```
--radius-xs   0.25rem
--radius-sm   0.5rem
--radius-md   0.75rem
--radius-lg   1.125rem
--radius-xl   1.5rem
--radius-full 9999px
```

## Ombres

```
--shadow-card         0 2px 24px  rgba(13,27,61,0.06)
--shadow-card-hover   0 12px 48px rgba(13,27,61,0.10)
--shadow-gold         0 8px 24px  rgba(196,164,86,0.22)
--shadow-gold-strong  0 14px 36px rgba(196,164,86,0.32)
```

## Easings

```
--ease-out-expo  cubic-bezier(0.16, 1, 0.3, 1)
--ease-out-soft  cubic-bezier(0.22, 1, 0.36, 1)
```

## Familles de polices (avec fallbacks réels)

```
--font-display  "Cormorant Garamond", "Iowan Old Style", Georgia, serif
--font-sans     "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif
--font-mono     "JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace
```

Poids chargés : Cormorant 400/500/500-italic/600/700 · Inter 300/400/500/600 ·
JetBrains Mono 400/500. Ne pas utiliser un poids non chargé : il sera synthétisé
et le rendu se dégrade.

## Recettes de composants

**Bouton primaire (or)** — fond `gold-500`, texte `navy-900`, `.sheen`,
`--shadow-gold` au repos, `--shadow-gold-strong` au hover, rayon `md`.

**Bouton secondaire** — fond transparent, bordure `.hairline-strong`,
texte `navy-900`, fond `cream-100` au hover.

**Card claire** — fond blanc ou `cream-50`, bordure `.hairline`,
`--shadow-card`, rayon `lg`.

**Card sombre** — fond `navy-800`, bordure `rgba(196,164,86,0.18)`,
texte `cream-50`, méta en `slate-300`.

**Pill** — fond `cream-100`, texte `navy-900`, bordure or 8 % d'opacité,
rayon `full`, texte en `--font-sans` 13-14 px, tracking léger.

**Eyebrow / surtitre** — `--font-mono`, 11-12 px, `letter-spacing: 0.12em`,
majuscules, couleur `slate-500` sur clair ou `gold-400` sur navy.

## Accessibilité — contrastes à respecter

| Combinaison | Usage |
|---|---|
| `ink` sur `cream-50` | texte courant — OK |
| `slate-500` sur `cream-50` | texte secondaire — OK |
| `slate-300` sur `navy-900` | méta sur fond sombre — OK |
| `gold-700` sur `cream-50` | texte or sur clair — OK (5.3:1) |
| `gold-500` sur `cream-50` | **interdit en texte** — décoratif uniquement |
| `gold-400` sur `navy-900` | texte or sur sombre — OK |

Focus visible obligatoire : contour `navy-900` 2 px + halo `rgba(230,201,125,0.95)`.
