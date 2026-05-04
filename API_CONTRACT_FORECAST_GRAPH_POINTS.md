# API Contract: Forecast Graph Points

## Overview
The frontend dashboard displays forecast data as sparkline graphs in the "Forecast · 7d/14d/30d" column. Currently, these sparklines show historical dispensing data from the past 12 weeks. This contract specifies that the backend should provide forecasted graph points that represent the predicted demand breakdown over the selected forecast horizon (7, 14, or 30 days).

## Motivation
- **Current State**: Dashboard sparklines show the last 12 weeks of actual dispensing history
- **Desired State**: Dashboard sparklines show forecasted demand points broken down over the selected horizon (e.g., if user selects 7 days, show 7-day forecast; if 30 days, show 30-day forecast)
- **Benefit**: Users see a clear visualization of what the forecast predicts for the selected time period, with points that align directly to the horizon (7d, 14d, or 30d)

## API Changes

### Endpoint
`GET /locations/{locationId}/forecasts?horizonDays={horizonDays}`

### Response Type Change
**Current Response Type**: `ForecastSummaryDto[]`

**Updated Response Type**: `ForecastSummaryDto[]` with new optional field

### New Field in ForecastSummaryDto

```typescript
type ForecastSummaryDto = {
  // ... existing fields ...
  din: string;
  drug_name: string | null;
  strength: string | null;
  predicted_quantity: number;
  confidence: ForecastConfidence;
  days_of_supply: number;
  reorder_status: ReorderStatus;
  generated_at: string;
  current_stock: number | null;
  stock_entered: boolean;
  threshold?: ForecastThresholdDto | null;
  
  // NEW FIELD:
  graph_points?: number[] | null;
};
```

### Field: `graph_points`
- **Type**: `number[] | null`
- **Required**: No (optional for backward compatibility)
- **Description**: Array of numeric points representing the forecasted demand breakdown over the selected forecast horizon
- **Values**: Should reflect the predicted demand broken down into periods matching the horizon
- **Calculation**: 
  - Use the forecast's `predicted_quantity`, `avg_daily_demand`, and `forecast_horizon_days` to generate points
  - **Array length should match the horizon breakdown**:
    - If `horizonDays` is 7: Return 7 daily forecast points (or 1 weekly point)
    - If `horizonDays` is 14: Return 14 daily forecast points (or 2 weekly points)
    - If `horizonDays` is 30: Return 30 daily forecast points (or 4-5 weekly points)
  - **Value calculation**: Divide `predicted_quantity` equally across the points or distribute based on `avg_daily_demand`
  - **Examples**:
    - Forecast: 140 units over 30 days with 5 units daily demand
      - 30-day horizon: graph_points could be [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5] (30 daily points)
      - Or: [35, 35, 35, 35] (4 weekly points, where each week ~35 units)
    - Forecast: 35 units over 7 days with 5 units daily demand
      - 7-day horizon: graph_points: [5, 5, 5, 5, 5, 5, 5] (7 daily points)
- **When Null**: If the forecast doesn't exist or cannot be calculated, return `null`
- **Edge Cases**:
  - If there is no forecast for the drug, return `null`
  - Sum of all `graph_points` should approximately equal `predicted_quantity` (allow for rounding)

## Frontend Impact
- Frontend will check for `graph_points` and display them if available
- If `graph_points` is null or undefined, the dashboard will gracefully fall back to not displaying a graph
- The sparkline visualization in the "Forecast · 30d" column will update to show these forecasted points instead of historical data
- No breaking changes: The field is optional, so existing API responses will continue to work

## Testing Checklist for Backend
- [ ] `graph_points` is returned for all forecasts with valid predictions
- [ ] `graph_points` is `null` for drugs without a forecast
- [ ] **For 7-day horizon**: `graph_points` array has 7 points (daily breakdown)
- [ ] **For 14-day horizon**: `graph_points` array has 14 points (daily breakdown) or 2 points (weekly breakdown)
- [ ] **For 30-day horizon**: `graph_points` array has 30 points (daily breakdown) or 4-5 points (weekly breakdown)
- [ ] Values in `graph_points` sum to approximately the `predicted_quantity` (allowing for rounding)
- [ ] Graph points match the `horizonDays` parameter sent in the request
- [ ] Multiple forecasts in a single response each have correct `graph_points` for the requested horizon

## Frontend Checklist
- [ ] Update `ForecastSummaryDto` type to include optional `graph_points` field ✅ DONE
- [ ] Update `ForecastCell` component to display `graph_points` sparkline when available ✅ DONE
- [ ] Fallback gracefully if `graph_points` is null or missing ✅ DONE
- [ ] Verify sparkline updates dynamically when user changes horizon (7d → 14d → 30d)
- [ ] Sparkline points count should match selected horizon (7 points for 7d, 14 for 14d, 30 for 30d)
- [ ] Verify sparkline visualization is consistent across all horizon selections

## Migration Notes
- This change is backward compatible; the field is optional
- Once the backend is updated, no frontend redeploy is necessary (it will automatically use the new data)
- Old API responses without `graph_points` will continue to work with the fallback behavior
