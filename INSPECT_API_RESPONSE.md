# Inspect API Response for graph_points

## Quick Test in Browser Console

Open DevTools (F12) and paste this to see what the API is returning:

### Test 1: Check Network Response Directly

```javascript
// Open the Network tab and look for the forecasts request
// Then paste this in console to see the response structure:

console.log('Check Network tab:');
console.log('1. Look for request: GET /locations/{id}/forecasts?horizonDays=7');
console.log('2. Click on it');
console.log('3. Go to Response tab');
console.log('4. Paste this in console:');
console.log('---');

// This will show you if graph_points exists in one of the recent requests
fetch(window.location.origin + '/api/locations/YOUR_LOCATION_ID/forecasts?horizonDays=7', {
  headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
})
  .then(r => r.json())
  .then(data => {
    console.log('=== FORECAST API RESPONSE ===');
    console.log('First forecast object:');
    const first = data[0];
    console.log({
      din: first?.din,
      predicted_quantity: first?.predicted_quantity,
      graph_points: first?.graph_points,
      graph_points_length: first?.graph_points?.length,
      has_graph_points: !!first?.graph_points
    });
    console.log('Full response:', data);
  });
```

**Replace `YOUR_LOCATION_ID`** with your actual location ID (visible in URL or DevTools)

### Test 2: Simpler Check via Network Tab

1. **Open DevTools** → **Network** tab
2. **Reload dashboard** → F5
3. Look for request that starts with: `forecasts?horizonDays=`
4. **Click on it** → **Response** tab
5. Look at the JSON response

**You should see**:
```json
[
  {
    "din": "02240756",
    "predicted_quantity": 140,
    "graph_points": [20, 20, 20, 20, 20, 20, 20],
    ...
  },
  {
    "din": "00012345",
    "predicted_quantity": 50,
    "graph_points": [7, 7, 7, 7, 7, 7, 7],
    ...
  }
]
```

### Test 3: Check Console Warnings

1. Open **DevTools** → **Console** tab
2. You should see warnings like:
```
[DEBUG] No graph_points for 02240756: {
  din: "02240756",
  has_graph_points: false,
  graph_points_value: null,
  predicted_quantity: 140,
  horizonDays: 7
}
```

This tells you exactly which drugs are missing `graph_points`.

---

## What to Look For

### ✅ If `graph_points` EXISTS

The response includes:
```json
"graph_points": [20, 20, 20, 20, 20, 20, 20]
```

Then the issue is in **code logic** - the array exists but maybe:
- Has less than 2 points? (need min 2 to render)
- Empty array? 
- Wrong data type?

### ❌ If `graph_points` is NULL or MISSING

The response shows:
```json
"graph_points": null
// OR no graph_points field at all
```

Then the backend **hasn't deployed** the new code yet, or:
- API endpoint not updated
- Field name is different
- Response format changed

---

## Debug Checklist

- [ ] **Network Response** has `graph_points` field? 
  - If NO → Backend hasn't deployed
  - If YES → Continue

- [ ] **`graph_points` is an array** (not null, not string)?
  - If NO → Backend data format issue
  - If YES → Continue

- [ ] **Array has at least 2 elements**?
  - If `[]` or `[20]` → Backend returning wrong data
  - If YES → Continue

- [ ] **Console shows `[DEBUG]` warnings**?
  - If YES → Confirms code found the issue
  - If NO → Sparkline should be rendering

- [ ] **Sparkline shows** instead of placeholder?
  - If YES → ✅ SUCCESS!
  - If NO → Something else is wrong

---

## Common Issues & Solutions

### Issue 1: `graph_points` is null

**Symptom**: API response has `"graph_points": null`

**Cause**: Backend deployed but returning null instead of array

**Solution**: 
1. Ask backend team to check their calculation logic
2. Verify `predicted_quantity` and `avg_daily_demand` are correct
3. Check if forecasts have all required fields

### Issue 2: `graph_points` is empty array

**Symptom**: API response has `"graph_points": []`

**Cause**: Backend calculation returned no points

**Solution**: Same as Issue 1

### Issue 3: `graph_points` has only 1 point

**Symptom**: API response has `"graph_points": [20]`

**Cause**: Backend returns single point instead of array matching horizon

**Solution**: Backend needs to fix calculation to return correct array length

### Issue 4: `graph_points` field doesn't exist

**Symptom**: No `graph_points` field in response at all

**Cause**: Backend code wasn't deployed

**Solution**: Confirm backend deployment and check if changes are live

---

## Step by Step Debugging

### Step 1: What does API return?

```javascript
// Paste in console:
fetch('/api/locations/LOCATION_ID/forecasts?horizonDays=7')
  .then(r => r.json())
  .then(d => console.log(JSON.stringify(d[0], null, 2)))
```

**Look at output:**
- Is `graph_points` there?
- Is it an array?
- How many elements?

### Step 2: What does Component see?

Open DevTools → **Console**

Look for `[DEBUG]` messages that show what the component received:
```
[DEBUG] No graph_points for 02240756: {
  has_graph_points: false,
  graph_points_value: null,
  ...
}
```

### Step 3: Why isn't it rendering?

If `graph_points` exists but sparkline doesn't show:

```javascript
// Check if it's a length issue:
const points = [20, 20, 20, 20, 20, 20, 20];
console.log('Points array length:', points.length);
console.log('Should render?', points && points.length >= 2);  // true
```

---

## Final Check

**Copy and paste this in console** (change LOCATION_ID):

```javascript
const locationId = 'LOCATION_ID';
const horizonDays = 7;

fetch(`/api/locations/${locationId}/forecasts?horizonDays=${horizonDays}`)
  .then(r => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  })
  .then(forecasts => {
    console.log(`=== ANALYZING ${forecasts.length} FORECASTS ===`);
    
    const withPoints = forecasts.filter(f => f.graph_points && f.graph_points.length >= 2);
    const withoutPoints = forecasts.filter(f => !f.graph_points || f.graph_points.length < 2);
    
    console.log(`✅ With valid graph_points (${withPoints.length}):`);
    withPoints.slice(0, 3).forEach(f => {
      console.log(`  ${f.din}: ${f.graph_points.length} points - [${f.graph_points.join(', ')}]`);
    });
    
    console.log(`❌ Without valid graph_points (${withoutPoints.length}):`);
    withoutPoints.slice(0, 3).forEach(f => {
      console.log(`  ${f.din}: graph_points = ${f.graph_points}`);
    });
  })
  .catch(err => console.error('Error:', err));
```

This will show you **exactly** which drugs have graph_points and which don't.

---

## Share the Results

Run the debug script above and share:
1. How many forecasts have `graph_points`?
2. How many are missing it?
3. What do the arrays look like? (e.g., `[20, 20, 20, ...]`)

This will tell us if it's a backend issue or frontend issue.
