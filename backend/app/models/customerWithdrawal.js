import mongoose from "mongoose";

/**
 * A customer's request to move money out of their wallet (refunds) to their own bank account or UPI.
 *
 *   pending  -> the amount has already been taken out of the wallet and is waiting for the admin
 *   paid     -> the admin sent the money and noted the transfer reference
 *   rejected -> the admin refused; the amount went back into the wallet
 *
 * The bank account number is stored encrypted (utils/piiCrypto.js); only the last 4 digits are readable.
 */
const customerWithdrawalSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    amount: { type: Number, required: true, min: 1 },
    status: { type: String, enum: ["pending", "paid", "rejected"], default: "pending", index: true },
    method: { type: String, enum: ["bank", "upi"], required: true },
    account: {
      holderName: { type: String, trim: true },
      bankName: { type: String, trim: true },
      accountNumberEnc: { type: String },
      accountLast4: { type: String },
      ifsc: { type: String, trim: true },
      upiId: { type: String, trim: true },
    },
    // What the admin typed when paying (bank transfer reference / UTR) or why they refused.
    reference: { type: String, trim: true, default: "" },
    rejectionReason: { type: String, trim: true, default: "" },
    processedAt: { type: Date, default: null },
    processedBy: { type: mongoose.Schema.Types.ObjectId, default: null },
    // How much of the payment the admin wallet could cover (the rest is only noted in the ledger).
    adminWalletDebited: { type: Number, default: 0 },
  },
  { timestamps: true },
);

customerWithdrawalSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model("CustomerWithdrawal", customerWithdrawalSchema);
