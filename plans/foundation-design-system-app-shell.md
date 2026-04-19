# Plan: Foundation, Design System, App Shell

> Source PRD: `docs/prd/foundation-design-system-app-shell.md`

## Architectural decisions

Durable decisions that apply across all phases:

- **Routes**: `/` enters `/dashboard`; product shell routes are `/dashboard`, `/overview`, `/chat`, `/insights`, and `/settings`; plain routes are `/login`, `/reset-password`, and `/onboarding`.
- **Schema**: no frontend-owned database schema changes are part of this feature.
- **Key models**: frontend placeholder app state includes user, organization, location, and auth/session readiness concepts; badge components use finalized backend enum/status values for display.
- **Auth**: no auth enforcement, session refresh, login, logout, route guard, or Supabase Auth flow is implemented in this feature. Routes remain open until a later auth slice.
- **External services**: pages do not call Spring Boot, Supabase, Python forecast service, Python LLM service, Resend, or Stripe. The frontend only prepares seams for future Spring Boot and Supabase integrations.
- **Design direction**: compact clinical dashboard; deep navy primary, teal accent, green/amber/red status colors, crisp white surfaces, Geist Sans, Geist Mono.
- **Compliance**: static scaffolds must not include `patient_id` or patient-level data. Future frontend integrations must route business calls through Spring Boot, not Python services.

---

## Phase 1: Scaffold The App And Prove It Renders

**User stories**: 1, 9, 18, 20, 26, 30

### What to build

Create the frontend-only Next.js foundation at the repository root with App Router, TypeScript, Tailwind CSS, React Query provider wiring, lenient environment access, and root behavior that sends users to the dashboard. Add the first behavior-level test proving the app surface renders without real API credentials, real Supabase auth, or backend calls.

### Acceptance criteria

- [ ] The application can be installed and started from the repository root.
- [ ] The root route leads to `/dashboard`.
- [ ] The provider tree renders children without real environment variables.
- [ ] No route performs a real API call.
- [ ] A behavior-level test proves the initial app route surface renders.

---

## Phase 2: Establish Theme And UI Primitives

**User stories**: 13, 14, 15, 16, 17, 24, 29

### What to build

Add the PharmaForecast design system foundation: clinical color tokens, global CSS variables, Tailwind theme mapping, Geist fonts, shadcn/ui configuration, and reusable UI primitives. Include enum-backed badges for backend status and forecast confidence display.

### Acceptance criteria

- [ ] The theme exposes navy, teal, green, amber, red, text, muted text, surface, and border tokens.
- [ ] shadcn/ui is configured with the `new-york` style, neutral base, CSS variables, lucide icons, and project paths.
- [ ] Shared components exist for status badges, confidence badges, loading, empty states, stat cards, section cards, page headers, and table toolbars.
- [ ] Badge components accept the finalized backend status/confidence values.
- [ ] Tests verify supported badge values render in user-readable form.
- [ ] Static UI content avoids patient-level data.

---

## Phase 3: Build The Responsive App Shell

**User stories**: 2, 3, 4, 5, 6, 7, 8

### What to build

Create the product shell used by dashboard, overview, chat, insights, and settings. The shell should provide a professional desktop sidebar, mobile navigation, active route state, top-bar placeholders for organization and location, notification placeholder, and avatar/logout placeholder.

### Acceptance criteria

- [ ] Product routes render inside the app shell.
- [ ] Desktop navigation includes dashboard, overview, chat, insights, and settings.
- [ ] Mobile navigation exposes the same product sections.
- [ ] The active route is visually identifiable.
- [ ] The top bar shows organization, location, notification, and avatar/logout placeholders.
- [ ] Shell tests verify navigation and top-bar placeholders through visible behavior.

---

## Phase 4: Create API-Ready Product Route Stubs

**User stories**: 10, 11, 12, 25, 27, 28

### What to build

Create realistic but non-calling route scaffolds for dashboard, overview, chat, insights, settings, login, reset password, and onboarding. Product pages should look ready for pharmacy operations while making clear that live API data and business workflows are not implemented. Login and reset password should be focused plain pages outside the app shell. Onboarding should remain a minimal placeholder.

### Acceptance criteria

- [ ] `/dashboard` renders a compact clinical operations scaffold.
- [ ] `/overview` renders a multi-location summary scaffold.
- [ ] `/chat` renders a chat assistant surface without LLM calls.
- [ ] `/insights` renders trends and alert placeholders without calculations.
- [ ] `/settings` renders organization, location, and notification settings placeholders without persistence.
- [ ] `/login` renders a focused form shell without auth behavior.
- [ ] `/reset-password` renders a focused form shell without auth behavior.
- [ ] `/onboarding` renders a minimal placeholder only.
- [ ] Route tests verify each page renders its intended surface.

---

## Phase 5: Add Integration-Ready Client Seams

**User stories**: 19, 20, 21, 22, 23

### What to build

Add frontend seams for future integration: centralized environment access, a Supabase browser client factory, a typed Spring Boot API client skeleton, and placeholder app context for user, organization, location, and auth readiness. Keep the implementation non-calling and lenient so local development works before real credentials exist.

### Acceptance criteria

- [ ] Environment access supports `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_API_URL`.
- [ ] Missing environment variables do not crash the scaffold.
- [ ] A Supabase browser client factory exists for future auth/session work.
- [ ] A typed Spring Boot API client seam exists for future data hooks.
- [ ] The API client is not invoked by scaffold pages.
- [ ] App context exposes placeholder user, organization, location, and auth readiness shape.

---

## Phase 6: Final Verification And Handoff

**User stories**: 26, 27, 28

### What to build

Run the available frontend verification commands, inspect the completed implementation, and create a source-of-truth implementation handoff contract for the next engineer.

### Acceptance criteria

- [ ] Tests pass or documented failures are explained.
- [ ] Lint passes or documented failures are explained.
- [ ] Build passes or documented failures are explained.
- [ ] The app can be run locally.
- [ ] The handoff contract documents exact routes, components, types, config, limitations, and verification results.
