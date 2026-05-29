# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # start dev server (Vite)
npm run build      # production build
npm run lint       # ESLint (zero warnings policy)
npm run preview    # preview production build locally
```

No test suite is configured. There is no `npm test`.

## Environment

Copy `.env.example` to `.env` and fill in:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Architecture

**React 18 + Vite SPA** with Supabase as the sole backend (auth + database). No API layer — all data access goes directly through `@supabase/supabase-js` from the client.

### Data flow

Every feature follows the same pattern:
1. Page component calls a custom hook (e.g., `useCycles`, `useEvaluations`) or queries Supabase directly
2. Hook/page manages its own loading/error state
3. UI renders from that local state

The custom hooks in `src/hooks/` are the intended abstraction for Supabase queries, but `useCycles.js` and `useEvaluations.js` are currently **empty stubs** — their logic lives inline in the page components for now.

### Auth

`AuthContext` wraps the entire app and exposes `{ user, loading, signIn, signOut }`. Use `useAuth()` (from `src/hooks/useAuth.js`) to access it. `ProtectedRoute` in `App.jsx` redirects to `/login` if unauthenticated.

### Database schema

All tables are prefixed `pf_`. Core relationships:
- `pf_departments` → `pf_teams` (one-to-many)
- `pf_employees` → department, team, and `manager_id` (self-referencing FK)
- `pf_evaluation_cycles` → `pf_evaluations` (one cycle, many evaluations)
- `pf_evaluations` → `pf_evaluation_answers` (one evaluation, one answer per criterion)
- `pf_criteria` — configurable evaluation criteria (seeded with 8 defaults)
- `pf_settings` — key/value store for global config (e.g., `peer_evaluator_limit`)

Migrations live in `supabase/migrations/`. Run them directly in the Supabase dashboard SQL editor.

### Component organization

```
src/
  pages/          # one file per route
  components/
    layout/       # Layout, Sidebar, TopBar
    ui/           # generic primitives (Button, Modal, Table, etc.)
    employees/    # domain components for the employees feature
    cycles/       # domain components for evaluation cycles
    evaluations/  # domain components for evaluations
    settings/     # domain components for settings page
  context/        # AuthContext, ThemeContext
  hooks/          # useAuth, useCycles (stub), useEvaluations (stub)
  lib/            # supabaseClient singleton, constants
  utils/          # evaluationAlgorithm, formatters, helpers
```

### Key business logic

- **Peer evaluator selection** (`src/utils/evaluationAlgorithm.js`): randomly picks up to N peers from the same team, excluding the employee and their manager. Limit is driven by the `peer_evaluator_limit` setting in `pf_settings`.
- **Evaluation types**: `self`, `peer`, `manager` — controlled by `EVALUATION_TYPES` in `src/lib/constants.js`.
- **Cycle anonymity**: stored per-cycle in `pf_evaluation_cycles.anonymous`; the UI should respect it when displaying evaluator identity.

### Conventions

- All domain enums and labels (Portuguese UI strings) are centralized in `src/lib/constants.js` — add new ones there, never inline them.
- The app UI is in Portuguese throughout.
- Dark/light mode is managed by `ThemeContext` via a CSS class toggle; use `useTheme()` to read the current theme.

## Deploy

Vercel, triggered automatically on push to `main`.
