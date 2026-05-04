# Backend Implementation Guide: Forecast Graph Points

## Quick Reference

### Endpoint to Update
```
GET /locations/{locationId}/forecasts?horizonDays={horizonDays}
```

### Current Response
Returns array of `ForecastSummaryDto`:
```json
[
  {
    "din": "02240756",
    "drug_name": "Metformin",
    "predicted_quantity": 140,
    "confidence": "HIGH",
    "days_of_supply": 5.2,
    "reorder_status": "RED",
    "generated_at": "2026-05-04T10:30:00Z"
  }
]
```

### New Response (Add `graph_points`)
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
    "graph_points": [
      5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5
    ]
  }
]
```

## Graph Points Calculation

### Logic
The `graph_points` array represents the forecast broken down over the selected horizon.

```python
def calculate_graph_points(predicted_quantity, horizon_days, avg_daily_demand):
    """
    Generate graph points for the forecast.
    
    Args:
        predicted_quantity: Total units predicted for the horizon
        horizon_days: Number of days in the forecast (7, 14, or 30)
        avg_daily_demand: Average daily demand from the forecast
    
    Returns:
        List of numeric points matching the horizon breakdown
    """
    
    # Option 1: Daily breakdown
    if horizon_days <= 30:
        daily_demand = predicted_quantity / horizon_days
        graph_points = [daily_demand] * horizon_days
    
    # Option 2: Weekly breakdown (for 30-day forecasts, more compact visualization)
    elif horizon_days == 30:
        weekly_demand = predicted_quantity / 4  # ~4 weeks in a month
        graph_points = [weekly_demand] * 4
    
    return graph_points
```

### Examples

#### Example 1: 7-day Forecast
```
horizonDays: 7
predicted_quantity: 35
avg_daily_demand: 5

graph_points: [5, 5, 5, 5, 5, 5, 5]
// 7 points, one per day
// Sum: 35 ✓
```

#### Example 2: 14-day Forecast
```
horizonDays: 14
predicted_quantity: 70
avg_daily_demand: 5

Option A (daily):
graph_points: [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5]
// 14 points, one per day
// Sum: 70 ✓

Option B (weekly):
graph_points: [35, 35]
// 2 points, one per week
// Sum: 70 ✓
```

#### Example 3: 30-day Forecast
```
horizonDays: 30
predicted_quantity: 150
avg_daily_demand: 5

Option A (daily):
graph_points: [5, 5, 5, ..., 5]  // 30 points total
// Sum: 150 ✓

Option B (weekly - recommended for compactness):
graph_points: [37.5, 37.5, 37.5, 37.5]
// 4 points, one per week
// Sum: 150 ✓
```

## Implementation Steps

1. **Locate the forecast response builder**
   - Find where `ForecastSummaryDto` is constructed
   - This is likely in a service that queries the forecast database

2. **Add the calculation**
   ```python
   forecast_dto = ForecastSummaryDto(
       din=forecast.din,
       predicted_quantity=forecast.predicted_quantity,
       # ... other fields ...
       graph_points=calculate_graph_points(
           forecast.predicted_quantity,
           horizon_days,
           forecast.avg_daily_demand
       )
   )
   ```

3. **Handle edge cases**
   - If forecast doesn't exist → `graph_points: null`
   - If predicted_quantity is 0 → `graph_points: null`
   - If avg_daily_demand is missing → Use `predicted_quantity / horizon_days`

4. **Test for each horizon**
   ```bash
   # Test 7-day forecast
   GET /locations/loc123/forecasts?horizonDays=7
   
   # Test 14-day forecast
   GET /locations/loc123/forecasts?horizonDays=14
   
   # Test 30-day forecast
   GET /locations/loc123/forecasts?horizonDays=30
   ```

## Validation Checklist

- [ ] `graph_points` is returned for all forecasts with predictions
- [ ] `graph_points` is `null` for drugs without a forecast
- [ ] Array length matches horizon:
  - [ ] 7-day: 7 points (or 1 point)
  - [ ] 14-day: 14 points (or 2 points)
  - [ ] 30-day: 30 points (or 4-5 points)
- [ ] Sum of `graph_points` ≈ `predicted_quantity` (within rounding tolerance)
- [ ] Points are realistic (non-negative, reasonable magnitudes)
- [ ] Works across multiple drugs in single response
- [ ] Works across different horizon values

## Frontend Integration

Once this is implemented, the dashboard will automatically:
1. Receive `graph_points` from the API
2. Display them as a sparkline in the "Forecast · {horizonDays}d" column
3. Update the graph when user changes the horizon selector
4. Show forecast visualization that matches the selected time period

No further frontend changes needed!
