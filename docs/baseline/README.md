# docs/baseline — Phase 0 (Audit & Baseline) — 2026-08-23

Référence « état avant » du site https://www.clair-dossier.com, commit `24e1e2b` (main = prod GitHub Pages).
Aucune modification du site n'a été faite en Phase 0 : seuls des fichiers nouveaux ont été ajoutés.

| Élément | Emplacement | Rôle |
|---|---|---|
| Constitution | `docs/MASTER_PROMPT.md` | Règles du projet (à lire avant toute tâche) |
| Baseline v1 | `/CLAIRDOSSIER_BASELINE.md` | Snapshot complet (III.1) |
| Inventaire des fonctionnalités | `/FEATURE_INVENTORY.md` | III.2 |
| Inventaire UI | `/DESIGN_INVENTORY.md` | III.3 |
| Matrice de non-régression | `/NON_REGRESSION_MATRIX.md` | III.4 |
| Carte Stripe / Supabase | `docs/baseline/STRIPE_SUPABASE_MAP.md` | XI.5 étape 5 |
| Rapports d'audit détaillés | `docs/baseline/audit/*.md` | 8 audits lecture seule (faits cités fichier:ligne) |
| Captures de référence | `docs/baseline/screens/` | 48 captures pleine page du site live + `index.json` |

## Captures de référence (`screens/`)

- Méthode : puppeteer-core + Google Chrome local, défilement progressif pour déclencher les animations `whileInView`, puis capture `fullPage`.
- Viewports : `<route>__desktop.jpg` = 1440 px de large ; `<route>__mobile.jpg` = 390 px (émulation mobile, ré-échantillonné depuis DPR 2).
- `index.json` : pour chaque capture — route, statut HTTP, URL finale, `<title>`, H1.
- Fait notable : toutes les routes sauf `/` répondent **HTTP 404** (fallback SPA `404.html` de GitHub Pages) tout en rendant le contenu correctement.
- Pour reproduire : voir la procédure dans `NON_REGRESSION_MATRIX.md` (section « Procédure d'exécution »).

## Règle d'usage

Après chaque phase (XI.2 Inter-Phase Gate) : `BUILD → TEST → COMPARE TO BASELINE → RUN REGRESSION → REVIEW`.
Toute fonctionnalité listée dans `FEATURE_INVENTORY.md` doit finir PASS, MIGRATED ou REPLACED WITH EQUIVALENT — jamais LOST.
