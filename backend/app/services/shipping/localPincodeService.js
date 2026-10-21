import mongoose from "mongoose";
import LocalPincode from "../../models/localPincode.js";

const DEFAULT_SEEDED_PINCODES = [
  {
    pincode: "284204",
    areaName: "Mauranipur Hub / Local Area",
    city: "Mauranipur",
    state: "Uttar Pradesh",
    deliveryTimeEstimate: "20-35 mins",
    isActive: true,
    riderRadiusKm: 10,
    notes: "Primary In-House Hyperlocal Delivery Zone",
  },
  {
    pincode: "284205",
    areaName: "Ranipur / Local Sector",
    city: "Mauranipur",
    state: "Uttar Pradesh",
    deliveryTimeEstimate: "20-35 mins",
    isActive: true,
    riderRadiusKm: 10,
    notes: "Secondary In-House Hyperlocal Delivery Zone",
  },
];

/**
 * Ensures initial local delivery pincodes exist in the database.
 */
export async function seedInitialPincodes() {
  try {
    const count = await LocalPincode.countDocuments();
    if (count === 0) {
      await LocalPincode.insertMany(DEFAULT_SEEDED_PINCODES);
      console.log("[LocalPincode] Seeded default local pincodes: 284204, 284205");
    }
  } catch (error) {
    console.error("[LocalPincode] Seeding failed:", error.message);
  }
}

/**
 * Checks if a given pincode is serviced locally by in-house delivery boys.
 * @param {string|number} pincode
 * @returns {Promise<boolean>}
 */
export async function isPincodeLocal(pincode) {
  if (!pincode) return false;
  const clean = String(pincode).trim();
  if (!clean) return false;

  const found = await LocalPincode.findOne({
    pincode: clean,
    isActive: true,
  }).lean();

  return Boolean(found);
}

/**
 * Retrieves the local pincode metadata (e.g. custom delivery time estimate).
 * @param {string|number} pincode
 */
export async function getLocalPincodeDetails(pincode) {
  if (!pincode) return null;
  const clean = String(pincode).trim();
  return await LocalPincode.findOne({ pincode: clean, isActive: true }).lean();
}

/**
 * Admin: Get all pincodes with pagination & search
 */
export async function listLocalPincodes({ search = "", status = "all", page = 1, limit = 50 } = {}) {
  const query = {};
  if (search && search.trim()) {
    const s = search.trim();
    query.$or = [
      { pincode: { $regex: s, $options: "i" } },
      { areaName: { $regex: s, $options: "i" } },
      { city: { $regex: s, $options: "i" } },
    ];
  }

  if (status === "active") query.isActive = true;
  if (status === "inactive") query.isActive = false;

  const skip = (Math.max(1, Number(page)) - 1) * Math.max(1, Number(limit));
  const parsedLimit = Math.max(1, Number(limit));

  const [items, total] = await Promise.all([
    LocalPincode.find(query).sort({ pincode: 1 }).skip(skip).limit(parsedLimit).lean(),
    LocalPincode.countDocuments(query),
  ]);

  const sanitizedItems = (items || []).map((item) => ({
    ...item,
    riderRadiusKm:
      item.riderRadiusKm !== undefined &&
      item.riderRadiusKm !== null &&
      Number.isFinite(Number(item.riderRadiusKm))
        ? Number(item.riderRadiusKm)
        : 10,
  }));

  return {
    items: sanitizedItems,
    total,
    page: Number(page),
    limit: parsedLimit,
    totalPages: Math.ceil(total / parsedLimit) || 1,
  };
}

/**
 * Admin: Create a new local serviceable pincode
 */
export async function addLocalPincode(data) {
  const pincode = String(data.pincode || "").trim();
  if (!/^\d{6}$/.test(pincode)) {
    const err = new Error("Invalid pincode format");
    err.statusCode = 400;
    throw err;
  }

  const existing = await LocalPincode.findOne({ pincode });
  if (existing) {
    const err = new Error(`Pincode ${pincode} already exists in database`);
    err.statusCode = 409;
    throw err;
  }

  const rawRadius = Number(data.riderRadiusKm);
  const riderRadiusKm = Number.isFinite(rawRadius)
    ? Math.min(Math.max(rawRadius, 1), 30)
    : 10;

  return await LocalPincode.create({
    pincode,
    areaName: data.areaName || "",
    city: data.city || "",
    state: data.state || "",
    deliveryTimeEstimate: data.deliveryTimeEstimate || "20-35 mins",
    isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
    riderRadiusKm,
    notes: data.notes || "",
  });
}

/**
 * Admin: Update an existing local pincode
 */
export async function updateLocalPincode(id, data) {
  const updateData = {};
  if (data.pincode !== undefined) {
    const nextPincode = String(data.pincode).trim();
    if (!/^\d{6}$/.test(nextPincode)) {
      const err = new Error("Invalid 6-digit pincode");
      err.statusCode = 400;
      throw err;
    }
    updateData.pincode = nextPincode;
  }
  if (data.areaName !== undefined) updateData.areaName = String(data.areaName).trim();
  if (data.city !== undefined) updateData.city = String(data.city).trim();
  if (data.state !== undefined) updateData.state = String(data.state).trim();
  if (data.deliveryTimeEstimate !== undefined) updateData.deliveryTimeEstimate = String(data.deliveryTimeEstimate).trim();
  if (data.isActive !== undefined) updateData.isActive = Boolean(data.isActive);
  if (data.riderRadiusKm !== undefined) {
    const r = Number(data.riderRadiusKm);
    updateData.riderRadiusKm = Number.isFinite(r) ? Math.min(Math.max(r, 1), 30) : 10;
  }
  if (data.notes !== undefined) updateData.notes = String(data.notes).trim();

  let updated = null;
  if (mongoose.Types.ObjectId.isValid(id)) {
    updated = await LocalPincode.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).lean();
  }
  if (!updated) {
    updated = await LocalPincode.findOneAndUpdate(
      { $or: [{ _id: id }, { pincode: String(id) }] },
      { $set: updateData },
      { new: true, runValidators: true }
    ).lean();
  }
  if (!updated) {
    const err = new Error("Pincode record not found");
    err.statusCode = 404;
    throw err;
  }
  return {
    ...updated,
    riderRadiusKm:
      updated.riderRadiusKm !== undefined &&
      updated.riderRadiusKm !== null &&
      Number.isFinite(Number(updated.riderRadiusKm))
        ? Number(updated.riderRadiusKm)
        : 10,
  };
}

/**
 * Admin: Delete a local pincode
 */
export async function deleteLocalPincode(id) {
  const deleted = await LocalPincode.findByIdAndDelete(id);
  if (!deleted) {
    const err = new Error("Pincode record not found");
    err.statusCode = 404;
    throw err;
  }
  return deleted;
}

/**
 * Admin: Toggle active status
 */
export async function toggleLocalPincodeStatus(id) {
  const item = await LocalPincode.findById(id);
  if (!item) {
    const err = new Error("Pincode record not found");
    err.statusCode = 404;
    throw err;
  }
  item.isActive = !item.isActive;
  await item.save();
  return item;
}

/**
 * Resolves the effective delivery mode for a product (quick_only vs both).
 * Product override takes precedence if set to "quick_only" or "both".
 * If "inherit" or unset, it checks the product's category.
 * If category deliveryMode is not set, defaults to "quick_only" for grocery and "both" for others.
 */
export async function resolveProductDeliveryMode(product, category = null) {
  if (!product) return "both";
  
  // 1. Explicit product override takes precedence
  const pMode = product.deliveryMode;
  if (pMode === "quick_only" || pMode === "both") {
    return pMode;
  }

  // 2. Resolve from category object if passed
  let cat = category;
  const isCatObject =
    cat &&
    typeof cat === "object" &&
    !(cat instanceof mongoose.Types.ObjectId) &&
    !Array.isArray(cat);
  const catHasDeliveryMode =
    isCatObject &&
    (cat.deliveryMode === "quick_only" || cat.deliveryMode === "both");

  if (!catHasDeliveryMode) {
    const candidateId =
      (isCatObject ? cat._id || cat.id : null) ||
      (cat && (typeof cat === "string" || mongoose.Types.ObjectId.isValid(cat))
        ? String(cat)
        : null) ||
      product.headerId?._id ||
      product.headerId ||
      product.categoryId?._id ||
      product.categoryId ||
      product.subcategoryId?._id ||
      product.subcategoryId;

    if (candidateId && mongoose.Types.ObjectId.isValid(String(candidateId))) {
      try {
        const Category = (await import("../../models/category.js")).default;
        const fetchedCat = await Category.findById(candidateId)
          .select("deliveryMode catalogType name slug")
          .lean();
        if (fetchedCat) {
          cat = fetchedCat;
        }
      } catch (err) {
        // silent fallback
      }
    }
  }

  if (cat?.deliveryMode === "quick_only" || cat?.deliveryMode === "both") {
    return cat.deliveryMode;
  }

  // 3. Check populated fields on product if present
  if (
    product.headerId?.deliveryMode === "quick_only" ||
    product.headerId?.deliveryMode === "both"
  ) {
    return product.headerId.deliveryMode;
  }
  if (
    product.categoryId?.deliveryMode === "quick_only" ||
    product.categoryId?.deliveryMode === "both"
  ) {
    return product.categoryId.deliveryMode;
  }
  if (
    product.subcategoryId?.deliveryMode === "quick_only" ||
    product.subcategoryId?.deliveryMode === "both"
  ) {
    return product.subcategoryId.deliveryMode;
  }

  // 4. If headerId or categoryId is an unpopulated ID, fetch from DB to check admin deliveryMode
  const hId = product.headerId?._id || product.headerId;
  if (hId && mongoose.Types.ObjectId.isValid(String(hId))) {
    try {
      const Category = (await import("../../models/category.js")).default;
      const hCat = await Category.findById(hId)
        .select("deliveryMode catalogType name slug")
        .lean();
      if (hCat?.deliveryMode === "quick_only" || hCat?.deliveryMode === "both") {
        return hCat.deliveryMode;
      }
      if (!cat) cat = hCat;
    } catch (e) {}
  }

  const cId = product.categoryId?._id || product.categoryId;
  if (cId && mongoose.Types.ObjectId.isValid(String(cId))) {
    try {
      const Category = (await import("../../models/category.js")).default;
      const cCat = await Category.findById(cId)
        .select("deliveryMode catalogType name slug")
        .lean();
      if (cCat?.deliveryMode === "quick_only" || cCat?.deliveryMode === "both") {
        return cCat.deliveryMode;
      }
      if (!cat) cat = cCat;
    } catch (e) {}
  }

  // 5. Fallback heuristics: check category slug
  const slug = String(
    cat?.slug || product.headerId?.slug || product.categoryId?.slug || ""
  ).toLowerCase();
  if (slug === "grocery" || slug === "kirana" || slug === "fresh") {
    return "quick_only";
  }

  const names = [
    cat?.name,
    product.headerId?.name,
    product.categoryId?.name,
    product.name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (
    names.includes("grocery") ||
    names.includes("kirana") ||
    names.includes("fresh") ||
    names.includes("vegetable") ||
    names.includes("sabzi") ||
    names.includes("dairy")
  ) {
    return "quick_only";
  }

  return "both";
}

/**
 * Core Rules Engine:
 * Evaluates delivery eligibility & fulfillment route based on:
 * - customerPincode (Destination)
 * - sellerPincode (Origin)
 * - deliveryMode ("quick_only" | "both")
 */
export async function evaluateDeliveryEligibility({
  customerPincode,
  sellerPincode,
  deliveryMode = "both",
}) {
  const cleanCustomer = String(customerPincode || "").trim();
  const cleanSeller = String(sellerPincode || "").trim();

  const isCustomerLocal = cleanCustomer ? await isPincodeLocal(cleanCustomer) : false;
  const isSellerLocal = cleanSeller ? await isPincodeLocal(cleanSeller) : false;

  const localDetails = isCustomerLocal ? await getLocalPincodeDetails(cleanCustomer) : null;
  const localEstimate = localDetails?.deliveryTimeEstimate || "15-20 mins";

  // Mode 1: Quick Delivery Only (Perishables/Grocery/Local Riders)
  if (deliveryMode === "quick_only") {
    // Both endpoints MUST be within active admin local delivery pincodes
    if (isCustomerLocal && isSellerLocal) {
      return {
        isDeliverable: true,
        fulfillmentType: "LOCAL_RIDERS",
        deliveryEstimate: localEstimate,
        shippingFeeType: "LOCAL",
        deliveryMode: "quick_only",
        isCustomerLocal: true,
        isSellerLocal: true,
        displayBadge: `⚡ ${localEstimate} Delivery (Local)`,
        reason: null,
      };
    }

    if (!cleanCustomer) {
      return {
        isDeliverable: false,
        fulfillmentType: null,
        deliveryEstimate: null,
        shippingFeeType: null,
        deliveryMode: "quick_only",
        isCustomerLocal: false,
        isSellerLocal,
        displayBadge: "❌ Quick Delivery Not Available",
        reason: "Please select a delivery location to check availability.",
      };
    }

    if (!isCustomerLocal) {
      return {
        isDeliverable: false,
        fulfillmentType: null,
        deliveryEstimate: null,
        shippingFeeType: null,
        deliveryMode: "quick_only",
        isCustomerLocal: false,
        isSellerLocal,
        displayBadge: `❌ Quick Delivery Not Available at ${cleanCustomer}`,
        reason: `Quick Delivery is not available at pincode ${cleanCustomer}. Fresh items are only delivered in local areas.`,
      };
    }

    // Customer is local, but seller is outside local delivery zone (e.g. Indore)
    return {
      isDeliverable: false,
      fulfillmentType: null,
      deliveryEstimate: null,
      shippingFeeType: null,
      deliveryMode: "quick_only",
      isCustomerLocal: true,
      isSellerLocal: false,
      displayBadge: "❌ Out of Zone",
      reason: "This fresh product is stocked outside the local delivery zone and cannot be delivered via courier.",
    };
  }

  // Mode 2: Both / Hybrid (Local 15-min riders if both endpoints are local, else Shiprocket standard courier)
  if (isCustomerLocal && isSellerLocal) {
    return {
      isDeliverable: true,
      fulfillmentType: "LOCAL_RIDERS",
      deliveryEstimate: localEstimate,
      shippingFeeType: "LOCAL",
      deliveryMode: "both",
      isCustomerLocal: true,
      isSellerLocal: true,
      displayBadge: `⚡ ${localEstimate} Delivery (Local)`,
      reason: null,
    };
  }

  // Either customer or seller is outside -> Shiprocket Pan-India courier
  return {
    isDeliverable: true,
    fulfillmentType: "SHIPROCKET",
    deliveryEstimate: "3-4 business days",
    shippingFeeType: "SHIPROCKET",
    deliveryMode: "both",
    isCustomerLocal,
    isSellerLocal,
    displayBadge: "📦 Standard Courier (3-4 Days)",
    reason: null,
  };
}

