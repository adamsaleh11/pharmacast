# Plan: Frontend Authentication

> Source PRD: `docs/prd/frontend-authentication.md`

## Architectural decisions

Durable decisions that apply across all phases:

- **Routes**: public auth routes are `/login`, `/onboarding`, and `/reset-password`; all other routes require a Supabase session and should redirect anonymous users to `/login`; successful authenticated entry lands on `/dashboard`.
- **Schema**: no frontend-owned database schema changes are part of this feature. Signup bootstrap metadata uses `organization_name`, `location_name`, and `location_address` to align with the backend bootstrap function contract.
- **Key models**: frontend app context exposes authenticated user, organization, locations, current location, current location setter, readiness, and auth error state. Locations are loaded from `GET /auth/me`.
- **Auth**: Supabase Auth is the only frontend session model. The frontend does not issue custom tokens, parse JWT authorization claims, or trust JWT custom role or organization data.
- **Backend contract**: Spring Boot `GET /auth/me` is the source of database-backed user, role, organization id, and active locations. `POST /auth/logout` is optional stateless acknowledgement; actual logout is `supabase.auth.signOut()`.
- **Bootstrap**: the backend exposes finalized `POST /auth/bootstrap`, backed by `bootstrap_first_owner_user`. The frontend calls it with the Supabase access token and `organization_name`, `location_name`, and `location_address` before dashboard entry.
- **External services**: frontend calls Supabase Auth and Spring Boot only. It never calls Python forecast or LLM services directly.
- **Compliance**: auth forms, metadata, context, logs, and UI must not include patient-level fields.

---

## Phase 1: Session Guard Baseline

**User stories**: 17, 18, 19, 20

### What to build

Add Supabase SSR middleware route protection that lets anonymous users reach only `/login`, `/onboarding`, and `/reset-password`. Protected routes should redirect to `/login` when no Supabase session exists, and public auth routes should remain directly reachable for recovery and first-time setup flows.

### Acceptance criteria

- [ ] Anonymous access to `/dashboard` and other product routes redirects to `/login`.
- [ ] `/login`, `/onboarding`, and `/reset-password` remain public.
- [ ] Middleware uses Supabase SSR session helpers and does not parse JWT claims manually.
- [ ] Middleware preserves the originally requested protected path as a return URL where practical.
- [ ] Tests or focused verification cover public and protected route behavior without live Supabase credentials.

---

## Phase 2: Auth API And Context Contract

**User stories**: 21, 22, 23, 24, 28, 30

### What to build

Create the typed frontend integration for `GET /auth/me`, map backend auth errors into stable frontend states, and replace placeholder app context with session-aware auth state. The context should initialize from the Supabase session, call Spring Boot with the bearer token, expose current tenant/location data, and persist selected location id in local storage.

### Acceptance criteria

- [ ] `/auth/me` requests include `Authorization: Bearer <supabase_access_token>`.
- [ ] The context exposes `user`, `organization`, `locations`, `currentLocation`, `setCurrentLocation`, readiness, and auth error state.
- [ ] Successful `/auth/me` initializes user role, organization id, locations, and current location.
- [ ] `USER_PROFILE_NOT_BOOTSTRAPPED` is represented as incomplete setup and routes users to onboarding for bootstrap.
- [ ] Missing or expired auth clears app user, organization, locations, and current location.
- [ ] Current location persists by id in local storage and falls back when the saved id is stale.

---

## Phase 3: Login Flow

**User stories**: 1, 2, 3, 4, 5, 27

### What to build

Replace the login placeholder with a Supabase email/password sign-in form. It should provide clear pending, success, invalid-credentials, unconfirmed-email, missing-configuration, and generic failure states while preserving the clinical visual direction.

### Acceptance criteria

- [ ] Users can enter email and password and submit with `signInWithPassword`.
- [ ] Successful login redirects to `/dashboard` or the preserved return URL.
- [ ] Invalid credentials show a clear form-level error.
- [ ] Unconfirmed email is handled as a distinct state.
- [ ] Forgot password links to `/reset-password`.
- [ ] Submit controls are disabled while the request is pending.
- [ ] The page remains responsive and accessible on mobile and desktop.

---

## Phase 4: Onboarding Signup Flow

**User stories**: 6, 7, 8, 9, 10, 11, 12, 13, 14, 26, 29

### What to build

Build a three-step onboarding flow for first-owner signup. Step 1 collects email, password, and pharmacy name. Step 2 collects first location name and address. Step 3 shows a CSV upload placeholder and allows skip. Submit creates a Supabase Auth user, calls Spring `POST /auth/bootstrap` when a session is available, and handles email-confirmation-required outcomes.

### Acceptance criteria

- [ ] Step 1 collects and validates email, password, and pharmacy name.
- [ ] Step 2 collects and validates first location name and address.
- [ ] Step 3 presents an optional CSV upload placeholder and skip path without parsing or uploading a file.
- [ ] Supabase signup metadata includes `organization_name`, `location_name`, and `location_address`.
- [ ] Email-confirmation-required signup shows a confirmation state.
- [ ] Immediate-session signup calls `POST /auth/bootstrap`, then redirects to `/dashboard`.
- [ ] The flow does not call the SQL bootstrap function directly and uses only Spring `POST /auth/bootstrap`.
- [ ] No patient-level data is requested or transmitted.

---

## Phase 5: Reset Password Flow

**User stories**: 15, 16, 27

### What to build

Replace the reset password placeholder with a Supabase recovery request form. The page should accept an email address, call Supabase recovery, and show a confirmation state that does not reveal whether the email belongs to an account.

### Acceptance criteria

- [ ] Users can submit an email address for password recovery.
- [ ] Supabase `resetPasswordForEmail` receives an application redirect URL.
- [ ] A success confirmation appears after submission.
- [ ] Pending, missing-configuration, and generic failure states are handled.
- [ ] The page remains responsive and accessible on mobile and desktop.

---

## Phase 6: Auth-Aware Shell And Final QA

**User stories**: 23, 25, 27, 30

### What to build

Update product shell surfaces to consume authenticated app context rather than hard-coded organization and location placeholders where possible. Add or update tests around auth pages, context, and shell behavior, then run the strongest available frontend verification and polish pass.

### Acceptance criteria

- [ ] The app shell displays context-driven organization and current location when available.
- [ ] Empty or loading auth context does not crash product layout.
- [ ] Existing route tests are updated for real auth-era page headings and behavior.
- [ ] Auth page tests cover core success, error, and pending states without live services.
- [ ] Auth context tests cover successful initialization, unbootstrapped profile redirect behavior, no session, and location persistence.
- [ ] Lint, tests, and build pass or documented failures explain the blocker.
- [ ] Final UI review confirms clinical styling, readable forms, non-overlapping responsive layout, and complete visible states.
