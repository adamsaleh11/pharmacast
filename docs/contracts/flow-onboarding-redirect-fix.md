# Implementation Handoff Contract

## 1. Summary

- **What was implemented**: Fixed the redirect flow after successful CSV upload in onboarding, and fixed the "Create an account" link navigation from login page.
- **Why it was implemented**: After completing the CSV upload step in onboarding, users were not being redirected to the dashboard. They had to manually click "Continue to dashboard". Additionally, clicking "Create an account" on the login page was causing redirect loops or navigation issues.
- **What is in scope**: Automatic redirect after CSV upload, improved onboarding auth validation, fixed login-to-onboarding navigation.
- **What is out of scope**: No backend changes, no database changes, no new authentication flows.
- **Which repo/service/module owns this implementation**: Frontend (Next.js App Router), specifically `src/components/product/csv-upload-zone.tsx` and `src/app/onboarding/page.tsx`.

## 2. Files Added or Changed

- `src/components/product/csv-upload-zone.tsx` - UPDATED - Added automatic redirect to dashboard after successful CSV upload. Uses `useEffect` with 1.5 second delay and refs to prevent duplicate redirects.
- `src/app/onboarding/page.tsx` - UPDATED - Simplified the authentication check in the `useEffect`. Removed redundant error handling that was causing unexpected redirects. Now only redirects to dashboard when a profile with `organization_id` actually exists.
- `src/app/login/page.tsx` - UPDATED - Changed "Create an account" link from Next.js `<Link>` to native `<span>` with `window.location.replace()` to prevent SPA routing issues.

## 3. Public Interface Contract

### CsvUploadZone Component

- **Name**: `CsvUploadZone`
- **Type**: React Component
- **Purpose**: Handles CSV file upload with drag-and-drop UI, displays upload progress, and triggers callback on success
- **Owner**: Frontend team
- **Inputs**:
  - `locationId: string | null` - The location ID to associate uploads with
  - `onSuccess?: () => void` - Optional callback fired after successful upload
- **Outputs**: Renders one of: drag-and-drop zone, uploading spinner, processing message, error alert, or success summary
- **Result States**: `idle` | `uploading` | `processing` | `success` | `error`
- **Example**:
  ```tsx
  <CsvUploadZone locationId="loc-123" onSuccess={() => router.push("/dashboard")} />
  ```

### Onboarding Page

- **Name**: `OnboardingPage`
- **Type**: Next.js Page
- **Purpose**: 3-step onboarding wizard for new pharmacy setup (account → location → CSV upload)
- **Owner**: Frontend team
- **Route**: `/onboarding`
- **Auth Behavior**: If user already has profile with `organization_id`, automatically redirects to `/dashboard`

### Login Page

- **Name**: `LoginPage`
- **Type**: Next.js Page
- **Purpose**: Sign-in form for existing users
- **Route**: `/login`
- **New User Link**: "Create an account" triggers `window.location.replace("/onboarding")`

## 4. Data Contract

### UploadState Enum (internal)

- **Type**: `"idle" | "uploading" | "processing" | "success" | "error"`
- **Purpose**: Internal state machine for the upload component
- **Managed by**: `useCsvUpload` hook

### ValidationSummary (from backend)

- **Fields**: `total_rows`, `unique_dins`, `date_range_start`, `date_range_end`, `warnings?`
- **Returned by**: Backend CSV processing endpoint
- **Used in**: Success state display

## 5. Integration Contract

### Upstream Dependencies

- **Supabase Auth**: Session token validation via `getCurrentAuthUser()`
- **useCsvUpload hook**: Manages upload state and API calls

### Downstream Dependencies

- **CSV Upload API**: `POST /api/uploads` (routes to backend)
- **Backend Auth**: `GET /auth/me` for profile validation

### Flow

1. User completes Step 1 & 2 (account + location details)
2. User uploads CSV or clicks "I'll upload later"
3. On success: `onSuccess()` callback fires, redirects to `/dashboard`
4. Onboarding `useEffect` checks for existing profile on mount

## 6. Usage Instructions for Other Engineers

### For CSV Upload

```tsx
import { CsvUploadZone } from "@/components/product/csv-upload-zone";

<CsvUploadZone locationId={locationId} onSuccess={() => window.location.replace("/dashboard")} />
```

- The component automatically redirects after 1.5 seconds when `onSuccess` is provided
- The `onSuccess` callback is optional - if not provided, no auto-redirect occurs
- User can still manually click "Continue to dashboard" if auto-redirect doesn't fire

### For Onboarding Customization

- The onboarding page handles its own auth validation
- To modify redirect behavior, edit the `useEffect` at lines 79-106 in `src/app/onboarding/page.tsx`
- The profile check function `getCurrentAuthUser()` returns a profile object with `organization_id`

### For Login to Onboarding

- The "Create an account" link is now a `<span>` with `onClick={() => window.location.replace("/onboarding")}`
- This prevents Next.js SPA routing issues that caused redirect loops

## 7. Security and Authorization Notes

- No sensitive data changes introduced
- Auth validation still uses backend `/auth/me` endpoint
- Session tokens are validated server-side
- No PHI/PII exposure changes

## 8. Environment and Configuration

- No new environment variables required
- No configuration changes

## 9. Testing and Verification

### Manual Test Steps

1. Start dev server: `npm run dev`
2. Navigate to `/login`
3. Click "Create an account" - should navigate to `/onboarding`
4. Complete Step 1 (email, password, pharmacy name)
5. Complete Step 2 (location name, address)
6. On Step 3: Either upload a CSV or click "I'll upload later"
7. After success, should auto-redirect to `/dashboard` after 1.5 seconds

### Automated Tests

- No unit tests added for this fix (UI behavior is manual)
- Existing test suite in `src/app/routes.test.tsx` covers basic routing

## 10. Known Limitations and TODOs

- Auto-redirect timing is hardcoded to 1.5 seconds - could be made configurable
- No visual indicator during the 1.5 second delay (just a text label "Redirecting to dashboard...")
- The "I'll upload later" skip button also triggers `openDashboard()` which uses `window.location.replace()` - same redirect behavior

## 11. Source of Truth Snapshot

### Key Interface Names

- `CsvUploadZone` - Component at `src/components/product/csv-upload-zone.tsx`
- `OnboardingPage` - Route at `src/app/onboarding/page.tsx`
- `LoginPage` - Route at `src/app/login/page.tsx`

### Key Functions

- `openDashboard()` - Function in onboarding that does `window.location.replace("/dashboard")`
- `useCsvUpload(locationId)` - Hook at `src/hooks/use-csv-upload.ts`

### Key Route Changes

- `/onboarding` - Now works correctly for new users without profiles
- `/login` → `/onboarding` - Fixed navigation

### Key State Transitions

- Upload state: `idle` → `uploading` → `processing` → `success`
- On success: 1.5s delay → `onSuccess()` callback fires

## 12. Copy-Paste Handoff for the Next Engineer

**What's done**:
- CSV upload now auto-redirects to dashboard after 1.5 seconds
- Onboarding properly shows step 1 for new users without profiles
- Login "Create an account" link navigates correctly

**What's safe to depend on**:
- `CsvUploadZone` component with `onSuccess` prop for redirect callbacks
- Onboarding `/onboarding` route works for unauthenticated users
- Login `/login` route works for existing users

**What remains to be built**:
- None for this specific fix

**Gotchas**:
- The auto-redirect uses a 1.5 second delay - user sees "Redirecting to dashboard..." text during this time
- `onSuccess` is called via ref to avoid stale closure issues when state changes

**Read this first**: This contract covers the onboarding redirect fix. Key files are `csv-upload-zone.tsx` (auto-redirect), `onboarding/page.tsx` (simplified auth check), and `login/page.tsx` (navigation fix).