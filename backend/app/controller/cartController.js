import Cart from "../models/cart.js";
import Product from "../models/product.js";
import handleResponse from "../utils/helper.js";
import { getApprovedOrLegacyFilter } from "../services/productModerationService.js";
import {
  parseCustomerCoordinates,
  getNearbySellerIdsForCustomer,
} from "../services/customerVisibilityService.js";
import {
  evaluateDeliveryEligibility,
  resolveProductDeliveryMode,
} from "../services/shipping/localPincodeService.js";

const CART_POPULATE_FIELDS =
  "name slug price salePrice mainImage stock status headerId categoryId subcategoryId sellerId warehouseId variants conditionType catalogType refurbishedDetails isFeatured brand weight unit isMonthlyKit";

const CUSTOMER_VISIBLE_PRODUCT_MATCH = {
  status: "active",
  ...getApprovedOrLegacyFilter(),
};

function sanitizeCartItems(cart) {
  if (!cart || !Array.isArray(cart.items)) return cart;
  cart.items = cart.items.filter((item) => Boolean(item?.productId));
  return cart;
}

async function getCustomerVisibleProductById(productId) {
  if (!productId) return null;
  return Product.findOne({
    _id: productId,
    ...CUSTOMER_VISIBLE_PRODUCT_MATCH,
  })
    .select("_id sellerId warehouseId conditionType catalogType stock variants")
    .lean();
}

function getAvailableStock(product, variantSku) {
  if (!product) return 0;
  const normalizedSku = String(variantSku || "").trim();
  if (normalizedSku && Array.isArray(product.variants) && product.variants.length > 0) {
    const variant = product.variants.find(
      (v) =>
        String(v.sku || "").trim().toLowerCase() === normalizedSku.toLowerCase() ||
        String(v.name || "").trim().toLowerCase() === normalizedSku.toLowerCase()
    );
    if (variant && typeof variant.stock === "number") {
      return Math.max(0, variant.stock);
    }
  }
  return Math.max(0, Number(product.stock || 0));
}

async function assertProductInCustomerRadius(product, lat, lng) {
  // Hybrid Commerce: Products are deliverable either via Local Pincode Quick Commerce or Shiprocket Pan-India.
  // GPS radius check is removed so customers can add any available product to cart without radius errors.
  return;
}

async function fetchPopulatedCart(cartId) {
  const cart = await Cart.findById(cartId)
    .populate({
      path: "items.productId",
      select: CART_POPULATE_FIELDS,
      match: CUSTOMER_VISIBLE_PRODUCT_MATCH,
    })
    .lean();

  return sanitizeCartItems(cart);
}

/* ===============================
   GET CUSTOMER CART
================================ */
export const getCart = async (req, res) => {
  try {
    const customerId = req.user.id;
    let cart = await Cart.findOne({ customerId })
      .populate({
        path: "items.productId",
        select: CART_POPULATE_FIELDS,
        match: CUSTOMER_VISIBLE_PRODUCT_MATCH,
      })
      .lean();

    if (!cart) {
      const newCart = await Cart.create({ customerId, items: [] });
      return handleResponse(res, 200, "Cart fetched successfully", newCart);
    }

    return handleResponse(res, 200, "Cart fetched successfully", sanitizeCartItems(cart));
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   ADD TO CART
================================ */
export const addToCart = async (req, res) => {
  try {
    const customerId = req.user.id;
    const { productId, quantity = 1, variantSku = "", kitAddons = [], lat, lng } = req.body;
    const normalizedVariantSku = String(variantSku || "").trim();
    const customerVisibleProduct = await getCustomerVisibleProductById(productId);
    if (!customerVisibleProduct) {
      return handleResponse(res, 404, "Product is not available for purchase");
    }

    try {
      await assertProductInCustomerRadius(
        customerVisibleProduct,
        lat ?? req.query?.lat,
        lng ?? req.query?.lng,
      );
    } catch (radiusErr) {
      return handleResponse(
        res,
        radiusErr.statusCode || 400,
        radiusErr.message,
      );
    }

    const customerPincode = String(req.body.customerPincode || req.body.pincode || "").trim();
    if (customerPincode) {
      try {
        const fullProduct = await Product.findById(productId)
          .select("deliveryMode headerId categoryId sellerId warehouseId")
          .populate("sellerId", "pincode")
          .populate("warehouseId", "pincode")
          .populate("headerId", "deliveryMode catalogType")
          .lean();
        if (fullProduct) {
          const sellerPincode =
            fullProduct.sellerId?.pincode || fullProduct.warehouseId?.pincode || "";
          const deliveryMode = await resolveProductDeliveryMode(
            fullProduct,
            fullProduct.headerId,
          );
          const eligibility = await evaluateDeliveryEligibility({
            customerPincode,
            sellerPincode,
            deliveryMode,
          });
          if (!eligibility.isDeliverable) {
            return handleResponse(
              res,
              400,
              eligibility.reason || "This product cannot be delivered to your location.",
            );
          }
        }
      } catch (checkErr) {
        // Continue if verification throws
      }
    }

    let cart = await Cart.findOne({ customerId });

    if (!cart) {
      cart = new Cart({ customerId, items: [] });
    }

    const itemIndex = cart.items.findIndex(
      (item) =>
        item.productId &&
        item.productId.toString() === productId &&
        String(item.variantSku || "").trim() === normalizedVariantSku,
    );

    const availableStock = getAvailableStock(customerVisibleProduct, normalizedVariantSku);
    const requestedAddition = Number(quantity);

    if (requestedAddition > 0 && availableStock <= 0) {
      return handleResponse(res, 400, "This product is currently sold out.");
    }

    if (itemIndex > -1) {
      // quantity 0 + kitAddons = patch addons only (used by basket sheet live updates)
      if (requestedAddition === 0 && kitAddons !== undefined) {
        cart.items[itemIndex].kitAddons = kitAddons;
      } else {
        const targetQty = (cart.items[itemIndex].quantity || 0) + requestedAddition;
        if (targetQty > availableStock) {
          return handleResponse(
            res,
            400,
            `Cannot add more items. Only ${availableStock} unit(s) available in stock.`,
          );
        }
        cart.items[itemIndex].quantity = targetQty;
        if (kitAddons !== undefined) {
          cart.items[itemIndex].kitAddons = kitAddons;
        }
      }
    } else {
      if (requestedAddition < 1) {
        return handleResponse(res, 400, "Quantity must be at least 1 for new cart items");
      }
      if (requestedAddition > availableStock) {
        return handleResponse(
          res,
          400,
          `Cannot add ${requestedAddition} items. Only ${availableStock} unit(s) available in stock.`,
        );
      }
      cart.items.push({ productId, variantSku: normalizedVariantSku, quantity: requestedAddition, kitAddons: kitAddons || [] });
    }

    await cart.save();
    const updatedCart = await fetchPopulatedCart(cart._id);

    return handleResponse(res, 200, "Item added to cart", updatedCart);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   UPDATE QUANTITY
================================ */
export const updateQuantity = async (req, res) => {
  try {
    const customerId = req.user.id;
    const { productId, quantity, variantSku = "" } = req.body;
    const normalizedVariantSku = String(variantSku || "").trim();

    let cart = await Cart.findOne({ customerId });

    if (!cart) {
      return handleResponse(res, 404, "Cart not found");
    }

    const itemIndex = cart.items.findIndex(
      (item) =>
        item.productId &&
        item.productId.toString() === productId &&
        String(item.variantSku || "").trim() === normalizedVariantSku,
    );

    if (itemIndex > -1) {
      const requestedQty = Number(quantity);
      if (requestedQty > 0) {
        const product = await Product.findById(productId).select("stock variants").lean();
        const availableStock = getAvailableStock(product, normalizedVariantSku);
        if (availableStock <= 0) {
          return handleResponse(res, 400, "This product is currently sold out.");
        }
        if (requestedQty > availableStock) {
          return handleResponse(
            res,
            400,
            `Cannot update quantity. Only ${availableStock} unit(s) available in stock.`,
          );
        }
      }
      cart.items[itemIndex].quantity = quantity;
      if (cart.items[itemIndex].quantity <= 0) {
        cart.items.splice(itemIndex, 1);
      }
    } else {
      return handleResponse(res, 404, "Product not in cart");
    }

    cart.markModified("items");
    await cart.save();
    const updatedCart = await fetchPopulatedCart(cart._id);

    return handleResponse(res, 200, "Cart updated successfully", updatedCart);
  } catch (error) {
    console.error("CRITICAL BACKEND ERROR IN updateQuantity:", error);
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   REMOVE FROM CART
================================ */
export const removeFromCart = async (req, res) => {
  try {
    const customerId = req.user.id;
    const { productId } = req.params;
    const normalizedVariantSku = String(req.query?.variantSku || "").trim();

    let cart = await Cart.findOne({ customerId });

    if (!cart) {
      return handleResponse(res, 404, "Cart not found");
    }

    cart.items = cart.items.filter((item) => {
      if (!item.productId) return false;
      if (item.productId.toString() !== productId) return true;
      // If variantSku is provided, remove only that variant line.
      if (normalizedVariantSku) {
        return String(item.variantSku || "").trim() !== normalizedVariantSku;
      }
      // If no variantSku is provided, keep legacy behavior: remove all lines for that product.
      return false;
    });

    cart.markModified("items");
    await cart.save();
    const updatedCart = await fetchPopulatedCart(cart._id);

    return handleResponse(res, 200, "Item removed from cart", updatedCart);
  } catch (error) {
    console.error("CRITICAL BACKEND ERROR IN removeFromCart:", error);
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   CLEAR CART
================================ */
export const clearCart = async (req, res) => {
  try {
    const customerId = req.user.id;
    let cart = await Cart.findOne({ customerId });

    if (cart) {
      cart.items = [];
      await cart.save();
    }

    return handleResponse(res, 200, "Cart cleared successfully");
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};
