import handleResponse from "../../utils/helper.js";
import getPagination from "../../utils/pagination.js";
import Seller from "../../models/seller.js";
import {
  getActiveSellersData,
  getSellerLocationsData,
  getSellerOptions,
} from "../../services/admin/sellerDirectoryService.js";
import { getErrorStatus } from "../../utils/httpError.js";

export const getSellerLocations = async (req, res) => {
  try {
    const {
      q = "",
      category = "all",
      city = "all",
      lifecycle = "all",
      mapLimit: rawMapLimit = "500",
      sort = "orders_desc",
    } = req.query;

    const { page, limit, skip } = getPagination(req, {
      defaultLimit: 25,
      maxLimit: 100,
    });

    const data = await getSellerLocationsData({
      q,
      category,
      city,
      lifecycle,
      mapLimit: rawMapLimit,
      sort,
      page,
      limit,
      skip,
    });

    return handleResponse(res, 200, "Seller locations fetched successfully", data);
  } catch (error) {
    return handleResponse(res, getErrorStatus(error), error.message);
  }
};

export const getActiveSellers = async (req, res) => {
  try {
    const { q = "", category = "all", sort = "recent" } = req.query;
    const { page, limit, skip } = getPagination(req, {
      defaultLimit: 20,
      maxLimit: 100,
    });

    const data = await getActiveSellersData({
      q,
      category,
      sort,
      page,
      limit,
      skip,
    });

    return handleResponse(res, 200, "Active sellers fetched successfully", data);
  } catch (error) {
    return handleResponse(res, getErrorStatus(error), error.message);
  }
};

export const getSellers = async (req, res) => {
  try {
    const sellers = await getSellerOptions();
    return res.status(200).json({ success: true, error: false, message: "Sellers fetched", result: sellers, results: sellers });
  } catch (error) {
    return handleResponse(res, getErrorStatus(error), error.message);
  }
};


export const getSellerStoreBanners = async (req, res) => {
  try {
    const { sellerId } = req.params;
    const seller = await Seller.findById(sellerId)
      .select("_id shopName name email phone storeBanners")
      .lean();
    if (!seller) {
      return handleResponse(res, 404, "Seller not found");
    }
    return handleResponse(res, 200, "Seller banners retrieved", {
      sellerId: seller._id,
      shopName: seller.shopName,
      name: seller.name,
      storeBanners: seller.storeBanners || [],
    });
  } catch (error) {
    return handleResponse(res, getErrorStatus(error), error.message);
  }
};

export const updateSellerStoreBanners = async (req, res) => {
  try {
    const { sellerId } = req.params;
    const { storeBanners } = req.body;

    if (!Array.isArray(storeBanners)) {
      return handleResponse(res, 400, "storeBanners must be an array");
    }

    if (storeBanners.length > 3) {
      return handleResponse(res, 400, "Maximum of 3 banners are allowed");
    }

    const sanitizedBanners = storeBanners
      .map((b) => ({
        imageUrl: String(b?.imageUrl || "").trim(),
        title: String(b?.title || "").trim(),
        linkUrl: String(b?.linkUrl || "").trim(),
      }))
      .filter((b) => b.imageUrl);

    const updatedSeller = await Seller.findByIdAndUpdate(
      sellerId,
      { $set: { storeBanners: sanitizedBanners } },
      { new: true, runValidators: true }
    )
      .select("_id shopName name email phone storeBanners")
      .lean();

    if (!updatedSeller) {
      return handleResponse(res, 404, "Seller not found");
    }

    return handleResponse(res, 200, "Store banners updated successfully", {
      sellerId: updatedSeller._id,
      shopName: updatedSeller.shopName,
      storeBanners: updatedSeller.storeBanners,
    });
  } catch (error) {
    return handleResponse(res, getErrorStatus(error), error.message);
  }
};
