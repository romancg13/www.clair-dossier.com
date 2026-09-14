# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

ClairDossier is a French LegalTech SPA (React 19 + Vite 8 + TypeScript 6) with a Supabase backend (Edge Functions + PostgreSQL). See `README.md` for full stack details.

### Running locally

- **Dev server:** `npm run dev` — starts Vite on `http://localhost:5173` (binds `0.0.0.0`)
- **Type check:** `npm run typecheck`
- **Production build:** `npm run build` (runs `tsc` then `vite build`, outputs to `dist/`)
- **Preview built bundle:** `npm run preview`

### Important notes

- There is **no test framework** configured (no Vitest, Jest, Playwright, etc.). The only verification available is `npm run typecheck` and `npm run build`.
- There is **no linter** (no ESLint/Biome config). TypeScript strict mode (`tsconfig.json`) acts as the primary static check.
- The frontend works standalone without Supabase credentials. Forms will show a user-friendly error ("La connexion Supabase doit être configurée…") when `VITE_SUPABASE_URL` is empty.
- Stripe integration is optional; the UI degrades gracefully without Stripe keys.
- Node.js 22 is required (matches CI in `.github/workflows/deploy.yml`).
- The package manager is **npm** (lockfile: `package-lock.json`).

### Environment variables

Copy `.env.example` to `.env`. Frontend vars (`VITE_*`) are optional for UI-only development. Server-side vars are only needed for Supabase Edge Functions.
