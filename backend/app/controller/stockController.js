import Product from "../models/product.js";
import StockHistory from "../models/stockHistory.js";
import handleResponse from "../utils/helper.js";
import { emitNotificationEvent } from "../modules/notifications/notification.emitter.js";
import { NOTIFICATION_EVENTS } from "../modules/notifications/notification.constants.js";
import {
    createLowStockAlertCandidate,
    isLowStockAlertsEnabled,
} from "../services/lowStockAlertService.js";
import { getErrorStatus } from "../utils/httpError.js";

/* ===============================
   ADJUST STOCK MANUALLY
================================ */
export const adjustStock = async (req, res) => {
    try {
        const { productId, type, quantity, note } = req.body;
        const userId = req.user.id;
        const role = String(req.user?.role || "").toLowerCase();

        const baseQuery = role === "warehouse" ? { _id: productId, warehouseId: userId } : { _id: productId, sellerId: userId };
        const product = await Product.findOne(baseQuery);
        if (!product) {
            return handleResponse(res, 404, "Product not found or unauthorized");
        }

        const rawQty = Number(quantity);
        const qtyChange = Math.abs(rawQty);
        if (isNaN(qtyChange) || qtyChange <= 0) {
            return handleResponse(res, 400, "Please enter a valid positive quantity");
        }

        const previousStock = Number(product.stock || 0);
        const isAddition = type === 'Restock' || type === 'Addition';
        const finalStock = isAddition ? previousStock + qtyChange : previousStock - qtyChange;

        if (finalStock < 0) {
            return handleResponse(res, 400, `Cannot remove more stock than currently available (${previousStock} units)`);
        }

        // 1. Update Product Stock
        product.stock = finalStock;
        await product.save();

        // 2. Create History Entry
        const historyEntry = new StockHistory({
            product: productId,
            ...(role === "warehouse" ? { warehouseId: userId } : { seller: userId }),
            type: isAddition ? 'Restock' : 'Correction',
            quantity: isAddition ? qtyChange : -qtyChange,
            note: note || `Manual ${isAddition ? 'Restock' : 'Remove'} adjustment`
        });

        await historyEntry.save();

        if (
            !isAddition &&
            qtyChange > 0 &&
            await isLowStockAlertsEnabled()
        ) {
            const lowStockAlert = createLowStockAlertCandidate({
                product,
                previousStock,
                currentStock: finalStock,
            });
            if (lowStockAlert) {
                emitNotificationEvent(NOTIFICATION_EVENTS.LOW_STOCK_ALERT, lowStockAlert);
            }
        }

        return handleResponse(res, 200, "Stock adjusted successfully", {
            newStock: product.stock,
            historyEntry
        });

    } catch (error) {
        return handleResponse(res, getErrorStatus(error), error.message);
    }
};

/* ===============================
   GET STOCK HISTORY LOG
================================ */
export const getStockHistory = async (req, res) => {
    try {
        const userId = req.user.id;
        const role = req.user.role;

        const query = role === "warehouse" ? { warehouseId: userId } : { seller: userId };

        const history = await StockHistory.find(query)
            .sort({ createdAt: -1 })
            .populate("product", "name sku mainImage");

        return handleResponse(res, 200, "Stock history fetched", history.map(item => ({
            id: item._id,
            productName: item.product?.name || "Deleted Product",
            sku: item.product?.sku || "N/A",
            type: item.type,
            quantity: item.quantity > 0 ? `+${item.quantity}` : `${item.quantity}`,
            date: item.createdAt.toISOString().split('T')[0],
            time: item.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            note: item.note
        })));

    } catch (error) {
        return handleResponse(res, getErrorStatus(error), error.message);
    }
};
