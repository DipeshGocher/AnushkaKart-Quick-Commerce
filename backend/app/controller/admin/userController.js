import handleResponse from "../../utils/helper.js";
import getPagination from "../../utils/pagination.js";
import Customer from "../../models/customer.js";
import Notification from "../../models/notification.js";
import { emitToCustomer } from "../../services/orderSocketEmitter.js";
import {
  getUserByIdData,
  getUsersData,
} from "../../services/admin/userAdminService.js";
import { getErrorStatus } from "../../utils/httpError.js";

export const getUsers = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req, {
      defaultLimit: 25,
      maxLimit: 200,
    });

    const data = await getUsersData({ page, limit, skip });
    return handleResponse(res, 200, "Users fetched successfully", data);
  } catch (error) {
    return handleResponse(res, getErrorStatus(error), error.message);
  }
};

export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await getUserByIdData(id);

    if (!user) {
      return handleResponse(res, 404, "Customer not found");
    }

    return handleResponse(
      res,
      200,
      "Customer details fetched successfully",
      user,
    );
  } catch (error) {
    return handleResponse(res, getErrorStatus(error), error.message);
  }
};

export const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, isActive } = req.body;
    const activeState = typeof isActive === "boolean" ? isActive : status === "active";
    const user = await Customer.findByIdAndUpdate(
      id,
      { isActive: activeState },
      { new: true }
    );
    if (!user) {
      return handleResponse(res, 404, "Customer not found");
    }
    return handleResponse(res, 200, `Customer account ${activeState ? "unblocked" : "blocked"} successfully`, {
      id: user._id,
      isActive: user.isActive,
      status: user.isActive ? "active" : "inactive",
    });
  } catch (error) {
    return handleResponse(res, getErrorStatus(error), error.message);
  }
};

export const sendUserNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, message } = req.body;

    if (!title || !message) {
      return handleResponse(res, 400, "Title and message are required");
    }

    const customer = await Customer.findById(id);
    if (!customer) {
      return handleResponse(res, 404, "Customer not found");
    }

    const notification = await Notification.create({
      userId: customer._id,
      recipient: customer._id,
      role: "customer",
      recipientModel: "User",
      title: title.trim(),
      message: message.trim(),
      body: message.trim(),
      type: "system",
      channel: "in_app",
      status: "sent",
      sentAt: new Date(),
      isRead: false,
    });

    try {
      emitToCustomer(customer._id.toString(), {
        event: "notification",
        payload: {
          id: notification._id,
          title: notification.title,
          message: notification.message,
          createdAt: notification.createdAt,
        },
      });
    } catch (socketErr) {
      // socket delivery is best effort
    }

    return handleResponse(res, 200, "Notification sent successfully to customer", notification);
  } catch (error) {
    return handleResponse(res, getErrorStatus(error), error.message);
  }
};
