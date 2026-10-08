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
    // Curated Category Deals showcase (matching reference screenshot layout)
    curatedDeals: {
      enabled: { type: Boolean, default: true },
      title: { type: String, trim: true, default: "" },
      cardTopBgColor: { type: String, trim: true, default: "#FAF8F5" },
      cardBottomBgColor: { type: String, trim: true, default: "" },
      cardTextColor: { type: String, trim: true, default: "#FFFFFF" },
      items: [
        {
          categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
          title: { type: String, trim: true, default: "" },
          offerText: { type: String, trim: true, default: "Min. 50% Off" },
          imageUrl: { type: String, trim: true, default: "" },
          linkValue: { type: String, trim: true, default: "" },
          sortOrder: { type: Number, default: 0 },
        },
      ],
    },
    // Good Afternoon greeting & category tiles customization on Home ("All") page
    greetingSection: {
      enabled: { type: Boolean, default: true },
      title: { type: String, trim: true, default: "Good Afternoon, {name}! ☀️" },
      titleColor: { type: String, trim: true, default: "#242424" },
      bgColor: { type: String, trim: true, default: "linear-gradient(135deg, #ffe078 0%, #ffeb9c 50%, #fff2bc 100%)" },
      cardBgColor: { type: String, trim: true, default: "#ffffff" },
      cardNameBgColor: { type: String, trim: true, default: "#2563eb" },
      cardNameTextColor: { type: String, trim: true, default: "#FFFFFF" },
      categoryIds: [
        { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
      ],
    },
  },
  { timestamps: true }
);

heroConfigSchema.index({ pageType: 1, headerId: 1 }, { unique: true });

export default mongoose.model("HeroConfig", heroConfigSchema);
