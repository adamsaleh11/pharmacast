import { describe, expect, it } from "vitest";
import { parseSseEvent } from "./forecast-dashboard";

describe("forecast dashboard API helpers", () => {
  it("parses SSE data events and skips malformed payloads", () => {
    const events = parseSseEvent(`
event: message
data: {"din":"00012345","forecast":{"din":"00012345","location_id":"loc","horizon_days":7,"predicted_quantity":10,"confidence":"HIGH","days_of_supply":3,"reorder_status":"AMBER","generated_at":"2026-04-20T12:00:00Z"}}

data: not-json
data: {"done":true,"total":1,"succeeded":1,"failed":0,"skipped_no_stock":0,"skipped_dins":[]}
`);

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ din: "00012345" });
    expect(events[1]).toMatchObject({ done: true, succeeded: 1 });
  });
});
