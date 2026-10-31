import Seller from "../models/seller.js";
import Order from "../models/order.js";
import Transaction from "../models/transaction.js";
import Wallet from "../models/wallet.js";
import { handleResponse, calculateDistance } from "../utils/helper.js";
import mongoose from "mongoose";
import { invalidateSellerName } from "../services/entityNameCache.js";
import { syncSellerPickupLocationToShiprocket } from "../services/shipping/shiprocketService.js";
import { getErrorStatus } from "../utils/httpError.js";

/* ===============================
   GET NEARBY SELLERS
================================ */
export const getNearbySellers = async (req, res) => {
  try {
    const { lat, lng } = req.query;

    if (!lat || !lng) {
      return handleResponse(res, 400, "Latitude and longitude are required");
    }

    const customerLat = Number(lat);
    const customerLng = Number(lng);

    // Fetch all active/verified sellers
    // We could use $geoNear, but to strictly follow the requirement of individual radii,
    // we'll fetch sellers within a reasonable max distance (e.g. 100km) and then filter.
    const sellers = await Seller.find({
      isActive: true,
      isVerified: true,
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [customerLng, customerLat],
          },
          $maxDistance: 100000, // 100km max search area for performance
        },
      },
    }).lean();

    // Filter based on individual service radius
    const nearbySellers = sellers.filter((seller) => {
      const sellerLng = seller.location.coordinates[0];
      const sellerLat = seller.location.coordinates[1];
      const distance = calculateDistance(
        customerLat,
        customerLng,
        sellerLat,
        sellerLng,
      );

      // Add distance to seller object for frontend
      seller.distance = distance;

      return distance <= (seller.serviceRadius || 5);
    });

    return handleResponse(
      res,
      200,
      "Nearby sellers fetched successfully",
      nearbySellers,
    );
  } catch (error) {
    return handleResponse(res, getErrorStatus(error), error.message);
  }
};

/* ===============================
   REQUEST WITHDRAWAL (Seller)
================================ */
export const requestWithdrawal = async (req, res) => {
  try {
    const sellerId = req.user.id;
    const { amount } = req.body;

    const parsedAmount = Number(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      return handleResponse(res, 400, "Please enter a valid amount");
    }

    // 1. Verify seller has bank account added in Profile
    const seller = await Seller.findById(sellerId).lean();
    if (!seller) {
      return handleResponse(res, 404, "Seller not found");
    }

    const bank = seller.bankDetails;
    const bankAccount = bank?.accountNumber || seller.accountNumber;
    const bankName = bank?.bankName || seller.bankName;
    const ifsc = bank?.ifscCode || bank?.ifsc || seller.ifsc;
    const accountHolder = bank?.accountHolderName || bank?.accountHolder || seller.accountHolder || seller.name;

    if (!bankAccount || !bankName) {
      return handleResponse(
        res,
        400,
        "Please link your bank account in Profile before requesting a withdrawal",
      );
    }

    // 2. Single source of truth available balance calculation
    const transactions = await Transaction.find({
      user: sellerId,
      userModel: "Seller",
    })
      .select("status amount type order")
      .populate("order", "paymentBreakdown")
      .lean();

    const settledEarnings = transactions
      .filter((t) => t.type === "Order Payment" && t.status === "Settled")
      .reduce(
        (acc, t) =>
          acc + (t.order?.paymentBreakdown?.sellerPayoutTotal || t.amount || 0),
        0,
      );

    const settledWithdrawals = transactions
      .filter((t) => t.type === "Withdrawal" && t.status === "Settled")
      .reduce((acc, t) => acc + Math.abs(t.amount || 0), 0);

    const pendingPayouts = transactions
      .filter(
        (t) =>
          t.type === "Withdrawal" &&
          (t.status === "Pending" || t.status === "Processing"),
      )
      .reduce((acc, t) => acc + Math.abs(t.amount || 0), 0);

    const availableBalance = Math.max(
      0,
      settledEarnings - settledWithdrawals - pendingPayouts,
    );

    if (parsedAmount > availableBalance) {
      return handleResponse(
        res,
        400,
        `Insufficient balance. Available: ₹${availableBalance.toLocaleString()}`,
      );
    }

    // 3. Create Withdrawal Transaction with bank details snapshot in meta
    const maskedAcc = String(bankAccount).slice(-4);
    const withdrawal = await Transaction.create({
      user: sellerId,
      userModel: "Seller",
      type: "Withdrawal",
      amount: -Math.abs(parsedAmount),
      status: "Pending",
      reference: `WDR-${Date.now()}`,
      meta: {
        bankDetails: {
          bankName,
          accountNumber: bankAccount,
          ifscCode: ifsc,
          accountHolderName: accountHolder,
          upiId: bank?.upiId || null,
        },
        requestedAt: new Date(),
      },
      notes: `Withdrawal to ${bankName} (Acct Ending in **** ${maskedAcc})`,
    });

    // 4. Sync Wallet document in MongoDB
    const remainingAvailable = Math.max(0, availableBalance - parsedAmount);
    const newPending = pendingPayouts + parsedAmount;
    await Wallet.findOneAndUpdate(
      { ownerType: "SELLER", ownerId: sellerId },
      {
        $set: {
          availableBalance: remainingAvailable,
          pendingBalance: newPending,
        },
      },
      { upsert: true },
    );

    return handleResponse(
      res,
      201,
      "Withdrawal request submitted successfully",
      withdrawal,
    );
  } catch (error) {
    return handleResponse(res, getErrorStatus(error), error.message);
  }
};

/* ===============================
   GET SELLER PROFILE
================================ */
export const getSellerProfile = async (req, res) => {
  try {
    const seller = await Seller.findById(req.user.id);
    if (!seller) {
      return handleResponse(res, 404, "Seller not found");
    }
    return handleResponse(
      res,
      200,
      "Seller profile fetched successfully",
      seller,
    );
  } catch (error) {
    return handleResponse(res, getErrorStatus(error), error.message);
  }
};

/* ===============================
   UPDATE SELLER PROFILE
================================ */
export const updateSellerProfile = async (req, res) => {
  try {
    const { name, shopName, phone, address, locality, pincode, city, state, lat, lng, radius, bankDetails } = req.body;

    // Find seller
    const seller = await Seller.findById(req.user.id);
    if (!seller) {
      return handleResponse(res, 404, "Seller not found");
    }

    // Update fields if provided
    if (name) seller.name = name;
    if (shopName) seller.shopName = shopName;
    if (phone) seller.phone = phone;
    if (locality !== undefined) seller.locality = locality;

    if (bankDetails && typeof bankDetails === "object") {
      if (!seller.bankDetails) seller.bankDetails = {};
      if (bankDetails.bankName !== undefined) {
        seller.bankDetails.bankName = String(bankDetails.bankName || "").trim();
        seller.bankName = seller.bankDetails.bankName;
      }
      if (bankDetails.accountNumber !== undefined) {
        seller.bankDetails.accountNumber = String(bankDetails.accountNumber || "").trim();
        seller.accountNumber = seller.bankDetails.accountNumber;
      }
      if (bankDetails.ifsc !== undefined || bankDetails.ifscCode !== undefined) {
        const ifscVal = String(bankDetails.ifscCode || bankDetails.ifsc || "").trim().toUpperCase();
        seller.bankDetails.ifsc = ifscVal;
        seller.bankDetails.ifscCode = ifscVal;
        seller.ifsc = ifscVal;
      }
      if (bankDetails.accountHolder !== undefined || bankDetails.accountHolderName !== undefined) {
        const holder = String(bankDetails.accountHolderName || bankDetails.accountHolder || "").trim();
        seller.bankDetails.accountHolder = holder;
        seller.bankDetails.accountHolderName = holder;
        seller.accountHolder = holder;
      }
      if (bankDetails.upiId !== undefined) {
        seller.bankDetails.upiId = String(bankDetails.upiId || "").trim();
      }
    }

    if (pincode !== undefined) {
      const normPincode = String(pincode || "").trim();
      if (!/^[1-9][0-9]{5}$/.test(normPincode)) {
        return handleResponse(res, 400, "A valid 6-digit Indian postal pincode is required");
      }
      seller.pincode = normPincode;
    }
    if (address !== undefined) {
      const normAddress = String(address || "").trim();
      if (normAddress && normAddress.length < 5) {
        return handleResponse(res, 400, "Address must be at least 5 characters long");
      }
      seller.address = normAddress;
    }
    if (city !== undefined) {
      const normCity = String(city || "").trim();
      if (normCity && normCity.length < 2) {
        return handleResponse(res, 400, "City must be at least 2 characters long");
      }
      seller.city = normCity;
    }
    if (state !== undefined) {
      const normState = String(state || "").trim();
      if (normState && normState.length < 2) {
        return handleResponse(res, 400, "State must be at least 2 characters long");
      }
      seller.state = normState;
    }

    // Automatically register or update pickup location with Shiprocket
    if (seller.pincode && seller.address && seller.city && seller.state) {
      try {
        await syncSellerPickupLocationToShiprocket(seller);
      } catch (srErr) {
        console.warn("[Seller Profile] Shiprocket pickup location sync warning:", srErr.message);
      }
    }

    // Validate and update geo data
    if (lat !== undefined && lng !== undefined) {
      if (lat < -90 || lat > 90)
        return handleResponse(res, 400, "Invalid latitude");
      if (lng < -180 || lng > 180)
        return handleResponse(res, 400, "Invalid longitude");

      seller.location = {
        type: "Point",
        coordinates: [Number(lng), Number(lat)],
      };
    }

    if (radius !== undefined) {
      if (radius < 1 || radius > 100)
        return handleResponse(res, 400, "Radius must be between 1 and 100 km");
      seller.serviceRadius = Number(radius);
    }

    const updatedSeller = await seller.save();

    // Invalidate cached seller name in case shopName changed
    invalidateSellerName(req.user.id).catch((err) => {
      console.warn("[Seller] Name cache invalidation failed:", err.message);
    });

    return handleResponse(
      res,
      200,
      "Profile updated successfully",
      updatedSeller,
    );
  } catch (error) {
    // Handle duplicate phone error
    if (error.code === 11000) {
      return handleResponse(res, 400, "Phone number already in use");
    }
    return handleResponse(res, getErrorStatus(error), error.message);
  }
};


/* ===============================
   GET PUBLIC SELLER STORE
================================ */
export const getPublicSellerStore = async (req, res) => {
  try {
    const rawId = String(req.params.sellerId || "").trim();
    if (!rawId || rawId === "undefined" || rawId === "null") {
      const fallbackSeller = await Seller.findOne({ isActive: true, isVerified: true })
        .select(
          "_id name shopName slug category description address locality city state pincode storeBanners isVerified isActive applicationStatus createdAt"
        )
        .lean();
      if (fallbackSeller) {
        return handleResponse(res, 200, "Seller store details retrieved", fallbackSeller);
      }
      return handleResponse(res, 404, "Seller not found");
    }

    let seller = null;
    if (mongoose.Types.ObjectId.isValid(rawId)) {
      seller = await Seller.findById(rawId)
        .select(
          "_id name shopName slug category description address locality city state pincode storeBanners isVerified isActive applicationStatus createdAt"
        )
        .lean();
    }

    if (!seller) {
      const normalized = rawId.toLowerCase();
      const escaped = normalized.replace(/[-_]/g, "[ -_]?");
      seller = await Seller.findOne({
        $or: [
          { slug: normalized },
          { shopName: new RegExp(`^${escaped}$`, "i") },
          { shopName: new RegExp(normalized.replace(/[-_]/g, " "), "i") },
          { name: new RegExp(`^${escaped}$`, "i") },
        ],
      })
        .select(
          "_id name shopName slug category description address locality city state pincode storeBanners isVerified isActive applicationStatus createdAt"
        )
        .lean();
    }

    if (!seller) {
      return handleResponse(res, 404, "Seller not found");
    }

    return handleResponse(
      res,
      200,
      "Seller store details retrieved successfully",
      seller
    );
  } catch (error) {
    return handleResponse(res, getErrorStatus(error), error.message);
  }
};
