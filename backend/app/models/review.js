import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true,
        },
        orderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Order",
        },
        rating: {
            type: Number,
            required: true,
            min: 1,
            max: 5,
        },
        comment: {
            type: String,
            required: true,
            trim: true,
        },
        images: [
            {
                type: String,
            },
        ],
        status: {
            type: String,
            enum: ["pending", "approved", "rejected"],
            default: "pending",
        },
    },
    { timestamps: true }
);

// Prevent multiple reviews from same user for same product
reviewSchema.index({ userId: 1, productId: 1 }, { unique: true });

export default mongoose.model("Review", reviewSchema);
