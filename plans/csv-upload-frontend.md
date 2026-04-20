# Plan: CSV Upload & Validation (Frontend)

> Source PRD: plans/prd-csv-upload-frontend.md

## Architectural decisions

Durable decisions that apply across all phases:

- **Routes**:
  - `POST /locations/{locationId}/uploads` (Multipart CSV upload)
  - `GET /locations/{locationId}/uploads` (Recent uploads list)
  - `GET /locations/{locationId}/uploads/{uploadId}` (Polling detail)
  - `/help/kroll-export` (Static guide)
- **Key models**:
  - `CsvUploadStatus`: `PENDING`, `PROCESSING`, `SUCCESS`, `ERROR`
  - `ValidationSummary`: Object parsed from backend JSON string (total, valid, invalid rows, drug count, date range, warnings).
- **Auth**:
  - Owner-only access for upload history (`role: 'owner'`).
  - Bearer token required for all backend requests.
- **External services**:
  - Supabase Realtime for terminal status broadcasts on `location:{locationId}`.
- **Privacy Boundary**:
  - `patient_id` must be excluded from all frontend layers (state, logs, UI).

---

## Phase 1: API Foundation & Onboarding Bootstrap

**User stories**: 12

### What to build

Refactor the onboarding flow to ensure the location is bootstrapped before reaching the upload step. Establish the TypeScript types and the API client for upload operations.

### Acceptance criteria

- [ ] `bootstrapFirstOwner` is called when transitioning from Onboarding Step 2 to Step 3.
- [ ] `locationId` is successfully retrieved and stored in state for the upload step.
- [ ] API client implements `uploadCsv`, `listUploads`, and `getUploadDetail`.
- [ ] TypeScript interfaces match the backend DTO shapes.

---

## Phase 2: Basic Upload & Processing Feedback

**User stories**: 3, 4, 5, 7

### What to build

The core `CsvUploadZone` component and the `useCsvUpload` hook state machine. Handle the physical file selection and the multipart POST request.

### Acceptance criteria

- [ ] Drag-and-drop zone accepts only `.csv` and files < 50MB.
- [ ] "Uploading..." state shows indeterminate progress during the POST request.
- [ ] "Processing..." state displays trust-building messages (e.g., "Validating 100,000+ rows...").
- [ ] Frontend strictly enforces no `patient_id` exposure in local state.

---

## Phase 3: Real-time Results & Resilience

**User stories**: 8, 9, 10, 11

### What to build

Integration with Supabase Realtime for terminal status updates. Implement a polling fallback for robustness and the final success/error UI components.

### Acceptance criteria

- [ ] Frontend subscribes to Supabase Realtime topic `location:{locationId}`.
- [ ] Terminal state (`SUCCESS`/`ERROR`) is reached via Realtime broadcast.
- [ ] Polling fallback (3s interval) kicks in if Realtime fails to deliver a terminal state.
- [ ] Success card shows summary data and the "Data Updated" reassurance badge for overlapping dates.
- [ ] Error card shows structured failure message and links to the Kroll guide.

---

## Phase 4: Restricted Data History

**User stories**: 1, 2

### What to build

The "Data" management view within the Settings page, restricted to organization owners.

### Acceptance criteria

- [ ] "Data" tab is visible in Settings only for users with `role: 'owner'`.
- [ ] History table displays the 10 most recent uploads with status badges.
- [ ] "Processing" state in table shows a spinner and current status.

---

## Phase 5: Safety & Polish

**User stories**: 6, 12

### What to build

Final safety guards and the static Kroll export documentation.

### Acceptance criteria

- [ ] `beforeunload` navigation guard prevents tab closure during the active `uploading` state.
- [ ] "Skip CSV" button correctly navigates to the dashboard after account setup.
- [ ] `/help/kroll-export` page is reachable and provides step-by-step instructions.
- [ ] Final end-to-end verification of the onboarding-to-dashboard flow.
