/**
 * Socket.IO — order rooms, role rooms, JWT auth.
 */
import { verifySocketToken } from "./socketAuth.js";
import mongoose from "mongoose";
import Ticket from "../models/ticket.js";
import { resolveAdminAccessFromToken } from "../services/adminAccessService.js";

let _io = null;

const deliverySockets = new Map();

export const initSocket = (io) => {
  _io = io;

  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.query?.token ||
      null;
    if (!token) {
      socket.user = null;
      return next();
    }
    const user = verifySocketToken(token);
    if (!user) {
      return next(new Error("Unauthorized"));
    }
    socket.user = user;
    next();
  });

  io.on("connection", (socket) => {
    const { id: userId, role } = socket.user || {};
    if (!userId) {
      return;
    }

    if (role === "delivery") {
      const dId = userId.toString();
      deliverySockets.set(dId, socket.id);
      socket.join("delivery:online");
      socket.join(`delivery:${dId}`);
    }
    if (role === "seller") {
      socket.join(`seller:${userId}`);
    }
    if (role === "customer" || role === "user") {
      socket.join(`customer:${userId}`);
    }
    // Admin staff only get the live feeds of the modules their role includes
    // (main admin gets everything). Loaded once per connection.
    let adminAccessPromise = null;
    if (role === "admin") {
      adminAccessPromise = resolveAdminAccessFromToken(socket.user)
        .then((access) => {
          if (!access.ok) {
            socket.disconnect(true);
            return null;
          }
          const has = (...keys) => access.isSuper || keys.some((k) => access.permissions.includes(k));
          if (has("orders", "returns")) socket.join("admin:orders");
          if (has("support_tickets")) socket.join("admin:support");
          if (has("sos_alerts")) socket.join("admin:sos");
          // Per-admin room — used by the notification service to push
          // `notification:new` deltas to the specific admin who owns the
          // Notification row, so the topbar can refresh without polling.
          socket.join(`admin:${userId}`);
          return access;
        })
        .catch(() => {
          socket.disconnect(true);
          return null;
        });
    }

    socket.on("join_order", (orderId) => {
      if (!orderId || typeof orderId !== "string") return;
      socket.join(`order:${orderId}`);
    });

    socket.on("leave_order", (orderId) => {
      if (!orderId) return;
      socket.leave(`order:${orderId}`);
    });

    socket.on("join_ticket", async (ticketId) => {
      const raw = typeof ticketId === "string" ? ticketId.trim() : "";
      if (!raw || !mongoose.Types.ObjectId.isValid(raw)) return;

      if (socket.user?.role === "admin") {
        const access = await adminAccessPromise;
        if (access && (access.isSuper || access.permissions.includes("support_tickets"))) {
          socket.join(`ticket:${raw}`);
        }
        return;
      }

      try {
        const ticket = await Ticket.findById(raw).select("userId").lean();
        if (!ticket?.userId) return;
        if (ticket.userId.toString() !== userId.toString()) return;
        socket.join(`ticket:${raw}`);
      } catch {
        /* ignore */
      }
    });

    socket.on("leave_ticket", (ticketId) => {
      if (!ticketId) return;
      socket.leave(`ticket:${String(ticketId).trim()}`);
    });

    socket.on("register_delivery", (deliveryId) => {
      if (deliveryId && socket.user?.role === "delivery") {
        deliverySockets.set(deliveryId.toString(), socket.id);
      }
    });

    socket.on("disconnect", () => {
      for (const [id, sid] of deliverySockets.entries()) {
        if (sid === socket.id) {
          deliverySockets.delete(id);
          break;
        }
      }
    });
  });
};

export const getIO = () => {
  if (!_io) throw new Error("Socket.IO not initialized");
  return _io;
};

export const notifyDeliveryPartners = (orderData) => {
  if (!_io) return;
  _io.to("delivery:online").emit("new_order_packed", orderData);
};
