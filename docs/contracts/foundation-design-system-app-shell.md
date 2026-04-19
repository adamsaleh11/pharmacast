# Implementation Handoff Contract

## 1. Summary
- Implemented the PharmaForecast frontend foundation in the `pharmacast` frontend repository.
- Implemented a Next.js App Router scaffold with TypeScript, Tailwind CSS, shadcn-compatible configuration, React Query, Supabase client dependencies, lucide-react, ESLint, Vitest, and Testing Library.
- Implemented the compact clinical design system foundation using navy `#0F1F3D`, teal `#0D9488`, green `#16A34A`, amber `#D97706`, red `#DC2626`, crisp white surfaces, status colors, and Geist font-family tokens.
- Implemented an app shell with desktop sidebar, mobile navigation bar, top bar placeholders for organization/location/notifications/avatar/logout, and active route styling.
- Implemented static, API-ready route stubs for `/dashboard`, `/overview`, `/chat`, `/insights`, `/settings`, `/login`, `/reset-password`, and `/onboarding`.
- Implemented reusable shared components: `StatusBadge`, `ConfidenceBadge`, `LoadingSpinner`, `EmptyState`, `StatCard`, `SectionCard`, `AppPageHeader`, and `TableToolbar`.
- Implemented app providers with React Query and placeholder application context for future auth/user/organization/location integration.
- Implemented integration-ready environment access, Supabase browser client factory, and Spring Boot API client skeleton.
- Implemented PRD and phased plan documentation for this frontend foundation.
- Why it was implemented: future PharmaForecast frontend slices need stable routing, theme tokens, shell layout, provider wiring, reusable UI primitives, and API seams before business workflows are added.
- In scope: frontend scaffold, design system foundation, app shell, static page stubs, shared UI primitives, provider layer, API-ready client seams, tests, PRD, plan, and this contract.
- Out of scope: real Supabase auth, route protection, real Spring Boot API calls, CSV upload behavior, forecasting behavior, LLM/Grok behavior, notifications, Stripe billing, purchase order generation, real onboarding, backend changes, and deployment setup.
- Owner: frontend-only Next.js application in `/Users/adamsaleh/Downloads/pharmacast`.

## 2. Files Added or Changed
- `.gitignore`: created. Ignores `.next/`, `node_modules/`, `out/`, `coverage/`, env files, package-manager debug logs, and `.DS_Store`.
- `package.json`: created. Defines project scripts and dependencies for Next.js, React, Tailwind, shadcn-compatible Radix primitives, Supabase, React Query, lucide-react, ESLint, Vitest, and Testing Library.
- `package-lock.json`: created. Locks installed npm dependency tree.
- `next.config.ts`: created. Exports an empty `NextConfig`.
- `next-env.d.ts`: created. Next.js TypeScript environment declarations.
- `tsconfig.json`: created and updated by Next build. Uses strict TypeScript, `moduleResolution: "bundler"`, alias `@/* -> ./src/*`, `jsx: "react-jsx"`, and includes `.next/types/**/*.ts` plus `.next/dev/types/**/*.ts`.
- `postcss.config.mjs`: created. Configures `tailwindcss` and `autoprefixer`.
- `tailwind.config.ts`: created. Configures content paths, class-based dark mode, shadcn CSS-variable colors, PharmaForecast colors, radius values, and Geist font-family variables.
- `components.json`: created. shadcn/ui configuration using `new-york`, `neutral`, CSS variables, `src/components/ui`, `src/lib/utils`, and lucide icons.
- `eslint.config.mjs`: created. Uses `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`, ignores `.next/**`, `node_modules/**`, and `coverage/**`.
- `vitest.config.ts`: created. Configures Vitest with React plugin, jsdom, globals, setup file, CSS handling, and `@` alias.
- `vitest.setup.ts`: created. Imports `@testing-library/jest-dom/vitest`.
- `docs/prd/foundation-design-system-app-shell.md`: created. Product requirements document for this frontend foundation.
- `plans/foundation-design-system-app-shell.md`: created. Multi-phase tracer-bullet implementation plan.
- `docs/contracts/foundation-design-system-app-shell.md`: created. This implementation handoff contract.
- `src/app/layout.tsx`: created. Root layout, metadata, global CSS import, and `AppProviders` wrapping.
- `src/app/globals.css`: created. Tailwind directives, global CSS variables, status tokens, Geist font-family variables, base body styling.
- `src/app/page.tsx`: created. Redirects `/` to `/dashboard`.
- `src/app/(app)/layout.tsx`: created. Wraps product routes with `AppShell`.
- `src/app/(app)/dashboard/page.tsx`: created. Static dashboard scaffold with page header, stat cards, reorder risk table, `StatusBadge`, and `ConfidenceBadge`.
- `src/app/(app)/dashboard/page.test.tsx`: created. Tests dashboard route renders without live API credentials.
- `src/app/(app)/overview/page.tsx`: created. Static multi-location overview scaffold.
- `src/app/(app)/chat/page.tsx`: created. Static chat assistant scaffold with no LLM call.
- `src/app/(app)/insights/page.tsx`: created. Static insights/trends scaffold with no calculations.
- `src/app/(app)/settings/page.tsx`: created. Static organization/location/notification settings scaffold with no persistence.
- `src/app/login/page.tsx`: created. Plain login form shell with no auth behavior.
- `src/app/reset-password/page.tsx`: created. Plain reset-password form shell with no auth behavior.
- `src/app/onboarding/page.tsx`: created. Minimal onboarding placeholder.
- `src/app/routes.test.tsx`: created. Tests product and plain route stubs render.
- `src/components/app-shell/navigation.ts`: created. Defines product navigation items for Dashboard, Overview, Chat, Insights, and Settings.
- `src/components/app-shell/app-shell.tsx`: created. Responsive shell with desktop sidebar, mobile navigation, top bar placeholders, and active route state using `usePathname`.
- `src/components/app-shell/app-shell.test.tsx`: created. Tests shell navigation and top-bar placeholders.
- `src/components/ui/badge.tsx`: created. shadcn-compatible badge primitive with `default`, `secondary`, `outline`, `success`, `warning`, `danger`, `muted`, and `teal` variants.
- `src/components/ui/button.tsx`: created. shadcn-compatible button primitive with `default`, `teal`, `outline`, `ghost`, and `secondary` variants.
- `src/components/ui/card.tsx`: created. Card, card header, card title, card description, and card content primitives.
- `src/components/ui/avatar.tsx`: created. Radix avatar wrapper and fallback.
- `src/components/product/status-badge.tsx`: created. Typed backend-status display component.
- `src/components/product/confidence-badge.tsx`: created. Typed forecast-confidence display component.
- `src/components/product/loading-spinner.tsx`: created. Loading indicator component.
- `src/components/product/empty-state.tsx`: created. Empty-state component with icon, title, description, and optional action button.
- `src/components/product/stat-card.tsx`: created. Compact metric card component.
- `src/components/product/section-card.tsx`: created. Section wrapper component with title, optional description, optional actions, and content.
- `src/components/product/app-page-header.tsx`: created. Page title/description/actions component.
- `src/components/product/table-toolbar.tsx`: created. Search input and optional action toolbar component.
- `src/components/product/badges.test.tsx`: created. Tests status and confidence badges render supported enum values.
- `src/providers/app-providers.tsx`: created. Provides React Query and app context.
- `src/providers/app-context.tsx`: created. Placeholder app context with organization/location values and no real auth.
- `src/providers/app-providers.test.tsx`: created. Tests provider tree renders children with placeholder context and no live credentials.
- `src/types/app-context.ts`: created. Types for `AppUser`, `AppOrganization`, `AppLocation`, and `AppContextValue`.
- `src/lib/utils.ts`: created. `cn()` utility using `clsx` and `tailwind-merge`.
- `src/lib/env.ts`: created. Lenient public env reader for Supabase and API URLs.
- `src/lib/api/client.ts`: created. Typed Spring Boot API client skeleton.
- `src/lib/supabase/client.ts`: created. Supabase browser client factory that returns `null` when Supabase env is missing.

## 3. Public Interface Contract

### Route `/`
- Name: `/`
- Type: Next.js App Router page
- Purpose: Root entry route that sends users to the product dashboard.
- Owner: `src/app/page.tsx`
- Inputs: none
- Outputs: redirect to `/dashboard`
- Required fields: none
- Optional fields: none
- Validation rules: none
- Defaults: always redirects to `/dashboard`
- Status codes or result states: Next.js redirect result
- Error shapes: NOT IMPLEMENTED
- Example input: browser request to `/`
- Example output: user is routed to `/dashboard`

### Route `/dashboard`
- Name: `/dashboard`
- Type: Next.js App Router page
- Purpose: Default product entry route and pharmacy operations scaffold.
- Owner: `src/app/(app)/dashboard/page.tsx`
- Inputs: none
- Outputs: static dashboard UI
- Required fields: none
- Optional fields: none
- Validation rules: none
- Defaults: renders static placeholder values and no live API data
- Status codes or result states: static prerendered route
- Error shapes: NOT IMPLEMENTED
- Example input: browser request to `/dashboard`
- Example output: page titled `Dashboard` with upload/generate buttons, stat cards, and reorder risk preview

### Route `/overview`
- Name: `/overview`
- Type: Next.js App Router page
- Purpose: Multi-location overview scaffold.
- Owner: `src/app/(app)/overview/page.tsx`
- Inputs: none
- Outputs: static overview UI
- Required fields: none
- Optional fields: none
- Validation rules: none
- Defaults: renders static placeholder location summary
- Status codes or result states: static prerendered route
- Error shapes: NOT IMPLEMENTED
- Example input: browser request to `/overview`
- Example output: page titled `Overview`

### Route `/chat`
- Name: `/chat`
- Type: Next.js App Router page
- Purpose: Chat assistant scaffold.
- Owner: `src/app/(app)/chat/page.tsx`
- Inputs: none
- Outputs: static chat UI
- Required fields: none
- Optional fields: none
- Validation rules: none
- Defaults: renders empty state and no LLM call
- Status codes or result states: static prerendered route
- Error shapes: NOT IMPLEMENTED
- Example input: browser request to `/chat`
- Example output: page titled `Chat`

### Route `/insights`
- Name: `/insights`
- Type: Next.js App Router page
- Purpose: Insights/trends scaffold.
- Owner: `src/app/(app)/insights/page.tsx`
- Inputs: none
- Outputs: static insights UI
- Required fields: none
- Optional fields: none
- Validation rules: none
- Defaults: renders static placeholders and no calculations
- Status codes or result states: static prerendered route
- Error shapes: NOT IMPLEMENTED
- Example input: browser request to `/insights`
- Example output: page titled `Insights`

### Route `/settings`
- Name: `/settings`
- Type: Next.js App Router page
- Purpose: Organization, location, and notification settings scaffold.
- Owner: `src/app/(app)/settings/page.tsx`
- Inputs: none
- Outputs: static settings UI
- Required fields: none
- Optional fields: none
- Validation rules: none
- Defaults: no persistence and no API calls
- Status codes or result states: static prerendered route
- Error shapes: NOT IMPLEMENTED
- Example input: browser request to `/settings`
- Example output: page titled `Settings`

### Route `/login`
- Name: `/login`
- Type: Next.js App Router page
- Purpose: Plain login form shell for future auth.
- Owner: `src/app/login/page.tsx`
- Inputs: visual email and password fields only
- Outputs: static login UI
- Required fields: none enforced
- Optional fields: none
- Validation rules: NOT IMPLEMENTED
- Defaults: submit button has `type="button"` and performs no auth
- Status codes or result states: static prerendered route
- Error shapes: NOT IMPLEMENTED
- Example input: browser request to `/login`
- Example output: page titled `Sign in to PharmaForecast`

### Route `/reset-password`
- Name: `/reset-password`
- Type: Next.js App Router page
- Purpose: Plain password reset shell for future auth.
- Owner: `src/app/reset-password/page.tsx`
- Inputs: visual email field only
- Outputs: static reset password UI
- Required fields: none enforced
- Optional fields: none
- Validation rules: NOT IMPLEMENTED
- Defaults: submit button has `type="button"` and performs no action
- Status codes or result states: static prerendered route
- Error shapes: NOT IMPLEMENTED
- Example input: browser request to `/reset-password`
- Example output: page titled `Reset password`

### Route `/onboarding`
- Name: `/onboarding`
- Type: Next.js App Router page
- Purpose: Minimal placeholder for future onboarding.
- Owner: `src/app/onboarding/page.tsx`
- Inputs: none
- Outputs: static placeholder UI
- Required fields: none
- Optional fields: none
- Validation rules: none
- Defaults: no onboarding behavior
- Status codes or result states: static prerendered route
- Error shapes: NOT IMPLEMENTED
- Example input: browser request to `/onboarding`
- Example output: page titled `Onboarding`

### Component `AppShell`
- Name: `AppShell`
- Type: React component
- Purpose: Product shell for authenticated-era routes.
- Owner: `src/components/app-shell/app-shell.tsx`
- Inputs: `children: React.ReactNode`
- Outputs: sidebar, mobile navigation, top bar, and main content area
- Required fields: `children`
- Optional fields: none
- Validation rules: none
- Defaults: hardcoded placeholders `Ottawa Independent Pharmacy`, `Bank Street`, `Owner`
- Status codes or result states: renders product shell
- Error shapes: NOT IMPLEMENTED
- Example input: `<AppShell><DashboardPage /></AppShell>`
- Example output: shell with product navigation and child content

### Component `StatusBadge`
- Name: `StatusBadge`
- Type: React component
- Purpose: Display finalized backend status values in user-readable form.
- Owner: `src/components/product/status-badge.tsx`
- Inputs: `value: StatusBadgeValue`
- Outputs: styled badge label
- Required fields: `value`
- Optional fields: none
- Validation rules: TypeScript union only
- Defaults: none
- Status codes or result states: renders supported status label
- Error shapes: TypeScript compile-time error for unsupported literal values
- Example input: `<StatusBadge value="amber" />`
- Example output: `Amber`

### Component `ConfidenceBadge`
- Name: `ConfidenceBadge`
- Type: React component
- Purpose: Display finalized forecast confidence values.
- Owner: `src/components/product/confidence-badge.tsx`
- Inputs: `value: "low" | "medium" | "high"`
- Outputs: styled badge label
- Required fields: `value`
- Optional fields: none
- Validation rules: TypeScript union only
- Defaults: none
- Status codes or result states: renders supported confidence label
- Error shapes: TypeScript compile-time error for unsupported literal values
- Example input: `<ConfidenceBadge value="high" />`
- Example output: `High confidence`

### Component `LoadingSpinner`
- Name: `LoadingSpinner`
- Type: React component
- Purpose: Display loading state.
- Owner: `src/components/product/loading-spinner.tsx`
- Inputs: `className?: string`, `label?: string`
- Outputs: loading icon and label
- Required fields: none
- Optional fields: `className`, `label`
- Validation rules: none
- Defaults: `label = "Loading"`
- Status codes or result states: renders loading indicator
- Error shapes: NOT IMPLEMENTED
- Example input: `<LoadingSpinner label="Loading forecasts" />`
- Example output: spinner with `Loading forecasts`

### Component `EmptyState`
- Name: `EmptyState`
- Type: React component
- Purpose: Display empty or not-yet-integrated surface.
- Owner: `src/components/product/empty-state.tsx`
- Inputs: `icon`, `title`, `description`, `actionLabel?`, `className?`
- Outputs: empty-state panel
- Required fields: `icon`, `title`, `description`
- Optional fields: `actionLabel`, `className`
- Validation rules: `icon` must be a lucide-compatible component
- Defaults: no action button when `actionLabel` is omitted
- Status codes or result states: renders empty state
- Error shapes: NOT IMPLEMENTED
- Example input: `<EmptyState icon={MessageSquareText} title="No messages" description="Start a chat." />`
- Example output: empty state titled `No messages`

### Component `StatCard`
- Name: `StatCard`
- Type: React component
- Purpose: Display compact metric cards.
- Owner: `src/components/product/stat-card.tsx`
- Inputs: `title`, `value`, `detail`, `icon`, `tone?`
- Outputs: metric card
- Required fields: `title`, `value`, `detail`, `icon`
- Optional fields: `tone`
- Validation rules: `tone` must be `navy`, `teal`, `green`, `amber`, or `red`
- Defaults: `tone = "navy"`
- Status codes or result states: renders stat card
- Error shapes: TypeScript compile-time error for unsupported `tone`
- Example input: `<StatCard title="Active DINs" value="142" detail="CSV-ready" icon={Boxes} tone="teal" />`
- Example output: stat card with `Active DINs`

### Component `SectionCard`
- Name: `SectionCard`
- Type: React component
- Purpose: Display titled content sections.
- Owner: `src/components/product/section-card.tsx`
- Inputs: `title`, `description?`, `actions?`, `children`
- Outputs: card section
- Required fields: `title`, `children`
- Optional fields: `description`, `actions`
- Validation rules: none
- Defaults: no description/actions when omitted
- Status codes or result states: renders section card
- Error shapes: NOT IMPLEMENTED
- Example input: `<SectionCard title="Reorder risk">...</SectionCard>`
- Example output: card titled `Reorder risk`

### Component `AppPageHeader`
- Name: `AppPageHeader`
- Type: React component
- Purpose: Standard page heading, description, and actions.
- Owner: `src/components/product/app-page-header.tsx`
- Inputs: `title`, `description`, `actions?`
- Outputs: page header
- Required fields: `title`, `description`
- Optional fields: `actions`
- Validation rules: none
- Defaults: no actions when omitted
- Status codes or result states: renders header
- Error shapes: NOT IMPLEMENTED
- Example input: `<AppPageHeader title="Dashboard" description="Monitor inventory." />`
- Example output: heading `Dashboard`

### Component `TableToolbar`
- Name: `TableToolbar`
- Type: React component
- Purpose: Search/action toolbar for future tables.
- Owner: `src/components/product/table-toolbar.tsx`
- Inputs: `searchPlaceholder`, `actionLabel?`
- Outputs: search input and optional button
- Required fields: `searchPlaceholder`
- Optional fields: `actionLabel`
- Validation rules: none
- Defaults: no action button when `actionLabel` is omitted
- Status codes or result states: renders toolbar
- Error shapes: NOT IMPLEMENTED
- Example input: `<TableToolbar searchPlaceholder="Search DIN or drug" actionLabel="Export review" />`
- Example output: search input with optional action button

### Hook `useAppContext`
- Name: `useAppContext`
- Type: React hook
- Purpose: Access placeholder app context for future auth/user/org/location state.
- Owner: `src/providers/app-context.tsx`
- Inputs: none
- Outputs: `AppContextValue`
- Required fields: none
- Optional fields: none
- Validation rules: must be used under `AppContextProvider` for future override support
- Defaults: placeholder context
- Status codes or result states: returns placeholder app context
- Error shapes: NOT IMPLEMENTED
- Example input: `const context = useAppContext()`
- Example output: `context.organization?.name === "Ottawa Independent Pharmacy"`

### Function `getPublicEnv`
- Name: `getPublicEnv`
- Type: exported function
- Purpose: Centralize public environment access.
- Owner: `src/lib/env.ts`
- Inputs: `process.env.NEXT_PUBLIC_SUPABASE_URL`, `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY`, `process.env.NEXT_PUBLIC_API_URL`
- Outputs: `PublicEnv`
- Required fields: none during this scaffold
- Optional fields: all env vars are optional during this scaffold
- Validation rules: none
- Defaults: missing env vars become empty strings; booleans indicate availability
- Status codes or result states: returns env object
- Error shapes: NOT IMPLEMENTED
- Example input: missing env vars
- Example output: `{ supabaseUrl: "", supabaseAnonKey: "", apiUrl: "", hasSupabaseConfig: false, hasApiConfig: false }`

### Function `createApiClient`
- Name: `createApiClient`
- Type: exported function
- Purpose: Create typed Spring Boot API client skeleton.
- Owner: `src/lib/api/client.ts`
- Inputs: none for factory; `get<TResponse>(path, options?)` for requests
- Outputs: `ApiClient`
- Required fields: `NEXT_PUBLIC_API_URL` is required only when `get()` is called
- Optional fields: `accessToken`
- Validation rules: throws if `NEXT_PUBLIC_API_URL` is missing when a request is made
- Defaults: no request is made by scaffold pages
- Status codes or result states: successful `get()` resolves parsed JSON
- Error shapes: `Error("NEXT_PUBLIC_API_URL is not configured.")`; `Error("API request failed with status <status>.")`
- Example input: `createApiClient().get<{ status: string }>("/health")`
- Example output: parsed JSON response from Spring Boot when configured

### Function `createSupabaseBrowserClient`
- Name: `createSupabaseBrowserClient`
- Type: exported function
- Purpose: Create Supabase browser client for future auth/session work.
- Owner: `src/lib/supabase/client.ts`
- Inputs: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Outputs: Supabase browser client or `null`
- Required fields: env vars are required only to return a client
- Optional fields: none
- Validation rules: returns `null` when Supabase env is incomplete
- Defaults: no client when env is missing
- Status codes or result states: returns client or `null`
- Error shapes: NOT IMPLEMENTED
- Example input: missing Supabase env
- Example output: `null`

### CLI Command `npm run dev`
- Name: `npm run dev`
- Type: CLI command
- Purpose: Start local Next.js development server.
- Owner: `package.json`
- Inputs: project source tree
- Outputs: local dev server
- Required fields: installed npm dependencies
- Optional fields: public env vars for future integrations
- Validation rules: none
- Defaults: runs `next dev --turbopack`
- Status codes or result states: dev server available at `http://localhost:3000`
- Error shapes: Next.js CLI output
- Example input: `npm run dev`
- Example output: `Local: http://localhost:3000`

### CLI Command `npm run build`
- Name: `npm run build`
- Type: CLI command
- Purpose: Build production Next.js app.
- Owner: `package.json`
- Inputs: project source tree
- Outputs: production build in `.next/`
- Required fields: installed npm dependencies
- Optional fields: public env vars are not required for scaffold build
- Validation rules: TypeScript and Next.js build must pass
- Defaults: runs `next build`
- Status codes or result states: build success or build failure
- Error shapes: Next.js CLI output
- Example input: `npm run build`
- Example output: static routes generated for `/`, `/dashboard`, `/overview`, `/chat`, `/insights`, `/settings`, `/login`, `/reset-password`, and `/onboarding`

### CLI Command `npm run lint`
- Name: `npm run lint`
- Type: CLI command
- Purpose: Run ESLint.
- Owner: `package.json`, `eslint.config.mjs`
- Inputs: project source tree
- Outputs: lint result
- Required fields: installed npm dependencies
- Optional fields: none
- Validation rules: ESLint config must pass
- Defaults: runs `eslint .`
- Status codes or result states: lint success or lint failure
- Error shapes: ESLint CLI output
- Example input: `npm run lint`
- Example output: no output and exit code `0`

### CLI Command `npm test`
- Name: `npm test`
- Type: CLI command
- Purpose: Run behavior-level frontend tests.
- Owner: `package.json`, `vitest.config.ts`
- Inputs: test files and source tree
- Outputs: Vitest result
- Required fields: installed npm dependencies
- Optional fields: none
- Validation rules: tests must pass
- Defaults: runs `vitest run`
- Status codes or result states: test success or test failure
- Error shapes: Vitest CLI output
- Example input: `npm test`
- Example output: `Test Files 5 passed (5); Tests 7 passed (7)`

## 4. Data Contract

### Type `StatusBadgeValue`
- Exact name: `StatusBadgeValue`
- Fields: single string union value
- Field types: TypeScript union
- Required vs optional: required prop for `StatusBadge`
- Allowed values: `ok`, `amber`, `red`, `active`, `inactive`, `unknown`, `pending`, `processing`, `completed`, `failed`, `draft`, `reviewed`, `sent`, `cancelled`
- Defaults: none
- Validation constraints: TypeScript compile-time union
- Migration notes: mirrors backend enum/status values from the backend handoff contract
- Backward compatibility notes: adding/removing values affects frontend badge callers

### Type `ConfidenceValue`
- Exact name: `ConfidenceValue`
- Fields: single string union value
- Field types: TypeScript union
- Required vs optional: required prop for `ConfidenceBadge`
- Allowed values: `low`, `medium`, `high`
- Defaults: none
- Validation constraints: TypeScript compile-time union
- Migration notes: mirrors backend `ForecastConfidence`
- Backward compatibility notes: adding/removing values affects forecast UI callers

### Type `AppUser`
- Exact name: `AppUser`
- Fields: `id`, `email`, `role`
- Field types: `id: string`, `email: string`, `role: "owner" | "admin" | "pharmacist" | "staff"`
- Required vs optional: all fields required when an `AppUser` object exists
- Allowed values: `role` values are `owner`, `admin`, `pharmacist`, `staff`
- Defaults: `user` is currently `null` in placeholder context
- Validation constraints: TypeScript only
- Migration notes: future Supabase auth integration should map backend `app_users` to this shape or replace deliberately
- Backward compatibility notes: provisional frontend shape

### Type `AppOrganization`
- Exact name: `AppOrganization`
- Fields: `id`, `name`
- Field types: `id: string`, `name: string`
- Required vs optional: all fields required
- Allowed values: no enum constraints
- Defaults: placeholder organization `{ id: "placeholder-organization", name: "Ottawa Independent Pharmacy" }`
- Validation constraints: TypeScript only
- Migration notes: provisional frontend shape
- Backward compatibility notes: future backend integration may expand this type

### Type `AppLocation`
- Exact name: `AppLocation`
- Fields: `id`, `name`
- Field types: `id: string`, `name: string`
- Required vs optional: all fields required
- Allowed values: no enum constraints
- Defaults: placeholder location `{ id: "placeholder-location", name: "Bank Street" }`
- Validation constraints: TypeScript only
- Migration notes: provisional frontend shape
- Backward compatibility notes: future backend integration may expand this type

### Type `AppContextValue`
- Exact name: `AppContextValue`
- Fields: `authReady`, `user`, `organization`, `location`
- Field types: `authReady: boolean`, `user: AppUser | null`, `organization: AppOrganization | null`, `location: AppLocation | null`
- Required vs optional: all fields required on context value; nullable fields may be `null`
- Allowed values: see nested types
- Defaults: `authReady: false`, `user: null`, placeholder organization, placeholder location
- Validation constraints: TypeScript only
- Migration notes: placeholder until auth/session integration exists
- Backward compatibility notes: provisional frontend shape

### Type `PublicEnv`
- Exact name: `PublicEnv`
- Fields: `supabaseUrl`, `supabaseAnonKey`, `apiUrl`, `hasSupabaseConfig`, `hasApiConfig`
- Field types: `supabaseUrl: string`, `supabaseAnonKey: string`, `apiUrl: string`, `hasSupabaseConfig: boolean`, `hasApiConfig: boolean`
- Required vs optional: all fields returned by `getPublicEnv`
- Allowed values: strings and booleans
- Defaults: missing env vars become empty strings; booleans become `false`
- Validation constraints: none
- Migration notes: intentionally lenient for scaffold
- Backward compatibility notes: can be tightened when real integrations are implemented

### Type `ApiClient`
- Exact name: `ApiClient`
- Fields: `get`
- Field types: `get<TResponse>(path: string, options?: ApiClientOptions) => Promise<TResponse>`
- Required vs optional: `get` is required
- Allowed values: `path` should be a Spring Boot API path
- Defaults: no default path
- Validation constraints: throws if `NEXT_PUBLIC_API_URL` is missing when `get()` is called
- Migration notes: no pages call this client yet
- Backward compatibility notes: future HTTP methods may be added

### Type `ApiClientOptions`
- Exact name: `ApiClientOptions`
- Fields: `accessToken`
- Field types: `accessToken?: string`
- Required vs optional: optional
- Allowed values: bearer token string
- Defaults: no `Authorization` header when omitted
- Validation constraints: none
- Migration notes: future auth should pass Supabase session token here or through a wrapper
- Backward compatibility notes: provisional

### Static Dashboard Row Shape
- Exact name: local `reorderRows` in `src/app/(app)/dashboard/page.tsx`
- Fields: `din`, `drug`, `status`, `supply`, `confidence`
- Field types: string literal values inferred with `as const`
- Required vs optional: all fields required in local static rows
- Allowed values: `status` uses `ok`, `amber`, or `red`; `confidence` uses `medium` or `high`
- Defaults: three static rows
- Validation constraints: TypeScript checks through `StatusBadge` and `ConfidenceBadge`
- Migration notes: placeholder only; not a DTO
- Backward compatibility notes: replace with backend DTO mapping later

## 5. Integration Contract
- Upstream dependencies: Node.js `v24.13.0` observed locally; npm `11.2.0` observed locally; Next.js `16.2.4`; React `19.2.5`; React DOM `19.2.5`; Tailwind CSS `3.4.17`; Vitest `4.1.4`; Supabase JS `2.103.3`; Supabase SSR `0.10.2`; React Query `5.99.1`.
- Downstream dependencies: none are called by rendered pages.
- Services called: NOT IMPLEMENTED. No page calls Supabase, Spring Boot, Python forecast service, Python LLM service, Resend, or Stripe.
- Endpoints hit: NOT IMPLEMENTED. `createApiClient().get()` can hit configured Spring Boot paths only when future code invokes it.
- Events consumed: NOT IMPLEMENTED.
- Events published: NOT IMPLEMENTED.
- Files read or written at runtime: Next.js reads application source/config files; build writes `.next/`; npm writes `node_modules/` and `package-lock.json`.
- Environment assumptions: public env vars may be absent during scaffold development.
- Auth assumptions: no auth flow is implemented; app context uses `authReady: false` and `user: null`; routes are open.
- Retry behavior: React Query default retry is `1`, but no real query hooks exist.
- Timeout behavior: NOT IMPLEMENTED.
- Fallback behavior: `createSupabaseBrowserClient()` returns `null` when Supabase env is incomplete; `getPublicEnv()` returns empty strings for missing env values.
- Idempotency behavior: route rendering is static; no mutations are implemented.
- Local dev server: `npm run dev` starts Next at `http://localhost:3000`.

## 6. Usage Instructions for Other Engineers
- Use `/dashboard` as the default frontend entry route.
- Use `src/app/(app)/layout.tsx` and `AppShell` for product routes that should have sidebar/top-bar navigation.
- Keep `/login`, `/reset-password`, and `/onboarding` outside the app-shell route group until auth/onboarding behavior is deliberately implemented.
- Import shared product primitives from `src/components/product/*`.
- Use `StatusBadge` only with `StatusBadgeValue` values: `ok`, `amber`, `red`, `active`, `inactive`, `unknown`, `pending`, `processing`, `completed`, `failed`, `draft`, `reviewed`, `sent`, `cancelled`.
- Use `ConfidenceBadge` only with `low`, `medium`, or `high`.
- Use `AppProviders` from `src/providers/app-providers.tsx` at the root provider boundary.
- Use `useAppContext()` only as placeholder state until real auth/session integration is implemented.
- Use `getPublicEnv()` instead of reading public env vars ad hoc.
- Use `createSupabaseBrowserClient()` for future browser-side Supabase Auth work; handle `null` when env is missing.
- Use `createApiClient()` as the future Spring Boot API seam; do not call Python services from the frontend.
- Handle loading, empty, success, and failure states explicitly in future feature pages. This scaffold provides `LoadingSpinner` and `EmptyState`; API failure UI is NOT IMPLEMENTED.
- Finalized: route names, product shell route grouping, plain route grouping, shared component names, design color tokens, badge enum values, and public env var names.
- Provisional: placeholder organization/location/user context shape, static dashboard rows, API client error shape, and Supabase client factory null behavior.
- MOCKED: no network mocks are implemented. Static placeholder page content is present but does not impersonate live backend data.
- Must not be changed without coordination: frontend must call Spring Boot for business APIs; frontend must not call Python forecast or LLM services directly; frontend must not display or transmit `patient_id`.

## 7. Security and Authorization Notes
- No authentication flow is implemented.
- No route protection is implemented.
- No login, logout, signup, reset-password delivery, session refresh, or token storage behavior is implemented.
- No organization/location authorization is implemented in the frontend.
- No role checks are implemented.
- Routes are intentionally open until a later auth slice.
- The frontend scaffold preserves the architecture rule that Spring Boot owns auth validation, organization/location authorization, business logic, persistence, notifications, billing, and calls to Python services.
- The frontend does not call Python forecast or LLM services directly.
- The frontend does not send data to Grok or any external LLM.
- Static scaffolds do not include `patient_id`.
- Forbidden future behavior without explicit security review: logging, prompting, exporting, displaying, or transmitting `patient_id`.
- Tenant isolation is NOT IMPLEMENTED in the frontend. Supabase RLS and Spring Boot authorization remain future/backend concerns.
- Compliance note: all current data is static placeholder content; no real pharmacy, patient, or inventory records are processed.

## 8. Environment and Configuration
- `NEXT_PUBLIC_SUPABASE_URL`: public Supabase project URL. Optional in this scaffold. Missing value becomes `""`; `hasSupabaseConfig` is `false`.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: public Supabase anon key. Optional in this scaffold. Missing value becomes `""`; `hasSupabaseConfig` is `false`.
- `NEXT_PUBLIC_API_URL`: public Spring Boot API base URL. Optional in this scaffold. Missing value becomes `""`; `hasApiConfig` is `false`; `createApiClient().get()` throws if called without it.
- `components.json`: shadcn configuration. Uses `new-york`, `neutral`, CSS variables, `src/components/ui`, `src/lib/utils`, and lucide icons.
- `tailwind.config.ts`: Tailwind configuration. Defines content globs, CSS-variable theme colors, PharmaForecast color constants, radius values, and Geist font-family variables.
- `postcss.config.mjs`: PostCSS configuration. Uses `tailwindcss` and `autoprefixer`.
- `eslint.config.mjs`: ESLint flat configuration. Uses Next core web vitals and TypeScript configs.
- `vitest.config.ts`: test configuration. Uses jsdom, globals, Testing Library setup, CSS support, and `@` alias.
- `package.json` scripts:
  - `dev`: `next dev --turbopack`
  - `build`: `next build`
  - `start`: `next start`
  - `lint`: `eslint .`
  - `test`: `vitest run`
  - `test:watch`: `vitest`

## 9. Testing and Verification
- Added `src/app/(app)/dashboard/page.test.tsx`: verifies dashboard renders heading, description, generate button, and static DIN text without API credentials.
- Added `src/components/product/badges.test.tsx`: verifies selected `StatusBadgeValue` labels and all `ConfidenceValue` labels render.
- Added `src/components/app-shell/app-shell.test.tsx`: verifies shell brand, active dashboard nav, organization placeholder, location placeholder, notification button, and avatar label render.
- Added `src/app/routes.test.tsx`: verifies overview, chat, insights, settings, login, reset password, and onboarding route surfaces render.
- Added `src/providers/app-providers.test.tsx`: verifies provider tree renders children with placeholder organization context and no live credentials.
- Manual verification command run: `npm test`.
- Final observed `npm test` result: `Test Files 5 passed (5); Tests 7 passed (7)`.
- Manual verification command run: `npm run lint`.
- Final observed `npm run lint` result: exit code `0` with no lint output.
- Manual verification command run: `npm run build`.
- Final observed `npm run build` result: build succeeded and generated static routes for `/`, `/_not-found`, `/chat`, `/dashboard`, `/insights`, `/login`, `/onboarding`, `/overview`, `/reset-password`, and `/settings`.
- Manual local server verification command run: `npm run dev`.
- Final observed dev server result: Next.js ready at `http://localhost:3000`.
- Manual HTTP verification command run: `curl -I http://localhost:3000/dashboard`.
- Final observed HTTP verification result: `HTTP/1.1 200 OK`.
- Known verification note: build had to be run outside the sandbox because Turbopack/PostCSS worker behavior attempted a local port bind blocked by the sandbox.
- Known coverage gap: no browser screenshot or Playwright visual regression test was added.
- Known coverage gap: no real Supabase or Spring Boot integration tests were added because integrations are intentionally not implemented.

## 10. Known Limitations and TODOs
- Real auth is NOT IMPLEMENTED.
- Route protection is NOT IMPLEMENTED.
- Login form submission is NOT IMPLEMENTED.
- Reset-password form submission is NOT IMPLEMENTED.
- Onboarding flow is NOT IMPLEMENTED.
- Real organization/location switching is NOT IMPLEMENTED.
- Real notification data is NOT IMPLEMENTED.
- CSV upload behavior is NOT IMPLEMENTED.
- Forecast generation behavior is NOT IMPLEMENTED.
- Spring Boot API calls are NOT IMPLEMENTED in pages.
- Supabase session handling is NOT IMPLEMENTED.
- Python forecast service calls are NOT IMPLEMENTED and must not be added directly from the frontend.
- Python LLM/Grok service calls are NOT IMPLEMENTED and must not be added directly from the frontend.
- Chat assistant behavior is NOT IMPLEMENTED.
- Purchase order drafting is NOT IMPLEMENTED.
- Billing UI and Stripe integration are NOT IMPLEMENTED.
- Evidence-based savings calculations are NOT IMPLEMENTED.
- Static placeholder values are present for visual scaffolding only.
- `createApiClient()` currently supports only `get()`.
- `createApiClient()` error handling is provisional.
- `createSupabaseBrowserClient()` returns `null` when config is missing; future auth code must handle or replace this deliberately.
- Geist fonts are configured as CSS font-family tokens without build-time Google Font fetching. If self-hosted font files are required later, add local font assets deliberately.
- `package.json` uses `latest` for most dependencies; `package-lock.json` locks the actual installed versions.

## 11. Source of Truth Snapshot
- Final app root: `/Users/adamsaleh/Downloads/pharmacast`.
- Final default route: `/dashboard`.
- Final route names: `/`, `/dashboard`, `/overview`, `/chat`, `/insights`, `/settings`, `/login`, `/reset-password`, `/onboarding`.
- Final shell component: `AppShell`.
- Final provider components/hooks: `AppProviders`, `AppContextProvider`, `useAppContext`.
- Final shared product components: `StatusBadge`, `ConfidenceBadge`, `LoadingSpinner`, `EmptyState`, `StatCard`, `SectionCard`, `AppPageHeader`, `TableToolbar`.
- Final UI primitives: `Badge`, `Button`, `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `Avatar`, `AvatarFallback`.
- Final env function: `getPublicEnv`.
- Final client functions: `createApiClient`, `createSupabaseBrowserClient`.
- Final status values: `ok`, `amber`, `red`, `active`, `inactive`, `unknown`, `pending`, `processing`, `completed`, `failed`, `draft`, `reviewed`, `sent`, `cancelled`.
- Final confidence values: `low`, `medium`, `high`.
- Final public env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL`.
- Final PRD path: `docs/prd/foundation-design-system-app-shell.md`.
- Final plan path: `plans/foundation-design-system-app-shell.md`.
- Final contract path: `docs/contracts/foundation-design-system-app-shell.md`.
- Breaking changes from previous version: repository metadata was promoted from nested `/Users/adamsaleh/Downloads/pharmacast/pharmacast` to root `/Users/adamsaleh/Downloads/pharmacast`; stale root `.next/` artifact was removed before scaffolding.

## 12. Copy-Paste Handoff for the Next Engineer
The PharmaForecast frontend foundation is implemented: Next.js App Router scaffold, TypeScript, Tailwind/shadcn-compatible theme, compact clinical app shell, product/plain route stubs, shared UI primitives, React Query provider, placeholder app context, Supabase client seam, Spring Boot API client seam, PRD, plan, tests, and this contract.

It is safe to depend on the route names, `AppShell`, shared product component names, badge enum values, public env var names, and the rule that frontend business calls go through Spring Boot only.

Remaining work: implement Supabase auth/session handling, route protection, organization/location onboarding, Spring Boot API hooks, CSV upload, forecast generation UI, notification data, chat behavior through Spring Boot and the LLM service, purchase order workflows, billing UI, and visual regression coverage.

Traps: do not call Python services directly from the frontend; do not display or transmit `patient_id`; do not treat static placeholder content as live backend data; do not reintroduce build-time Google Font fetching unless CI has network access or fonts are self-hosted.

Read first: sections 3, 4, and 7 for route/component contracts, frontend types, and security boundaries.
