import Delivery from "../../models/delivery.js";
import Order from "../../models/order.js";
import handleResponse from "../../utils/helper.js";
import getPagination from "../../utils/pagination.js";
import { clearRiderPresence } from "../../services/firebaseService.js";

export const getDeliveryPartners = async (req, res) => {
  try {
    const { status, verified } = req.query;
    const query = {};

    if (status === "online") {
      query.isOnline = true;
    } else if (status === "offline") {
      query.isOnline = false;
    } else if (status === "deactivated") {
      query.isActive = false;
    }

    if (verified === "true") {
      query.isVerified = true;
    } else if (verified === "false") {
      query.isVerified = false;
    }

    const { page, limit, skip } = getPagination(req, {
      defaultLimit: 25,
      maxLimit: 200,
    });

    const [deliveryPartners, total] = await Promise.all([
      Delivery.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Delivery.countDocuments(query),
    ]);

    const partnerIds = deliveryPartners.map((p) => p._id);

    // Calculate real total delivered orders per rider
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [totalDeliveriesAgg, todayDeliveriesAgg, activeOrdersAgg] = await Promise.all([
      Order.aggregate([
        { $match: { deliveryBoy: { $in: partnerIds }, status: "delivered" } },
        { $group: { _id: "$deliveryBoy", count: { $sum: 1 } } },
      ]),
      Order.aggregate([
        {
          $match: {
            deliveryBoy: { $in: partnerIds },
            status: "delivered",
            updatedAt: { $gte: startOfToday },
          },
        },
        { $group: { _id: "$deliveryBoy", count: { $sum: 1 } } },
      ]),
      Order.aggregate([
        {
          $match: {
            deliveryBoy: { $in: partnerIds },
            status: { $in: ["confirmed", "packed", "shipped", "out_for_delivery"] },
          },
        },
        { $group: { _id: "$deliveryBoy", count: { $sum: 1 } } },
      ]),
    ]);

    const totalDeliveriesMap = new Map(totalDeliveriesAgg.map((a) => [String(a._id), a.count]));
    const todayDeliveriesMap = new Map(todayDeliveriesAgg.map((a) => [String(a._id), a.count]));
    const activeOrdersMap = new Map(activeOrdersAgg.map((a) => [String(a._id), a.count]));

    const enrichedItems = deliveryPartners.map((p) => ({
      ...p,
      isActive: p.isActive !== false,
      totalDeliveries: totalDeliveriesMap.get(String(p._id)) || 0,
      todayDeliveries: todayDeliveriesMap.get(String(p._id)) || 0,
      activeOrdersCount: activeOrdersMap.get(String(p._id)) || 0,
    }));

    return handleResponse(res, 200, "Delivery partners fetched successfully", {
      items: enrichedItems,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const updateDeliveryPartnerStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const rider = await Delivery.findById(id);
    if (!rider) {
      return handleResponse(res, 404, "Rider not found");
    }

    rider.isActive = Boolean(isActive);
    if (!rider.isActive) {
      rider.isOnline = false;
      try {
        await clearRiderPresence(id);
      } catch (err) {}
    }

    await rider.save();

    return handleResponse(
      res,
      200,
      `Delivery partner ${rider.isActive ? "activated" : "deactivated"} successfully`,
      rider
    );
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const deleteDeliveryPartner = async (req, res) => {
  try {
    const { id } = req.params;
    const rider = await Delivery.findByIdAndDelete(id);

    if (!rider) {
      return handleResponse(res, 404, "Rider not found");
    }

    try {
      await clearRiderPresence(id);
    } catch (err) {}

    return handleResponse(
      res,
      200,
      "Delivery partner completely removed from database"
    );
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const approveDeliveryPartner = async (req, res) => {
  try {
    const { id } = req.params;
    const rider = await Delivery.findByIdAndUpdate(
      id,
      { isVerified: true, isActive: true },
      { new: true },
    );

    if (!rider) {
      return handleResponse(res, 404, "Rider not found");
    }

    return handleResponse(res, 200, "Rider approved successfully", rider);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const rejectDeliveryPartner = async (req, res) => {
  try {
    const { id } = req.params;
    const rider = await Delivery.findByIdAndDelete(id);

    if (!rider) {
      return handleResponse(res, 404, "Rider not found");
    }

    try {
      await clearRiderPresence(id);
    } catch (err) {}

    return handleResponse(
      res,
      200,
      "Rider application rejected and removed",
    );
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};
