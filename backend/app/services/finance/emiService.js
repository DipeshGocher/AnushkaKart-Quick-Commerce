/**
 * EMI / finance feature: settings, eligibility, calculation, quotations.
 *
 * The server is the only place that decides a price or a number: the customer's browser sends
 * only (productId, variant, down payment, months) and gets the breakdown back, so what the
 * customer sees, what is saved and what goes into WhatsApp can never disagree.
 */

import crypto from "crypto";
import mongoose from "mongoose";
import FinanceConfig from "../../models/financeConfig.js";
import FinanceQuote from "../../models/financeQuote.js";
import Product from "../../models/product.js";
import Category from "../../models/category.js";
import Setting from "../../models/setting.js";
import { DEFAULT_EMI_CONFIG, calculateEmi } from "../../utils/financeCalculator.js";
import { encryptPii, decryptPii, maskAadhaar, maskPan } from "../../utils/piiCrypto.js";

const DEFAULT_TERMS = [
  "मोबाइल की कुल रकम में सहमत शुल्क/ब्याज शामिल हैं; डाउन पेमेंट घटाने के बाद बची रकम EMI के माध्यम से जमा करनी होगी।",
  "सभी EMI तय तारीख पर जमा करना ग्राहक की जिम्मेदारी है।",
  "देय EMI तारीख पर किस्त जमा न होने पर विलंब पेनाल्टी लागू होगी, जहाँ यह लागू कानून और ग्राहक को पहले से बताई गई शर्तों के अनुसार अनुमत हो।",
  "मोबाइल का स्वामित्व/पूर्ण अधिकार ग्राहक को सभी तय EMI और देय रकम पूरी जमा होने के बाद मिलेगा; यह शर्त लागू कानून के अधीन होगी।",
  "मोबाइल की निर्माता वारंटी, यदि लागू हो, निर्माता/विक्रेता की शर्तों के अनुसार होगी।",
  "ग्राहक और गारंटर ने इस EMI विवरण, देय तारीखों और शर्तों को पढ़कर/समझकर स्वीकार किया है।",
];

function err(message, statusCode = 400) {
  const e = new Error(message);
  e.statusCode = statusCode;
  return e;
}

const num = (v) => (v === "" || v === null || v === undefined ? NaN : Number(v));

/* ───────────────────────────── settings ───────────────────────────── */

/** Settings with defaults filled in. Never throws for a missing document. */
export async function getConfig() {
  const doc = await FinanceConfig.findOne({ key: "default" }).lean();
  return {
    ...DEFAULT_EMI_CONFIG,
    fileChargeSlabs: DEFAULT_EMI_CONFIG.fileChargeSlabs.map((s) => ({ ...s })),
    tenures: [...DEFAULT_EMI_CONFIG.tenures],
    dueDateRules: DEFAULT_EMI_CONFIG.dueDateRules.map((r) => ({ ...r })),
    whatsappNumber: "",
    shop: { name: "Anushka Mobile Gallery", address: "", phone: "" },
    terms: [...DEFAULT_TERMS],
    ...(doc || {}),
    ...(doc && (!doc.terms || doc.terms.length === 0) ? { terms: [...DEFAULT_TERMS] } : {}),
    ...(doc && (!doc.fileChargeSlabs || doc.fileChargeSlabs.length === 0)
      ? { fileChargeSlabs: DEFAULT_EMI_CONFIG.fileChargeSlabs.map((s) => ({ ...s })) }
      : {}),
    ...(doc && (!doc.tenures || doc.tenures.length === 0) ? { tenures: [...DEFAULT_EMI_CONFIG.tenures] } : {}),
    ...(doc && (!doc.dueDateRules || doc.dueDateRules.length === 0)
      ? { dueDateRules: DEFAULT_EMI_CONFIG.dueDateRules.map((r) => ({ ...r })) }
      : {}),
  };
}

/** The number quotations are sent to: finance setting first, then the store's WhatsApp setting. */
export async function resolveWhatsappNumber(config) {
  const own = String(config?.whatsappNumber || "").replace(/\D/g, "");
  if (own) return normalizeWhatsapp(own);
  const store = await Setting.findOne({}).select("whatsappNumber supportWhatsappNumber").lean();
  const fallback = String(store?.whatsappNumber || store?.supportWhatsappNumber || "").replace(/\D/g, "");
  return fallback ? normalizeWhatsapp(fallback) : "";
}

function normalizeWhatsapp(digits) {
  return digits.length === 10 ? `91${digits}` : digits;
}

/** Validates admin input and returns the clean document to store. Throws 400 with a clear message. */
export function validateConfigInput(input = {}) {
  const out = {};

  out.enabled = input.enabled !== false && input.enabled !== "false";

  if (!["flat", "reducing"].includes(input.interestType)) throw err("Interest type must be flat or reducing.");
  out.interestType = input.interestType;

  const rate = num(input.interestRatePerMonth);
  if (!Number.isFinite(rate) || rate < 0 || rate > 50) throw err("Interest rate must be between 0 and 50 % per month.");
  out.interestRatePerMonth = rate;

  const slabs = Array.isArray(input.fileChargeSlabs) ? input.fileChargeSlabs : [];
  if (slabs.length < 1 || slabs.length > 20) throw err("Add between 1 and 20 file charge slabs.");
  let prev = 0;
  out.fileChargeSlabs = slabs.map((s, i) => {
    const isLast = i === slabs.length - 1;
    const fileCharge = num(s?.fileCharge);
    if (!Number.isFinite(fileCharge) || fileCharge < 0) throw err(`Slab ${i + 1}: file charge must be 0 or more.`);
    if (isLast) {
      if (s?.upTo !== null && s?.upTo !== undefined && s?.upTo !== "") {
        throw err("The last slab must be 'all amounts above' (leave its limit empty).");
      }
      return { upTo: null, fileCharge };
    }
    const upTo = num(s?.upTo);
    if (!Number.isFinite(upTo) || upTo <= prev) throw err(`Slab ${i + 1}: limit must be higher than the previous slab.`);
    prev = upTo;
    return { upTo, fileCharge };
  });

  const tenures = Array.isArray(input.tenures) ? input.tenures.map(Number) : [];
  const uniq = [...new Set(tenures)].sort((a, b) => a - b);
  if (uniq.length < 1 || uniq.some((t) => !Number.isInteger(t) || t < 1 || t > 60)) {
    throw err("EMI durations must be whole months between 1 and 60 (at least one).");
  }
  out.tenures = uniq;

  const rules = (Array.isArray(input.dueDateRules) ? input.dueDateRules : [])
    .map((r) => ({ fromDay: Number(r?.fromDay), toDay: Number(r?.toDay), dueDay: Number(r?.dueDay) }))
    .sort((a, b) => a.fromDay - b.fromDay);
  if (!rules.length) throw err("Add at least one first-EMI date rule.");
  let expectedFrom = 1;
  for (const r of rules) {
    if (![r.fromDay, r.toDay, r.dueDay].every(Number.isInteger)) throw err("Date rules must use whole day numbers.");
    if (r.fromDay !== expectedFrom) throw err("Date rules must cover days 1 to 31 with no gaps or overlaps.");
    if (r.toDay < r.fromDay || r.toDay > 31) throw err("Date rule: 'to' day must not be before the 'from' day (max 31).");
    if (r.dueDay < 1 || r.dueDay > 28) throw err("First EMI day must be between 1 and 28.");
    expectedFrom = r.toDay + 1;
  }
  if (expectedFrom !== 32) throw err("Date rules must cover days 1 to 31 with no gaps or overlaps.");
  out.dueDateRules = rules;

  const lateFee = num(input.lateFee);
  if (!Number.isFinite(lateFee) || lateFee < 0 || lateFee > 100000) throw err("Late fee must be 0 or more.");
  out.lateFee = lateFee;

  const minDown = num(input.minDownPaymentPercent ?? 0);
  if (!Number.isFinite(minDown) || minDown < 0 || minDown > 90) throw err("Minimum down payment must be between 0 and 90 %.");
  out.minDownPaymentPercent = minDown;

  const wa = String(input.whatsappNumber || "").replace(/\D/g, "");
  if (wa && (wa.length < 10 || wa.length > 13)) throw err("WhatsApp number must be 10 digits (or with country code).");
  out.whatsappNumber = wa;

  const shop = input.shop || {};
  out.shop = {
    name: String(shop.name || "").trim().slice(0, 80) || "Anushka Mobile Gallery",
    address: String(shop.address || "").trim().slice(0, 200),
    phone: String(shop.phone || "").trim().slice(0, 30),
  };

  const terms = (Array.isArray(input.terms) ? input.terms : []).map((t) => String(t || "").trim()).filter(Boolean);
  if (terms.length > 15 || terms.some((t) => t.length > 500)) throw err("Keep terms to 15 lines of up to 500 characters.");
  out.terms = terms;

  return out;
}

export async function saveConfig(input) {
  const clean = validateConfigInput(input);
  await FinanceConfig.updateOne({ key: "default" }, { $set: clean, $setOnInsert: { key: "default" } }, { upsert: true });
  return getConfig();
}

/** What a customer may see about the settings (no WhatsApp number, rates stay private). */
export function publicConfig(config) {
  return {
    enabled: Boolean(config.enabled),
    interestType: config.interestType,
    tenures: config.tenures,
    minDownPaymentPercent: config.minDownPaymentPercent || 0,
  };
}

/** Header categories that offer finance. Lets the product page decide whether to show the button without an extra request per product. */
export async function listEnabledHeaders() {
  const config = await getConfig();
  if (!config.enabled) return { enabled: false, headerIds: [] };
  const headers = await Category.find({ type: "header", financeEnabled: true }).select("_id").lean();
  return { enabled: true, headerIds: headers.map((h) => String(h._id)) };
}

/* ─────────────────────── product, price and eligibility ─────────────────────── */

const PRODUCT_FIELDS = "name status approvalStatus headerId price salePrice mainImage galleryImages variants";

function productImage(product, variant) {
  return (variant?.images && variant.images[0]) || product.mainImage || (product.galleryImages && product.galleryImages[0]) || "";
}

/** Same price rule the product page uses: sale price if set, else price. */
function priceOf(entity) {
  const sale = Number(entity?.salePrice);
  if (Number.isFinite(sale) && sale > 0) return sale;
  const price = Number(entity?.price);
  return Number.isFinite(price) && price > 0 ? price : 0;
}

export function findVariant(product, variantKey) {
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const key = String(variantKey || "").trim();
  if (!key) return null;
  return variants.find((v) => String(v.sku || "").trim() === key || String(v.name || "").trim() === key) || null;
}

/**
 * Loads a product and decides whether finance is offered for it.
 * Returns { available, reason, product, variant, price, headerName }.
 */
export async function loadFinanceProduct(productId, variantKey, config) {
  if (!mongoose.Types.ObjectId.isValid(String(productId || ""))) throw err("Product not found.", 404);
  const product = await Product.findById(productId).select(PRODUCT_FIELDS).lean();
  if (!product || product.status !== "active" || product.approvalStatus === "rejected") {
    throw err("Product not found.", 404);
  }

  let reason = null;
  if (!config.enabled) reason = "Finance is not available right now.";
  else {
    const header = product.headerId
      ? await Category.findById(product.headerId).select("financeEnabled name").lean()
      : null;
    if (!header?.financeEnabled) reason = "Finance is not available for this product.";
  }

  const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;
  let variant = null;
  if (hasVariants) {
    variant = findVariant(product, variantKey) || (!variantKey && product.variants.length === 1 ? product.variants[0] : null);
    if (!variant && !reason) reason = "Please choose a variant first.";
  }

  const price = variant ? priceOf(variant) : priceOf(product);
  if (!reason && price <= 0) reason = "Price is not available for finance.";

  return { available: !reason, reason, product, variant, price };
}

/* ───────────────────────────── calculation ───────────────────────────── */

export async function calculateForProduct({ productId, variantSku, downPayment, months }, now = new Date()) {
  const config = await getConfig();
  const info = await loadFinanceProduct(productId, variantSku, config);
  if (!info.available) throw err(info.reason, 400);
  const result = calculateEmi({
    price: info.price,
    downPayment: num(downPayment),
    months: Number(months),
    config,
    now,
  });
  return { result, info, config };
}

/* ───────────────────────────── quotations ───────────────────────────── */

const fmtMoney = (n) => `Rs ${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;

function fmtDate(iso) {
  const [y, m, d] = String(iso).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

/** Groups equal consecutive EMIs so the WhatsApp text stays short even for 24 months. */
function scheduleLines(schedule) {
  const lines = [];
  let i = 0;
  while (i < schedule.length) {
    let j = i;
    while (j + 1 < schedule.length && schedule[j + 1].amount === schedule[i].amount) j += 1;
    if (j > i) {
      lines.push(`EMI ${schedule[i].no}-${schedule[j].no}: ${fmtMoney(schedule[i].amount)} each (${fmtDate(schedule[i].dueDate)} to ${fmtDate(schedule[j].dueDate)})`);
    } else {
      lines.push(`EMI ${schedule[i].no}: ${fmtMoney(schedule[i].amount)} on ${fmtDate(schedule[i].dueDate)}`);
    }
    i = j + 1;
  }
  return lines;
}

/** The pre-filled WhatsApp text for the shop. PAN / Aadhaar appear masked only. */
export function buildQuotationMessage(quote) {
  const r = quote.result;
  const p = quote.product;
  const lines = [
    `*EMI Quotation Request* (${quote.quoteId})`,
    "",
    `Customer: ${quote.customer.name}`,
    `Phone: ${quote.customer.phone}`,
  ];
  if (quote.customer.panMasked) lines.push(`PAN: ${quote.customer.panMasked}`);
  if (quote.customer.aadhaarMasked) lines.push(`Aadhaar: ${quote.customer.aadhaarMasked}`);
  lines.push(
    "",
    `Product: ${p.name}${p.variantName ? ` (${p.variantName})` : ""}`,
  );
  if (quote.imei1) lines.push(`IMEI 1: ${quote.imei1}`);
  if (quote.imei2) lines.push(`IMEI 2: ${quote.imei2}`);
  lines.push(
    "",
    `Product price: ${fmtMoney(r.price)}`,
    `Down payment: ${fmtMoney(r.downPayment)}`,
    `Finance amount: ${fmtMoney(r.financeAmount)}`,
    `File charge: ${fmtMoney(r.fileCharge)}`,
    `Interest (${r.interestType === "reducing" ? "reducing" : "flat"}): ${fmtMoney(r.remainingInterest)}`,
    `Total payable: ${fmtMoney(r.totalPayable)}`,
    `EMI duration: ${r.months} months`,
    `${r.emiVaries ? "First EMI" : "Monthly EMI"}: ${fmtMoney(r.monthlyEmi)}`,
    `First EMI date: ${fmtDate(r.firstEmiDate)}`,
    "",
    "*EMI schedule*",
    ...scheduleLines(r.schedule),
  );
  return lines.join("\n");
}

export function buildWhatsappUrl(number, message) {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

function newQuoteId() {
  return `FQ-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
}

function cleanCustomer(input = {}) {
  const name = String(input.name || "").trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 80) throw err("Enter the customer's full name.");

  const phone = String(input.phone || "").replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
  if (!/^[6-9]\d{9}$/.test(phone)) throw err("Enter a valid 10 digit mobile number.");

  const panRaw = String(input.pan || "").trim().toUpperCase();
  if (panRaw && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(panRaw)) throw err("PAN number looks wrong (example: ABCDE1234F).");

  const aadhaarRaw = String(input.aadhaar || "").replace(/\s/g, "");
  if (aadhaarRaw && !/^\d{12}$/.test(aadhaarRaw)) throw err("Aadhaar number must be 12 digits.");

  return { name, phone, pan: panRaw, aadhaar: aadhaarRaw };
}

function cleanImei(value, label) {
  const v = String(value || "").replace(/\s/g, "");
  if (!v) return "";
  if (!/^\d{15}$/.test(v)) throw err(`${label} must be 15 digits.`);
  return v;
}

export async function createQuote({ productId, variantSku, downPayment, months, customer, imei1, imei2, userId = null }, now = new Date()) {
  // Validate everything first; nothing is written until all checks pass.
  const cust = cleanCustomer(customer);
  const i1 = cleanImei(imei1, "IMEI 1");
  const i2 = cleanImei(imei2, "IMEI 2");
  if (i1 && i2 && i1 === i2) throw err("IMEI 1 and IMEI 2 must be different.");

  const { result, info, config } = await calculateForProduct({ productId, variantSku, downPayment, months }, now);

  const whatsappNumber = await resolveWhatsappNumber(config);
  if (!whatsappNumber) throw err("The shop's WhatsApp number is not set up yet. Please try again later.", 503);

  const doc = {
    customerUser: userId && mongoose.Types.ObjectId.isValid(String(userId)) ? userId : null,
    customer: {
      name: cust.name,
      phone: cust.phone,
      panEnc: cust.pan ? encryptPii(cust.pan) : "",
      aadhaarEnc: cust.aadhaar ? encryptPii(cust.aadhaar) : "",
      panMasked: cust.pan ? maskPan(cust.pan) : "",
      aadhaarMasked: cust.aadhaar ? maskAadhaar(cust.aadhaar) : "",
    },
    product: {
      productId: info.product._id,
      name: info.product.name,
      variantName: info.variant?.name || "",
      variantSku: info.variant?.sku || "",
      image: productImage(info.product, info.variant),
    },
    imei1: i1,
    imei2: i2,
    result,
    settingsSnapshot: {
      interestType: config.interestType,
      interestRatePerMonth: config.interestRatePerMonth,
      fileChargeSlabs: config.fileChargeSlabs,
      lateFee: config.lateFee,
    },
    whatsappNumber,
  };

  let saved = null;
  for (let attempt = 0; attempt < 5 && !saved; attempt += 1) {
    try {
      saved = await FinanceQuote.create({ ...doc, quoteId: newQuoteId() });
    } catch (error) {
      if (error?.code !== 11000) throw error;
    }
  }
  if (!saved) throw err("Could not create the quotation. Please try again.", 500);

  const plain = saved.toObject();
  const message = buildQuotationMessage(plain);
  return {
    quote: publicQuote(plain),
    message,
    whatsappUrl: buildWhatsappUrl(whatsappNumber, message),
    print: {
      shop: config.shop,
      terms: config.terms,
      lateFee: config.lateFee,
    },
  };
}

/** Shape sent back to the customer (never any ID numbers, not even masked ones beyond what they typed). */
export function publicQuote(q) {
  return {
    quoteId: q.quoteId,
    createdAt: q.createdAt,
    customer: { name: q.customer.name, phone: q.customer.phone },
    product: q.product,
    imei1: q.imei1,
    imei2: q.imei2,
    result: q.result,
  };
}

/* ───────────────────────────── admin ───────────────────────────── */

const STATUSES = ["new", "contacted", "approved", "rejected", "cancelled"];

export async function listQuotes({ status, search, page = 1, limit = 25 } = {}) {
  const q = {};
  if (status && status !== "all") {
    if (!STATUSES.includes(status)) throw err("Unknown status.");
    q.status = status;
  }
  const term = String(search || "").trim();
  if (term) {
    const safe = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    q.$or = [
      { quoteId: new RegExp(safe, "i") },
      { "customer.name": new RegExp(safe, "i") },
      { "customer.phone": new RegExp(safe, "i") },
      { "product.name": new RegExp(safe, "i") },
    ];
  }
  const pageNum = Math.max(1, Number(page) || 1);
  const lim = Math.min(100, Math.max(1, Number(limit) || 25));
  const [items, total, newCount] = await Promise.all([
    FinanceQuote.find(q).sort({ createdAt: -1, _id: -1 }).skip((pageNum - 1) * lim).limit(lim).lean(),
    FinanceQuote.countDocuments(q),
    FinanceQuote.countDocuments({ status: "new" }),
  ]);
  return { items, total, page: pageNum, limit: lim, totalPages: Math.ceil(total / lim) || 1, newCount };
}

export async function getQuote(id, { reveal = false } = {}) {
  const query = mongoose.Types.ObjectId.isValid(String(id)) ? { _id: id } : { quoteId: String(id) };
  const q = await FinanceQuote.findOne(query).select("+customer.panEnc +customer.aadhaarEnc").lean();
  if (!q) throw err("Quotation not found.", 404);
  const { panEnc, aadhaarEnc, ...customerRest } = q.customer;
  const out = { ...q, customer: { ...customerRest } };
  if (reveal) {
    out.customer.pan = decryptPii(panEnc);
    out.customer.aadhaar = decryptPii(aadhaarEnc);
  }
  return out;
}

export async function updateQuote(id, { status, adminNote }) {
  const set = {};
  if (status !== undefined) {
    if (!STATUSES.includes(status)) throw err("Unknown status.");
    set.status = status;
  }
  if (adminNote !== undefined) set.adminNote = String(adminNote || "").trim().slice(0, 500);
  if (!Object.keys(set).length) throw err("Nothing to update.");
  const query = mongoose.Types.ObjectId.isValid(String(id)) ? { _id: id } : { quoteId: String(id) };
  const updated = await FinanceQuote.findOneAndUpdate(query, { $set: set }, { new: true }).lean();
  if (!updated) throw err("Quotation not found.", 404);
  return updated;
}

export default {
  getConfig,
  saveConfig,
  publicConfig,
  validateConfigInput,
  loadFinanceProduct,
  calculateForProduct,
  createQuote,
  buildQuotationMessage,
  listQuotes,
  getQuote,
  updateQuote,
};
