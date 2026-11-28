import { getCourierBookingView } from "../../shared/utils/courierBooking.js";

const courier = (status, shiprocket, extra = {}) => ({
  fulfillmentType: "SHIPROCKET",
  status,
  shiprocket,
  ...extra,
});

describe("courier booking view (one button for seller and admin)", () => {
  it("local-delivery orders get nothing", () => {
    expect(getCourierBookingView({ fulfillmentType: "LOCAL", status: "confirmed" })).toBeNull();
    expect(getCourierBookingView(null)).toBeNull();
  });

  it("no shipment yet: a single Book Courier button, no label, no retry wording", () => {
    const v = getCourierBookingView(courier("confirmed", {}));
    expect(v.kind).toBe("NOT_BOOKED");
    expect(v.showBookButton).toBe(true);
    expect(v.bookLabel).toBe("Book Courier");
    expect(v.showPrintLabel).toBe(false);
  });

  it("AWB assigned but pickup failed: Retry stays visible (the old UI hid it) and the real reason is shown", () => {
    const v = getCourierBookingView(
      courier("confirmed", {
        shipmentId: "1759830153",
        awb: "1091410458085",
        currentStatus: "AWB_ASSIGNED",
        automation: { state: "PICKUP_PENDING", lastError: "Shiprocket pickup request failed (400): Pickup address not verified" },
      }),
    );
    expect(v.kind).toBe("PENDING");
    expect(v.showBookButton).toBe(true);
    expect(v.bookLabel).toBe("Retry Booking");
    expect(v.showPrintLabel).toBe(true);
    expect(v.tone).toBe("warning");
    expect(v.message).toContain("Pickup address not verified");
  });

  it("shipment exists but no AWB yet: Retry, and no label to print", () => {
    const v = getCourierBookingView(courier("confirmed", { shipmentId: "1", currentStatus: "NEW" }));
    expect(v.kind).toBe("PENDING");
    expect(v.showBookButton).toBe(true);
    expect(v.showPrintLabel).toBe(false);
    expect(v.message).toContain("AWB");
  });

  it("AWB but no pickup and no stored error still asks for a retry", () => {
    const v = getCourierBookingView(courier("packed", { shipmentId: "1", awb: "A1", currentStatus: "AWB_ASSIGNED" }));
    expect(v.kind).toBe("PENDING");
    expect(v.bookLabel).toBe("Retry Booking");
    expect(v.message).toContain("pickup");
  });

  it("everything done: Ready, only Print Label", () => {
    const v = getCourierBookingView(
      courier("packed", {
        shipmentId: "1",
        awb: "A1",
        currentStatus: "PICKUP_SCHEDULED",
        pickupScheduledAt: new Date().toISOString(),
        automation: { state: "COMPLETE" },
      }),
    );
    expect(v.kind).toBe("READY");
    expect(v.showBookButton).toBe(false);
    expect(v.showPrintLabel).toBe(true);
    expect(v.tone).toBe("success");
  });

  it("pickup scheduled by hand (older orders without automation state) is Ready", () => {
    const v = getCourierBookingView(courier("packed", { shipmentId: "1", awb: "A1", currentStatus: "PICKUP_SCHEDULED" }));
    expect(v.kind).toBe("READY");
  });

  it("label still pending after pickup: keep the retry button", () => {
    const v = getCourierBookingView(
      courier("packed", { shipmentId: "1", awb: "A1", currentStatus: "PICKUP_SCHEDULED", automation: { state: "LABEL_PENDING", lastError: "no label yet" } }),
    );
    expect(v.kind).toBe("PENDING");
    expect(v.showBookButton).toBe(true);
  });

  it("courier already has the parcel: no booking button, label and tracking only", () => {
    for (const st of ["IN_TRANSIT", "OUT_FOR_DELIVERY"]) {
      const v = getCourierBookingView(courier("shipped", { shipmentId: "1", awb: "A1", currentStatus: st }));
      expect(v.kind).toBe("PAST_PICKUP");
      expect(v.showBookButton).toBe(false);
    }
  });

  it("cancelled and delivered orders show nothing to press", () => {
    for (const status of ["cancelled", "delivered"]) {
      const v = getCourierBookingView(courier(status, { shipmentId: "1", awb: "A1" }));
      expect(v.kind).toBe("CLOSED");
      expect(v.showBookButton).toBe(false);
      expect(v.showPrintLabel).toBe(false);
    }
  });

  it("never offers a separate Schedule Pickup action", () => {
    const v = getCourierBookingView(courier("confirmed", { shipmentId: "1", awb: "A1", currentStatus: "AWB_ASSIGNED" }));
    expect(JSON.stringify(v)).not.toMatch(/schedule pickup/i);
  });
});
