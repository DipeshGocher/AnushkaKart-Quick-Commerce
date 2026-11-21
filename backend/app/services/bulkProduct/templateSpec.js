/**
 * What goes into the Excel template (pure data; workbookIO.js draws it).
 * The Read Me sheet is written for sellers, in plain words.
 */
import { COLUMNS, MAX_ROWS } from "./columns.js";

/** Example rows (grey in the file, ignored on upload). */
export function exampleRows(paths = []) {
  const p1 = paths[0] || "Grocery > Staples > Rice";
  const p2 = paths[1] || paths[0] || "Fashion > Men > Shirts";
  const p3 = paths[2] || paths[1] || paths[0] || "Fashion > Men > Jeans";
  const shirt = {
    group: "EXAMPLE-SHIRT", category: p2, price: 999, salePrice: 799, description: "Soft cotton shirt, regular fit.", brand: "Urban Style",
    spec1Name: "Fabric", spec1Value: "Cotton", spec2Name: "Fit", spec2Value: "Regular",
  };
  const jeans = { group: "EXAMPLE-JEANS", category: p3, price: 1299, brand: "Urban Style", description: "Slim fit stretch denim." };
  return [
    // 1. single product (no options)
    {
      name: "EXAMPLE - Basmati Rice 5kg", category: p1, price: 650, salePrice: 599, stock: 40, sku: "RICE-5KG",
      weight: 5, weightUnit: "kg", length: 30, breadth: 20, height: 10,
      description: "Long grain basmati rice, 5 kg pack.", brand: "India Gate",
      image: "https://your-site.com/rice.jpg", returnable: "No",
      spec1Name: "Type", spec1Value: "Basmati", shelfLife: "12 Months", country: "India", fssai: "10020042001234",
    },
    // 2. Size + Color (one row per combination that you sell; Large-Blue is NOT sold, so it has no row)
    { ...shirt, name: "EXAMPLE - Men's Cotton Shirt", stock: 10, opt1Name: "Size", opt1Value: "M", opt2Name: "Color", opt2Value: "Red",
      weight: 300, weightUnit: "g", length: 30, breadth: 25, height: 4, image: "https://your-site.com/shirt-red.jpg", images: "https://your-site.com/shirt-red-2.jpg" },
    { group: "EXAMPLE-SHIRT", stock: 8, price: 999, salePrice: 799, opt1Name: "Size", opt1Value: "M", opt2Name: "Color", opt2Value: "Blue", image: "https://your-site.com/shirt-blue.jpg" },
    { group: "EXAMPLE-SHIRT", stock: 5, price: 999, salePrice: 799, opt1Name: "Size", opt1Value: "L", opt2Name: "Color", opt2Value: "Red" },
    // 3. only one option (Size)
    { ...jeans, name: "EXAMPLE - Slim Fit Jeans", stock: 12, opt1Name: "Size", opt1Value: "30", weight: 600, weightUnit: "g", length: 32, breadth: 26, height: 5, image: "https://your-site.com/jeans.jpg" },
    { group: "EXAMPLE-JEANS", price: 1299, stock: 9, opt1Name: "Size", opt1Value: "32" },
    { group: "EXAMPLE-JEANS", price: 1349, stock: 4, opt1Name: "Size", opt1Value: "34" },
  ];
}

const requiredKeys = COLUMNS.filter((c) => c.required).map((c) => c.title.replace(/\s*\*$/, ""));

/**
 * Lines of the Read Me sheet. kind: title | h | p | step | bullet | gap | table (rows = arrays)
 */
export function readmeLines() {
  return [
    { kind: "title", text: "Bulk Product Upload  /  एक साथ कई प्रोडक्ट अपलोड करें" },
    { kind: "p", text: "Fill many products in this file and upload it once. No need to add products one by one." },
    { kind: "p", text: "इस फ़ाइल में कई प्रोडक्ट भरें और एक बार में अपलोड करें।" },
    { kind: "gap" },

    { kind: "h", text: "4 simple steps  /  4 आसान स्टेप" },
    { kind: "step", text: "1.  Open the sheet \"Products\". The grey EXAMPLE rows show how to fill. You can delete them, or leave them: they are ignored." },
    { kind: "step", text: "2.  Fill one row per product. Products with Size / Color need one row per combination (see below)." },
    { kind: "step", text: "3.  Save the file as .xlsx. In the app go to Products > Bulk Upload and choose the file." },
    { kind: "step", text: "4.  Check the preview (green = ok, red = fix it). Then press Save. Rows with errors are skipped, the rest are saved." },
    { kind: "gap" },

    { kind: "h", text: "What is must, what is optional  /  क्या ज़रूरी है" },
    { kind: "p", text: `Only ${requiredKeys.length} things are a must (red headings): ${requiredKeys.join(", ")}.` },
    { kind: "p", text: "Everything else is optional (blue headings). If you leave it empty nothing breaks. You can add it later from the product page." },
    { kind: "gap" },

    { kind: "h", text: "Photo and parcel size  /  फ़ोटो और पार्सल साइज़" },
    { kind: "bullet", text: "Photo link, Weight, Length, Width, Height are optional here." },
    { kind: "bullet", text: "A product WITHOUT a photo or WITHOUT the full parcel size is saved as a DRAFT. A draft is hidden from customers." },
    { kind: "bullet", text: "Open the draft in Products, add the photo / parcel size, set it to Active. It then goes live." },
    { kind: "bullet", text: "Why parcel size? The courier charges by weight and box size. A wrong size can cost you money, so please fill it with the packing included." },
    { kind: "bullet", text: "Photo link: a web address like https://.../photo.jpg. A Google Drive link also works if it is shared as \"Anyone with the link\". Photo up to 5 MB (JPG / PNG / WEBP)." },
    { kind: "gap" },

    { kind: "h", text: "How to fill  /  कैसे भरें" },
    { kind: "p", text: "A) Single product (no sizes or colours): fill ONE row. Leave Product Group and the Option columns empty. See example 1." },
    { kind: "p", text: "B) Product with Size and Color: write the SAME Product Group (for example SHIRT-01) on every row of that product. One row for each combination you sell." },
    { kind: "bullet", text: "Option 1 Name = Size, Option 1 Value = M.   Option 2 Name = Color, Option 2 Value = Red." },
    { kind: "bullet", text: "Every row has its own Price, Stock and SKU." },
    { kind: "bullet", text: "Product Name, Category, Description, Brand, Weight and box size only need to be written on the FIRST row of the product." },
    { kind: "bullet", text: "You do not sell Large in Blue? Simply do not write that row. Customers will not see it. See example 2." },
    { kind: "bullet", text: "Photos belong to the Color: write the photo link on one row of each colour, all sizes of that colour use it." },
    { kind: "p", text: "C) Only one option (for example only Size): fill Option 1 only and leave Option 2 empty. See example 3." },
    { kind: "bullet", text: "The Product Group must be new. If it already exists in your products, the file is rejected so nothing is added twice." },
    { kind: "gap" },

    { kind: "h", text: "All columns  /  सारे कॉलम" },
    {
      kind: "table",
      header: ["Column", "Must?", "What to write", "Example"],
      rows: COLUMNS.map((c) => [c.title.replace(/\s*\*$/, ""), c.required ? "MUST" : "optional", c.hint, c.example]),
    },
    { kind: "gap" },

    { kind: "h", text: "Please remember  /  ध्यान रखें" },
    { kind: "bullet", text: "Do not rename the sheets or the headings. Do not add columns in between." },
    { kind: "bullet", text: "Category: choose from the dropdown. The full list is in the sheet \"Categories\"." },
    { kind: "bullet", text: "Price, Stock and sizes: write numbers only (999, not Rs 999/-). Stock can be 0." },
    { kind: "bullet", text: `Up to ${MAX_ROWS} rows in one file. For more, upload in parts.` },
    { kind: "bullet", text: "Sale Price must be less than Price. Leave it empty if there is no discount." },
    { kind: "bullet", text: "Write plain text. Formatting, pictures inside Excel and formulas are not read." },
  ];
}

/** Sheet names and the rows of the Categories sheet. */
export function buildTemplateSpec({ categoryPaths = [] } = {}) {
  return {
    columns: COLUMNS,
    examples: exampleRows(categoryPaths),
    readme: readmeLines(),
    categories: categoryPaths,
  };
}
