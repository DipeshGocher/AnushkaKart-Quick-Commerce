/**
 * Bulk product upload: the columns of the Excel template (single source of truth for the
 * template builder, the reader and the instructions).
 */

export const MAX_ROWS = 300;
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGES_PER_PRODUCT = 5;

export const SHEET_PRODUCTS = "Products";
export const SHEET_README = "Read Me First";
export const SHEET_CATEGORIES = "Categories";

/**
 * key      internal name
 * title    header text in the Excel file (a trailing * means required)
 * required true = the product cannot be saved without it
 * width    column width in Excel
 * hint     short help shown as a note on the header cell and in the Read Me sheet
 * example  what the Read Me sheet shows
 */
export const COLUMNS = [
  { key: "group", title: "Product Group", required: false, width: 18,
    hint: "Only for products with options (Size / Color). Write the SAME text on every row of that product, e.g. SHIRT-01. Leave empty for a single product.",
    example: "SHIRT-01" },
  { key: "name", title: "Product Name *", required: true, width: 34,
    hint: "Name customers will see. For products with options write it on the first row.", example: "Men's Cotton Shirt" },
  { key: "category", title: "Category *", required: true, width: 34,
    hint: "Pick from the dropdown (it comes from the Categories sheet). Do not type your own.", example: "Fashion > Men > Shirts" },
  { key: "price", title: "Price *", required: true, width: 12,
    hint: "Selling price before discount, numbers only. Example: 999", example: "999" },
  { key: "stock", title: "Stock *", required: true, width: 10,
    hint: "How many pieces you have. Whole number, 0 is allowed.", example: "25" },
  { key: "salePrice", title: "Sale Price", required: false, width: 12,
    hint: "Discounted price. Must be less than Price. Leave empty for no discount.", example: "799" },
  { key: "sku", title: "SKU", required: false, width: 16,
    hint: "Your own product code. Leave empty and we create one.", example: "SH-M-RED" },
  { key: "opt1Name", title: "Option 1 Name", required: false, width: 14,
    hint: "Only for products with options. Example: Size", example: "Size" },
  { key: "opt1Value", title: "Option 1 Value", required: false, width: 14,
    hint: "The value of this row. Example: M", example: "M" },
  { key: "opt2Name", title: "Option 2 Name", required: false, width: 14,
    hint: "Second option, if any. Example: Color", example: "Color" },
  { key: "opt2Value", title: "Option 2 Value", required: false, width: 14,
    hint: "The value of this row. Example: Red", example: "Red" },
  { key: "weight", title: "Weight", required: false, width: 10,
    hint: "Weight of the parcel WITH packing, number only. Example: 500", example: "500" },
  { key: "weightUnit", title: "Weight Unit", required: false, width: 12,
    hint: "g or kg (dropdown). Needed if you write a weight.", example: "g" },
  { key: "length", title: "Length (cm)", required: false, width: 12,
    hint: "Box length in cm. Courier charges by weight and box size.", example: "30" },
  { key: "breadth", title: "Width (cm)", required: false, width: 12, hint: "Box width in cm.", example: "25" },
  { key: "height", title: "Height (cm)", required: false, width: 12, hint: "Box height in cm.", example: "4" },
  { key: "description", title: "Description", required: false, width: 40,
    hint: "A few lines about the product. Plain text only.", example: "Soft cotton shirt, regular fit." },
  { key: "brand", title: "Brand", required: false, width: 16, hint: "Brand name.", example: "Urban Style" },
  { key: "image", title: "Main Photo Link", required: false, width: 34,
    hint: "Web link of the main photo (https://...). Google Drive 'anyone with the link' also works. Leave empty to add the photo later.",
    example: "https://your-site.com/shirt-red.jpg" },
  { key: "images", title: "More Photo Links", required: false, width: 34,
    hint: "Up to 4 more links, separated by a comma.", example: "https://your-site.com/shirt-red-2.jpg" },
  { key: "returnable", title: "Returnable (Yes/No)", required: false, width: 14,
    hint: "Can customers return it? Empty means Yes.", example: "Yes" },
  { key: "spec1Name", title: "Detail 1 Name", required: false, width: 14, hint: "Extra detail shown under More Details. Example: Fabric", example: "Fabric" },
  { key: "spec1Value", title: "Detail 1 Value", required: false, width: 16, hint: "Example: Cotton", example: "Cotton" },
  { key: "spec2Name", title: "Detail 2 Name", required: false, width: 14, hint: "Example: Fit", example: "Fit" },
  { key: "spec2Value", title: "Detail 2 Value", required: false, width: 16, hint: "Example: Regular", example: "Regular" },
  { key: "spec3Name", title: "Detail 3 Name", required: false, width: 14, hint: "Example: Wash Care", example: "Wash Care" },
  { key: "spec3Value", title: "Detail 3 Value", required: false, width: 16, hint: "Example: Machine Wash", example: "Machine Wash" },
  { key: "shelfLife", title: "Shelf Life", required: false, width: 14, hint: "For food items. Example: 6 Months", example: "6 Months" },
  { key: "country", title: "Country of Origin", required: false, width: 16, hint: "Example: India", example: "India" },
  { key: "fssai", title: "FSSAI License", required: false, width: 16, hint: "For food items.", example: "10020042001234" },
];

export const COLUMN_KEYS = COLUMNS.map((c) => c.key);

/** "Returnable (Yes/No)" -> "returnable", "Product Name *" -> "product name" */
export const normalizeTitle = (t) =>
  String(t == null ? "" : t)
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/\*/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const TITLE_TO_KEY = new Map(COLUMNS.map((c) => [normalizeTitle(c.title), c.key]));
// older / friendlier names that still map to the same column
TITLE_TO_KEY.set("width", "breadth");
TITLE_TO_KEY.set("main image link", "image");

export const keyForTitle = (title) => TITLE_TO_KEY.get(normalizeTitle(title)) || null;

export const REQUIRED_KEYS = COLUMNS.filter((c) => c.required).map((c) => c.key);

/** Rows ignored on upload: the example rows in the template (name or group starts with EXAMPLE). */
export const isExampleText = (v) => /^\s*example\b/i.test(String(v == null ? "" : v));
