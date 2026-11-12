import mongoose from "mongoose";

/**
 * Admin-controlled EMI / finance settings. One document (key "default").
 * Defaults mirror the shop's original EMI sheet; see utils/financeCalculator.js.
 */
const financeConfigSchema = new mongoose.Schema(
  {
    key: { type: String, default: "default", unique: true },
    enabled: { type: Boolean, default: true },
    interestType: { type: String, enum: ["flat", "reducing"], default: "flat" },
    interestRatePerMonth: { type: Number, default: 5, min: 0 },
    // upTo = finance amount below which this file charge applies; null = "everything above".
    fileChargeSlabs: [
      {
        _id: false,
        upTo: { type: Number, default: null },
        fileCharge: { type: Number, default: 0, min: 0 },
      },
    ],
    tenures: [{ type: Number }],
    dueDateRules: [
      {
        _id: false,
        fromDay: Number,
        toDay: Number,
        dueDay: Number,
      },
    ],
    lateFee: { type: Number, default: 590, min: 0 },
    minDownPaymentPercent: { type: Number, default: 0, min: 0, max: 90 },
    // Customers' quotations are sent to this WhatsApp number (digits, with or without 91).
    whatsappNumber: { type: String, default: "", trim: true },
    shop: {
      name: { type: String, default: "Anushka Mobile Gallery", trim: true },
      address: { type: String, default: "", trim: true },
      phone: { type: String, default: "", trim: true },
    },
    terms: [{ type: String, trim: true }],
  },
  { timestamps: true },
);

export default mongoose.model("FinanceConfig", financeConfigSchema);
