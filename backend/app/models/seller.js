import mongoose from "mongoose";
import bcrypt from "bcrypt";

const sellerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    phone: {
      type: String,
      required: true,
      unique: true,
    },

    password: {
      type: String,
      required: true,
      select: false,
    },

    slug: {
      type: String,
      trim: true,
      lowercase: true,
      index: true,
    },
    shopName: {
      type: String,
      required: true,
      trim: true,
    },

    category: {
      type: String,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
    },

    address: {
      type: String,
      trim: true,
    },
    locality: {
      type: String,
      trim: true,
    },
    pincode: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      trim: true,
    },
    state: {
      type: String,
      trim: true,
    },
    shiprocketPickupLocation: {
      type: String,
      trim: true,
    },
    shiprocketPickupStatus: {
      type: String,
      enum: ["unregistered", "pending", "verified", "failed", "mock"],
      default: "unregistered",
    },

    documents: {
      tradeLicense: { type: String, trim: true },
      gstCertificate: { type: String, trim: true },
      idProof: { type: String, trim: true },
      businessRegistration: { type: String, trim: true },
      fssaiLicense: { type: String, trim: true },
      other: { type: String, trim: true },
    },

    bankDetails: {
      bankName: { type: String, trim: true },
      accountNumber: { type: String, trim: true },
      ifsc: { type: String, trim: true },
      accountHolder: { type: String, trim: true },
      upiId: { type: String, trim: true },
    },
    accountHolder: { type: String, trim: true },
    accountNumber: { type: String, trim: true },
    ifsc: { type: String, trim: true },
    bankName: { type: String, trim: true },

    role: {
      type: String,
      default: "seller",
    },

    isVerified: {
      type: Boolean,
      default: false,
    },

    emailVerified: {
      type: Boolean,
      default: false,
    },

    phoneVerified: {
      type: Boolean,
      default: false,
    },

    applicationStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    reviewedAt: {
      type: Date,
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },

    rejectionReason: {
      type: String,
      trim: true,
    },

    isActive: {
      type: Boolean,
      default: false,
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number],
        default: [0, 0],
      },
    },
    serviceRadius: {
      type: Number,
      default: 5, // Default 5km
    },
    storeBanners: [
      {
        imageUrl: { type: String, trim: true, default: "" },
        title: { type: String, trim: true, default: "" },
        linkUrl: { type: String, trim: true, default: "" },
      },
    ],
    lastLogin: Date,
  },
  { timestamps: true },
);

sellerSchema.index({ location: "2dsphere" });
sellerSchema.index({ isActive: 1, isVerified: 1 });

// Hash password before saving
sellerSchema.pre("save", async function (next) {
  if (!this.slug || this.isModified("shopName")) {
    const raw = String(this.shopName || this.name || "store")
      .toLowerCase()
      .trim()
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    this.slug = raw || `store-${this._id ? this._id.toString().slice(-6) : Date.now()}`;
  }
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password
sellerSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.model("Seller", sellerSchema);
