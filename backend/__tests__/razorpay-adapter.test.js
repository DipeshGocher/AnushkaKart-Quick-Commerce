import crypto from "node:crypto";
import { RazorpayAdapter } from "../app/services/payment/providers/razorpay.adapter.js";

describe("Razorpay webhook integration", () => {
  const adapter = new RazorpayAdapter();

  it("validates webhook signatures over the exact raw body", async () => {
    const previous = process.env.RAZORPAY_WEBHOOK_SECRET;
    process.env.RAZORPAY_WEBHOOK_SECRET = "test-webhook-secret";
    try {
      const body = Buffer.from('{"event":"order.paid"}');
      const signature = crypto.createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
        .update(body).digest("hex");
      expect(await adapter.validateWebhook({ rawBody: body, authorization: signature })).toBe(true);
      expect(await adapter.validateWebhook({ rawBody: body, authorization: "bad" })).toBe(false);
    } finally {
      if (previous === undefined) delete process.env.RAZORPAY_WEBHOOK_SECRET;
      else process.env.RAZORPAY_WEBHOOK_SECRET = previous;
    }
  });

  it("resolves captured payments by Razorpay order ID when merchant notes are absent", async () => {
    const body = Buffer.from(JSON.stringify({
      event: "payment.captured",
      payload: { payment: { entity: {
        id: "pay_test_1",
        order_id: "order_test_1",
        status: "captured",
        notes: {},
      } } },
    }));
    const decoded = await adapter.decodeWebhookPayload({ rawBody: body });
    expect(decoded.razorpayOrderId).toBe("order_test_1");
    expect(decoded.transactionId).toBe("pay_test_1");
    expect(adapter.mapStatusToInternal(decoded.state)).toBe("CAPTURED");
  });
});
