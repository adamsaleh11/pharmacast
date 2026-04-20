# Implementation Handoff Contract

## 1. Summary
- Implemented frontend auth fixes for Supabase signup confirmation, onboarding bootstrap retry, and API error handling.
- The bug investigation found the frontend does send `Authorization: Bearer <supabase_access_token>` when Supabase has a session; Spring logs showed `Signed JWT rejected: Another algorithm expected, or no matching key(s) found`, so the token was not valid for the backend-configured Supabase project/JWKS.
- In scope: Next.js auth callback, onboarding metadata preservation, cooldown behavior, frontend API client cleanup, and backend contract.
- Out of scope: Spring Boot implementation, Supabase database migrations, RLS policies, password update UI, and CSV ingestion.
- Owner: frontend repo/module at `/Users/adamsaleh/Downloads/pharmacast`; backend owns token validation and database persistence.

## 2. Files Added or Changed
- `/Users/adamsaleh/Downloads/pharmacast/src/app/auth/callback/route.ts` - created; exchanges Supabase PKCE `code` for a server-side session and redirects to a safe local `next` path.
- `/Users/adamsaleh/Downloads/pharmacast/src/app/onboarding/page.tsx` - updated; signup confirmation now redirects through `/auth/callback?next=/onboarding`, existing sessions can bootstrap without creating another Supabase user, signup metadata is prefilled from `session.user.user_metadata`, and bootstrap fetches the current Supabase session immediately before calling Spring.
- `/Users/adamsaleh/Downloads/pharmacast/src/middleware.ts` - updated; `/auth/callback` is a public route so confirmation links can establish a session before protected routing.
- `/Users/adamsaleh/Downloads/pharmacast/src/lib/api/client.ts` - updated; keeps bearer-token support and structured `ApiError`, removes browser console logging of API bodies/responses, and logs a non-sensitive warning on 401 showing whether the Authorization header was present.
- `/Users/adamsaleh/Downloads/pharmacast/src/lib/supabase/session.ts` - created; provides `getBackendAccessToken` and temporary safe JWT header/claim diagnostics without logging token values.
- `/Users/adamsaleh/Downloads/pharmacast/.env.example` - updated; documents the backend-configured Supabase project URL `https://ebrxagoygjtnpzlnxtmr.supabase.co`.
- `/Users/adamsaleh/Downloads/pharmacast/src/app/auth-pages.test.tsx` - updated; tests clear local signup cooldown state and expect `idempotencyKey` metadata.

## 3. Public Interface Contract
- Name: `GET /auth/callback`
- Type: Next.js route handler.
- Purpose: complete Supabase email-confirmation PKCE flow.
- Owner: frontend.
- Inputs: query `code?: string`, query `next?: string`.
- Outputs: redirect response.
- Required fields: none; when `code` is present it is passed to `supabase.auth.exchangeCodeForSession(code)`.
- Optional fields: `next`, accepted only when it starts with `/` and not `//`.
- Validation rules: unsafe or missing `next` falls back to `/dashboard`.
- Defaults: `/dashboard` redirect.
- Status/result states: redirects to `next` on success; redirects to `/login?error=auth_callback_failed` if exchange fails; redirects to `/login?error=supabase_not_configured` if Supabase env is missing.
- Error shapes: redirect query only; no JSON response.
- Example input: `/auth/callback?code=SUPABASE_CODE&next=/onboarding`.
- Example output: `302 Location: /onboarding` with Supabase session cookies set.

- Name: `POST /auth/bootstrap`
- Type: Spring Boot endpoint expected by frontend.
- Purpose: create the first owner app profile, organization, and initial location after Supabase signup.
- Owner: backend.
- Inputs: `Authorization: Bearer <supabase_access_token>` and JSON body with `organization_name`, `location_name`, `location_address`.
- Outputs: JSON `{ "organization_id": "uuid", "location_id": "uuid", "user_id": "uuid" }`.
- Required fields: all three body fields and bearer token.
- Status codes/result states: `200` or `201` on created/already-safe success; `400 USER_ALREADY_BOOTSTRAPPED` idempotent duplicate; `400` validation errors; `401 AUTHENTICATION_REQUIRED` only when bearer token is missing, expired, malformed, wrong issuer/audience, or signature-invalid.
- Error shapes: JSON `{ "error": "ERROR_CODE" }`.
- Example input: `{ "organization_name": "Ottawa Independent Pharmacy", "location_name": "Bank Street", "location_address": "100 Bank St, Ottawa, ON" }`.
- Example output: `{ "organization_id": "6b3...", "location_id": "8c1...", "user_id": "43a..." }`.

- Name: `GET /auth/me`
- Type: Spring Boot endpoint expected by frontend.
- Purpose: return database-backed auth context after login/session restoration.
- Owner: backend.
- Inputs: `Authorization: Bearer <supabase_access_token>`.
- Outputs: JSON `{ "id": "uuid", "email": "owner@example.ca", "role": "owner", "organization_id": "uuid", "locations": [{ "id": "uuid", "name": "Bank Street" }] }`.
- Required fields: bearer token.
- Status codes/result states: `200` with context; `401 AUTHENTICATION_REQUIRED` only for invalid/missing token; `403 USER_PROFILE_NOT_BOOTSTRAPPED` when token is valid but no app user/profile row exists.
- Error shapes: JSON `{ "error": "ERROR_CODE" }`.

## 4. Data Contract
- `SignupBootstrapMetadata`: `{ organization_name: string; location_name: string; location_address: string }`; all required, trimmed before submit.
- Supabase signup metadata: same fields plus `idempotencyKey: string`; stored only in Supabase Auth user metadata to help resume confirmed signup.
- `AuthBootstrapResponse`: `{ organization_id: string; location_id: string; user_id: string }`; all UUID strings from backend.
- `AuthMeResponse`: `{ id: string; email: string; role: "owner" | "admin" | "pharmacist" | "staff"; organization_id: string; locations: AppLocation[] }`.
- Expected backend token claims: JWT header `alg: "ES256"`, header `kid: "a1fd80b7-556b-4218-aa7f-76f060797299"`, claim `aud: "authenticated"`, claim `iss: "https://ebrxagoygjtnpzlnxtmr.supabase.co/auth/v1"`, future `exp`, and `sub` as the Supabase Auth user UUID.
- Local storage keys: `pharmacast_signup_idempotency`, `pharmacast_last_signup_attempt`, `pharmacast.currentLocationId`.

## 5. Integration Contract
- Upstream: Supabase Auth via `@supabase/ssr`.
- Downstream: Spring Boot API at `NEXT_PUBLIC_API_URL`.
- Services called by frontend: Supabase `signUp`, `signInWithPassword`, `getSession`, `exchangeCodeForSession`; Spring `GET /auth/me`, `POST /auth/bootstrap`, optional `POST /auth/logout`.
- Auth assumption: Supabase access token must be accepted by Spring as the only bearer credential.
- Retry behavior: `/auth/me` and `/auth/bootstrap` retry once after a 401 by calling `supabase.auth.refreshSession()` and reusing the refreshed `session.access_token`; bootstrap treats `USER_ALREADY_BOOTSTRAPPED` as success.
- Timeout behavior: browser default fetch timeout.
- Fallback behavior: email-confirmation-required signups show a confirmation screen; after email confirmation the callback returns to onboarding with metadata prefilled.
- Idempotency behavior: frontend sends `idempotencyKey` in Supabase user metadata, but Spring currently receives only organization/location fields. Backend should be idempotent by Supabase user id.

## 6. Usage Instructions for Other Engineers
- Frontend engineers can rely on `bootstrapFirstOwner(accessToken, metadata)` and `getCurrentAuthUser(accessToken)` from `/Users/adamsaleh/Downloads/pharmacast/src/lib/api/auth.ts`.
- Browser diagnostics for a 401 now log `[API] Backend rejected authenticated request.` with `path`, `status`, `code`, and `authorizationHeader: "present" | "missing"`; this does not log token values.
- Backend engineers must validate the Supabase JWT signature, issuer, audience, expiry, and subject, then use `sub` as the stable external auth user id.
- Backend should create or upsert the app `users` row during `POST /auth/bootstrap` and return `USER_PROFILE_NOT_BOOTSTRAPPED` from `GET /auth/me` when a valid Supabase user exists without app rows.
- UI handles loading, missing session, successful context, unbootstrapped context, validation failures, 401, and generic backend failure.
- Do not change request field names without coordinating frontend changes.

## 7. Security and Authorization Notes
- Frontend never parses JWT claims for authorization and never calls Python services.
- Spring Boot remains the enforcement layer for auth validation, organization/location authorization, DB writes, notifications, billing, and Python service calls.
- `patient_id` is not collected or sent in this flow and must not be added to metadata, prompts, logs, exports, or purchase orders.
- API client no longer logs request bodies, response bodies, or token snippets in the browser console.
- Backend must validate organization/location ownership server-side even when Supabase RLS exists.

## 8. Environment and Configuration
- `NEXT_PUBLIC_SUPABASE_URL`: required for Supabase client/server auth helpers; missing value disables frontend Supabase flows.
- Required Supabase project URL: `https://ebrxagoygjtnpzlnxtmr.supabase.co`; frontend `.env` currently matches this value and `.env.example` now documents it.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: required public Supabase anon/publishable key; missing value disables frontend Supabase flows.
- `NEXT_PUBLIC_API_URL`: required Spring Boot API base URL; missing value makes API client throw `NEXT_PUBLIC_API_URL is not configured.`
- No service-role keys, database passwords, or backend secrets are used in the frontend.

## 9. Testing and Verification
- Updated tests: `/Users/adamsaleh/Downloads/pharmacast/src/app/auth-pages.test.tsx`.
- Verified commands: `npm test` passed with 6 files and 12 tests; `npm run lint` passed; `npm run build` passed when run outside the sandbox because Turbopack needs worker process/port permissions.
- Local validation: create an account with email confirmation enabled, click the Supabase confirmation link, land on `/onboarding`, confirm metadata is prefilled, click `Skip CSV and finish`, and verify Spring creates app `users`, `organizations`, and `locations` rows.
- Known test gap: no live Supabase/Spring integration test exists in this repo.

## 10. Known Limitations and TODOs
- If backend still returns `401 AUTHENTICATION_REQUIRED`, inspect the `[auth debug]` console output. `alg: "HS256"` means the browser is using a stale/legacy token; sign out, clear site data for the frontend origin, and sign in again. A wrong `iss` means frontend and backend are using different Supabase projects.
- Frontend does not automatically call `POST /auth/bootstrap` inside `/auth/callback`; user completes bootstrap on `/onboarding`.
- Reset-password callback/update-password UI is NOT IMPLEMENTED.
- Next.js 16 warns that `middleware` is deprecated in favor of `proxy`; migration is NOT IMPLEMENTED.

## 11. Source of Truth Snapshot
- Final frontend route: `/auth/callback`.
- Final Spring routes expected: `GET /auth/me`, `POST /auth/bootstrap`, `POST /auth/logout`.
- Final DTOs: `SignupBootstrapMetadata`, `AuthBootstrapResponse`, `AuthMeResponse`.
- Final error codes consumed: `AUTHENTICATION_REQUIRED`, `USER_PROFILE_NOT_BOOTSTRAPPED`, `USER_ALREADY_BOOTSTRAPPED`.
- Key files: `src/app/auth/callback/route.ts`, `src/app/onboarding/page.tsx`, `src/lib/api/auth.ts`, `src/lib/api/client.ts`, `src/providers/app-context.tsx`, `src/middleware.ts`.
- Breaking change from prior frontend behavior: signup email confirmations no longer redirect directly to `/dashboard`; they redirect through `/auth/callback?next=/onboarding`.

## 12. Copy-Paste Handoff for the Next Engineer
- Already done: frontend creates Supabase users, sends bootstrap metadata to Spring with bearer token, handles confirmed-session onboarding, and initializes app context from `GET /auth/me`.
- Safe to depend on: frontend calls `supabase.auth.getSession()` immediately before `GET /auth/me` and `POST /auth/bootstrap`, uses `session.access_token`, logs safe token diagnostics, and retries once after 401 with `refreshSession()`.
- Remains to build/fix: if diagnostics show `alg: "HS256"` or wrong `iss`/`kid`, clear stale browser auth state or correct frontend env; if diagnostics match backend expectations and Spring still rejects, backend JWKS/JWT config is wrong.
- Trap: `USER_PROFILE_NOT_BOOTSTRAPPED` is a `403` valid-session app-profile state, not session expiry. `401 AUTHENTICATION_REQUIRED` means missing/invalid/expired/wrong-project token.
- Read first: sections 3, 5, and 10.
