import { buildOutcomeSteps } from "../../modules/admin/components/orders/outcomeSteps.js";

describe("buildOutcomeSteps", () => {
  test("cancelled before confirmation: placed -> cancelled with reason", () => {
    const s = buildOutcomeSteps({ status: "cancelled", cancelledBy: "customer", cancelReason: "Changed mind", createdAt: "2026-10-09T10:00:00Z", updatedAt: "2026-10-09T10:05:00Z" });
    expect(s.map((x) => x.key)).toEqual(["placed", "cancelled"]);
    expect(s[1].label).toBe("Cancelled by the customer");
    expect(s[1].note).toBe("Changed mind");
    expect(s[1].state).toBe("cancelled");
  });
  test("cancelled after seller confirmed shows the confirmed step", () => {
    const s = buildOutcomeSteps({ status: "cancelled", cancelledBy: "seller", sellerAcceptedAt: "2026-10-09T10:01:00Z" });
    expect(s.map((x) => x.key)).toEqual(["placed", "confirmed", "cancelled"]);
  });
  test("delivered local order", () => {
    const s = buildOutcomeSteps({ status: "delivered", deliveredAt: "2026-10-09T12:00:00Z" });
    expect(s.map((x) => x.label)).toEqual(["Order placed", "Order confirmed", "Out for delivery", "Delivered"]);
    expect(s.every((x) => x.state === "done")).toBe(true);
  });
  test("delivered courier order says handed to courier", () => {
    const s = buildOutcomeSteps({ status: "delivered", fulfillmentType: "SHIPROCKET" });
    expect(s[2].label).toBe("Handed to courier");
  });
});
