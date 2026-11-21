/**
 * Creates the first four login accounts (admin, seller, customer, rider) in the database named by
 * MONGO_URI / MONGODB_URI. Safe to run again: an account that already exists is left untouched
 * (its password is NOT changed unless you pass --reset-passwords).
 *
 *   SEED_ADMIN_EMAIL=admin@gmail.com SEED_ADMIN_PASSWORD='...' \
 *   SEED_SELLER_EMAIL=seller@gmail.com SEED_SELLER_PASSWORD='...' SEED_SELLER_PHONE=9999999999 \
 *   SEED_CUSTOMER_PHONE=8209224481 SEED_RIDER_PHONE=7733992176 \
 *   node scripts/seedLiveAccounts.js --yes
 *
 * Without --yes it only shows which database it would write to and which accounts are missing.
 * Passwords are read from the environment on purpose, so they never get written into the code or git.
 * Customers and riders log in with an OTP on their phone, so they have no password.
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import dns from "node:dns";
import Admin from "../app/models/admin.js";
import Seller from "../app/models/seller.js";
import User from "../app/models/customer.js";
import Delivery from "../app/models/delivery.js";

dotenv.config({ quiet: true });

const args = new Set(process.argv.slice(2));
const WRITE = args.has("--yes");
const RESET = args.has("--reset-passwords");
const env = (k, fallback = "") => String(process.env[k] ?? fallback).trim();

// Some home / office DNS servers cannot look up Atlas "mongodb+srv" addresses.
if (args.has("--public-dns")) dns.setServers(["8.8.8.8", "1.1.1.1"]);

const PLAN = {
  admin: { email: env("SEED_ADMIN_EMAIL").toLowerCase(), password: env("SEED_ADMIN_PASSWORD"), name: env("SEED_ADMIN_NAME", "Admin") },
  seller: {
    email: env("SEED_SELLER_EMAIL").toLowerCase(), password: env("SEED_SELLER_PASSWORD"), phone: env("SEED_SELLER_PHONE"),
    name: env("SEED_SELLER_NAME", "Seller"), shopName: env("SEED_SELLER_SHOP", "Anushka Store"),
  },
  customer: { phone: env("SEED_CUSTOMER_PHONE"), name: env("SEED_CUSTOMER_NAME", "Customer") },
  rider: { phone: env("SEED_RIDER_PHONE"), name: env("SEED_RIDER_NAME", "Rider") },
};

const tenDigits = (p) => String(p || "").replace(/\D/g, "").slice(-10);
const problems = [];
if (!PLAN.admin.email || !PLAN.admin.password) problems.push("SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are needed");
if (!PLAN.seller.email || !PLAN.seller.password || !/^\d{10}$/.test(tenDigits(PLAN.seller.phone))) problems.push("SEED_SELLER_EMAIL, SEED_SELLER_PASSWORD and a 10 digit SEED_SELLER_PHONE are needed");
if (!/^\d{10}$/.test(tenDigits(PLAN.customer.phone))) problems.push("a 10 digit SEED_CUSTOMER_PHONE is needed");
if (!/^\d{10}$/.test(tenDigits(PLAN.rider.phone))) problems.push("a 10 digit SEED_RIDER_PHONE is needed");
for (const e of [PLAN.admin.email, PLAN.seller.email]) if (e && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) problems.push(`"${e}" is not a valid email`);
if (problems.length) {
  console.error("Cannot start:\n - " + problems.join("\n - "));
  process.exit(1);
}

const uri = String(process.env.MONGO_URI || process.env.MONGODB_URI || process.env.DATABASE_URL || "").trim();
if (!uri) {
  console.error("MONGO_URI / MONGODB_URI is not set.");
  process.exit(1);
}

async function main() {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 });
  const host = mongoose.connection.host;
  console.log(`Database: "${mongoose.connection.name}" on ${host}`);
  console.log(WRITE ? "Mode: WRITE (--yes)" : "Mode: dry run (add --yes to create the missing accounts)");

  const report = [];
  const phone10 = { customer: tenDigits(PLAN.customer.phone), rider: tenDigits(PLAN.rider.phone), seller: tenDigits(PLAN.seller.phone) };

  // ---- admin
  const admin = await Admin.findOne({ email: PLAN.admin.email }).select("+password");
  if (!admin) {
    if (WRITE) await new Admin({ name: PLAN.admin.name, email: PLAN.admin.email, password: PLAN.admin.password, role: "admin", isVerified: true }).save();
    report.push(`admin    ${PLAN.admin.email}: ${WRITE ? "CREATED" : "would be created"}`);
  } else if (RESET && WRITE) {
    admin.password = PLAN.admin.password;
    await admin.save();
    report.push(`admin    ${PLAN.admin.email}: exists, password RESET`);
  } else report.push(`admin    ${PLAN.admin.email}: already exists (left as it is)`);

  // ---- seller (approved so the panel opens straight away)
  const seller = await Seller.findOne({ email: PLAN.seller.email }).select("+password");
  const phoneTaken = !seller && (await Seller.exists({ phone: phone10.seller }));
  if (!seller) {
    if (phoneTaken) report.push(`seller   ${PLAN.seller.email}: NOT created, phone ${phone10.seller} already belongs to another seller`);
    else {
      if (WRITE) {
        await new Seller({
          name: PLAN.seller.name, email: PLAN.seller.email, password: PLAN.seller.password, phone: phone10.seller,
          shopName: PLAN.seller.shopName, role: "seller", isVerified: true, isActive: true, applicationStatus: "approved",
        }).save();
      }
      report.push(`seller   ${PLAN.seller.email}: ${WRITE ? "CREATED (approved)" : "would be created"}`);
    }
  } else if (RESET && WRITE) {
    seller.password = PLAN.seller.password;
    seller.isVerified = true;
    seller.isActive = true;
    seller.applicationStatus = "approved";
    await seller.save();
    report.push(`seller   ${PLAN.seller.email}: exists, password RESET and approved`);
  } else report.push(`seller   ${PLAN.seller.email}: already exists (left as it is)`);

  // ---- customer (logs in with an OTP; the phone is stored as +91XXXXXXXXXX by the model)
  const customerPhones = [phone10.customer, `+91${phone10.customer}`];
  const customer = await User.findOne({ phone: { $in: customerPhones } });
  if (!customer) {
    if (WRITE) await new User({ name: PLAN.customer.name, phone: phone10.customer, role: "user", isVerified: true }).save();
    report.push(`customer ${phone10.customer}: ${WRITE ? "CREATED" : "would be created"}`);
  } else report.push(`customer ${phone10.customer}: already exists (left as it is)`);

  // ---- rider (logs in with an OTP; the rider app sends the plain 10 digits, so that is what is stored)
  const rider = await Delivery.findOne({ phone: { $in: [phone10.rider, `+91${phone10.rider}`] } });
  if (!rider) {
    if (WRITE) await new Delivery({ name: PLAN.rider.name, phone: phone10.rider, isVerified: true, isActive: true, isOnline: false }).save();
    report.push(`rider    ${phone10.rider}: ${WRITE ? "CREATED (verified)" : "would be created"}`);
  } else report.push(`rider    ${phone10.rider}: already exists (left as it is)`);

  console.log("\n" + report.join("\n"));
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("Failed:", error.message);
  try { await mongoose.disconnect(); } catch { /* ignore */ }
  process.exit(1);
});
