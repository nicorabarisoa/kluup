# Technology Stack

**Analysis Date:** 2026-06-07

## Runtime & Framework

- **Node.js** — runtime (no `.nvmrc`; `@types/node ^20` implies Node 20+)
- **Next.js** `16.2.7` — App Router, Turbopack dev server
- **React** `19.2.4` — UI rendering
- **TypeScript** `^5` — strict mode (`"strict": true` in `tsconfig.json`)

## Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `next` | `16.2.7` | Framework — App Router, SSR/SSG, file-based routing |
| `react` | `19.2.4` | UI rendering |
| `react-dom` | `19.2.4` | DOM mounting |
| `@supabase/supabase-js` | `^2.107.0` | Supabase client — Postgres queries, Realtime channels, presence |
| `modern-screenshot` | `^4.7.0` | DOM-to-image for the end-of-game share card (replaces html2canvas which distorted custom fonts) |
| `tailwindcss` | `^4` | Utility-first CSS (v4 — config-less, PostCSS plugin only) |
| `@tailwindcss/postcss` | `^4` | PostCSS integration for Tailwind v4 |
| `typescript` | `^5` | Type checking |
| `eslint` | `^9` | Linting |
| `eslint-config-next` | `16.2.7` | Next.js ESLint rules (core-web-vitals + TypeScript) |

## Build & Tooling

**Scripts** (from `package.json`):
```bash
npm run dev      # next dev (Turbopack enabled by default in Next 16)
npm run build    # next build
npm run start    # next start
npm run lint     # eslint
```

**Next.js config** (`next.config.ts`):
- Minimal config — only `allowedDevOrigins: ['192.168.1.63']` for LAN testing on a local network device.
- No custom webpack config, no image domains, no i18n config (handled manually via `lib/i18n.ts`).

**TypeScript config** (`tsconfig.json`):
- Target: `ES2017`
- Module resolution: `bundler` (Next.js bundler-aware)
- Strict mode: enabled
- Path alias: `@/*` maps to project root (`./`)
- `isolatedModules: true` (compatible with SWC/Turbopack transpilation)

**CSS tooling** (`postcss.config.mjs`):
- Tailwind v4 via `@tailwindcss/postcss` PostCSS plugin
- No separate `tailwind.config.*` file — Tailwind v4 is config-less by default

**Linting** (`eslint.config.mjs`):
- ESLint v9 flat config
- Extends `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript`
- Note: some `react-hooks/set-state-in-effect` warnings exist (non-blocking `setTimeout → setState` patterns); `next build` does not fail on ESLint errors

**Fonts** (`app/layout.tsx`):
- `Bricolage Grotesque` — display font, CSS var `--font-display-face`
- `DM Sans` — body font, CSS var `--font-body-face`
- Loaded via `next/font` (self-hosted, zero layout shift)

## Environment Variables

All required vars are `NEXT_PUBLIC_*` — they are **inlined at build time** by Next.js. Setting them after a build without rebuilding has no effect.

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL (`https://<ref>.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon/public API key |

**Local dev:** copy `.env.example` to `.env.local` and fill in values.
**Production (Railway):** set in Railway → Variables, then trigger a new deploy/build.

If either variable is missing at build time, `lib/supabase.ts` logs a loud `console.error` and every Supabase request fails with an empty-string URL.

## Deployment

- **Hosting:** Railway (production), ~10 €/month at MVP scale
- **Build command:** `next build`
- **Start command:** `next start`
- **Runtime:** Node.js 20+
- **No Docker config** detected — Railway builds directly from the repo
- **PWA / web app** — no App Store, no Capacitor; runs in any mobile browser

---

*Stack analysis: 2026-06-07*
