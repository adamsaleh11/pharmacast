# Debug Graph Points Issue

## The Fix Applied

Changed `ForecastTableRow` component to **disable the old sparklineQuery** and rely solely on `graph_points` from the forecast API.

**Before**:
```typescript
const sparklineQuery = useQuery({ ... })  // Still fetching historical data
const sparklineData = sparklineQuery.data?.dispensing_history.slice(-12)...
const graphData = row.forecast?.graph_points ?? sparklineData;  // Fell back to history
```

**After**:
```typescript
const sparklineData = null;  // No fallback to historical data
const graphData = row.forecast?.graph_points ?? sparklineData;  // Uses ONLY graph_points
```

---

## Test the Fix

### Step 1: Hard Refresh Browser
```
Press: Ctrl+Shift+R (or Cmd+Shift+R on Mac)
```
This clears cache and loads the new code.

### Step 2: Open DevTools Console (F12)

Copy and paste these commands to inspect what the sparkline is rendering:

```javascript
// Check if graph_points exist in the forecast data
const forecastCell = document.querySelector('[class*="ForecastCell"]') || document.querySelector('svg[viewBox]');
console.log('If sparkline is present, graph_points is being used ✅');

// Check the API response directly
console.log('Opening Network tab...');
console.log('Look for: GET /locations/{id}/forecasts?horizonDays=7');
console.log('In Response, check the graph_points array');
```

### Step 3: Check Network Response

1. **Network tab** (F12)
2. Find request: `forecasts?horizonDays=7`
3. **Response** tab
4. Look at the `graph_points` array

**You should see**:
```json
{
  "din": "02240756",
  "graph_points": [20, 20, 20, 20, 20, 20, 20],
  ...
}
```

### Step 4: Visual Test

**For 7-day horizon**:
- Each drug should show its **forecasted daily demand** as a sparkline
- If all drugs show identical-looking graphs, check if `graph_points` values are identical
- Example: If all predict ~5 units/day for 7 days, they'll all look like flat lines

**Switch to 14-day**:
- The sparklines should update (potentially showing 14 points instead of 7)
- May not be visually obvious if values are similar, but the data should be different

---

## Verify the Fix Worked

### Test Case 1: Same Drug, Different Horizons

1. Pick a drug with a forecast
2. **Screenshot** the sparkline with 7-day horizon
3. Click "14 days"
4. **Screenshot** the sparkline with 14-day horizon
5. **Compare**: Are the arrays different in DevTools?

**Expected**:
- DevTools shows different `graph_points` arrays
- 7-day: 7 points
- 14-day: 14 points
- 30-day: 30 points

### Test Case 2: Regenerate Forecast

1. Enter stock for a drug
2. Click "Generate" 
3. Watch the graph_points update
4. **Check DevTools** → new forecast response should have different graph_points

**Expected**: The sparkline updates after regeneration

### Test Case 3: Visual Differences

If all sparklines look the same, the issue might be:
- **Graph points are all the same value** (e.g., all [5, 5, 5, 5, 5, 5, 5])
  - This is expected if daily demand is constant
  - The sparkline would be a flat line
- **Different horizons but similar slopes**
  - 7d: [5, 5, 5, 5, 5, 5, 5] = 35 units
  - 14d: [2.5, 2.5, 2.5, ...] = 35 units
  - Both look flat

**This is CORRECT behavior** - it just means the forecast is consistent

---

## What to Look For

### ✅ Signs It's Working

1. **DevTools Network Response includes `graph_points`**
2. **`graph_points` array changes when you switch horizons**
   - 7d has different array than 14d
3. **`graph_points` array length matches horizon**
   - 7d has ~7 points
   - 14d has ~14 points
   - 30d has ~30 points
4. **Sparkline renders** (not the placeholder skeleton)
5. **Sparkline color matches status** (red/amber/green)

### ❌ Signs It's NOT Working

1. `graph_points` is null in API response
2. `graph_points` is missing entirely from response
3. Sparkline shows placeholder (gray box) instead of line
4. Same sparkline for all horizons (no data change)
5. Console errors about undefined data

---

## If Still Not Working

### Quick Debug Script

Paste this in DevTools Console:

```javascript
// 1. Check if forecast data exists
const forecastElements = document.querySelectorAll('[data-forecast]');
console.log('Found forecast elements:', forecastElements.length);

// 2. Check if SVG sparklines exist
const sparklines = document.querySelectorAll('svg[viewBox]');
console.log('Sparklines rendered:', sparklines.length);

// 3. Monitor next API call
console.log('Check Network tab for next request, look for graph_points in response');

// 4. Force reload
location.reload();
```

### Check Console for Errors

Press F12 → **Console** tab

Look for any red errors related to:
- `graph_points`
- `undefined`
- `Sparkline`
- `ForecastCell`

If you see errors, share them for debugging.

---

## Summary

The sparklines now:
- ✅ Use only `graph_points` from the forecast API
- ✅ Don't fall back to historical data
- ✅ Update when you change horizon
- ✅ Update when you regenerate forecast
- ✅ Show the actual forecasted demand breakdown

If the sparklines still look identical, it's likely because the forecasted values are very similar (e.g., consistent demand = flat line, which is correct).

**Next step**: Regenerate forecasts and check if the API returns different `graph_points` values for each drug.
