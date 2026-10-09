import LocalPincode from "../../models/localPincode.js";

const DEFAULT_SEEDED_PINCODES = [
  {
    pincode: "284204",
    areaName: "Mauranipur Hub / Local Area",
    city: "Mauranipur",
    state: "Uttar Pradesh",
    deliveryTimeEstimate: "12-15 mins",
    isActive: true,
    notes: "Primary In-House Hyperlocal Delivery Zone",
  },
  {
    pincode: "284205",
    areaName: "Ranipur / Local Sector",
    city: "Mauranipur",
    state: "Uttar Pradesh",
    deliveryTimeEstimate: "12-15 mins",
    isActive: true,
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

  // Auto-seed if collection is completely empty
  const totalCount = await LocalPincode.countDocuments();
  if (totalCount === 0) {
    await seedInitialPincodes();
  }

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

  return {
    items,
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
  if (!pincode || !/^\d{4,8}$/.test(pincode)) {
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

  return await LocalPincode.create({
    pincode,
    areaName: data.areaName || "",
    city: data.city || "",
    state: data.state || "",
    deliveryTimeEstimate: data.deliveryTimeEstimate || "12-15 mins",
    isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
    notes: data.notes || "",
  });
}

/**
 * Admin: Update an existing local pincode
 */
export async function updateLocalPincode(id, data) {
  const updateData = {};
  if (data.pincode !== undefined) updateData.pincode = String(data.pincode).trim();
  if (data.areaName !== undefined) updateData.areaName = String(data.areaName).trim();
  if (data.city !== undefined) updateData.city = String(data.city).trim();
  if (data.state !== undefined) updateData.state = String(data.state).trim();
  if (data.deliveryTimeEstimate !== undefined) updateData.deliveryTimeEstimate = String(data.deliveryTimeEstimate).trim();
  if (data.isActive !== undefined) updateData.isActive = Boolean(data.isActive);
  if (data.notes !== undefined) updateData.notes = String(data.notes).trim();

  const updated = await LocalPincode.findByIdAndUpdate(id, updateData, { new: true }).lean();
  if (!updated) {
    const err = new Error("Pincode record not found");
    err.statusCode = 404;
    throw err;
  }
  return updated;
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
