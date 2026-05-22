# AGENTS.md

## Cursor Cloud specific instructions

### Overview

ClairDossier is a React + Vite + TypeScript LegalTech frontend application. It uses Supabase for backend (auth, database, Edge Functions) and Stripe for payment processing. The frontend runs standalone; Supabase and Stripe are optional external services that gracefully degrade when unconfigured.

### Running the dev server

```bash
npm run dev
```

Vite serves on `http://localhost:5173` (bound to `0.0.0.0`).

### Available npm scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | TypeScript check + production build |
| `npm run typecheck` | TypeScript type checking only |
| `npm run preview` | Preview production build |

### Environment variables

Copy `.env.example` to `.env`. All `VITE_*` variables are optional for local development — the app shows fallback messages when Supabase/Stripe are not configured.

### No lint or test framework

The project currently has no ESLint configuration and no test framework. Use `npm run typecheck` as the primary code quality check.

### Supabase Edge Functions

Located in `supabase/functions/`. These use Deno and are deployed separately to Supabase. They are not part of the Vite dev server workflow.

### Key gotcha

The codebase lives on the `cursor/clairdossier-legaltech-platform-82ac` branch, not `main`. The `main` branch only has a bare README.
