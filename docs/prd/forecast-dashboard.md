## Problem Statement

Independent pharmacists need one daily screen where they can see which drugs are at reorder risk, enter live on-hand inventory, and generate demand forecasts without leaving the workflow. Today the frontend `/dashboard` is a static scaffold. It does not consume the backend forecast APIs, does not expose the new `current_stock` source of truth, and cannot support the key operational behavior: pharmacists manually enter current stock, then generate forecasts only for drugs with entered stock.

This matters now because the backend has already moved live stock into the `current_stock` table and made it mandatory for forecast generation. CSV upload now supplies only historical dispensing data for Prophet. If the dashboard keeps behaving as if CSV stock is authoritative, pharmacists will see misleading readiness states and may generate or interpret forecasts against the wrong inventory reality.

The dashboard must also respect the backend implementation as-is. The backend forecast list returns a raw array of forecast summaries, not aggregate wrapper counts, and the stock list returns only manually entered stock rows. There is no backend endpoint that returns every unique DIN from dispensing history. Therefore the frontend must be honest about its data universe and avoid claiming it displays all uploaded drugs.

## Solution

Build the primary `/dashboard` page as the pharmacist's daily forecasting workflow.

The dashboard will fetch forecasts and current stock for the selected location, merge them into tracked drug rows keyed by DIN, and let pharmacists enter or update current stock directly in a spreadsheet-like table cell. Forecast generation will be gated by current stock. A stock value of `0` is valid and counts as entered; empty stock means no stock entered.

The dashboard will support both all-drug and selected-drug generation. Pharmacists can select rows globally, switch between `All tracked drugs` and `Selected drugs`, and generate forecasts for the chosen target set. Bulk generation will use the backend's POST streaming endpoint through `fetch()` stream parsing, not native `EventSource`, because the backend requires a JSON body and authorization header.

The dashboard will compute stat cards in the frontend from the tracked rows available under the backend contract. The primary count will be named `Tracked Drugs`, not `Total Drugs`, because the backend does not expose all historical DINs with no stock and no forecast. Empty states and copy must remain similarly honest.

Forecasts remain visible when stock changes, but the row is marked stale with `Stock changed` when the live stock differs from the stock value recorded for the displayed forecast during the current browser session. If the pharmacist changes the stock back to that recorded value, the stale state clears.

## User Stories

1. As a pharmacist, I want to see tracked drugs for my current location, so that I can review inventory and forecast status in one daily workspace.
2. As a pharmacist, I want the dashboard to use my selected location, so that I do not accidentally view or modify another pharmacy location's data.
3. As a pharmacist, I want current stock shown separately from forecast demand, so that I can distinguish what I have from what I am expected to need.
4. As a pharmacist, I want to click a current stock cell and type a quantity quickly, so that I can enter inventory without opening forms.
5. As a pharmacist, I want the current stock cell to look like table text until I interact with it, so that the dashboard remains scannable.
6. As a pharmacist, I want rows without stock to show `Enter qty` with a visible edit cue, so that I know what action is needed before forecasting.
7. As a pharmacist, I want `0` stock to be accepted as a valid value, so that drugs with no units on hand can still be forecasted and reordered.
8. As a pharmacist, I want empty stock input to cancel or revert rather than saving zero, so that accidental blank values do not become false inventory counts.
9. As a pharmacist, I want negative, decimal, and excessively large stock values rejected with clear inline warnings, so that data entry mistakes are caught immediately.
10. As a pharmacist, I want stock saves to update optimistically, so that the table feels responsive during bulk entry.
11. As a pharmacist, I want failed stock saves to revert and explain what went wrong, so that I can correct the value without trusting unsaved data.
12. As a pharmacist, I want Tab from one stock input to save and move to the next visible stock input, so that I can enter many quantities like a spreadsheet.
13. As a pharmacist, I want Enter to save stock and stay focused, so that I can quickly confirm a value without changing rows.
14. As a pharmacist, I want Escape to cancel editing and restore the previous value, so that mistakes are easy to abandon.
15. As a pharmacist, I want a green confirmation mark after successful stock saves, so that I know the value persisted.
16. As a pharmacist, I want to generate a forecast for one stocked drug, so that I can update an individual high-priority row without running a full batch.
17. As a pharmacist, I want row generation disabled when stock is missing, so that I understand stock is required first.
18. As a pharmacist, I want a clear tooltip or inline message when generation is blocked by missing stock, so that I know how to fix it.
19. As a pharmacist, I want row generation to show loading only on the affected row, so that I can keep reviewing the rest of the dashboard.
20. As a pharmacist, I want row generation to lock that row's stock cell while it runs, so that the forecast is based on a stable stock value.
21. As a pharmacist, I want a forecast result to update the row immediately, so that I can act on days of supply, demand, confidence, and reorder status.
22. As a pharmacist, I want insufficient-history errors to appear inline, so that I know the problem is data history rather than current stock.
23. As a pharmacist, I want stock-not-set backend errors to map back to stock entry guidance, so that backend validation and UI guidance agree.
24. As a pharmacist, I want to choose 7, 14, or 30 day forecast horizons, so that I can review and generate forecasts for different planning windows.
25. As a pharmacist, I want horizon changes to show existing forecasts for that horizon without auto-generating, so that I stay in control of forecast runs.
26. As a pharmacist, I want rows without a forecast for the selected horizon to say `Not generated`, so that I know a forecast has not been produced for that planning window.
27. As a pharmacist, I want to search by DIN or drug name, so that I can quickly find a medication.
28. As a pharmacist, I want to filter by forecast status, confidence, no-stock state, and therapeutic class where known, so that I can focus my review.
29. As a pharmacist, I want to sort by drug name, days of supply, predicted quantity, and status, so that I can prioritize work.
30. As a pharmacist, I want the default sort to prioritize red, amber, green, not-generated, and no-stock rows, so that urgent risks are surfaced first.
31. As a pharmacist, I want discontinued or dormant drugs to be visibly flagged, so that I do not reorder drugs that may no longer be active.
32. As a pharmacist, I want discontinued status to override forecast status, so that regulatory/drug availability concerns are not hidden.
33. As a pharmacist, I want summary cards for tracked drugs, critical, reorder, well stocked, and missing stock, so that I can understand the day's workload at a glance.
34. As a pharmacist, I want missing stock to be amber rather than red, so that it reads as an action prompt instead of an emergency.
35. As a pharmacist, I want summary counts to update during bulk generation, so that I can see progress affect risk status in real time.
36. As a pharmacist, I want row checkboxes always available, so that I can build a selected worklist while scanning.
37. As a pharmacist, I want selection to persist across search, filters, sorting, horizon changes, and generation, so that I do not lose my worklist.
38. As a pharmacist, I want a `Clear selection` action, so that I can reset the worklist intentionally.
39. As a pharmacist, I want a mode control for `All tracked drugs` versus `Selected drugs`, so that I can forecast the full tracked set or only a subset.
40. As a pharmacist, I want `Generate All` to target all tracked rows, not only filtered rows, so that a search filter does not accidentally narrow the run.
41. As a pharmacist, I want `Generate Selected` to target all checked rows globally, including rows hidden by filters or search, so that selection is a stable worklist.
42. As a pharmacist, I want zero selected rows to block `Generate Selected`, so that no empty backend request is sent.
43. As a pharmacist, I want a visible selected count, so that I know how many drugs will be targeted.
44. As a pharmacist, I want bulk generation to check stock only within the target set, so that unrelated missing stock does not block a selected run.
45. As a pharmacist, I want bulk generation to block when no target drugs have stock, so that I do not start a run the backend cannot process.
46. As a pharmacist, I want a confirmation modal when some target drugs lack stock, so that I can decide whether to generate only stocked drugs or enter stock first.
47. As a pharmacist, I want `Enter stock first` in that modal to focus the first missing-stock target row, so that I can fix readiness quickly.
48. As a pharmacist, I want bulk generation to show progress and completed counts, so that I know a long-running run is active.
49. As a pharmacist, I want stock cells for target DINs locked during bulk generation, so that quantities cannot change while those forecasts are being created.
50. As a pharmacist, I want stock cells outside the bulk target set to remain editable, so that I can keep working.
51. As a pharmacist, I want generation blocked if any target stock save is still in flight, so that forecasts use persisted stock.
52. As a pharmacist, I want a cancel button during bulk generation, so that I can stop listening to a long-running run from the dashboard.
53. As a pharmacist, I want partial results received before cancellation to remain visible, so that successful completed forecasts are not discarded.
54. As a pharmacist, I want a completion toast summarizing successes, insufficient-history failures, and skipped no-stock drugs, so that I know what happened.
55. As a pharmacist, I want forecast rows that turn red during generation to move toward the top according to the active sort, so that urgent risks become visible.
56. As a pharmacist, I want existing forecasts to remain visible after a stock edit, so that useful risk context does not disappear.
57. As a pharmacist, I want a `Stock changed` indicator when live stock differs from the value associated with the displayed forecast, so that I know regeneration is recommended.
58. As a pharmacist, I want the `Stock changed` indicator to clear if I change stock back to the forecast-associated quantity, so that stale state reflects reality.
59. As a pharmacist, I want stale forecasts to still count in forecast stats, so that the dashboard remains stable while clearly marking rows needing regeneration.
60. As a pharmacist, I want `Export Order` disabled until at least one forecast exists, so that I do not export an empty order.
61. As a pharmacist, I want `Export Order` to avoid performing unfinished purchase-order behavior, so that the dashboard does not invent a workflow without a contract.
62. As a pharmacist, I want `Explain` visible only after a forecast exists, so that explanations are tied to real forecast data.
63. As a pharmacist, I want `Explain` to avoid making unsupported LLM calls until its backend contract exists, so that patient privacy and compliance are preserved.
64. As a pharmacist, I want row click to open a detail panel with already-available drug and forecast context, so that I can inspect a row without leaving the dashboard.
65. As a pharmacist, I want row click not to trigger when I click stock inputs, checkboxes, or action buttons, so that table controls remain predictable.
66. As a pharmacist, I want a sticky header and virtualized table behavior, so that large pharmacies with many tracked DINs remain usable.
67. As a pharmacist, I want the dashboard to stay usable while individual API calls load or fail, so that one failed row does not block the full workflow.
68. As a pharmacist, I want unauthenticated or unauthorized states to follow existing app auth behavior, so that tenant isolation remains enforced.
69. As a pharmacy owner, I want the dashboard never to show patient identifiers, so that the product remains compliant with PHIPA and PIPEDA expectations.
70. As an engineer, I want the frontend to consume the backend contract as implemented, so that Feature 6 does not depend on unbuilt endpoints.
71. As an engineer, I want the frontend to compute counts from tracked rows and label them honestly, so that UI claims match available data.
72. As an engineer, I want bulk stream parsing isolated behind a stable interface, so that POST SSE parsing complexity does not leak through dashboard components.
73. As an engineer, I want stock cell behavior isolated in a reusable component, so that spreadsheet editing and validation are testable independently.
74. As an engineer, I want generation target resolution isolated in a small domain module, so that all-vs-selected, stock gating, and in-flight save blocking are consistent.
75. As an engineer, I want dashboard tests to exercise behavior through user interactions and public contracts, so that refactors do not break pharmacist workflows.

## Implementation Decisions

- The backend implementation is treated as the source of truth.
- The dashboard row universe is the union of DINs returned by the active-horizon forecast query and DINs returned by the current-stock query.
- The dashboard will not add or require a backend endpoint for all unique dispensing-history DINs.
- The dashboard will use `Tracked Drugs` instead of `Total Drugs` because backend-as-is does not expose all historical DINs when a DIN has neither stock nor forecast.
- Forecast list consumption will use the backend's raw array response, not the wrapper object previously described in the frontend handoff.
- Forecast counts will be computed on the frontend from the merged tracked row model.
- Current stock will be fetched from `GET /locations/{locationId}/stock` and stored in local component state as a DIN-keyed map.
- Stock writes will call `PUT /locations/{locationId}/stock/{din}` with `{ quantity }`.
- The shared API client will need a PUT capability or an equivalent stock-specific API helper.
- A stock value of `0` is a valid entered stock value.
- Empty stock input is a no-op/revert and must not become zero.
- Stock input client validation will reject negative values, decimal values, and values above a practical frontend maximum of `999999`.
- API stock save failures will revert to the previous stock state, exit edit mode, and show a warning with the best available explanation.
- Client validation errors remain in edit mode so the pharmacist can correct them.
- Stock editing must provide spreadsheet-like keyboard behavior: Enter saves in place, Tab saves and moves to the next visible stock input, Escape cancels.
- The dashboard will maintain a stock-save in-flight set by DIN.
- Forecast generation for a target set is blocked if any target DIN has an in-flight stock save.
- Per-row generation will call `POST /locations/{locationId}/forecasts/generate` with the selected DIN and active horizon.
- Per-row generation locks only that row's stock cell.
- Bulk generation will call `POST /locations/{locationId}/forecasts/generate-all` with JSON body including `location_id`, `dins`, `horizon_days`, and `thresholds`.
- Bulk generation will use `fetch()` stream parsing with authorization headers and an abort controller, not native EventSource.
- Bulk generation target DINs are snapshotted at run start.
- During bulk generation, stock editing is disabled for every target DIN until completion, cancellation, or error.
- Stock editing remains enabled for non-target DINs during bulk generation.
- Partial bulk forecast results received before cancellation remain in the table.
- Bulk cancellation aborts the frontend stream and must not claim that backend work was necessarily cancelled.
- Bulk mode control will support `All tracked drugs` and `Selected drugs`.
- Row checkboxes are always visible.
- Selection is stored by DIN and persists across filtering, searching, sorting, horizon changes, and generation.
- `Generate All` targets all tracked DINs, ignoring filters and search.
- `Generate Selected` targets all checked DINs globally, including rows hidden by filters or search.
- `Generate Selected` with no selected rows blocks and shows guidance.
- Missing-stock checks apply only to the chosen target set.
- If no target DINs have stock, bulk generation does not call the API.
- If some target DINs lack stock, the dashboard shows a confirmation modal and can proceed with only stocked target DINs.
- The horizon toggle supports 7, 14, and 30 days.
- Changing horizon refetches existing forecasts for that horizon but does not generate forecasts.
- Generation updates only the active horizon's forecast cache.
- Rows with stock but no forecast for the selected horizon show `Not generated` with horizon-specific supporting copy.
- Stale forecast tracking is session-local under the backend-as-is contract.
- On initial load, forecast rows with stock are treated as not stale and record the current stock as the forecast-associated stock value.
- When a forecast is generated, the forecast-associated stock value for that DIN becomes the current live stock value.
- A row is stale when live current stock differs from the forecast-associated stock value.
- Stale state clears if stock returns to the forecast-associated stock value.
- Stale forecasts keep their RED/AMBER/GREEN status and add a `Stock changed` indicator.
- `Export Order` is disabled until at least one forecast exists. If no purchase-order contract exists during implementation, the enabled button should avoid performing unfinished behavior and may show a non-destructive unavailable-state message.
- `Explain` appears only after a forecast exists. If no explanation contract exists during implementation, it should avoid LLM calls and may show a non-destructive unavailable-state message.
- Row click opens a lightweight placeholder detail panel using only already-available row data, unless a finalized Feature 7 contract exists by implementation time.
- Row click must not fire when interacting with checkboxes, stock inputs, or action buttons.
- The table must use virtualization through `@tanstack/react-virtual`.
- Infinite-scroll behavior will be implemented as client-side incremental reveal over the merged, sorted, filtered row set because backend-as-is does not provide dashboard pagination.
- Drug metadata will use forecast fields where available and existing per-DIN lookup as fallback. There is no dependency on `GET /drugs`.
- Therapeutic class and drug status filters should degrade gracefully when metadata is unavailable.
- Empty states must be honest under backend-as-is:
  - no successful upload and no tracked rows means no dispensing history visible to the dashboard;
  - successful upload but no tracked rows must not claim all uploaded drugs are visible;
  - tracked rows with no stock should prompt current stock entry;
  - stocked rows with no forecasts should prompt generation.
- Patient identifiers must never appear in dashboard UI, logs, requests, exports, generated text, or tests.
- The frontend must send Spring Boot requests with `Authorization: Bearer <session.access_token>` using the existing Supabase session path.
- The dashboard must continue to rely on backend tenant validation and must not attempt to bypass authorization.

## Testing Decisions

- Tests should focus on external behavior, user interactions, request payloads, and state transitions rather than internal component structure.
- Dashboard data merge behavior should be tested against the backend-as-is contract: raw forecast array plus stock array.
- Tests should verify `Tracked Drugs` uses `forecasts ∪ stock` and does not assume all historical DINs.
- Stock cell tests should cover click-to-edit, Enter save, Escape cancel, Tab navigation, empty no-op, explicit zero, negative rejection, decimal rejection, too-large rejection, optimistic success, and API failure revert.
- Tests should verify that `0` stock counts as entered and enables generation.
- Per-row generation tests should verify disabled state with no stock, enabled state with stock, row loading state, success merge, insufficient-data display, and stock-not-set error handling.
- Bulk generation tests should verify all-mode target resolution ignores filters, selected-mode target resolution includes hidden checked rows, zero selected blocks, missing-stock modal behavior, and in-flight stock save blocking.
- Stream parsing should have focused unit coverage for result, error, done, malformed chunk, and cancellation behavior.
- Stale forecast tests should verify initial non-stale state, stale after stock change, stale cleared when stock changes back, and forecast generation resetting the forecast-associated stock value.
- Horizon tests should verify toggle-driven refetch without generation and active-horizon cache update only.
- Selection tests should verify persistence across filtering, sorting, horizon changes, generation, and clear selection.
- Empty state tests should verify copy does not overclaim unavailable backend data.
- Accessibility-oriented tests should verify controls have usable labels for search, filters, horizon, row selection, stock inputs, generation actions, modal actions, and side panel close.
- Existing dashboard tests can be replaced or expanded because the current dashboard is static scaffold behavior, not the final workflow.
- Existing API and upload test patterns should inform mocking of authenticated backend calls and upload-history state.
- Virtualization itself does not need pixel-perfect testing; tests should assert that row behavior works through accessible controls and that large row sets remain representable.

## Out of Scope

- Adding a backend endpoint for all unique DINs with dispensing history.
- Changing backend forecast list response from raw array to wrapper counts.
- Changing backend batch generation from POST streaming to a GET EventSource-compatible endpoint.
- Changing the current-stock backend schema or source-of-truth decision.
- Reading or displaying CSV `quantity_on_hand` as current stock.
- Implementing the full Feature 7 drug detail panel beyond a lightweight placeholder using available data.
- Implementing LLM forecast explanations without a finalized backend/API contract.
- Implementing purchase order generation or export without a finalized backend/API contract.
- Implementing patient-level views, patient identifiers, patient filtering, or patient exports.
- Implementing backend RLS tests or backend integration coverage.
- Optimizing backend current-stock hydration or forecast list query shape.
- Building a complete drug metadata bulk endpoint.
- Adding external queues or background job infrastructure.

## Further Notes

- The biggest product limitation is that backend-as-is cannot expose uploaded historical DINs that have no current stock and no forecast. The dashboard must use honest labels and empty states to avoid implying complete inventory visibility.
- A future backend endpoint for location-level historical DIN inventory would materially improve the dashboard by enabling true `Total Drugs`, complete stock-entry rows after upload, and accurate "CSV uploaded, no stock entered" workflows.
- Cross-session stale forecast detection is not possible with backend-as-is because forecast summaries do not expose stock-at-generation. The PRD requires session-local stale tracking only.
- If backend later adds stock-at-generation to forecast summaries, the frontend stale tracking model should switch from session-local inference to backend-provided comparison.
- The frontend will likely need new or expanded dashboard-specific modules for API calls, row merging, stock editing, target resolution, stream parsing, and table rendering. These should be designed as deep modules with small testable interfaces.
- The dashboard should prefer existing UI primitives and product components where they fit, but current shared components are not sufficient for the full workflow.
- The required virtualization dependency is not currently present and must be added during implementation.
- If Dialog, Tooltip, Select, Progress, or Toast primitives are missing, implementation should either add scoped primitives consistent with the existing design system or use already-installed Radix packages where available.
- All compliance constraints from the product context remain active. The dashboard should never log raw tokens, patient identifiers, or patient-level data.
- The implementation should be staged so the stock-entry workflow is completed and tested before bulk forecast orchestration, because current stock is the most important pharmacist input surface and the gate for every forecast.
