## Problem Statement

Independent pharmacies cannot safely use PharmaCast product routes until the frontend has a real Supabase Auth session model, authentication pages, onboarding collection, password reset initiation, route protection, and authenticated app context. The current app shell and auth-era routes are placeholders, so users can reach product pages without authentication and the frontend does not initialize the backend's database-backed user context.

This matters now because all later pharmacy workflows depend on knowing the signed-in user, organization, active locations, and current location. Forecasting, uploads, alerts, settings, chat, and purchase order workflows must be scoped to a tenant and location through Spring Boot, not inferred locally or trusted from JWT custom claims.

The affected users are pharmacy owners and staff at independent Ottawa pharmacies. They need a login and onboarding experience that feels trustworthy, handles normal account failures clearly, and keeps them inside the approved Supabase plus Spring Boot architecture.

## Solution

Implement a frontend authentication slice using Supabase Auth as the only session source. Add production-shaped login, onboarding, and reset password pages. Add middleware route protection with `@supabase/ssr` so all routes except `/login`, `/onboarding`, and `/reset-password` require a Supabase session.

After login or session restoration, the frontend will call Spring Boot `GET /auth/me` with the Supabase access token to initialize the application context. The app context will expose the authenticated user, organization, locations, current location, and a setter for current location. The current location selection will persist in `localStorage` by location id.

Onboarding will collect email, password, pharmacy name, first location name, and first location address through a three-step flow. The final optional CSV step will be a placeholder with skip behavior only. On submit, the frontend will create the Supabase Auth user, call Spring Boot `POST /auth/bootstrap` with `organization_name`, `location_name`, and `location_address`, then redirect to the dashboard after bootstrap succeeds.

The backend now exposes finalized `POST /auth/bootstrap`, backed by `bootstrap_first_owner_user`. The frontend must call this endpoint with the Supabase access token when a signup returns an immediate session, and must support already-signed-in unbootstrapped users completing the same onboarding form.

## User Stories

1. As a pharmacy owner, I want to sign in with email and password, so that I can access my pharmacy dashboard.
2. As a pharmacy owner, I want invalid credentials to produce a clear error, so that I know the email or password needs correction.
3. As a pharmacy owner, I want an unconfirmed email state to be distinguishable from wrong credentials, so that I know I need to confirm my account.
4. As a pharmacy owner, I want a forgot password link from login, so that I can recover access without contacting support.
5. As a signed-in user, I want successful login to take me to `/dashboard`, so that I land in the operational workspace.
6. As a new pharmacy owner, I want onboarding step 1 to collect email, password, and pharmacy name, so that my account and tenant can be initialized.
7. As a new pharmacy owner, I want onboarding step 2 to collect the first location name and address, so that the product has an initial operating location.
8. As a new pharmacy owner, I want onboarding step 3 to show an optional CSV upload placeholder, so that I understand upload is the next workflow without being blocked by it.
9. As a new pharmacy owner, I want to skip the CSV placeholder step, so that I can finish account setup before preparing dispensing history.
10. As a new pharmacy owner, I want signup to create a Supabase Auth user, so that the frontend uses the same session model as the rest of the product.
11. As a backend engineer, I want onboarding to call `POST /auth/bootstrap` with `organization_name`, `location_name`, and `location_address`, so that Spring Boot can create the first owner tenant shape.
12. As a frontend engineer, I want onboarding to avoid direct database bootstrap calls and use Spring `POST /auth/bootstrap`, so that Spring Boot remains the orchestration and enforcement layer.
13. As a user whose email confirmation is required, I want onboarding to show a confirmation state, so that I know why I was not immediately redirected.
14. As a user with a Supabase session but no backend app profile, I want the app to detect `USER_PROFILE_NOT_BOOTSTRAPPED`, so that incomplete setup is not treated as a normal signed-in tenant context.
15. As a user, I want reset password to accept my email address, so that Supabase can send a recovery email.
16. As a user, I want reset password to show a success confirmation state, so that I know the recovery request was submitted.
17. As an anonymous visitor, I want protected routes to redirect me to `/login`, so that pharmacy data routes are not exposed without authentication.
18. As a signed-in user, I want public auth pages to avoid trapping me away from the app, so that I can continue to the dashboard when appropriate.
19. As a frontend engineer, I want middleware to use `@supabase/ssr`, so that session cookies are read and refreshed through the approved Supabase helper.
20. As a frontend engineer, I want no custom JWT parsing or issuance, so that the frontend does not duplicate backend auth responsibilities.
21. As a frontend engineer, I want `/auth/me` to be the source of user, organization id, role, and locations, so that authorization context comes from Spring Boot and the database.
22. As a frontend engineer, I want the auth context to expose `user`, `organization`, `locations`, `currentLocation`, and `setCurrentLocation`, so that product pages can scope future workflows consistently.
23. As a multi-location pharmacy user, I want the selected location to persist locally, so that returning to the app preserves my working location.
24. As a multi-location pharmacy user, I want an unavailable saved location to fall back to the first active backend location, so that stale local state does not break the app.
25. As a QA engineer, I want login, onboarding, reset, middleware, and context behavior covered by tests, so that regressions are caught before later workflows depend on auth.
26. As a compliance reviewer, I want patient-level fields excluded from auth prompts, logs, metadata, and context, so that authentication work does not introduce sensitive data exposure.
27. As a product owner, I want auth pages to follow the clinical design direction, so that account flows feel consistent with pharmacy operations.
28. As a support operator, I want backend auth errors to map to understandable frontend states, so that users do not see raw implementation details.
29. As a future feature engineer, I want frontend bootstrap behavior to depend on the finalized Spring endpoint, so that onboarding persists tenant setup before dashboard entry.
30. As a future feature engineer, I want authenticated app context available from a single provider, so that uploads, forecasts, alerts, chat, and settings can share one tenant/location contract.

## Implementation Decisions

- Supabase Auth is the only frontend session model.
- The frontend will not issue, parse, store, or customize JWTs beyond passing the Supabase access token to Spring Boot as a bearer token.
- Spring Boot remains the owner of auth validation, organization authorization, role loading, DB reads/writes, and bootstrap persistence.
- The frontend will call `GET /auth/me` after Supabase session establishment to initialize app context.
- The frontend may call `POST /auth/logout` as a backend acknowledgement, but actual logout is `supabase.auth.signOut()`.
- Route protection is enforced in Next.js middleware with `@supabase/ssr`.
- Public frontend routes are `/login`, `/onboarding`, and `/reset-password`.
- All other routes are protected by Supabase session presence.
- Login supports email/password, invalid credentials error, unconfirmed email state, forgot password navigation, pending state, and successful dashboard redirect.
- Onboarding is a three-step client flow: account/pharmacy, first location, optional CSV placeholder.
- Onboarding sends `organization_name`, `location_name`, and `location_address` to `POST /auth/bootstrap` after Supabase session establishment.
- The optional CSV upload step is UI-only in this slice; no file parsing, upload, or ingestion starts here.
- Password reset initiates Supabase recovery email delivery and shows a success state.
- The auth context exposes authenticated user, organization, locations, current location, current location setter, readiness, and auth error state.
- Organization identity in app context comes from `organization_id` returned by `GET /auth/me`.
- Organization display name is not finalized by the backend response in this contract; the frontend must avoid treating signup metadata as authorization truth.
- Locations in app context come from `GET /auth/me`.
- Current location persistence uses browser `localStorage` and stores the selected location id only.
- If the saved location id is not present in the current backend location list, the first returned location becomes current.
- `USER_PROFILE_NOT_BOOTSTRAPPED` is handled as an incomplete backend setup state and routes users to onboarding so they can call bootstrap.
- No patient-level fields are included in auth forms, Supabase metadata, app context, prompts, logs, or exports.
- No frontend calls are made to Python forecast or LLM services.
- The finalized backend bootstrap endpoint is `POST /auth/bootstrap`; the frontend must not call the SQL function directly.

## Testing Decisions

- Tests should assert user-visible behavior and stable integration contracts, not private component implementation.
- Login tests should cover successful sign-in flow, invalid credentials, unconfirmed email, pending submit state, forgot password link, and missing Supabase configuration.
- Onboarding tests should cover step progression, required field validation, metadata passed to Supabase signup, `POST /auth/bootstrap`, CSV placeholder skip behavior, confirmation-required state, and session-present redirect behavior.
- Reset password tests should cover email submission, Supabase recovery call, success confirmation, submit failures, and missing Supabase configuration.
- Middleware tests should cover anonymous redirects from protected routes, public route access, and authenticated access when Supabase returns a session.
- Auth context tests should cover no session, successful `/auth/me` initialization, `USER_PROFILE_NOT_BOOTSTRAPPED`, location persistence, stale saved location fallback, and sign-out state clearing.
- API client tests should verify bearer token attachment and backend error-code extraction where practical.
- Existing route and shell tests should be updated only where placeholder assumptions are replaced by real auth behavior.
- Tests should not require live Supabase credentials or a live Spring Boot backend.

## Out of Scope

- Direct Supabase RPC calls to `bootstrap_first_owner_user` are out of scope; the frontend uses Spring `POST /auth/bootstrap`.
- Supabase Admin API usage is out of scope.
- Server-side token revocation is out of scope.
- Password update callback UI after clicking a recovery email is out of scope unless added by a later PRD.
- Email template customization is out of scope.
- CSV file parsing, validation, upload, and ingestion are out of scope.
- Role-specific authorization UI is out of scope beyond preserving known role values.
- Billing, notifications, forecasting, LLM chat, and purchase order generation are out of scope.
- Backend schema changes are out of scope.
- Supabase RLS policy implementation is out of scope for this frontend feature.

## Further Notes

- The backend handoff is the source of truth for `GET /auth/me`, `POST /auth/bootstrap`, `POST /auth/logout`, `USER_PROFILE_NOT_BOOTSTRAPPED`, and bootstrap request/response field names.
- The main integration dependency is that `POST /auth/bootstrap` requires a valid Supabase access token, so email-confirmation-required signups cannot bootstrap until the user signs in.
- Auth pages should retain the established clinical visual direction: deep navy primary, teal accent, crisp white surfaces, compact spacing, and readable form states.
- User-facing timestamps are not part of this feature. Future scheduling and notification flows should display in ET while persisted timestamps remain UTC.
