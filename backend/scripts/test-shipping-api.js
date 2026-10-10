import mongoose from "mongoose";
import dotenv from "dotenv";
import dns from "node:dns";

dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
dotenv.config({ path: "./.env" });

import { checkPincodeServiceability, validateCartDelivery } from "../app/controller/shippingController.js";

async function testApiControllers() {
  console.log("=================================================");
  console.log("🧪 TESTING SHIPPING CONTROLLER API RESPONSES");
  console.log("=================================================");

  await mongoose.connect(process.env.MONGODB_URI);

  // Mock res
  function createMockRes() {
    return {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.data = data;
        return this;
      },
    };
  }

  // 1. Test checkPincodeServiceability for local pincode (Jhansi)
  const req1 = { query: { pincode: "284204" } };
  const res1 = createMockRes();
  await checkPincodeServiceability(req1, res1);
  console.log("Local Pincode 284204 Response:", {
    isLocal: res1.data.result.isLocal,
    fulfillmentType: res1.data.result.fulfillmentType,
    deliveryEstimate: res1.data.result.deliveryEstimate,
  });

  // 2. Test checkPincodeServiceability for outside pincode (Indore)
  const req2 = { query: { pincode: "452018" } };
  const res2 = createMockRes();
  await checkPincodeServiceability(req2, res2);
  console.log("Outside Pincode 452018 Response:", {
    isLocal: res2.data.result.isLocal,
    fulfillmentType: res2.data.result.fulfillmentType,
    deliveryEstimate: res2.data.result.deliveryEstimate,
  });

  // 3. Test validateCartDelivery for mixed cart in Indore (452018)
  const reqCart = {
    body: {
      customerPincode: "452018",
      items: [
        {
          name: "Fresh Milk",
          deliveryMode: "quick_only",
          sellerPincode: "284204",
        },
        {
          name: "Cotton T-Shirt",
          deliveryMode: "both",
          sellerPincode: "110001",
        },
      ],
    },
  };
  const resCart = createMockRes();
  await validateCartDelivery(reqCart, resCart);
  console.log("\nCart Validation for Indore (452018):", {
    isValid: resCart.data.result.isValid,
    hasBlockedItems: resCart.data.result.hasBlockedItems,
    hasShiprocketItems: resCart.data.result.hasShiprocketItems,
    overallFulfillment: resCart.data.result.overallFulfillment,
    items: resCart.data.result.items.map((i) => ({
      name: i.name,
      isDeliverable: i.isDeliverable,
      fulfillmentType: i.fulfillmentType,
      displayBadge: i.displayBadge,
    })),
  });

  await mongoose.disconnect();
}

testApiControllers();
