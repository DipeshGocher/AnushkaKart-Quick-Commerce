import { computeReturnMoney, buildReturnMoneyView } from "../app/services/order/returnMoney.js";
import { RETURN_REASONS, findReturnReason, faultForReasonCode, RETURN_FAULT } from "../app/constants/returnReasons.js";

/** An order the way placement stores it: per-item seller payout + admin commission in lineItems. */
function order(over = {}) {
  const items = over.items || [{ product: "p1", name: "Phone", quantity: 1, price: 1000 }];
  const lineItems = over.lineItems || items.map((i) => ({
    productId: i.product,
    quantity: i.quantity,
    itemSubtotal: i.price * i.quantity,
    sellerPayout: i.price * i.quantity * 0.9, // 10% commission
    adminProductCommission: i.price * i.quantity * 0.1,
  }));
  const productSubtotal = items.reduce((a, i) => a + i.price * i.quantity, 0);
  return {
    paymentMode: "ONLINE",
    financeFlags: { adminEarningCredited: true },
    items,
    paymentBreakdown: {
      productSubtotal,
      sellerPayoutTotal: productSubtotal * 0.9,
      adminProductCommissionTotal: productSubtotal * 0.1,
      platformTotalEarning: productSubtotal * 0.1 + 20,
      lineItems,
    },
    returnStatus: "qc_passed",
    returnDeliveryCommission: 25,
    returnFault: "customer",
    returnItems: [{ product: "p1", itemIndex: 0, quantity: 1, price: 1000 }],
    ...over,
  };
}

describe("return money split", () => {
  it("customer's choice: customer 1,000; seller gives back what they earned (900), not 1,000; admin gives back 100; platform pays the 25 pickup fee", () => {
    const m = computeReturnMoney(order());
    expect(m).toMatchObject({
      refundAmount: 1000, sellerShare: 900, adminCommission: 100, adminCommissionReversed: 100,
      pickupFee: 25, pickupFeePayer: "platform", sellerCharged: 900,
    });
  });

  it("seller's fault: the seller also pays the 25 pickup fee", () => {
    const m = computeReturnMoney(order({ returnFault: "seller" }));
    expect(m.pickupFeePayer).toBe("seller");
    expect(m.sellerCharged).toBe(925);
    expect(m.refundAmount).toBe(1000);
  });

  it("unknown fault (old returns) = the platform pays the pickup fee", () => {
    expect(computeReturnMoney(order({ returnFault: null })).pickupFeePayer).toBe("platform");
    expect(computeReturnMoney(order({ returnFault: "unknown" })).sellerCharged).toBe(900);
  });

  it("partial return: only the returned item counts, not the whole order", () => {
    const o = order({
      items: [
        { product: "p1", name: "Phone", quantity: 1, price: 1000 },
        { product: "p2", name: "Case", quantity: 1, price: 500 },
      ],
      returnItems: [{ product: "p2", itemIndex: 1, quantity: 1, price: 500 }],
    });
    const m = computeReturnMoney(o);
    expect(m).toMatchObject({ refundAmount: 500, sellerShare: 450, adminCommission: 50, adminCommissionReversed: 50 });
  });

  it("returning 1 of 3 units of a line takes a third of that line's money", () => {
    const o = order({
      items: [{ product: "p1", name: "Cable", quantity: 3, price: 100 }],
      returnItems: [{ product: "p1", itemIndex: 0, quantity: 1, price: 100 }],
    });
    expect(computeReturnMoney(o)).toMatchObject({ refundAmount: 100, sellerShare: 90, adminCommission: 10 });
  });

  it("a fixed per-quantity commission is respected (it is not always 10%)", () => {
    const o = order({
      items: [{ product: "p1", name: "Cable", quantity: 2, price: 100 }],
      lineItems: [{ productId: "p1", quantity: 2, itemSubtotal: 200, sellerPayout: 190, adminProductCommission: 10 }],
      returnItems: [{ product: "p1", itemIndex: 0, quantity: 1, price: 100 }],
    });
    expect(computeReturnMoney(o)).toMatchObject({ refundAmount: 100, sellerShare: 95, adminCommission: 5 });
  });

  it("COD: the commission was never booked, so none is taken back", () => {
    const m = computeReturnMoney(order({ paymentMode: "COD", financeFlags: { adminEarningCredited: true } }));
    expect(m.adminCommission).toBe(100);
    expect(m.adminCommissionReversed).toBe(0);
    expect(m.sellerShare).toBe(900);
  });

  it("online order whose admin earning was never booked: nothing to take back", () => {
    expect(computeReturnMoney(order({ financeFlags: { adminEarningCredited: false } })).adminCommissionReversed).toBe(0);
  });

  it("an old order without per-item numbers is split by price", () => {
    const o = order({ paymentBreakdown: { productSubtotal: 1500, sellerPayoutTotal: 1350, adminProductCommissionTotal: 150, platformTotalEarning: 150 } });
    o.items = [
      { product: "p1", quantity: 1, price: 1000 },
      { product: "p2", quantity: 1, price: 500 },
    ];
    o.returnItems = [{ product: "p2", itemIndex: 1, quantity: 1, price: 500 }];
    expect(computeReturnMoney(o)).toMatchObject({ refundAmount: 500, sellerShare: 450, adminCommission: 50 });
  });

  it("an old order with no commission data at all: the seller gives back the full price, admin nothing", () => {
    const o = order({ paymentBreakdown: {} });
    const m = computeReturnMoney(o);
    expect(m.refundAmount).toBe(1000);
    expect(m.sellerShare).toBe(1000);
    expect(m.adminCommission).toBe(0);
  });

  it("the seller never gives back more than the customer was refunded, and money adds up", () => {
    for (const price of [99.99, 100, 1499.5, 25000]) {
      for (const qty of [1, 2, 5]) {
        const o = order({
          items: [{ product: "p1", quantity: qty, price }],
          returnItems: [{ product: "p1", itemIndex: 0, quantity: 1, price }],
        });
        const m = computeReturnMoney(o);
        expect(m.sellerShare).toBeLessThanOrEqual(m.refundAmount + 0.001);
        expect(m.sellerShare + m.adminCommission).toBeCloseTo(m.refundAmount, 1);
      }
    }
  });
});

describe("what the Returns pages show", () => {
  it("before QC: 'if QC passes'; after the refund: what really happened", () => {
    expect(buildReturnMoneyView(order({ returnStatus: "returned" })).status).toBe("if_qc_passes");
    const done = buildReturnMoneyView(order({
      returnStatus: "refund_completed",
      returnFinance: { appliedAt: new Date(), refundAmount: 1000, sellerShare: 900, adminCommission: 100, adminCommissionReversed: 100, pickupFee: 25, pickupFeePayer: "platform", sellerCharged: 900, fromPendingPayout: 900, fromWallet: 0, owedBySeller: 0, payoutAction: "cancelled" },
    }));
    expect(done).toMatchObject({ status: "applied", fromPendingPayout: 900, payoutAction: "cancelled", sellerCharged: 900 });
  });

  it("a failed QC or rejected return refunds nothing", () => {
    expect(buildReturnMoneyView(order({ returnStatus: "qc_failed" })).status).toBe("not_refunded");
    expect(buildReturnMoneyView(order({ returnStatus: "return_rejected" })).status).toBe("not_refunded");
  });

  it("a seller does not see the admin's commission; a customer sees only the refund", () => {
    const seller = buildReturnMoneyView(order(), { role: "seller" });
    expect(seller).not.toHaveProperty("adminCommission");
    expect(seller).not.toHaveProperty("adminCommissionReversed");
    expect(seller.sellerShare).toBe(900);
    expect(buildReturnMoneyView(order(), { role: "customer" })).toEqual({ status: "if_qc_passes", refundAmount: 1000 });
  });

  it("no return, no money view", () => {
    expect(buildReturnMoneyView(order({ returnStatus: "none" }))).toBeNull();
    expect(buildReturnMoneyView(null)).toBeNull();
  });
});

describe("return reasons", () => {
  it("every reason has a code, a label and a fault, and codes are unique", () => {
    const codes = RETURN_REASONS.map((r) => r.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const r of RETURN_REASONS) {
      expect(r.label.length).toBeGreaterThan(3);
      expect([RETURN_FAULT.SELLER, RETURN_FAULT.CUSTOMER]).toContain(r.fault);
    }
  });

  it("seller-fault vs customer-choice reasons are the agreed ones", () => {
    const sellerFault = RETURN_REASONS.filter((r) => r.fault === "seller").map((r) => r.code).sort();
    expect(sellerFault).toEqual(["DAMAGED_DEFECTIVE", "EXPIRED_SPOILT", "MISSING_PARTS", "NOT_AS_DESCRIBED", "WRONG_ITEM"]);
    const customer = RETURN_REASONS.filter((r) => r.fault === "customer").map((r) => r.code).sort();
    expect(customer).toEqual(["CHANGED_MIND", "FOUND_CHEAPER", "ORDERED_BY_MISTAKE", "OTHER"]);
  });

  it("lookup is forgiving about case/spaces and unknown codes have an unknown fault", () => {
    expect(findReturnReason(" wrong_item ").code).toBe("WRONG_ITEM");
    expect(findReturnReason("nope")).toBeNull();
    expect(faultForReasonCode("CHANGED_MIND")).toBe("customer");
    expect(faultForReasonCode("DAMAGED_DEFECTIVE")).toBe("seller");
    expect(faultForReasonCode(undefined)).toBe("unknown");
  });
});
