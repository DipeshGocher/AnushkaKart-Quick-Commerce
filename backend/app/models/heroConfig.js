import mongoose from "mongoose";

const heroBannerItemSchema = new mongoose.Schema(
  {
    imageUrl: { type: String, required: true },
    title: { type: String, trim: true },
    subtitle: { type: String, trim: true },
    linkType: {
      type: String,
      enum: ["none", "header", "category", "subcategory", "product", "url"],
      default: "none",
    },
    linkValue: { type: String, trim: true },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  { _id: false }
);

const heroConfigSchema = new mongoose.Schema(
  {
    pageType: {
      type: String,
      enum: ["home", "header", "monthly_basket"],
      required: true,
    },
    headerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },
    banners: {
      items: [heroBannerItemSchema],
      default: [],
    },
    categoryIds: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
    ],
    // Top Deals section customization (for category pages)
    topDealsTitle: {
      type: String,
      trim: true,
      default: "",
    },
    topDealsProductIds: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    ],
    topDealsBgColor: {
      type: String,
      trim: true,
      default: "",
    },
    topDealsTextColor: {
      type: String,
      trim: true,
      default: "",
    },
    topDealsProductNameColor: {
      type: String,
      trim: true,
      default: "",
    },
    topDealsPriceColor: {
      type: String,
      trim: true,
      default: "",
    },
    // Best Selling Categories section customization (for home page)
    bestSellingTitle: {
      type: String,
      trim: true,
      default: "",
    },
    bestSellingCategoryIds: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
    ],
    // Category sections banners on Home ("All") page
    categorySectionBanners: [
      {
        headerId: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
        headerName: { type: String, trim: true, default: "" },
        banners: [heroBannerItemSchema],
      },
    ],
  },
  { timestamps: true }
);

heroConfigSchema.index({ pageType: 1, headerId: 1 }, { unique: true });

export default mongoose.model("HeroConfig", heroConfigSchema);
