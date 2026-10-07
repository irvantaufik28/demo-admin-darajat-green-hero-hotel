<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Folder structure rules

This project uses a **feature-based architecture**. All domain code lives under `features/<feature>/`, and the Next.js App Router (`app/`) only wires routes to feature code.

## Per-feature layout

Each feature follows this structure. Folders are created only when needed (a feature without hooks has no `hooks/`):

```
features/<feature>/
├── pages/        → page-level components, one per route (files end with `Page`, e.g. `ReservationsListPage.tsx`)
├── components/   → feature-local UI building blocks (forms, modals, cells, etc.)
├── services/     → API calls / data access
├── constants/    → static data, seed/mock data, configuration
├── styles/       → feature CSS (e.g. `reservations.css`)
├── utils/        → feature-local helper functions (optional)
└── hooks/        → feature-local React hooks (optional)
```

## Rules

1. **Page components live in `pages/`, not `components/`.** Any component whose name ends with `Page` (e.g. `CampaignsPage.tsx`) must sit in `features/<feature>/pages/`. `pages/` is a sibling of `components/`, not nested inside it.

2. **`components/` holds everything else** — the smaller building blocks that pages compose (forms, modals, field controls, table cells, …).

3. **Routing stays thin.** Files in `app/**/page.tsx` should only import a page component from a feature and render it. Example:
   ```tsx
   import { CampaignsPage } from "../../features/campaigns/pages/CampaignsPage";
   export default function Page() {
     return <CampaignsPage />;
   }
   ```

4. **Import depth from `pages/`.** Because `pages/` is one level deep inside the feature (same depth as `components/`), relative imports from a page component are:
   - sibling building block in `components/`: `../components/<Name>`
   - same-feature `services`/`constants`/`utils`/`hooks`: `../services/...`, `../constants/...`
   - shared/global code: `../../../components/...`, `../../../lib/...`
   - another feature: `../../<other-feature>/...`

## Styling rules

CSS is split per feature instead of living entirely in `app/globals.css`.

- **`app/globals.css`** (imported once in `app/layout.tsx`) keeps only truly global styles: CSS variables (`:root`), resets, auth/login screens, the shared admin shell (sidebar/navbar/`admin-main`), and the shared loading-skeleton state.
- **Feature-specific CSS** lives in `features/<feature>/styles/<feature>.css` and is imported from the feature's page component(s), right after the `"use client";` directive:
  ```tsx
  "use client";
  import "../styles/campaigns.css";
  ```
  For a feature with multiple pages that share the same stylesheet (e.g. `reservations`), import the stylesheet in **every** page of that feature so the styles load regardless of entry point.
- One-off stylesheets scoped to a single component may live next to that component (e.g. `features/reservations/components/room-rack.css`).

## Formatting

Format CSS (and other files) with Prettier before committing:

```bash
npx prettier --write "<path>"
```
