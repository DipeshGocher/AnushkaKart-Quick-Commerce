import { getPaymentDisplay, getPaymentKind } from "../../shared/utils/paymentDisplay.js";

describe("payment display (QR / COD / Online + plain status)", () => {
  it.each([
    // [order, kind, method, status, tone]
    [{ paymentMode: "COD", paymentStatus: "PENDING_CASH_COLLECTION" }, "cod", "Cash on Delivery", "Pay on delivery", "warning"],
    [{ paymentMode: "COD", paymentStatus: "CASH_COLLECTED" }, "cod", "Cash on Delivery", "Paid", "success"],
    [{ paymentMode: "COD", paymentStatus: "COD_RECONCILED" }, "cod", "Cash on Delivery", "Paid", "success"],
    [{ paymentMode: "UPI_QR", paymentStatus: "PAID", utrNumber: "402938491028" }, "upi", "UPI QR", "Paid", "success"],
    [{ paymentMode: "UPI_QR", paymentStatus: "AWAITING_VERIFICATION" }, "upi", "UPI QR", "Verifying", "warning"],
    [{ paymentMode: "UPI_QR", paymentStatus: "CREATED" }, "upi", "UPI QR", "Payment pending", "warning"],
    [{ paymentMode: "UPI_QR", paymentStatus: "REJECTED" }, "upi", "UPI QR", "Failed", "danger"],
    [{ paymentMode: "ONLINE", paymentStatus: "PAID" }, "online", "Online Payment", "Paid", "success"],
    [{ paymentMode: "ONLINE", paymentStatus: "CREATED" }, "online", "Online Payment", "Payment pending", "warning"],
    [{ paymentMode: "ONLINE", paymentStatus: "FAILED" }, "online", "Online Payment", "Failed", "danger"],
    [{ paymentMode: "ONLINE", paymentStatus: "REFUNDED" }, "online", "Online Payment", "Refunded", "info"],
  ])("%j", (order, kind, method, status, tone) => {
    expect(getPaymentDisplay(order)).toEqual(expect.objectContaining({ kind, methodLabel: method, statusLabel: status, tone }));
  });

  it("never shows raw backend codes to the customer", () => {
    for (const s of ["PENDING_CASH_COLLECTION", "AWAITING_VERIFICATION", "CASH_COLLECTED", "COD_RECONCILED", "PARTIALLY_REMITTED"]) {
      expect(getPaymentDisplay({ paymentMode: "COD", paymentStatus: s }).statusLabel).not.toMatch(/_/);
    }
  });

  it("only UPI QR payments mention the UTR", () => {
    expect(getPaymentDisplay({ paymentMode: "UPI_QR" }).showUtr).toBe(true);
    expect(getPaymentDisplay({ paymentMode: "COD" }).showUtr).toBe(false);
    expect(getPaymentDisplay({ paymentMode: "ONLINE" }).showUtr).toBe(false);
  });

  it("handles legacy orders that only have payment.method / payment.status", () => {
    expect(getPaymentKind({ payment: { method: "cash" } })).toBe("cod");
    expect(getPaymentKind({ payment: { method: "upi_qr" } })).toBe("upi");
    expect(getPaymentDisplay({ payment: { method: "online", status: "completed" } })).toEqual(
      expect.objectContaining({ kind: "online", statusLabel: "Paid" }),
    );
    expect(getPaymentDisplay({ payment: { method: "cash" } }).statusLabel).toBe("Pay on delivery");
  });
});
