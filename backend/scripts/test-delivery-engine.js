import mongoose from "mongoose";
import dotenv from "dotenv";
import dns from "node:dns";

dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);

dotenv.config({ path: "./.env" });

import {
  isPincodeLocal,
  addLocalPincode,
  deleteLocalPincode,
  evaluateDeliveryEligibility,
} from "../app/services/shipping/localPincodeService.js";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/anushkakart";

async function runTests() {
  console.log("=================================================");
  console.log("🧪 TESTING PHASE 1: HYBRID DELIVERY RULES ENGINE");
  console.log("=================================================");

  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB successfully.\n");

    let passed = 0;
    let failed = 0;

    function assert(condition, message) {
      if (condition) {
        console.log(`✅ PASS: ${message}`);
        passed++;
      } else {
        console.error(`❌ FAIL: ${message}`);
        failed++;
      }
    }

    // 1. Pincode local checks
    const is284204Local = await isPincodeLocal("284204");
    assert(is284204Local === true, "Pincode 284204 is marked as LOCAL");

    const is284205Local = await isPincodeLocal("284205");
    assert(is284205Local === true, "Pincode 284205 is marked as LOCAL");

    const isIndoreLocal = await isPincodeLocal("452018");
    assert(isIndoreLocal === false, "Pincode 452018 (Indore) is NOT local");

    const isDelhiLocal = await isPincodeLocal("110001");
    assert(isDelhiLocal === false, "Pincode 110001 (Delhi) is NOT local");

    console.log("\n--- Testing Matrix Conditions ---");

    // Case 1: Quick item + Local Seller + Local Customer
    const case1 = await evaluateDeliveryEligibility({
      customerPincode: "284205",
      sellerPincode: "284204",
      deliveryMode: "quick_only",
    });
    assert(
      case1.isDeliverable === true && case1.fulfillmentType === "LOCAL_RIDERS",
      "Case 1: Quick + Local Seller + Local Customer => Allowed via LOCAL_RIDERS (12-15 min)"
    );

    // Case 2: Quick item + Outside Seller + Local Customer
    const case2 = await evaluateDeliveryEligibility({
      customerPincode: "284204",
      sellerPincode: "110001", // Delhi
      deliveryMode: "quick_only",
    });
    assert(
      case2.isDeliverable === false && case2.isSellerLocal === false,
      "Case 2: Quick + Outside Seller + Local Customer => BLOCKED (Seller outside local zone)"
    );

    // Case 3: Quick item + Local Seller + Outside Customer
    const case3 = await evaluateDeliveryEligibility({
      customerPincode: "452018", // Indore
      sellerPincode: "284204",
      deliveryMode: "quick_only",
    });
    assert(
      case3.isDeliverable === false && case3.displayBadge.includes("452018"),
      "Case 3: Quick + Local Seller + Outside Customer => BLOCKED ('Quick Delivery not available at 452018')"
    );

    // Case 4: Both item + Local Seller + Local Customer
    const case4 = await evaluateDeliveryEligibility({
      customerPincode: "284204",
      sellerPincode: "284204",
      deliveryMode: "both",
    });
    assert(
      case4.isDeliverable === true && case4.fulfillmentType === "LOCAL_RIDERS",
      "Case 4: Both/Hybrid + Local Seller + Local Customer => Allowed via LOCAL_RIDERS (12-15 min)"
    );

    // Case 5: Both item + Outside Seller + Local Customer
    const case5 = await evaluateDeliveryEligibility({
      customerPincode: "284204",
      sellerPincode: "110001", // Delhi
      deliveryMode: "both",
    });
    assert(
      case5.isDeliverable === true && case5.fulfillmentType === "SHIPROCKET" && case5.shippingFeeType === "SHIPROCKET",
      "Case 5: Both/Hybrid + Outside Seller + Local Customer => Allowed via SHIPROCKET (Customer pays courier fee)"
    );

    // Case 6: Both item + Local Seller + Outside Customer
    const case6 = await evaluateDeliveryEligibility({
      customerPincode: "452018", // Indore
      sellerPincode: "284204",
      deliveryMode: "both",
    });
    assert(
      case6.isDeliverable === true && case6.fulfillmentType === "SHIPROCKET",
      "Case 6: Both/Hybrid + Local Seller + Outside Customer => Allowed via SHIPROCKET (Customer pays courier fee)"
    );

    // Case 7: Both item + Outside Seller + Outside Customer
    const case7 = await evaluateDeliveryEligibility({
      customerPincode: "452018", // Indore
      sellerPincode: "110001", // Delhi
      deliveryMode: "both",
    });
    assert(
      case7.isDeliverable === true && case7.fulfillmentType === "SHIPROCKET",
      "Case 7: Both/Hybrid + Outside Seller + Outside Customer => Allowed via SHIPROCKET"
    );

    console.log("\n--- Testing Dynamic Admin Addition of Pincode ---");
    // Case 8: Dynamic Admin Pincode addition
    const testTempPincode = "284999";
    const beforeAdd = await isPincodeLocal(testTempPincode);
    assert(beforeAdd === false, `Before add: ${testTempPincode} is not local`);

    // Add local pincode dynamically
    const createdRecord = await addLocalPincode({
      pincode: testTempPincode,
      areaName: "New Testing Sector",
      city: "Mauranipur Extension",
      state: "Uttar Pradesh",
      deliveryTimeEstimate: "15-20 mins",
      isActive: true,
    });
    assert(createdRecord && createdRecord.pincode === testTempPincode, `Admin dynamically added ${testTempPincode}`);

    // Check that eligibility now immediately changes to LOCAL!
    const afterAddEligibility = await evaluateDeliveryEligibility({
      customerPincode: testTempPincode,
      sellerPincode: "284204",
      deliveryMode: "quick_only",
    });
    assert(
      afterAddEligibility.isDeliverable === true && afterAddEligibility.fulfillmentType === "LOCAL_RIDERS",
      `Dynamic Check: ${testTempPincode} immediately unlocks Quick Delivery without code changes!`
    );

    // Cleanup temporary pincode
    await deleteLocalPincode(createdRecord._id);
    const afterDelete = await isPincodeLocal(testTempPincode);
    assert(afterDelete === false, `Cleaned up test pincode ${testTempPincode}`);

    console.log("\n=================================================");
    console.log(`🎉 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log("=================================================");

    await mongoose.disconnect();
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error("Test execution error:", err);
    process.exit(1);
  }
}

runTests();
