import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        slug: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true,
        },
        sku: {
            type: String,
            unique: true,
            trim: true,
        },
        description: {
            type: String,
            trim: true,
        },
        price: {
            type: Number,
            required: true,
            min: 0,
        },
        salePrice: {
            type: Number,
            default: 0,
            min: 0,
        },
        stock: {
            type: Number,
            required: true,
            default: 0,
        },
        lowStockAlert: {
            type: Number,
            default: 5,
        },
        brand: {
            type: String,
            trim: true,
        },
        weight: {
            type: String,
            trim: true,
        },
        shelfLife: {
            type: String,
            trim: true,
        },
        countryOfOrigin: {
            type: String,
            trim: true,
        },
        fssaiLicense: {
            type: String,
            trim: true,
        },
        tags: [{
            type: String,
            trim: true,
        }],
        highlights: [{
            icon: { type: String, trim: true },
            label: { type: String, trim: true },
        }],
        specifications: [{
            key: { type: String, trim: true },
            value: { type: String, trim: true },
        }],
        dynamicAttributes: [{
            attributeId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Attribute",
            },
            name: { type: String, trim: true },
            value: { type: String, trim: true },
        }],
        shelfLife: {
            type: String,
            trim: true,
            default: "",
        },
        countryOfOrigin: {
            type: String,
            trim: true,
            default: "",
        },
        fssaiLicense: {
            type: String,
            trim: true,
            default: "",
        },
        mainImage: {
            type: String, // Cloudinary URL
        },
        galleryImages: [{
            type: String, // Array of Cloudinary URLs
        }],
        headerId: {
            type: mongoose.Schema?.Types?.ObjectId || String,
            ref: "Category",
            required: true,
        },
        categoryId: {
            type: mongoose.Schema?.Types?.ObjectId || String,
            ref: "Category",
            required: true,
        },
        subcategoryId: {
            type: mongoose.Schema?.Types?.ObjectId || String,
            ref: "Category",
            required: false,
            default: null,
        },
        sellerId: {
            type: mongoose.Schema?.Types?.ObjectId || String,
            ref: "Seller",
            required: function () { return !this.isMonthlyKit && !this.warehouseId; }
        },
        warehouseId: {
            type: mongoose.Schema?.Types?.ObjectId || String,
            ref: "Warehouse",
            required: function () { return this.isMonthlyKit; }
        },
        isMonthlyKit: {
            type: Boolean,
            default: false,
        },
        deliveryMode: {
            type: String,
            enum: ["quick_only", "both", "inherit"],
            default: "inherit",
        },
        status: {
            type: String,
            enum: ["active", "inactive"],
            default: "active",
        },
        approvalStatus: {
            type: String,
            enum: ["pending", "approved", "rejected"],
            default: "approved",
        },
        approvalRequestedAt: {
            type: Date,
            default: null,
        },
        approvalReviewedAt: {
            type: Date,
            default: null,
        },
        approvalReviewedBy: {
            type: mongoose.Schema?.Types?.ObjectId || String,
            ref: "Admin",
            default: null,
        },
        approvalNote: {
            type: String,
            trim: true,
            default: "",
        },
        lastSubmittedByRole: {
            type: String,
            enum: ["seller", "admin"],
            default: null,
        },
        includedItems: [{
            name: { type: String, trim: true },
            quantity: { type: String, trim: true }
        }],
        variants: [
            {
                name: String,
                price: Number,
                salePrice: Number,
                stock: Number,
                sku: String,
                images: [{ type: String }], // Array of Cloudinary URLs for variant specific images
            }
        ],
        isFeatured: {
            type: Boolean,
            default: false,
        },
        isTopDeal: {
            type: Boolean,
            default: false,
        },
        conditionType: {
            type: String,
            enum: ["new", "refurbished"],
            default: "new",
        },
        refurbishedDetails: {
            grade: {
                type: String,
                enum: [
                    "Grade A (Superb)",
                    "Grade B (Good)",
                    "Grade C (Fair)",
                    "Like New (Superb)",
                    "Excellent (Grade A)",
                    "Good (Grade B)",
                    "Fair (Grade C)",
                    ""
                ],
                default: undefined,
            },
            batteryHealth: {
                type: Number,
                default: undefined,
            },
            warrantyMonths: {
                type: Number,
                default: undefined,
            },
            imeiNumber: {
                type: String,
                trim: true,
                default: undefined,
            },
        trustBadges: [
            {
                icon: { type: String, trim: true },
                title: { type: String, trim: true },
                subtitle: { type: String, trim: true },
            }
        ],
            qcPassed: {
                type: Boolean,
                default: undefined,
            },
            boxItems: [{
                type: String,
                trim: true,
            }],
            refurbishedImages: [{
                type: String,
            }],
        }
    },
    { timestamps: true }
);

// Optimize performance for common queries on home/search pages
productSchema.index({ status: 1, isFeatured: 1, createdAt: -1 });
productSchema.index({ status: 1, createdAt: -1, _id: -1 });
productSchema.index({ approvalStatus: 1, status: 1, createdAt: -1 });
productSchema.index({ status: 1, approvalStatus: 1, categoryId: 1 });
productSchema.index({ status: 1, conditionType: 1, createdAt: -1 });
productSchema.index({ headerId: 1, status: 1 });
productSchema.index({ categoryId: 1, status: 1 });
productSchema.index({ subcategoryId: 1, status: 1 });
productSchema.index({ sellerId: 1, status: 1 });
productSchema.index({ sellerId: 1, approvalStatus: 1, createdAt: -1 });
productSchema.index({ sellerId: 1, createdAt: -1, _id: -1 });
productSchema.index({ headerId: 1, status: 1, isTopDeal: 1 });
productSchema.index({ headerId: 1, status: 1, isBestseller: 1 });
productSchema.index({ headerId: 1, status: 1, createdAt: -1 });
productSchema.index({ categoryId: 1, subcategoryId: 1, status: 1 });
productSchema.index({ status: 1, isTopDeal: 1 });
productSchema.index({ status: 1, isBestseller: 1 });
productSchema.index({ name: "text", tags: "text" }); // For better search if regex is too slow

export default mongoose.model("Product", productSchema);
