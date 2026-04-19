## Problem Statement

Independent pharmacies using PharmaForecast need a fast, trustworthy frontend foundation before business workflows can be built. The product will eventually help pharmacy teams upload dispensing history, forecast drug demand, identify reorder risk, understand inventory trends, receive alerts, chat with an assistant, and draft purchase orders. Today there is no Next.js application scaffold, no shared design system, no app shell, no route structure, no provider layer, and no frontend integration seams for Supabase or the Spring Boot API.

This matters now because later product slices depend on stable layout, navigation, theme tokens, shared components, and API-ready boundaries. Without this foundation, each future feature would make its own UI, data-loading, and layout decisions, creating inconsistency and integration churn.

The affected users are pharmacy owners, pharmacists, and staff at independent pharmacies in Ottawa, Canada. They need a compact clinical interface that is readable under pressure, professional enough for pharmacy operations, and prepared for authenticated multi-location workflows without implementing those workflows prematurely.

## Solution

Create a frontend-only Next.js application foundation for PharmaForecast. The app will use the App Router, TypeScript, Tailwind CSS, shadcn/ui, React Query, Supabase client libraries, and lucide-react. It will establish a compact clinical design direction using deep navy, teal, status colors, crisp white surfaces, Geist fonts, and reusable UI primitives.

The app will provide an authenticated-product-shaped shell without enforcing authentication yet. Desktop users will see a sidebar and top bar. Mobile users will see a responsive navigation pattern. The top bar will include placeholders for organization, location, notifications, and avatar/logout. Product pages will be static, realistic, and API-ready but will not call real backend endpoints.

The app will include stub routes for dashboard, overview, chat, insights, settings, login, reset password, and onboarding. The root route will direct users to the dashboard. `/dashboard` is the default app entry route. `/onboarding` will be a minimal placeholder left ready for future implementation.

The implementation will intentionally avoid real auth behavior, real Supabase session handling, real Spring Boot API calls, CSV upload logic, forecasting logic, LLM behavior, billing behavior, and business workflows. It will create clean seams so those capabilities can be added later without reworking the shell.

## User Stories

1. As a pharmacy owner, I want the app to open into a professional dashboard shell, so that the product immediately feels credible for pharmacy operations.
2. As a pharmacist, I want navigation for dashboard, overview, chat, insights, and settings, so that future workflows have predictable locations.
3. As a pharmacy staff member, I want the UI to be compact and readable, so that I can scan operational information quickly during a workday.
4. As a mobile user, I want navigation that works on small screens, so that I can access the product without a desktop sidebar crowding the viewport.
5. As a desktop user, I want a persistent sidebar, so that switching between major product areas is fast.
6. As a user, I want the current section to be visually identifiable in navigation, so that I know where I am in the app.
7. As a user, I want the top bar to show organization and location placeholders, so that the multi-tenant and multi-location model is visible before real auth is implemented.
8. As a user, I want notification and account controls to have placeholders, so that future alert and session behavior has a stable UI location.
9. As a user, I want `/dashboard` to be the default entry route, so that the first product surface is the operational workspace.
10. As a user, I want `/login` to be a focused auth page without the app shell, so that future authentication can be added cleanly.
11. As a user, I want `/reset-password` to be a focused auth page without the app shell, so that account recovery has a clean future surface.
12. As a product team member, I want `/onboarding` to exist as a minimal placeholder, so that organization/location setup can be added later without changing routing conventions.
13. As a frontend engineer, I want shared design tokens for navy, teal, green, amber, red, text, muted text, surface, and border colors, so that future screens use consistent clinical styling.
14. As a frontend engineer, I want shadcn/ui configured with CSS variables, so that reusable components can align with the product theme.
15. As a frontend engineer, I want shared status badge components typed to backend enum values, so that future API data maps cleanly to UI states.
16. As a frontend engineer, I want a confidence badge typed to `low`, `medium`, and `high`, so that forecast confidence can be displayed consistently when forecasts are implemented.
17. As a frontend engineer, I want loading, empty, stat, section, page-header, and table-toolbar primitives, so that future feature pages do not recreate basic layout components.
18. As a frontend engineer, I want React Query provider wiring present, so that future API hooks can be added without changing the root provider tree.
19. As a frontend engineer, I want placeholder app context for user, organization, location, and auth state, so that future auth integration has a clear shape.
20. As a frontend engineer, I want centralized environment access for Supabase and API URLs, so that future integrations do not read environment variables ad hoc.
21. As a frontend engineer, I want a Supabase browser client factory ready, so that future auth/session work can use the approved dependency without redesign.
22. As a frontend engineer, I want a typed Spring Boot API client skeleton ready, so that future data hooks can call the backend through a single seam.
23. As a backend engineer, I want the frontend to assume Spring Boot is the only API orchestration layer, so that the frontend never calls Python forecast or LLM services directly.
24. As a compliance reviewer, I want no patient-level data in static UI scaffolds, so that the frontend foundation does not normalize exposing sensitive fields.
25. As a pharmacy user, I want pages to look like real product surfaces even before integrations exist, so that demos communicate the intended operational workflows.
26. As a QA engineer, I want behavior-level tests around routing, shell rendering, provider wiring, and enum badge display, so that the scaffold has regression coverage without brittle implementation assertions.
27. As a future implementer, I want realistic but non-calling page scaffolds, so that I can add API data without replacing the layout.
28. As a future implementer, I want no mocked business behavior presented as live data, so that placeholder content is not mistaken for backend integration.
29. As a product owner, I want the design to feel clinical, trustworthy, modern, fast, and readable under pressure, so that the product matches pharmacy expectations.
30. As a future auth implementer, I want routes left open for now, so that auth can be implemented deliberately in a later slice.

## Implementation Decisions

- The repository is frontend-only for this scaffold.
- The application will be scaffolded at the repository root, not in a nested app directory.
- The app will use Next.js App Router, TypeScript, Tailwind CSS, ESLint, and a `src/` source structure.
- The root route will redirect or navigate to `/dashboard`.
- `/dashboard` is the default product entry route.
- Product shell routes are `/dashboard`, `/overview`, `/chat`, `/insights`, and `/settings`.
- Plain routes without the app shell are `/login`, `/reset-password`, and `/onboarding`.
- `/onboarding` is a minimal placeholder and intentionally does not implement onboarding flow behavior.
- No authentication enforcement will be implemented in this feature.
- No real Supabase session behavior will be implemented in this feature.
- No real Spring Boot API calls will be made by pages in this feature.
- No frontend calls to Python forecast or LLM services are allowed.
- React Query will be configured as a provider, but no real query hooks will fetch backend data.
- Supabase dependencies will be installed and a browser-client seam will be prepared for future auth/session work.
- Spring Boot API URL access will be centralized through frontend environment handling.
- Environment handling will be lenient during this scaffold so the app can run before real Supabase/API values exist.
- The design system will use navy `#0F1F3D`, teal `#0D9488`, green `#16A34A`, amber `#D97706`, and red `#DC2626`.
- The app will use Geist Sans and Geist Mono.
- Global CSS variables will define text, muted text, surface, border, and status colors.
- shadcn/ui will be configured with the `new-york` style, neutral base color, and CSS variables.
- The visual direction is compact clinical dashboard, not spacious marketing SaaS.
- The app shell will be production-shaped with placeholder data.
- Shared components will include `StatusBadge`, `ConfidenceBadge`, `LoadingSpinner`, `EmptyState`, `StatCard`, `SectionCard`, `AppPageHeader`, and `TableToolbar`.
- `StatusBadge` will encode finalized backend status and enum display values where relevant, including `ok`, `amber`, `red`, `active`, `inactive`, `unknown`, `pending`, `processing`, `completed`, `failed`, `draft`, `reviewed`, `sent`, and `cancelled`.
- `ConfidenceBadge` will encode finalized forecast confidence values: `low`, `medium`, and `high`.
- Static route scaffolds may use realistic pharmacy-oriented placeholders, but must remain API-ready and non-calling.
- Static scaffolds must not include `patient_id` or patient-level details.
- The frontend must respect the backend ownership boundary: Spring Boot owns auth validation, authorization, business logic, persistence, notifications, billing, and Python service orchestration.

## Testing Decisions

- Tests should verify observable behavior through public UI and routing surfaces rather than internal implementation details.
- The first TDD seam should prove that the app can render the default dashboard route through the real Next.js application surface.
- Route tests should verify that `/dashboard`, `/overview`, `/chat`, `/insights`, `/settings`, `/login`, `/reset-password`, and `/onboarding` render their intended page surfaces.
- Shell tests should verify that product routes expose navigation and top-bar placeholders.
- Plain route tests should verify that login, reset password, and onboarding do not depend on authenticated app-shell behavior.
- Shared component tests should verify that `StatusBadge` and `ConfidenceBadge` render supported backend enum values in user-readable form.
- Provider tests should verify that the provider tree can render children without requiring real environment variables, real Supabase session state, or real API calls.
- Tests should avoid asserting private component structure, CSS class internals, or implementation-specific provider internals.
- Since this is a greenfield Next.js app, testing dependencies and commands will be chosen during implementation and documented in the handoff contract.

## Out of Scope

- Real Supabase authentication flow is out of scope.
- Real login, logout, signup, password reset, and session refresh behavior are out of scope.
- Route protection and redirects based on auth state are out of scope.
- Organization and location onboarding workflow is out of scope.
- CSV upload behavior is out of scope.
- Forecast generation behavior is out of scope.
- Calls to the Spring Boot backend are out of scope.
- Calls to Python forecast service are out of scope.
- Calls to Python LLM service or Grok are out of scope.
- Notification delivery, realtime subscriptions, and notification jobs are out of scope.
- Stripe billing UI and billing integration are out of scope.
- Purchase order generation behavior is out of scope.
- Chat assistant behavior is out of scope.
- Supabase RLS implementation is out of scope for the frontend scaffold.
- Backend schema changes are out of scope.
- Patient-level data display is out of scope.
- Deployment configuration for Vercel is out of scope unless required by the Next.js scaffold defaults.

## Further Notes

- This PRD assumes the Spring Boot backend foundation contract remains source of truth for backend table names, enum values, auth assumptions, and sensitive data restrictions.
- The frontend should use `app_users` as the backend application-user concept when future auth integrations are designed, even though user-facing copy can say "user" or "team member".
- The frontend should preserve DINs as strings when future drug data appears.
- The frontend should never display or transmit `patient_id` unless a future explicitly approved secure workflow changes the contract.
- The current implementation should create structure that future teams can build on without implying real backend integration.
- The route and component names in this PRD are considered stable for the scaffold.
- The exact internal file paths and implementation details belong in the implementation plan and handoff contract, not this PRD.
