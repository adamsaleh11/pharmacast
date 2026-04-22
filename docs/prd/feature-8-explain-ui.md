## Problem Statement

Pharmacists need a fast way to understand why a forecast recommends a reorder, but the dashboard and drug detail side panel currently stop at numeric forecast output. Without an explanation layer, users have to infer the meaning of days of supply, predicted quantity, and reorder status on their own, which slows down review and makes the dashboard less actionable.

This matters now because the backend explanation contract already exists and the frontend needs to expose it in the two places pharmacists naturally inspect a forecast: the dashboard table and the drug detail side panel. The explanation must feel immediate, reusable across both surfaces, and safe to use in a pharmacy workflow.

## Solution

Add an explicit `Explain` interaction wherever a forecast is visible and make the resulting explanation available across the dashboard table and the drug detail side panel through one shared React Query cache key.

In the dashboard, `Explain` appears in the row actions only after a forecast exists. When clicked, the row shows a loading state, calls the backend explain endpoint for that location and DIN, and then renders the explanation in a full-width expandable section directly beneath the row.

In the side panel, `Explain this forecast` appears below the forecast card only when a forecast exists. When clicked, the panel uses the same cached query result and renders the same teal-accented explanation block inline below the button.

The explanation content remains selectable for copying into notes. Cached explanations remain available for one hour. If the forecast is regenerated for that DIN, the frontend invalidates the explanation so the user never sees an explanation tied to an older forecast.

## User Stories

1. As a pharmacist, I want to click `Explain` from a forecast row, so that I can quickly understand the recommendation without leaving the dashboard.
2. As a pharmacist, I want `Explain` to appear only when a forecast exists, so that I do not request an explanation for an ungenerated row.
3. As a pharmacist, I want the explain action to show loading feedback, so that I know the system is working.
4. As a pharmacist, I want the loading state to start with a clear analysis message, so that the UI feels specific to the forecast task.
5. As a pharmacist, I want the loading state to show a longer-wait message after a delay, so that slow responses do not feel broken.
6. As a pharmacist, I want a forecast explanation to render below the row in full width, so that I can read it without squinting inside the actions column.
7. As a pharmacist, I want the explanation area to be collapsible, so that I can hide it once I have read it.
8. As a pharmacist, I want the collapsed state to return the row button label back to `Explain`, so that the row action remains clear.
9. As a pharmacist, I want the explanation text to be selectable, so that I can copy it into notes or messaging without friction.
10. As a pharmacist, I want the same explanation to appear in the drug detail side panel if I already asked for it in the table, so that I do not repeat myself.
11. As a pharmacist, I want the same explanation to appear in the dashboard if I already asked for it in the side panel, so that both views stay in sync.
12. As a pharmacist, I want the side panel to show `Explain this forecast` only when a forecast exists, so that the control matches the available data.
13. As a pharmacist, I want the explanation to render inline below the side panel button, so that I can keep the explanation near the forecast card.
14. As a pharmacist, I want a simple retry action when explanation generation fails, so that I can try again without refreshing the page.
15. As a pharmacist, I want retry to bypass stale cached data, so that a second attempt really calls the backend again.
16. As a pharmacist, I want explanation failures to be shown without technical details, so that the UI stays clear and non-threatening.
17. As a pharmacist, I want the UI to clear or refresh an explanation when the forecast is regenerated, so that I do not read outdated guidance.
18. As a pharmacist, I want an explanation to remain cached for a short time, so that reopening the other view is instant.
19. As a pharmacist, I want the cached explanation to be shared across table and side panel, so that one click benefits both places.
20. As a pharmacist, I want the explanation block to use a consistent teal accent, so that it feels like one product pattern instead of two separate features.
21. As a pharmacist, I want the explain workflow to trigger only when I explicitly click, so that the app never sends explanation requests on its own.
22. As a pharmacist, I want the feature to stay within the authenticated pharmacy workspace, so that explanations only reflect the location I am allowed to see.
23. As a pharmacist, I want explanation content to avoid patient-level data, so that the workflow remains compliant and trustworthy.
24. As a frontend engineer, I want one shared query key for explanations by location and DIN, so that both UI surfaces reuse the same cached result.
25. As a frontend engineer, I want forecast regeneration to invalidate that explanation cache entry, so that the explanation stays aligned with the latest forecast.

## Implementation Decisions

- The frontend will consume the backend explain contract at `POST /locations/{locationId}/forecasts/{din}/explain`.
- The response will be treated as `{ explanation, generated_at }` and nothing more.
- The explanation cache key will be shared across the dashboard and the side panel and will be scoped by location and DIN.
- Cached explanations will use a 1-hour stale window.
- Regenerating a forecast for the same DIN will invalidate the explanation cache entry for that DIN.
- The dashboard row will show `Explain` only when a forecast exists for that row.
- The dashboard explanation will render as a full-width expandable block below the row, not inside the actions column.
- The side panel explanation will render inline below the forecast card button.
- Both surfaces will use the same visual treatment: teal left border, selectable text, and compact explanatory copy.
- The loading state will begin with `Analyzing your dispensing patterns...`.
- If loading exceeds 15 seconds, the UI will append a longer-wait message indicating the request is still working.
- Failure states will use a single user-facing message: `Explanation unavailable — try again`.
- A retry action will re-run the mutation and bypass cached success state.
- The feature will remain explicit-click only and will not auto-trigger from row hover, panel open, or forecast load.
- The existing side panel explanation state should be aligned with the shared cache rather than kept as a separate one-off response holder.
- The explanation UI should be implemented with local inline expand/collapse behavior instead of introducing a new reusable accordion primitive.

## Testing Decisions

- Test the explanation flow through user-visible behavior, not through implementation details of the query cache.
- Verify the dashboard row only shows `Explain` after a forecast exists.
- Verify clicking `Explain` shows a loading state and then renders a selectable explanation block below the row.
- Verify the side panel shows `Explain this forecast` only when a forecast exists.
- Verify the side panel renders the shared explanation inline when the cache has already been populated elsewhere.
- Verify collapsing the explanation hides the content without losing the cached result.
- Verify retry after failure calls the backend again and does not reuse the failed state.
- Verify forecast regeneration invalidates the explanation and causes a fresh request on the next explain action.
- Verify the delayed loading copy appears after the configured wait threshold.
- Existing dashboard and drug-detail panel tests should be expanded rather than replaced, because they already exercise the surrounding workflow.

## Out of Scope

- Changing the backend explanation API contract.
- Persisting explanations in the database.
- Supporting auto-generated explanations without a user click.
- Adding explanations to any surface other than the dashboard table and drug detail side panel.
- Exposing technical error details to the user.
- Adding patient-level explanation data or any external data beyond the backend contract.
- Reworking the rest of the dashboard forecast workflow, stock entry workflow, or bulk generation flow.

## Further Notes

- The explanation cache is intentionally short-lived and should be treated as a convenience layer, not a permanent record.
- The explanation content itself is not product-owned prose; the frontend should be resilient to wording changes from the backend service.
- The shared cache and shared visibility behavior are the key product expectations for this feature.
- The feature should preserve the current compliance posture: no patient identifiers in the request, response, logs, or rendered UI.
