import {
  addBusinessDays,
  formatDeliveryDate,
  getCourierDeliveryDateText,
  resolveItemDeliveryInfo,
} from "../../modules/customer/services/deliveryService.js";

describe("Option 1: Dynamic Business Days Delivery Fallback Tests", () => {
  describe("addBusinessDays & formatDeliveryDate", () => {
    test("advances 4 business days skipping Sundays when start is Sunday", () => {
      // 2026-10-25 is a Sunday
      const sundayDate = new Date("2026-10-25T10:00:00Z");
      expect(sundayDate.getUTCDay()).toBe(0); // 0 = Sunday

      const targetDate = addBusinessDays(sundayDate, 4);
      // Mon (1), Tue (2), Wed (3), Thu (4) -> Thu 29 Oct
      expect(targetDate.getUTCDate()).toBe(29);
      expect(targetDate.getUTCMonth()).toBe(9); // 9 is October (0-indexed)

      const formatted = formatDeliveryDate(targetDate);
      expect(formatted).toBe("Thu, 29 Oct");
    });

    test("advances across Sunday when start date is Friday", () => {
      // 2026-10-23 is a Friday
      const fridayDate = new Date("2026-10-23T10:00:00Z");
      expect(fridayDate.getUTCDay()).toBe(5);

      const targetDate = addBusinessDays(fridayDate, 4);
      // Sat (1), Sun (skip), Mon (2), Tue (3), Wed (4) -> Wed 28 Oct
      expect(targetDate.getUTCDate()).toBe(28);

      const formatted = formatDeliveryDate(targetDate);
      expect(formatted).toBe("Wed, 28 Oct");
    });

    test("getCourierDeliveryDateText returns dynamic formatted date", () => {
      const sundayDate = new Date("2026-10-25T10:00:00Z");
      const text = getCourierDeliveryDateText(sundayDate, 4);
      expect(text).toBe("Thu, 29 Oct");
    });
  });

  describe("resolveItemDeliveryInfo", () => {
    test("resolves Quick Commerce item with 20-25 mins estimate", () => {
      const localItem = {
        _id: "prod_quick_1",
        name: "Fresh Amul Milk 500ml",
        fulfillmentType: "LOCAL_RIDERS",
      };

      const result = resolveItemDeliveryInfo(localItem, {
        defaultFulfillment: "LOCAL",
      });

      expect(result.isQuick).toBe(true);
      expect(result.fulfillmentType).toBe("LOCAL_RIDERS");
      expect(result.estimateText).toBe("20-25 mins");
      expect(result.badgeText).toBe("Quick Commerce");
      expect(result.fullText).toBe("Delivery in 20-25 mins");
    });

    test("preserves specific quick commerce minute estimate if present", () => {
      const localItem = {
        _id: "prod_quick_2",
        name: "Farm Fresh Paneer 200g",
      };

      const result = resolveItemDeliveryInfo(localItem, {
        itemDecision: {
          fulfillmentType: "LOCAL_RIDERS",
          deliveryEstimate: "15-20 mins",
        },
      });

      expect(result.isQuick).toBe(true);
      expect(result.estimateText).toBe("15-20 mins");
      expect(result.fullText).toBe("Delivery in 15-20 mins");
    });

    test("resolves Shiprocket Courier item with Option 1 dynamic calendar date", () => {
      const sundayDate = new Date("2026-10-25T10:00:00Z");
      const courierItem = {
        _id: "prod_courier_1",
        name: "Men Running Shoes",
        fulfillmentType: "SHIPROCKET",
      };

      const result = resolveItemDeliveryInfo(courierItem, {
        baseDate: sundayDate,
      });

      expect(result.isQuick).toBe(false);
      expect(result.fulfillmentType).toBe("SHIPROCKET");
      expect(result.estimateText).toBe("Thu, 29 Oct");
      expect(result.badgeText).toBe("Standard Courier");
      expect(result.fullText).toBe("Delivery by Thu, 29 Oct");
    });

    test("prioritizes live Shiprocket ETD over fallback date when live ETD is provided", () => {
      const courierItem = {
        _id: "prod_courier_2",
        name: "Bluetooth Headphones",
        fulfillmentType: "SHIPROCKET",
      };

      const result = resolveItemDeliveryInfo(courierItem, {
        itemDecision: {
          etd: "Tue, 27 Oct",
        },
      });

      expect(result.isQuick).toBe(false);
      expect(result.estimateText).toBe("Tue, 27 Oct");
      expect(result.fullText).toBe("Delivery by Tue, 27 Oct");
    });
  });
});
