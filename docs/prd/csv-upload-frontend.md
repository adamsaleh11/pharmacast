# PRD: CSV Upload & Validation (Frontend)

## Problem Statement
PharmaForecast depends on high-quality dispensing history to generate accurate inventory forecasts. Currently, getting this data from the Kroll pharmacy management system into PharmaForecast is a manual, opaque process. Pharmacy owners need a way to upload their Kroll export files, receive immediate feedback on data quality, and be reassured that their sensitive business data is being handled securely and accurately.

## Solution
A robust, drag-and-drop CSV upload interface integrated into the onboarding flow and the organization settings. The solution uses a primary Realtime feedback loop (Supabase) with a polling fallback to guide the user through the upload, validation, and ingestion process. It reinforces the system's "intelligent" nature by explaining the validation steps and ensuring data integrity through a strict "all-or-nothing" validation policy.

## User Stories
1. As an Organization Owner, I want to see a clear "Data" tab in Settings, so that I can manage my pharmacy's dispensing history.
2. As an Organization Owner, I want the "Data" tab to be restricted to my role, so that sensitive financial and volume history is not visible to general staff.
3. As a user, I want to drag and drop a Kroll CSV export, so that I can easily provide the data needed for forecasting.
4. As a user, I want the system to validate my file strictly, so that I can be certain the resulting forecasts are based on perfect data.
5. As a user, I want to see a clear filename and size after selecting a file, so that I know I've picked the right one before starting the upload.
6. As a user, I want a warning if I try to navigate away during the "Uploading" phase, so that I don't accidentally interrupt the transmission of a large file.
7. As a user, I want to see informative messages during the "Processing" phase (e.g., "Validating 100,000+ rows..."), so that I understand why the thorough analysis takes time.
8. As a user, I want to see a success summary (row count, drug count, date range) after a successful upload, so that I can verify the import coverage.
9. As a user, I want a "Data Updated" notification if the upload overlaps with existing dates, so that I am reassured that my records are safely updated without double-counting.
10. As a user, I want to see a structured list of errors if the validation fails, so that I know exactly what to fix in my Kroll export.
11. As a user, I want a link to a Kroll export guide whenever I encounter an error, so that I can quickly learn how to generate the correct file.
12. As a new user, I want to be able to "Skip" the CSV upload during onboarding, so that I can explore the dashboard before committing my data.

## Implementation Decisions
- **Access Control:** The "Data" tab in Settings will be conditionally rendered based on the user's role (`owner` only).
- **Onboarding Workflow:** Account bootstrapping (`/auth/bootstrap`) will be triggered upon transition to the CSV step to ensure a valid `locationId` is available for the upload.
- **State Machine:** The upload UI will be governed by a formal state machine (`idle`, `uploading`, `processing`, `success`, `error`).
- **Realtime Integration:** Primary status updates will come via Supabase Realtime (topic `location:{id}`, event `upload_complete`).
- **Resilience:** A 3-second polling fallback will trigger if a terminal state isn't reached via Realtime within a reasonable window.
- **Navigation Guard:** A `beforeunload` listener will be active during the `uploading` state.
- **Privacy:** `patient_id` will be strictly excluded from all frontend logs, state, and UI elements.
- **API Handling:** The frontend will parse the stringified `validationSummary` JSON returned by the backend.

## Testing Decisions
- **Contract Testing:** Verify the frontend correctly handles the terminal `SUCCESS` and `ERROR` payloads as defined by the backend contract.
- **State Transitions:** Test the custom hook to ensure it transitions correctly from `uploading` to `processing` even if the Realtime event arrives "early" or "late".
- **Role-Based Access:** Verify the "Data" tab is hidden for non-owner roles.
- **File Validation:** Test the 50MB and `.csv` extension limits before attempting an actual network request.

## Out of Scope
- Detailed row-by-row error reporting (currently not supported by the backend DTO).
- Background "Resumable" uploads (TUS/Multipart-upload-resume).
- Editing or deleting specific dispensed records manually in the UI.

## Further Notes
- **Kroll Guide:** A static help page (`/help/kroll-export`) is required to support the "See our guide" links.
- **JSON Parsing:** `validationSummary` must be handled safely with `try/catch` as it is a raw string from the backend.
