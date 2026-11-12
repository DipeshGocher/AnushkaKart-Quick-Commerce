import mongoose from "mongoose";

/**
 * A finance (EMI) quotation a customer sent to the shop. Everything needed to review it
 * later is frozen here: product snapshot, the numbers, and the settings they were based on,
 * so changing the admin settings never rewrites an old quotation.
 * PAN / Aadhaar are encrypted; only masked forms are readable without an explicit admin "reveal".
 */
const financeQuoteSchema = new mongoose.Schema(
  {
    quoteId: { type: String, required: true, unique: true, index: true },
    customerUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    customer: {
      name: { type: String, required: true, trim: true },
      phone: { type: String, required: true, trim: true, index: true },
      panEnc: { type: String, default: "", select: false },
      aadhaarEnc: { type: String, default: "", select: false },
      panMasked: { type: String, default: "" },
      aadhaarMasked: { type: String, default: "" },
    },
    product: {
      productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, index: true },
      name: { type: String, required: true },
      variantName: { type: String, default: "" },
      variantSku: { type: String, default: "" },
      image: { type: String, default: "" },
    },
    imei1: { type: String, default: "" },
    imei2: { type: String, default: "" },
    result: { type: mongoose.Schema.Types.Mixed, required: true },
    settingsSnapshot: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: {
      type: String,
      enum: ["new", "contacted", "approved", "rejected", "cancelled"],
      default: "new",
      index: true,
    },
    adminNote: { type: String, default: "", trim: true },
    whatsappNumber: { type: String, default: "" },
  },
  { timestamps: true },
);

financeQuoteSchema.index({ createdAt: -1 });

export default mongoose.model("FinanceQuote", financeQuoteSchema);
