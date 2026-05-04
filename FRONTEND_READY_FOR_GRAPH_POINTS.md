# Frontend Ready for Forecast Graph Points

## Status: ✅ Ready for Backend Implementation

The frontend has been updated and is ready to display forecast-based graph points as soon as the backend provides them.

## Changes Made

### 1. Type Definition Updated
**File**: `src/types/forecast-dashboard.ts`

Added optional field to `ForecastSummaryDto`:
```typescript
graph_points?: number[] | null;
```

### 2. ForecastCell Component Updated
**File**: `src/app/(app)/dashboard/page.tsx`

The `ForecastCell` component now:
- Checks for `row.forecast?.graph_points` first (new forecasted data)
- Falls back to `sparklineData` (historical data) if `graph_points` is unavailable
- Displays the same sparkline visualization regardless of data source
- **No breaking changes**: The fallback ensures the dashboard continues to work with or without the new field

#### Code Change:
```typescript
// Use graph_points from forecast if available, otherwise fall back to sparklineData
const graphData = row.forecast?.graph_points ?? sparklineData;

if (graphData && graphData.length >= 2) {
  <Sparkline data={graphData} color={color} />
}
```

## How It Works

### Current Flow (Before Backend Update)
1. User selects horizon: 7d, 14d, or 30d
2. Frontend fetches forecast from API → `listForecasts(horizonDays)`
3. Forecast returns `ForecastSummaryDto[]` (without `graph_points`)
4. Dashboard falls back to `sparklineData` (last 12 weeks historical data)
5. Sparkline displays historical data

### After Backend Update
1. User selects horizon: 7d, 14d, or 30d
2. Frontend fetches forecast from API → `listForecasts(horizonDays)`
3. Forecast returns `ForecastSummaryDto[]` **with `graph_points`**
4. Dashboard uses `row.forecast.graph_points` (forecasted breakdown for selected horizon)
5. Sparkline displays forecast points
6. **When user changes horizon → new forecast fetched automatically → new graph points displayed**

## What the Backend Needs to Provide

When endpoint `/locations/{locationId}/forecasts?horizonDays={horizonDays}` is called:

For each `ForecastSummaryDto`, include:
```typescript
{
  din: "02240756",
  drug_name: "Metformin",
  predicted_quantity: 140,
  graph_points: [
    // For 7-day horizon: 7 daily points
    20, 20, 20, 20, 20, 20, 20
    
    // For 14-day horizon: 14 daily points or 2 weekly points
    70, 70
    
    // For 30-day horizon: 30 daily points or 4-5 weekly points
    35, 35, 35, 35
  ],
  // ... other fields
}
```

## Testing the Integration

Once backend provides `graph_points`:

1. **7-day forecast**: Change horizon selector to "7 days" → Sparkline shows 7 points
2. **14-day forecast**: Change horizon selector to "14 days" → Sparkline shows 14 (or 2) points
3. **30-day forecast**: Change horizon selector to "30 days" → Sparkline shows 30 (or 4-5) points
4. **Backward compatibility**: If `graph_points` is null/missing → Falls back to historical sparkline

## No Frontend Redeploy Needed

Once the backend is updated to include `graph_points`, the dashboard will automatically:
- Detect the new field
- Use it instead of historical data
- Display forecast visualization matching the selected horizon

The change is fully backward compatible and requires no frontend code changes after the current update.
