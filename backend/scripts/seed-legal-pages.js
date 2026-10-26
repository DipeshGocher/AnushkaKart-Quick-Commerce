import mongoose from "mongoose";
import dotenv from "dotenv";
import LegalPage from "../app/models/legalPage.js";

dotenv.config();

const CUSTOMER_PRIVACY = `
<div class="legal-points space-y-5">
  <div class="point-item">
    <h3 class="text-base font-bold text-slate-900 mb-1">1. Information We Collect</h3>
    <p class="text-sm text-slate-600 leading-relaxed">We collect your name, mobile number, email address, delivery addresses, and order history when you create an account and place orders on AnushkaKart. Payment card details and net banking credentials are never stored on our servers; they are processed securely through RBI-authorized payment gateways.</p>
  </div>

  <div class="point-item">
    <h3 class="text-base font-bold text-slate-900 mb-1">2. How We Use Your Information</h3>
    <p class="text-sm text-slate-600 leading-relaxed">Your data is utilized solely to process your orders, provide accurate doorstep deliveries, send real-time order status updates via SMS and WhatsApp, and handle customer support and refund requests.</p>
  </div>

  <div class="point-item">
    <h3 class="text-base font-bold text-slate-900 mb-1">3. Data Sharing for Order Fulfillment</h3>
    <p class="text-sm text-slate-600 leading-relaxed">We share only your necessary delivery details (name, delivery address, and contact number) with assigned merchants and delivery executives exclusively to fulfill your active orders. We never sell, rent, or trade your personal data to third-party marketing companies.</p>
  </div>

  <div class="point-item">
    <h3 class="text-base font-bold text-slate-900 mb-1">4. Data Security & Storage</h3>
    <p class="text-sm text-slate-600 leading-relaxed">We implement industry-standard 256-bit SSL encryption, tokenized authentication, and secure cloud storage in compliance with Indian data protection norms to safeguard your personal information against unauthorized access.</p>
  </div>

  <div class="point-item">
    <h3 class="text-base font-bold text-slate-900 mb-1">5. Your Privacy Rights & Account Management</h3>
    <p class="text-sm text-slate-600 leading-relaxed">You have full control over your information. You can review, update, or request the deletion of your account and personal data at any time through the in-app Profile Settings or by reaching out to our Grievance Officer at <strong>support@anushkakart.com</strong>.</p>
  </div>
</div>
`;

const CUSTOMER_TERMS = `
<div class="legal-points space-y-5">
  <div class="point-item">
    <h3 class="text-base font-bold text-slate-900 mb-1">1. Account Registration & Eligibility</h3>
    <p class="text-sm text-slate-600 leading-relaxed">To place orders on AnushkaKart, you must be at least 18 years of age or access the service under parental supervision. You agree to provide accurate, current contact numbers and delivery addresses to ensure smooth order processing.</p>
  </div>

  <div class="point-item">
    <h3 class="text-base font-bold text-slate-900 mb-1">2. Product Pricing & Order Placement</h3>
    <p class="text-sm text-slate-600 leading-relaxed">All product prices, applicable taxes, and delivery charges are transparently displayed at checkout before order confirmation. Orders can be paid using authorized online payment methods (UPI, Cards, Wallets) or Cash on Delivery (COD) where available.</p>
  </div>

  <div class="point-item">
    <h3 class="text-base font-bold text-slate-900 mb-1">3. Delivery & Handoff Verification</h3>
    <p class="text-sm text-slate-600 leading-relaxed">Delivery timeframes are estimates and may vary based on traffic, weather, or operational factors. Quick-commerce local deliveries are completed upon customer OTP verification or physical handover at the designated doorstep address.</p>
  </div>

  <div class="point-item">
    <h3 class="text-base font-bold text-slate-900 mb-1">4. Cancellations, Returns & Refunds</h3>
    <p class="text-sm text-slate-600 leading-relaxed">You may cancel an order before the seller begins packing. For delivered eligible goods, returns must be requested within the product return window in original, unused condition. Approved refunds are credited to your AnushkaKart wallet or original payment source.</p>
  </div>

  <div class="point-item">
    <h3 class="text-base font-bold text-slate-900 mb-1">5. Platform Fair Use & Conduct</h3>
    <p class="text-sm text-slate-600 leading-relaxed">Users agree not to misuse promotional coupons, place fraudulent orders, or mistreat delivery partners and merchant staff. Any abusive conduct or fraudulent activity may result in immediate account deactivation and order cancellations.</p>
  </div>
</div>
`;

const SELLER_PRIVACY = `
<div class="legal-points space-y-5">
  <div class="point-item">
    <h3 class="text-base font-bold text-slate-900 mb-1">1. Introduction</h3>
    <p class="text-sm text-slate-600 leading-relaxed">This Seller Privacy Policy explains how <strong>AnushkaKart</strong> collects, utilizes, stores, and protects the business and personal information of Merchant Partners and Shop Owners using our Seller Center and Merchant Mobile Application.</p>
  </div>

  <div class="point-item">
    <h3 class="text-base font-bold text-slate-900 mb-1">2. Information Collected from Sellers</h3>
    <p class="text-sm text-slate-600 leading-relaxed">To enable merchant onboarding, catalog management, and bank payouts, we collect your store name, owner identity proof (PAN, Aadhaar), business registrations (GSTIN, FSSAI license, Trade Certificate), verified bank account details, physical store GPS coordinates, and product catalog inventory.</p>
  </div>

  <div class="point-item">
    <h3 class="text-base font-bold text-slate-900 mb-1">3. Purpose of Processing Seller Data</h3>
    <p class="text-sm text-slate-600 leading-relaxed">Seller information is strictly processed to verify business credentials, display your shop to nearby shoppers, compute sales commissions, deposit statutory GST/TCS with government authorities, disburse weekly bank payouts, and dispatch incoming customer orders.</p>
  </div>

  <div class="point-item">
    <h3 class="text-base font-bold text-slate-900 mb-1">4. Device Permissions & Security</h3>
    <p class="text-sm text-slate-600 leading-relaxed">The Seller App requires camera and file access solely for photographing product listings and uploading verification documents, foreground location to mark accurate store pickup points, and push notifications for instant incoming order alerts. All records are secured using enterprise-grade encryption.</p>
  </div>

  <div class="point-item">
    <h3 class="text-base font-bold text-slate-900 mb-1">5. Customer Data Confidentiality</h3>
    <p class="text-sm text-slate-600 leading-relaxed">Customer names and addresses provided for order packing are strictly confidential. Sellers are prohibited from saving customer contact numbers, contacting buyers for personal marketing, or sharing customer data with external parties.</p>
  </div>
</div>
`;

const SELLER_TERMS = `
<div class="legal-points space-y-5">
  <div class="point-item">
    <h3 class="text-base font-bold text-slate-900 mb-1">1. Merchant Onboarding & KYC Verification</h3>
    <p class="text-sm text-slate-600 leading-relaxed">All sellers must register with authentic business information, valid GSTIN (where required), owner PAN, FSSAI registration for food products, and verified bank account details matching the business entity prior to listing items.</p>
  </div>

  <div class="point-item">
    <h3 class="text-base font-bold text-slate-900 mb-1">2. Catalog Integrity & Genuine Products</h3>
    <p class="text-sm text-slate-600 leading-relaxed">Sellers are solely responsible for product quality, MRP accuracy, and stock availability. Selling counterfeit, expired, defective, or prohibited goods is strictly forbidden and results in immediate store suspension, inventory forfeiture, and statutory legal reporting.</p>
  </div>

  <div class="point-item">
    <h3 class="text-base font-bold text-slate-900 mb-1">3. Order Fulfillment & Preparation SLA</h3>
    <p class="text-sm text-slate-600 leading-relaxed">Sellers must accept incoming orders promptly and complete packing and labeling within the agreed preparation timeframe to ensure seamless handoff to assigned delivery riders or shipping couriers.</p>
  </div>

  <div class="point-item">
    <h3 class="text-base font-bold text-slate-900 mb-1">4. Platform Commission & Bank Settlements</h3>
    <p class="text-sm text-slate-600 leading-relaxed">The platform deducts agreed category commissions, logistics fees, and statutory taxes (TCS/TDS) per fulfilled order. Net payouts are automatically disbursed directly into the seller's verified bank account according to the scheduled payout calendar.</p>
  </div>

  <div class="point-item">
    <h3 class="text-base font-bold text-slate-900 mb-1">5. Customer Returns & Dispute Resolution</h3>
    <p class="text-sm text-slate-600 leading-relaxed">Sellers agree to inspect return parcels (QC Check) delivered back to the store. Genuine customer returns must be acknowledged for refund processing. Sellers can file claims with photographic evidence for damaged or tampered return parcels via Seller Support.</p>
  </div>
</div>
`;

const DELIVERY_PRIVACY = `
<div class="legal-points space-y-5">
  <div class="point-item">
    <h3 class="text-base font-bold text-slate-900 mb-1">1. Introduction</h3>
    <p class="text-sm text-slate-600 leading-relaxed">This Delivery Partner Privacy Policy outlines how <strong>AnushkaKart</strong> collects, utilizes, and protects the personal and location data of delivery executives using our Rider Mobile Application.</p>
  </div>

  <div class="point-item bg-amber-50/90 border border-amber-300 p-4 rounded-xl">
    <h3 class="text-base font-bold text-amber-950 mb-1">2. Prominent Background Location Disclosure (Google Play Requirement)</h3>
    <p class="text-sm text-amber-900 leading-relaxed mb-2">The AnushkaKart Delivery Partner App collects real-time location data, including when the app is running in the <strong>background (app minimized, closed, or screen locked)</strong>, for the following essential purposes:</p>
    <ul class="text-xs list-disc pl-5 space-y-1 text-amber-900 font-medium">
      <li><strong>Proximity Order Matching:</strong> Assigning delivery orders to you based on your live distance from merchant stores.</li>
      <li><strong>Customer Live Tracking:</strong> Allowing the customer to view live delivery progress on the order map.</li>
      <li><strong>Accurate Distance Payouts:</strong> Calculating your per-kilometer travel earnings and surge incentives.</li>
      <li><strong>Rider Safety:</strong> Locating your vehicle during emergency SOS alerts.</li>
    </ul>
    <p class="text-xs font-bold text-amber-950 mt-2">Background location collection is active ONLY when your duty toggle is set to "ONLINE" and stops completely when you switch to "OFFLINE".</p>
  </div>

  <div class="point-item">
    <h3 class="text-base font-bold text-slate-900 mb-1">3. Personal & Verification Information</h3>
    <p class="text-sm text-slate-600 leading-relaxed">For onboarding, identity verification, and payouts, we collect your full name, mobile number, Aadhaar card, PAN card, Driving License (DL), Vehicle Registration Certificate (RC), vehicle insurance, and bank/UPI payment details.</p>
  </div>

  <div class="point-item">
    <h3 class="text-base font-bold text-slate-900 mb-1">4. Customer Data Confidentiality</h3>
    <p class="text-sm text-slate-600 leading-relaxed">Customer names, addresses, and phone numbers shown on delivery tasks are provided strictly for completing delivery. Saving customer numbers, calling customers after delivery, or sharing customer information is strictly prohibited.</p>
  </div>

  <div class="point-item">
    <h3 class="text-base font-bold text-slate-900 mb-1">5. Data Protection & Account Management</h3>
    <p class="text-sm text-slate-600 leading-relaxed">All rider operational logs and payout histories are encrypted and stored securely. You may review your profile details or request account deactivation at any time through Rider Support at <strong>delivery-support@anushkakart.com</strong>.</p>
  </div>
</div>
`;

const DELIVERY_TERMS = `
<div class="legal-points space-y-5">
  <div class="point-item">
    <h3 class="text-base font-bold text-slate-900 mb-1">1. Independent Contractor Relationship</h3>
    <p class="text-sm text-slate-600 leading-relaxed">You join AnushkaKart as an independent freelance delivery executive. You have the full freedom to choose when to log in, accept delivery assignments, and take breaks. This agreement does not create an employer-employee relationship.</p>
  </div>

  <div class="point-item">
    <h3 class="text-base font-bold text-slate-900 mb-1">2. Onboarding & Documentation Requirements</h3>
    <p class="text-sm text-slate-600 leading-relaxed">To accept deliveries, you must be at least 18 years of age, hold a valid Indian Driving License, active Vehicle Registration (RC), active two-wheeler insurance, and possess a smartphone with active GPS connectivity.</p>
  </div>

  <div class="point-item">
    <h3 class="text-base font-bold text-slate-900 mb-1">3. Safe Delivery & Secure OTP Verification</h3>
    <p class="text-sm text-slate-600 leading-relaxed">Delivery partners must inspect parcels for secure merchant packaging before departing the store. Deliveries must be completed directly to the customer’s address and verified by entering the customer’s secure delivery OTP into the app.</p>
  </div>

  <div class="point-item">
    <h3 class="text-base font-bold text-slate-900 mb-1">4. Cash on Delivery (COD) Remittance</h3>
    <p class="text-sm text-slate-600 leading-relaxed">All cash collected for COD orders is the exclusive property of AnushkaKart. Partners must remit or deposit all cash collections on the same day within the assigned cash limit. Unauthorized cash retention results in immediate deactivation and recovery proceedings.</p>
  </div>

  <div class="point-item">
    <h3 class="text-base font-bold text-slate-900 mb-1">5. Road Safety & Code of Conduct</h3>
    <p class="text-sm text-slate-600 leading-relaxed">Wearing a protective helmet, obeying all traffic safety laws, and maintaining respectful conduct toward customers and store staff is mandatory. Substance abuse or reckless riding results in permanent platform blacklisting.</p>
  </div>
</div>
`;

const pagesToSeed = [
  {
    type: "privacy",
    audience: "customer",
    title: "Customer Privacy Policy",
    content: CUSTOMER_PRIVACY,
  },
  {
    type: "terms",
    audience: "customer",
    title: "Customer Terms & Conditions",
    content: CUSTOMER_TERMS,
  },
  {
    type: "privacy",
    audience: "seller",
    title: "Seller Privacy Policy",
    content: SELLER_PRIVACY,
  },
  {
    type: "terms",
    audience: "seller",
    title: "Seller Terms & Conditions",
    content: SELLER_TERMS,
  },
  {
    type: "privacy",
    audience: "delivery",
    title: "Delivery Partner Privacy Policy",
    content: DELIVERY_PRIVACY,
  },
  {
    type: "terms",
    audience: "delivery",
    title: "Delivery Partner Terms & Conditions",
    content: DELIVERY_TERMS,
  },
];

async function seed() {
  const mongoUri =
    process.env.MONGO_URI ||
    process.env.MONGODB_URI ||
    "mongodb://localhost:27017/anushkakart";

  console.log("Connecting to MongoDB:", mongoUri ? "URI present" : "None");
  await mongoose.connect(mongoUri);
  console.log("Connected to MongoDB successfully!");

  for (const page of pagesToSeed) {
    const filter = { type: page.type, audience: page.audience };
    const update = {
      $set: {
        title: page.title,
        content: page.content,
        updatedAt: new Date(),
      },
    };
    const options = { upsert: true, new: true, setDefaultsOnInsert: true };
    const result = await LegalPage.findOneAndUpdate(filter, update, options);
    console.log(
      `✓ Seeded [type=${page.type}, audience=${page.audience}] -> "${result.title}" (ID: ${result._id})`
    );
  }

  console.log("All 6 legal pages seeded successfully with 5 crisp points!");
  await mongoose.disconnect();
  console.log("Disconnected from MongoDB.");
}

seed().catch((err) => {
  console.error("Error seeding legal pages:", err);
  process.exit(1);
});
