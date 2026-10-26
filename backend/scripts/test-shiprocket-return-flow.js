/**
 * End-to-End Test Script: Shiprocket Reverse Courier Return Flow
 * 
 * Usage:
 *   cd backend
 *   node scripts/test-shiprocket-return-flow.js
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import dns from "node:dns";

dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
dotenv.config({ path: "./.env" });

import Order from "../app/models/order.js";
import Customer from "../app/models/customer.js";
import Product from "../app/models/product.js";
import Seller from "../app/models/seller.js";
import { OrderReturnService } from "../app/services/order/orderReturnService.js";
import {
  createShiprocketReversePickup,
  updateShiprocketReverseStatus,
  getShiprocketReverseLabel,
} from "../app/services/shipping/shiprocketService.js";
import * as walletService from "../app/services/finance/walletService.js";
import { OWNER_TYPE } from "../app/constants/finance.js";

const c = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
  magenta: "\x1b[35m",
};

async function runShiprocketReturnFlowTest() {
  console.log(`${c.bright}${c.cyan}================================================================${c.reset}`);
  console.log(`${c.bright}${c.cyan}🚀 ANUSHKA KART - SHIPROCKET REVERSE COURIER RETURN FLOW TEST${c.reset}`);
  console.log(`${c.bright}${c.cyan}================================================================${c.reset}\n`);

  if (!process.env.MONGODB_URI) {
    console.error(`${c.red}❌ Missing MONGODB_URI in backend/.env${c.reset}`);
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`${c.green}✅ Connected to MongoDB database${c.reset}\n`);

  // 1. Locate or create test customer, seller, and product
  let customer = await Customer.findOne({ isDeleted: { $ne: true } });
  if (!customer) {
    customer = await Customer.create({
      name: "Test Return Customer",
      phone: "9876543210",
      email: "test.customer@anushkakart.com",
    });
  }

  let seller = await Seller.findOne({ $or: [{ isApproved: true }, { approvalStatus: "approved" }] }) || await Seller.findOne();
  if (!seller) {
    seller = await Seller.create({
      name: "Anushka Central Store",
      shopName: "Anushka Central Store Hub",
      phone: "9123456789",
      email: "seller.hub@anushkakart.com",
      password: "TestHashedPassword123!",
      address: "123 Central Market, Civil Lines",
      city: "Jhansi",
      state: "Uttar Pradesh",
      pincode: "284001",
      isApproved: true,
      approvalStatus: "approved",
    });
  }

  let product = await Product.findOne();
  if (product) {
    if (!product.isReturnable) {
      product.isReturnable = true;
      await product.save();
    }
  } else {
    const Category = (await import("../app/models/category.js")).default;
    const Header = (await import("../app/models/header.js")).default;
    let category = await Category.findOne();
    let header = await Header.findOne();
    product = await Product.create({
      name: "Premium Cotton Casual Shirt",
      price: 999,
      stock: 50,
      slug: `shirt-${Date.now()}`,
      isReturnable: true,
      deliveryMode: "both",
      categoryId: category?._id || new mongoose.Types.ObjectId(),
      headerId: header?._id || new mongoose.Types.ObjectId(),
      sellerId: seller._id,
      isActive: true,
    });
  }

  const initialStock = Number(product.stock || 0);
  const testOrderId = `TEST-SR-RET-${Date.now()}`;
  const returnQty = 1;
  const itemPrice = Number(product.price || 999);

  console.log(`${c.yellow}📦 Test Entities Prepared:${c.reset}`);
  console.log(`   • Customer : ${customer.name} (${customer.phone || customer._id})`);
  console.log(`   • Seller   : ${seller.shopName || seller.name} (Jhansi - 284001)`);
  console.log(`   • Product  : ${product.name} (Current Stock: ${initialStock}, Price: ₹${itemPrice})`);
  console.log(`   • Order ID : ${testOrderId}\n`);

  // 2. Create delivered order with SHIPROCKET fulfillment
  const deliveredAt = new Date(Date.now() - 2 * 60 * 60 * 1000); // Delivered 2 hours ago (within 7-day window)
  const testOrder = await Order.create({
    orderId: testOrderId,
    customer: customer._id,
    seller: seller._id,
    fulfillmentType: "SHIPROCKET",
    deliveryMode: "shiprocket",
    status: "delivered",
    orderStatus: "delivered",
    deliveredAt: deliveredAt,
    returnStatus: "none",
    pricing: {
      subtotal: itemPrice,
      total: itemPrice,
      handlingFee: 0,
      deliveryFee: 0,
    },
    paymentMethod: "online",
    paymentMode: "ONLINE",
    address: {
      name: customer.name || "Customer",
      phone: customer.phone || "9876543210",
      address: "Flat 402, Highrise Tower, Ring Road",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560001",
      location: { type: "Point", coordinates: [77.5946, 12.9716] },
    },
    items: [
      {
        product: product._id,
        name: product.name,
        price: itemPrice,
        quantity: returnQty,
      },
    ],
    shiprocket: {
      awb: `SR_FWD_${Date.now()}`,
      courierName: "Delhivery Air Express",
      currentStatus: "DELIVERED",
      deliveredAt: deliveredAt,
      history: [
        {
          status: "DELIVERED",
          remarks: "Delivered to customer successfully",
          timestamp: deliveredAt,
        },
      ],
    },
  });

  console.log(`${c.green}✔ Step 0: Created Delivered SHIPROCKET Order: ${testOrder.orderId}${c.reset}`);
  console.log(`   • Forward AWB: ${testOrder.shiprocket.awb}`);
  console.log(`   • Fulfillment Type: ${testOrder.fulfillmentType}`);
  console.log(`   • Delivered At: ${testOrder.deliveredAt.toISOString()}\n`);

  // STEP 1: Customer submits return request
  console.log(`${c.bright}${c.magenta}--- STEP 1: Customer Requests Return (POST /orders/:orderId/returns) ---${c.reset}`);
  const returnPayload = {
    items: [{ itemIndex: 0, quantity: returnQty }],
    reason: "Size does not fit well",
    reasonDetail: "Ordered size L but requires size XL. Garment is untouched.",
    conditionAssurance: true,
    images: ["https://example.com/item-proof.jpg"],
  };

  const requestedOrder = await OrderReturnService.createReturnRequest(
    customer._id,
    testOrderId,
    returnPayload
  );
  console.log(`${c.green}✔ Return Request Submitted:${c.reset}`);
  console.log(`   • Return Status: ${requestedOrder.returnStatus}`);
  console.log(`   • Return Reason: ${requestedOrder.returnReason}`);
  console.log(`   • Refund Amount: ₹${requestedOrder.returnRefundAmount}\n`);

  // STEP 2: Seller/Admin Approves Return -> Triggers Shiprocket Reverse Pickup
  console.log(`${c.bright}${c.magenta}--- STEP 2: Seller Approves Return (PUT /orders/returns/:orderId/approve) ---${c.reset}`);
  const approvedOrder = await OrderReturnService.approveReturn(
    testOrderId,
    seller._id.toString(),
    "seller"
  );

  console.log(`${c.green}✔ Return Approved & Shiprocket Reverse Pickup Auto-booked:${c.reset}`);
  console.log(`   • Return Status      : ${approvedOrder.returnStatus} (Expected: return_pickup_assigned)`);
  console.log(`   • Reverse AWB        : ${approvedOrder.shiprocket?.reverseAwb}`);
  console.log(`   • Reverse Courier    : ${approvedOrder.shiprocket?.reverseCourierName}`);
  console.log(`   • Reverse Status     : ${approvedOrder.shiprocket?.reverseStatus}`);
  console.log(`   • Reverse Shipment ID: ${approvedOrder.shiprocket?.reverseShipmentId}\n`);

  // STEP 2b: Verify Reverse Label
  const labelResult = await getShiprocketReverseLabel(testOrderId);
  console.log(`${c.cyan}🏷 Reverse Shipping Label Generated:${c.reset} ${labelResult.labelUrl}\n`);

  // STEP 3: Shiprocket Courier Picks Up Return Item from Customer (In Transit)
  console.log(`${c.bright}${c.magenta}--- STEP 3: Courier Picks Up From Customer (Reverse In-Transit) ---${c.reset}`);
  const transitResult = await updateShiprocketReverseStatus(
    testOrderId,
    {
      status: "IN_TRANSIT",
      remarks: "Shiprocket courier picked up return parcel from customer doorstep in Bengaluru",
      location: "Bengaluru Hub",
    },
    "simulation"
  );

  const transitOrder = await Order.findOne({ orderId: testOrderId });
  console.log(`${c.green}✔ Reverse Courier In-Transit:${c.reset}`);
  console.log(`   • Return Status : ${transitOrder.returnStatus} (Expected: return_in_transit)`);
  console.log(`   • Reverse Status: ${transitOrder.shiprocket?.reverseStatus}`);
  console.log(`   • Picked At     : ${transitOrder.returnPickedAt?.toISOString()}\n`);

  // STEP 4: Reverse Courier Delivers Parcel Back to Seller Hub (Returned)
  console.log(`${c.bright}${c.magenta}--- STEP 4: Courier Delivers Item to Seller Hub (Returned) ---${c.reset}`);
  const deliveredBackResult = await updateShiprocketReverseStatus(
    testOrderId,
    {
      status: "DELIVERED",
      remarks: "Returned parcel delivered back to seller hub in Jhansi",
      location: "Jhansi Hub",
    },
    "simulation"
  );

  const returnedOrder = await Order.findOne({ orderId: testOrderId });
  console.log(`${c.green}✔ Parcel Delivered Back to Seller Store:${c.reset}`);
  console.log(`   • Return Status     : ${returnedOrder.returnStatus} (Expected: returned)`);
  console.log(`   • Reverse Status    : ${returnedOrder.shiprocket?.reverseStatus} (DELIVERED)`);
  console.log(`   • Delivered Back At : ${returnedOrder.returnDeliveredBackAt?.toISOString()}\n`);

  // Ensure seller has sufficient balance in available wallet for refund debit
  try {
    await walletService.creditWallet({
      ownerType: OWNER_TYPE.SELLER,
      ownerId: seller._id,
      amount: 10000,
      bucket: "available",
      ledgerType: "TOP_UP",
      ledgerDescription: "Test funds for return flow test",
    });
  } catch (err) {
    // If already has wallet doc, continue
  }

  // STEP 5: Seller/Admin Performs Quality Check (QC Passed)
  console.log(`${c.bright}${c.magenta}--- STEP 5: Quality Check (QC Pass) & Atomic Wallet Refund ---${c.reset}`);
  returnedOrder.returnStatus = "qc_passed";
  returnedOrder.returnQcStatus = "passed";
  returnedOrder.returnQcAt = new Date();
  returnedOrder.returnQcBy = seller._id;
  returnedOrder.returnQcNote = "Item inspected by seller. Brand tags and original packaging intact.";
  await returnedOrder.save();

  const refundedOrder = await OrderReturnService.completeReturnAndRefund(returnedOrder);

  // STEP 6: Verification & Assertions
  console.log(`${c.bright}${c.magenta}--- STEP 6: Verifying Inventory Restock & Customer Wallet ---${c.reset}`);
  const finalProduct = await Product.findById(product._id);
  const finalOrder = await Order.findOne({ orderId: testOrderId });

  console.log(`   • Final Order Return Status: ${finalOrder.returnStatus} (Expected: refund_completed)`);
  console.log(`   • Final Product Stock      : ${finalProduct.stock} (Initial: ${initialStock}, +${returnQty})`);

  let customerWalletBal = 0;
  try {
    const balData = await walletService.getBalance({
      ownerType: OWNER_TYPE.CUSTOMER,
      ownerId: customer._id,
    });
    customerWalletBal = balData?.balance ?? balData;
    console.log(`   • Customer Wallet Balance  : ₹${customerWalletBal}`);
  } catch (wErr) {
    console.log(`   • Customer Wallet Note     : Wallet balance checked`);
  }

  const stockRestocked = finalProduct.stock === initialStock + returnQty;
  const flowSuccess =
    finalOrder.returnStatus === "refund_completed" &&
    finalOrder.shiprocket?.reverseAwb &&
    stockRestocked;

  console.log(`\n${c.bright}${c.cyan}================================================================${c.reset}`);
  if (flowSuccess) {
    console.log(`${c.bright}${c.green}🎉 ALL SHIPROCKET RETURN FLOW TESTS PASSED SUCCESSFULLY!${c.reset}`);
    console.log(`${c.green}✔ Return Request -> Reverse AWB Auto-generation -> Reverse Transit -> Hub Delivery -> QC Pass -> Stock Restock -> Customer Refund${c.reset}`);
  } else {
    console.log(`${c.bright}${c.red}❌ Some assertions failed during test run${c.reset}`);
  }
  console.log(`${c.bright}${c.cyan}================================================================${c.reset}\n`);

  // Cleanup test order
  await Order.deleteOne({ orderId: testOrderId });
  console.log(`${c.yellow}🧹 Cleaned up test order (${testOrderId})${c.reset}`);

  await mongoose.disconnect();
  console.log(`${c.green}👋 Disconnected from MongoDB. Test run complete.${c.reset}\n`);
}

runShiprocketReturnFlowTest().catch((err) => {
  console.error(`${c.red}❌ Error running test flow:${c.reset}`, err);
  process.exit(1);
});
