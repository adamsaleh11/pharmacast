# Manual Testing Guide: Forecast Graph Points

## Quick Start

### Step 1: Start the Dev Server
```bash
npm run dev
```
Wait for it to start (should see "Ready in XXXms" or "compiled successfully")

### Step 2: Open the App
```
http://localhost:3000
```
You'll be redirected to `/login`

### Step 3: Log In
- Use your test credentials to log in
- Select a pharmacy location that has forecasts

---

## Test Scenarios

### Test 1: Verify Graph Points Display (7-day)

1. **Navigate to Dashboard**
   - Go to the Dashboard page
   - Ensure the "7 days" button is selected (top-left of toolbar)

2. **Check the "Forecast · 7d" Column**
   - Look at any drug row with a forecast
   - **Expected**: You should see a small sparkline graph (not the old historical bars)
   - The graph should have ~7 points (may be harder to see visually, but should be smoother than before)

3. **Verify in Browser DevTools**
   - Open DevTools (F12 or Cmd+Opt+I)
   - Go to **Network** tab
   - Look for the request: `GET /locations/{locationId}/forecasts?horizonDays=7`
   - Click on that request → **Response** tab
   - Expand one of the forecast objects and look for:
     ```json
     {
       "din": "00012345",
       "predicted_quantity": 140,
       "graph_points": [20, 20, 20, 20, 20, 20, 20],
       ...
     }
     ```
   - ✅ **PASS**: If you see `graph_points` array with 7 numbers
   - ❌ **FAIL**: If `graph_points` is missing or null for all entries

### Test 2: Verify Different Horizons (14-day)

1. **Click "14 days" Button**
   - Located in the toolbar next to "7 days"

2. **Observe**
   - Dashboard refreshes and fetches new forecast
   - Sparklines should update/change appearance
   - The "Forecast · 14d" column header should update

3. **Verify in DevTools**
   - Network tab should show new request: `GET /locations/{locationId}/forecasts?horizonDays=14`
   - Response should have `graph_points` with ~14 points
   - Example:
     ```json
     {
       "graph_points": [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
       ...
     }
     ```
   - ✅ **PASS**: Array has 14 points, different from 7-day forecast
   - ❌ **FAIL**: Array has same number of points as 7-day, or missing

### Test 3: Verify 30-day Horizon

1. **Click "30 days" Button**

2. **Observe**
   - Dashboard refreshes again
   - Sparklines update

3. **Verify in DevTools**
   - Request: `GET /locations/{locationId}/forecasts?horizonDays=30`
   - Response should have `graph_points` with ~30 points (or 4-5 weekly points)
   - ✅ **PASS**: Array reflects 30-day breakdown
   - ❌ **FAIL**: Array is missing or has wrong length

### Test 4: Verify Fallback Behavior

To test fallback (when backend doesn't provide graph_points):

1. **Open Browser DevTools**
   - Console tab
   - Run this command to mock missing data:
   ```javascript
   // This is just for testing - observe what happens if data is missing
   console.log("If graph_points were missing, the sparkline would show historical data instead");
   ```

2. **Current behavior**: Should show the new forecast-based graph

3. **Alternative test**: Check older drugs without recent forecasts
   - They should fall back to showing the placeholder or historical data

### Test 5: Verify Color Consistency

1. **Look at Different Drugs with Different Statuses**
   - Find a drug with RED status (critical)
   - Find a drug with AMBER status (reorder soon)
   - Find a drug with GREEN status (well stocked)

2. **Check Sparkline Colors**
   - RED drug → sparkline should be red tint
   - AMBER drug → sparkline should be amber/orange tint
   - GREEN drug → sparkline should be green tint

3. **Verify in Code**
   - Open DevTools → Inspector
   - Right-click on the sparkline SVG
   - Click "Inspect Element"
   - Look at the SVG stroke color
   - Should match the status badge color

---

## DevTools Deep Dive

### Inspect Network Response

1. **Open DevTools** → **Network tab**
2. **Reload dashboard** → You'll see the forecasts request
3. **Click on the request** named something like `forecasts?horizonDays=7`
4. **Click Response tab** and look for this structure:
   ```json
   [
     {
       "din": "02240756",
       "drug_name": "Metformin",
       "predicted_quantity": 140,
       "confidence": "HIGH",
       "days_of_supply": 5.2,
       "reorder_status": "RED",
       "generated_at": "2026-05-04T10:30:00Z",
       "graph_points": [20, 20, 20, 20, 20, 20, 20]
     },
     ...
   ]
   ```

### Inspect Component State

1. **Open DevTools** → **Components tab** (React DevTools)
2. **Find** the `ForecastCell` component
3. **Check Props**:
   - `row.forecast.graph_points` should be an array of numbers
   - `horizonDays` should match selected horizon (7, 14, or 30)
4. **Check Rendering**:
   - Should see `<Sparkline>` component
   - Not showing placeholder div

---

## Troubleshooting

### Issue: Sparklines not showing

**Possible causes:**
1. Backend hasn't been deployed yet
2. No forecasts exist for the drugs
3. Cache issue

**Solution**:
1. Check DevTools Network → Forecast response has `graph_points`?
   - If YES: Frontend is working, backend isn't sending data
   - If NO: Frontend code issue
2. Check if drugs have `predicted_quantity`
   - If null: No forecast data exists
3. Hard refresh: `Ctrl+Shift+R` (or `Cmd+Shift+R` on Mac)

### Issue: All sparklines show same data

**Possible causes:**
1. Backend returning same array for all horizons
2. Cache not invalidating

**Solution**:
1. Look at DevTools Network requests
2. Request for 7d should be different from 14d request
3. Check if responses are actually different

### Issue: Sparklines look empty or weird

**Possible causes:**
1. Graph has only 1 point (requires min 2 to render)
2. All values identical (flat line expected)
3. CSS styling issue

**Solution**:
1. Check array length in DevTools: Should be >= 2
2. Check array values: Should be numeric
3. Open Inspector on sparkline SVG → check if it's being rendered

---

## Quick Checklist

- [ ] Backend API returns `graph_points` field ✅ (verify in DevTools)
- [ ] 7-day horizon shows sparkline ✅
- [ ] 14-day horizon shows different sparkline ✅
- [ ] 30-day horizon shows different sparkline ✅
- [ ] Switching horizons updates the graphs ✅
- [ ] Graph points align with reorder status color ✅
- [ ] Fallback works if data is missing ✅
- [ ] No console errors ✅

---

## Expected Behavior

### Before Testing
- Make sure backend team has deployed the `graph_points` field
- Confirm at least one drug has forecasts

### During Testing
- **Horizon changes**: Should fetch new forecast immediately
- **Sparklines**: Should render smoothly, not pixelated
- **Colors**: Should match status badge colors exactly
- **No lag**: Switching between 7d/14d/30d should feel instant

### Success Criteria
- ✅ All 6 test scenarios pass
- ✅ No console errors (F12 → Console)
- ✅ DevTools shows `graph_points` in API response
- ✅ Sparklines render for all horizons
- ✅ Switching horizons updates data

---

## What You're Looking For

### Good Signs ✅
- Sparklines are smooth curves (not blocky bars)
- Graph changes when you switch horizons
- DevTools shows `graph_points: [20, 20, 20, ...]` in response
- Colors match status badges

### Bad Signs ❌
- Sparklines look like last 12 bars (historical data fallback)
- Graphs don't change when switching horizons
- DevTools shows `graph_points: null` or missing
- Console shows errors about undefined data

---

## Getting Help

If tests fail:

1. **Check backend deployed**: Ask backend team to confirm `graph_points` is live
2. **Check response structure**: Use DevTools Network tab to verify response format
3. **Check console errors**: F12 → Console tab for any JavaScript errors
4. **Check cache**: Hard refresh with `Ctrl+Shift+R`

---

**Test Duration**: ~5-10 minutes
**Difficulty**: Easy (mostly visual inspection + DevTools)
