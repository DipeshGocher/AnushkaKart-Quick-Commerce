/**
 * Script to generate the comprehensive Anushka Connect Live Store Onboarding Template.
 * Formatted with ExcelJS, adhering 100% to AnushkaKart's bulk upload engine specifications.
 */
import path from "path";
import { fileURLToPath } from "url";
import ExcelJS from "../backend/node_modules/exceljs/dist/es5/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_FILE = path.resolve(__dirname, "../AnushkaConnect_Live_Store_Setup_Template.xlsx");

// Canonical columns from backend/app/services/bulkProduct/columns.js
const COLUMNS = [
  { key: "group", title: "Product Group", required: false, width: 18, hint: "Only for products with options (Size / Color). Write the SAME text on every row of that product, e.g. SHIRT-01. Leave empty for a single product.", example: "SHIRT-01" },
  { key: "name", title: "Product Name *", required: true, width: 36, hint: "Name customers will see. For products with options write it on the first row.", example: "Men's Cotton Shirt" },
  { key: "category", title: "Category *", required: true, width: 36, hint: "Pick from the dropdown (from Categories sheet). Format: Header > Main > Sub", example: "Grocery & Kitchen > Dairy, Bread & Eggs > Milk & Curd" },
  { key: "price", title: "Price *", required: true, width: 12, hint: "MRP / Selling price before discount, numbers only. Example: 999", example: "999" },
  { key: "stock", title: "Stock *", required: true, width: 10, hint: "Available quantity in pieces. Whole number, 0 is allowed.", example: "25" },
  { key: "salePrice", title: "Sale Price", required: false, width: 12, hint: "Discounted price. Must be less than Price. Leave empty for no discount.", example: "799" },
  { key: "sku", title: "SKU", required: false, width: 16, hint: "Your unique item code / barcode. Leave empty and system creates one.", example: "SH-M-RED" },
  { key: "opt1Name", title: "Option 1 Name", required: false, width: 14, hint: "Only for products with options. Example: Size", example: "Size" },
  { key: "opt1Value", title: "Option 1 Value", required: false, width: 14, hint: "The value of this row. Example: M", example: "M" },
  { key: "opt2Name", title: "Option 2 Name", required: false, width: 14, hint: "Second option, if any. Example: Color", example: "Color" },
  { key: "opt2Value", title: "Option 2 Value", required: false, width: 14, hint: "The value of this row. Example: Red", example: "Red" },
  { key: "weight", title: "Weight", required: false, width: 10, hint: "Weight of the parcel WITH packing, number only. Example: 500", example: "500" },
  { key: "weightUnit", title: "Weight Unit", required: false, width: 12, hint: "g or kg (dropdown). Needed if weight is filled.", example: "g" },
  { key: "length", title: "Length (cm)", required: false, width: 12, hint: "Box length in cm.", example: "30" },
  { key: "breadth", title: "Width (cm)", required: false, width: 12, hint: "Box width in cm.", example: "25" },
  { key: "height", title: "Height (cm)", required: false, width: 12, hint: "Box height in cm.", example: "4" },
  { key: "description", title: "Description", required: false, width: 42, hint: "Product details, plain text only.", example: "Soft cotton shirt, regular fit." },
  { key: "brand", title: "Brand", required: false, width: 16, hint: "Brand name.", example: "Urban Style" },
  { key: "image", title: "Main Photo Link", required: false, width: 36, hint: "Direct web link (https://...) or Google Drive 'anyone with link' URL.", example: "https://images.example.com/item.jpg" },
  { key: "images", title: "More Photo Links", required: false, width: 36, hint: "Up to 4 more links, comma separated.", example: "https://images.example.com/item2.jpg" },
  { key: "tags", title: "Tags", required: false, width: 20, hint: "Search keywords, comma separated.", example: "milk, amul, dairy" },
  { key: "returnable", title: "Returnable (Yes/No)", required: false, width: 16, hint: "Can customers return it? Empty means Yes.", example: "Yes" },
  { key: "returnDays", title: "Return Days", required: false, width: 12, hint: "Return window in days. Default is 7.", example: "7" },
  { key: "spec1Name", title: "Detail 1 Name", required: false, width: 14, hint: "Specification 1 name. Example: Fabric", example: "Fabric" },
  { key: "spec1Value", title: "Detail 1 Value", required: false, width: 16, hint: "Specification 1 value. Example: Cotton", example: "Cotton" },
  { key: "spec2Name", title: "Detail 2 Name", required: false, width: 14, hint: "Specification 2 name. Example: Fit", example: "Fit" },
  { key: "spec2Value", title: "Detail 2 Value", required: false, width: 16, hint: "Specification 2 value. Example: Regular", example: "Regular" },
  { key: "spec3Name", title: "Detail 3 Name", required: false, width: 14, hint: "Specification 3 name. Example: Wash Care", example: "Wash Care" },
  { key: "spec3Value", title: "Detail 3 Value", required: false, width: 16, hint: "Specification 3 value. Example: Machine Wash", example: "Machine Wash" },
  { key: "shelfLife", title: "Shelf Life", required: false, width: 14, hint: "For food items. Example: 6 Months", example: "6 Months" },
  { key: "country", title: "Country of Origin", required: false, width: 16, hint: "Example: India", example: "India" },
  { key: "fssai", title: "FSSAI License", required: false, width: 18, hint: "14-digit FSSAI number for food items.", example: "10020042001234" },
];

const CATEGORIES_DATA = [
  // Grocery & Kitchen
  { header: "Grocery & Kitchen", main: "Dairy, Bread & Eggs", sub: "Milk & Curd", mode: "quick_only", notes: "Amul Taaza, Mother Dairy, Dahi, Chaas" },
  { header: "Grocery & Kitchen", main: "Dairy, Bread & Eggs", sub: "Butter, Cheese & Paneer", mode: "quick_only", notes: "Amul Butter, Cheese slices, Fresh Paneer" },
  { header: "Grocery & Kitchen", main: "Dairy, Bread & Eggs", sub: "Bread & Bakery", mode: "quick_only", notes: "Brown Bread, Pav, Buns" },
  { header: "Grocery & Kitchen", main: "Atta, Rice & Dal", sub: "Atta & Flours", mode: "both", notes: "Aashirvaad Atta, Maida, Besan, Sooji" },
  { header: "Grocery & Kitchen", main: "Atta, Rice & Dal", sub: "Rice & Grains", mode: "both", notes: "Basmati Rice, Kolam Rice, Poha" },
  { header: "Grocery & Kitchen", main: "Atta, Rice & Dal", sub: "Dal & Pulses", mode: "both", notes: "Toor Dal, Moong Dal, Chana Dal, Rajma" },
  { header: "Grocery & Kitchen", main: "Oils & Masalas", sub: "Cooking Oils & Ghee", mode: "both", notes: "Fortune Oil, Saffola, Pure Desi Ghee" },
  { header: "Grocery & Kitchen", main: "Oils & Masalas", sub: "Spices & Powdered Masalas", mode: "both", notes: "Haldi, Mirch, Dhaniya, Garam Masala, MDH, Everest" },
  { header: "Grocery & Kitchen", main: "Oils & Masalas", sub: "Salt, Sugar & Jaggery", mode: "both", notes: "Tata Salt, Madhur Sugar, Gud" },

  // Snacks & Beverages
  { header: "Snacks & Drinks", main: "Biscuits & Cookies", sub: "Cream Biscuits & Cookies", mode: "quick_only", notes: "Oreo, Good Day, Dark Fantasy, Parle-G" },
  { header: "Snacks & Drinks", main: "Biscuits & Cookies", sub: "Rusks & Tea Snacks", mode: "both", notes: "Britannia Rusk, Khari, Toast" },
  { header: "Snacks & Drinks", main: "Chips & Namkeen", sub: "Potato Chips & Crisps", mode: "quick_only", notes: "Lay's, Kurkure, Pringles, Bingo" },
  { header: "Snacks & Drinks", main: "Chips & Namkeen", sub: "Indian Namkeen & Bhujia", mode: "both", notes: "Haldiram Bhujia, Moong Dal, Mixture" },
  { header: "Snacks & Drinks", main: "Tea, Coffee & Health Drinks", sub: "Tea & Green Tea", mode: "both", notes: "Tata Tea Gold, Red Label, Taj Mahal, Green Tea" },
  { header: "Snacks & Drinks", main: "Tea, Coffee & Health Drinks", sub: "Coffee & Instant Mixes", mode: "both", notes: "Nescafe Classic, Bru, Boost, Horlicks" },
  { header: "Snacks & Drinks", main: "Cold Drinks & Juices", sub: "Soft Drinks & Soda", mode: "quick_only", notes: "Coca Cola, Thums Up, Sprite, Soda" },
  { header: "Snacks & Drinks", main: "Cold Drinks & Juices", sub: "Fruit Juices", mode: "quick_only", notes: "Real Juice, Tropicana, Frooti, Maaza" },

  // Personal Care & Hygiene
  { header: "Personal Care", main: "Bath & Body", sub: "Soaps & Body Wash", mode: "both", notes: "Dettol, Dove, Lifebuoy, Pears" },
  { header: "Personal Care", main: "Bath & Body", sub: "Shampoo & Conditioner", mode: "both", notes: "Head & Shoulders, Sunsilk, Pantene, Clinic Plus" },
  { header: "Personal Care", main: "Hair & Skin Care", sub: "Creams, Lotions & Powders", mode: "both", notes: "Nivea Cream, Vaseline Lotion, Boroline" },
  { header: "Personal Care", main: "Oral Care", sub: "Toothpaste & Toothbrushes", mode: "both", notes: "Colgate, Sensodyne, Close Up, Oral-B" },

  // Household & Cleaning
  { header: "Household Items", main: "Cleaning Essentials", sub: "Detergent Powders & Liquids", mode: "both", notes: "Surf Excel, Ariel, Tide, Rin" },
  { header: "Household Items", main: "Cleaning Essentials", sub: "Dishwash Bars & Liquids", mode: "both", notes: "Vim Bar, Pril Liquid, Scrub pads" },
  { header: "Household Items", main: "All Out & Repellents", sub: "Mosquito Repellents & Sprays", mode: "both", notes: "Goodknight Refill, All Out, Hit Spray" },
  { header: "Household Items", main: "Pooja Needs", sub: "Agarbatti & Diya Oil", mode: "both", notes: "Cycle Agarbatti, Kapoor, Dhoop, Matchbox" },

  // Fashion & Apparel (Variants Example)
  { header: "Fashion & Apparel", main: "Men's Wear", sub: "Shirts & T-Shirts", mode: "both", notes: "Cotton Shirts, Polo T-Shirts, Casuals" },
  { header: "Fashion & Apparel", main: "Men's Wear", sub: "Jeans & Trousers", mode: "both", notes: "Denim Jeans, Chinos, Track Pants" },

  // Electronics & Mobile Accessories
  { header: "Electronics & Accessories", main: "Mobile Accessories", sub: "Cables, Chargers & Adapters", mode: "both", notes: "Type-C Cable, 20W Fast Charger, OTG" },
  { header: "Electronics & Accessories", main: "Audio & Sound", sub: "Wired & Wireless Earphones", mode: "both", notes: "boAt BassHeads, Neckbands, Earbuds" },
];

const PRODUCT_EXAMPLES = [
  // 1. Dairy - Fast moving perishable (No variants)
  {
    name: "EXAMPLE - Amul Taaza Homogenised Toned Milk 500ml",
    category: "Grocery & Kitchen > Dairy, Bread & Eggs > Milk & Curd",
    price: 32,
    salePrice: 30,
    stock: 50,
    sku: "AMUL-TZ-500",
    weight: 500,
    weightUnit: "g",
    length: 10,
    breadth: 6,
    height: 15,
    description: "Amul Taaza pasteurised toned milk is fresh, tasty and packed with pure calcium and proteins.",
    brand: "Amul",
    image: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
    tags: "milk, amul, dairy, fresh milk",
    returnable: "No",
    returnDays: 0,
    spec1Name: "Type",
    spec1Value: "Toned Milk",
    spec2Name: "Fat Content",
    spec2Value: "3.0% Minimum",
    shelfLife: "2 Days",
    country: "India",
    fssai: "10014021001010",
  },

  // 2. Cooking Oil (Staples)
  {
    name: "EXAMPLE - Fortune Sunlite Refined Sunflower Oil 1L Pouch",
    category: "Grocery & Kitchen > Oils & Masalas > Cooking Oils & Ghee",
    price: 160,
    salePrice: 142,
    stock: 40,
    sku: "FORT-OIL-1L",
    weight: 910,
    weightUnit: "g",
    length: 16,
    breadth: 8,
    height: 24,
    description: "Fortune Sunlite refined sunflower oil is light, healthy, and enriched with Vitamin A and Vitamin D.",
    brand: "Fortune",
    image: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
    tags: "sunflower oil, cooking oil, fortune oil",
    returnable: "No",
    returnDays: 0,
    spec1Name: "Container Type",
    spec1Value: "Pouch",
    shelfLife: "9 Months",
    country: "India",
    fssai: "10012021000071",
  },

  // 3. Atta (Heavy staple with courier weight)
  {
    name: "EXAMPLE - Aashirvaad Superior MP Sharbati Atta 5kg",
    category: "Grocery & Kitchen > Atta, Rice & Dal > Atta & Flours",
    price: 345,
    salePrice: 310,
    stock: 35,
    sku: "AASH-ATTA-5KG",
    weight: 5,
    weightUnit: "kg",
    length: 35,
    breadth: 24,
    height: 12,
    description: "100% whole wheat flour made from MP Sharbati grains for soft, fluffy rotis.",
    brand: "Aashirvaad",
    image: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
    tags: "atta, wheat flour, aashirvaad, roti",
    returnable: "No",
    returnDays: 0,
    shelfLife: "3 Months",
    country: "India",
    fssai: "10012031000312",
  },

  // 4. Chocolates & Confectionery
  {
    name: "EXAMPLE - Cadbury Dairy Milk Silk Chocolate Bar 150g",
    category: "Snacks & Drinks > Biscuits & Cookies > Cream Biscuits & Cookies",
    price: 175,
    salePrice: 160,
    stock: 60,
    sku: "CAD-SILK-150G",
    weight: 150,
    weightUnit: "g",
    length: 18,
    breadth: 8,
    height: 2,
    description: "Rich, creamy and decadent Cadbury Silk bar that melts in your mouth.",
    brand: "Cadbury",
    image: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
    tags: "chocolate, cadbury, silk, sweet",
    returnable: "No",
    returnDays: 0,
    shelfLife: "12 Months",
    country: "India",
    fssai: "10014022002711",
  },

  // 5. Household Cleaning
  {
    name: "EXAMPLE - Surf Excel Quick Wash Detergent Powder 1kg",
    category: "Household Items > Cleaning Essentials > Detergent Powders & Liquids",
    price: 150,
    salePrice: 139,
    stock: 45,
    sku: "SURF-QW-1KG",
    weight: 1,
    weightUnit: "kg",
    length: 22,
    breadth: 16,
    height: 7,
    description: "Removes tough stains in the wash itself with advanced enzyme technology.",
    brand: "Surf Excel",
    image: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
    tags: "surf excel, detergent, washing powder, laundry",
    returnable: "Yes",
    returnDays: 7,
    country: "India",
  },

  // 6 - 9. Multi-Variant Fashion Item (Size + Color combinations!)
  {
    group: "EXAMPLE-SHIRT-01",
    name: "EXAMPLE - Men's Regular Fit Solid Cotton Casual Shirt",
    category: "Fashion & Apparel > Men's Wear > Shirts & T-Shirts",
    price: 999,
    salePrice: 699,
    stock: 15,
    sku: "SH-NAVY-M",
    opt1Name: "Size",
    opt1Value: "M",
    opt2Name: "Color",
    opt2Value: "Navy Blue",
    weight: 320,
    weightUnit: "g",
    length: 30,
    breadth: 25,
    height: 4,
    description: "Premium 100% breathable cotton casual shirt. Features spread collar, patch pocket, and pre-washed softness.",
    brand: "Urban Style",
    image: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
    tags: "shirt, cotton shirt, men casual shirt, blue shirt",
    returnable: "Yes",
    returnDays: 7,
    spec1Name: "Fabric",
    spec1Value: "100% Cotton",
    spec2Name: "Fit",
    spec2Value: "Regular Fit",
    spec3Name: "Wash Care",
    spec3Value: "Machine Wash Cold",
    country: "India",
  },
  {
    group: "EXAMPLE-SHIRT-01",
    price: 999,
    salePrice: 699,
    stock: 12,
    sku: "SH-NAVY-L",
    opt1Name: "Size",
    opt1Value: "L",
    opt2Name: "Color",
    opt2Value: "Navy Blue",
    image: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
  },
  {
    group: "EXAMPLE-SHIRT-01",
    price: 999,
    salePrice: 699,
    stock: 10,
    sku: "SH-BLACK-M",
    opt1Name: "Size",
    opt1Value: "M",
    opt2Name: "Color",
    opt2Value: "Black",
    image: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
  },
  {
    group: "EXAMPLE-SHIRT-01",
    price: 999,
    salePrice: 699,
    stock: 8,
    sku: "SH-BLACK-L",
    opt1Name: "Size",
    opt1Value: "L",
    opt2Name: "Color",
    opt2Value: "Black",
    image: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
  },

  // 10. Electronics / Accessory with specifications
  {
    name: "EXAMPLE - boAt BassHeads 100 Wired In-Ear Earphones with Mic",
    category: "Electronics & Accessories > Audio & Sound > Wired & Wireless Earphones",
    price: 499,
    salePrice: 349,
    stock: 50,
    sku: "BOAT-BH100-BLK",
    weight: 120,
    weightUnit: "g",
    length: 12,
    breadth: 8,
    height: 3,
    description: "Hawk-inspired dynamic 10mm drivers delivering powerful super extra bass and crystal clear calling microphone.",
    brand: "boAt",
    image: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
    tags: "earphones, boat, bassheads, wired earphones",
    returnable: "Yes",
    returnDays: 7,
    spec1Name: "Connector Type",
    spec1Value: "3.5mm Gold-plated Jack",
    spec2Name: "Driver Size",
    spec2Value: "10mm Dynamic",
    spec3Name: "Warranty",
    spec3Value: "1 Year Official Brand Warranty",
    country: "China",
  },
];

const STORE_FIELDS = [
  { field: "Store Display Name (दुकान/ब्रांड का नाम)", example: "Anushka Connect Super Store", required: true, desc: "ग्राहक ऐप में यह नाम सबसे ऊपर देखेगा" },
  { field: "Registered Legal / Entity Name (बिलिंग का नाम)", example: "Anushka Enterprises Pvt. Ltd.", required: true, desc: "कंपनी/दुकान का पंजीकृत नाम जो इनवॉइस पर छपेगा" },
  { field: "Store Manager / Owner Name (मालिक/मैनेजर का नाम)", example: "Ramesh Sharma", required: true, desc: "ऑपरेशन और संपर्क के लिए मुख्य व्यक्ति" },
  { field: "Primary WhatsApp / Mobile Number (मोबाइल नंबर)", example: "9876543210", required: true, desc: "आर्डर अलर्ट्स और डिलीवरी समन्वय के लिए" },
  { field: "Customer Support Email (सपोर्ट ईमेल)", example: "support@anushkaconnect.com", required: true, desc: "ग्राहकों के प्रश्नों और शिकायतों के लिए" },
  { field: "Complete Store Pickup Address (दुकान का पूरा पता)", example: "Shop No. 12-14, Ground Floor, Central Market, Near City Clock Tower", required: true, desc: "डिलीवरी राइडर सामान उठाने इसी पते पर आएगा" },
  { field: "Store City & State (शहर और राज्य)", example: "Indore, Madhya Pradesh", required: true, desc: "दुकान का शहर व राज्य" },
  { field: "Store Pincode (दुकान का पिनकोड)", example: "452001", required: true, desc: "दुकान की मुख्य लोकेशन का 6-अंकों का पिनकोड" },
  { field: "Store GPS Coordinates (Latitude & Longitude)", example: "22.7196, 75.8577 (या Google Maps का Share Link)", required: true, desc: "राइडर और सिस्टम के लिए सटीक मैप लोकेशन (अति महत्वपूर्ण)" },
  { field: "Delivery Radius (डिलीवरी कितने किलोमीटर तक होगी?)", example: "7 KM", required: true, desc: "क्विक कॉमर्स डिलीवरी का अधिकतम दायरा (e.g. 5 km, 8 km, 10 km)" },
  { field: "Serviceable Pincodes List (डिलीवरी वाले पिनकोड)", example: "452001, 452002, 452003, 452005", required: true, desc: "जिन सभी पिनकोड में ग्राहक आर्डर बुक कर सकते हैं (कॉमा से अलग करें)" },
  { field: "Delivery Fee Rules (डिलीवरी चार्ज का नियम)", example: "₹499 से ऊपर फ्री डिलीवरी, ₹499 से कम पर ₹30 चार्ज", required: true, desc: "कम से कम आर्डर राशि और डिलीवरी चार्ज" },
  { field: "Store Operating Hours (दुकान का समय)", example: "सुबह 08:00 AM से रात 10:30 PM (सोमवार से रविवार)", required: true, desc: "ऐप में आर्डर लेने का समय" },
  { field: "Direct UPI ID / VPA (पेमेंट लेने के लिए UPI ID)", example: "anushkastore@okhdfcbank", required: true, desc: "कस्टमर द्वारा QR स्कैन करके सीधे आपके बैंक खाते में पैसे आएंगे" },
  { field: "Merchant Account Holder Name on UPI (UPI का नाम)", example: "Anushka Connect Store", required: true, desc: "कस्टमर के PhonePe/GPay/Paytm में जो नाम दिखाई देगा" },
];

const FILL = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const RED = "FFC62828";
const BLUE = "FF1565C0";
const GREEN = "FF2E7D32";
const PURPLE = "FF4A148C";
const GREY = "FFF5F5F5";
const DARK = "FF37474F";

async function main() {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Anushka Connect";
  wb.created = new Date();

  // ==========================================
  // SHEET 1: READ ME FIRST (निर्देश)
  // ==========================================
  const wsReadme = wb.addWorksheet("Read Me First", { properties: { tabColor: { argb: GREEN } } });
  wsReadme.getColumn(1).width = 24;
  wsReadme.getColumn(2).width = 12;
  wsReadme.getColumn(3).width = 85;
  wsReadme.getColumn(4).width = 30;

  let r = 1;
  const writeBanner = (text, bg, fg = "FFFFFFFF", sz = 13, bold = true) => {
    wsReadme.mergeCells(r, 1, r, 4);
    const cell = wsReadme.getCell(r, 1);
    cell.value = text;
    cell.alignment = { wrapText: true, vertical: "middle" };
    cell.font = { bold, size: sz, color: { argb: fg } };
    cell.fill = FILL(bg);
    wsReadme.getRow(r).height = 28;
    r += 1;
  };

  const writePara = (text, sz = 11, bold = false) => {
    wsReadme.mergeCells(r, 1, r, 4);
    const cell = wsReadme.getCell(r, 1);
    cell.value = text;
    cell.alignment = { wrapText: true, vertical: "top" };
    cell.font = { size: sz, bold };
    wsReadme.getRow(r).height = Math.max(20, Math.ceil(String(text).length / 110) * 18);
    r += 1;
  };

  const writeGap = () => { r += 1; };

  writeBanner("ANUSHKA CONNECT - LIVE STORE ONBOARDING GUIDE / स्टोर सेटअप निर्देश", "FF0D47A1", "FFFFFFFF", 16);
  writePara("नमस्ते! इस एक्सेल फ़ाइल का उपयोग अपनी लाइव दुकान के केटेगरी (Categories), प्रोडक्ट्स (Products), और स्टोर विवरण (Store Details) को एक साथ सेट करने के लिए करें।");
  writePara("Hello! Use this complete Excel workbook to prepare and upload your categories, products, and store launch settings in one go.");
  writeGap();

  writeBanner("4 मुख्य शीट्स की जानकारी / Workbook Sheets Overview", BLUE);
  writePara("1. 'Read Me First': यह निर्देश शीट है (यह पढ़ें और समझें)।");
  writePara("2. 'Categories': इसमें हेडर, मेन केटेगरी और सब-केटेगरी की लिस्ट है। आप अपनी नई केटेगरी भी इसमें जोड़ सकते हैं।");
  writePara("3. 'Products': इसमें आपके सभी प्रोडक्ट्स की लिस्ट आएगी। इसमें ऊपर 8-10 उदाहरण (EXAMPLE) दिए गए हैं।");
  writePara("4. 'Store Setup': इसमें आपकी दुकान का पता, पिनकोड, डिलीवरी दायरा (Radius), और बैंक UPI ID भरनी है।");
  writeGap();

  writeBanner("प्रोडक्ट्स भरने के मुख्य नियम / Mandatory vs Optional Rules", BLUE);
  writePara("• केवल 4 कॉलम अनिवार्य (MUST) हैं (लाल रंग के हेडर): Product Name *, Category *, Price *, Stock *।");
  writePara("• बाकी सभी कॉलम ऐच्छिक (Optional) हैं (नीले रंग के हेडर): Sale Price, Brand, Description, Photos आदि। इन्हें आप बाद में भी भर सकते हैं।");
  writePara("• Category हमेशा 'Categories' शीट में मौजूद लिस्ट में से ही चुनें (ड्रॉपडाउन उपलब्ध है)। Format: Header > Main > Sub");
  writePara("• Price और Stock में केवल नंबर लिखें (जैसे 999, न कि 'Rs 999/-')।");
  writePara("• Sale Price हमेशा Price (MRP) से कम होनी चाहिए। यदि कोई डिस्काउंट नहीं है तो Sale Price खाली छोड़ दें।");
  writeGap();

  writeBanner("साइज़ / रंग वाले प्रोडक्ट्स (Variants) कैसे भरें?", BLUE);
  writePara("• यदि किसी प्रोडक्ट में Size या Color के कई विकल्प हैं (जैसे टी-शर्ट M, L, XL), तो उसके सभी रो (rows) में SAME 'Product Group' लिखें (जैसे SHIRT-01)।");
  writePara("• Option 1 Name में 'Size' और Option 1 Value में 'M', 'L' आदि भरें।");
  writePara("• Option 2 Name में 'Color' और Option 2 Value में 'Navy Blue', 'Black' आदि भरें।");
  writePara("• हर रो का अपना अलग Stock, Price, और SKU हो सकता है।");
  writePara("• उदाहरण देखने के लिए 'Products' शीट की रो नंबर 7 से 10 (SHIRT-NAVY-BLK) देखें।");
  writeGap();

  writeBanner("फोटो (Photos) कैसे जोड़ें?", BLUE);
  writePara("• Main Photo Link में फ़ोटो का डायरेक्ट लिंक डालें (जैसे https://.../photo.jpg)।");
  writePara("• Google Drive का लिंक भी काम करता है! बस Drive में फ़ोटो का शेयरिंग एक्सेस 'Anyone with the link can view' सेट करें।");
  writePara("• अगर अभी फ़ोटो लिंक नहीं हैं, तो इस कॉलम को खाली छोड़ दें। आप बाद में एडमिन पैनल से भी एक क्लिक में इमेज अपलोड कर सकते हैं।");
  writeGap();

  // Table of all columns
  writeBanner("सभी कॉलम्स की विस्तृत सूची / Full Column Reference", DARK);
  const tableHeaderRow = r;
  ["कॉलम नाम (Column)", "ज़रूरी या ऐच्छिक", "विवरण (What to enter)", "उदाहरण (Example)"].forEach((h, i) => {
    const c = wsReadme.getCell(tableHeaderRow, i + 1);
    c.value = h;
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = FILL(DARK);
    c.alignment = { vertical: "middle", horizontal: "center" };
  });
  wsReadme.getRow(tableHeaderRow).height = 26;
  r += 1;

  COLUMNS.forEach((col) => {
    const row = wsReadme.getRow(r);
    row.getCell(1).value = col.title.replace(/\s*\*$/, "");
    row.getCell(2).value = col.required ? "MUST (ज़रूरी)" : "Optional (ऐच्छिक)";
    row.getCell(3).value = col.hint;
    row.getCell(4).value = col.example;

    row.getCell(1).font = { bold: true };
    row.getCell(2).font = { bold: true, color: { argb: col.required ? RED : BLUE } };
    row.getCell(3).alignment = { wrapText: true, vertical: "top" };
    row.getCell(4).alignment = { wrapText: true, vertical: "top" };
    row.border = { bottom: { style: "hair", color: { argb: "FFBDBDBD" } } };
    row.height = Math.max(20, Math.ceil(String(col.hint).length / 75) * 16);
    r += 1;
  });

  // ==========================================
  // SHEET 2: CATEGORIES (केटेगरी लिस्ट)
  // ==========================================
  const wsCategories = wb.addWorksheet("Categories", { properties: { tabColor: { argb: BLUE } } });
  wsCategories.columns = [
    { key: "path", width: 52, header: "Category Path (सिस्टम पाथ - Header > Main > Sub)" },
    { key: "header", width: 24, header: "Header Category (मुख्य हेडर)" },
    { key: "main", width: 28, header: "Main Category (मुख्य वर्ग)" },
    { key: "sub", width: 28, header: "Subcategory (उप-वर्ग)" },
    { key: "mode", width: 16, header: "Delivery Mode" },
    { key: "notes", width: 44, header: "Common Items / Notes (उदाहरण)" },
  ];

  const catHead = wsCategories.getRow(1);
  catHead.height = 32;
  for (let c = 1; c <= 6; c++) {
    const cell = catHead.getCell(c);
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.fill = FILL(BLUE);
    cell.alignment = { vertical: "middle", horizontal: "center" };
  }

  CATEGORIES_DATA.forEach((cat, idx) => {
    const fullPath = `${cat.header} > ${cat.main} > ${cat.sub}`;
    const row = wsCategories.getRow(idx + 2);
    row.getCell(1).value = fullPath;
    row.getCell(2).value = cat.header;
    row.getCell(3).value = cat.main;
    row.getCell(4).value = cat.sub;
    row.getCell(5).value = cat.mode;
    row.getCell(6).value = cat.notes;
    row.height = 22;
    row.border = { bottom: { style: "thin", color: { argb: "FFE0E0E0" } } };
    row.getCell(1).font = { bold: true, color: { argb: "FF0D47A1" } };
  });
  wsCategories.views = [{ state: "frozen", ySplit: 1, xSplit: 1 }];

  // ==========================================
  // SHEET 3: PRODUCTS (bulkProduct compatible)
  // ==========================================
  const wsProducts = wb.addWorksheet("Products", { properties: { tabColor: { argb: RED } } });
  const textCols = new Set(["group", "sku", "opt1Value", "opt2Value", "fssai", "name"]);
  wsProducts.columns = COLUMNS.map((c) => ({
    key: c.key,
    width: c.width,
    style: textCols.has(c.key) ? { numFmt: "@" } : {},
  }));

  const prodHead = wsProducts.getRow(1);
  prodHead.height = 36;
  COLUMNS.forEach((col, idx) => {
    const cell = prodHead.getCell(idx + 1);
    cell.value = col.title;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.fill = FILL(col.required ? RED : BLUE);
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.note = col.hint;
  });

  // Insert product example rows
  PRODUCT_EXAMPLES.forEach((ex, idx) => {
    const row = wsProducts.getRow(idx + 2);
    row.height = 24;
    COLUMNS.forEach((col, cIdx) => {
      const val = ex[col.key];
      const cell = row.getCell(cIdx + 1);
      if (val !== undefined && val !== "") cell.value = val;
      cell.fill = FILL(GREY);
      cell.font = { italic: true, color: { argb: "FF616161" } };
      cell.border = { bottom: { style: "thin", color: { argb: "FFE0E0E0" } } };
    });
  });

  // Validations
  const letter = (n) => {
    let s = "";
    let x = n;
    while (x > 0) {
      const m = (x - 1) % 26;
      s = String.fromCharCode(65 + m) + s;
      x = Math.floor((x - 1) / 26);
    }
    return s;
  };
  const lastRow = 350;
  const colLetter = (key) => letter(COLUMNS.findIndex((c) => c.key === key) + 1);
  const colRange = (key) => `${colLetter(key)}2:${colLetter(key)}${lastRow}`;
  const addVal = (key, def) => wsProducts.dataValidations.add(colRange(key), { allowBlank: true, showErrorMessage: true, errorStyle: "stop", ...def });

  // Dropdown for Category from Categories sheet!
  addVal("category", {
    type: "list",
    formulae: [`'Categories'!$A$2:$A$${CATEGORIES_DATA.length + 1}`],
    errorTitle: "Invalid Category",
    error: "Please pick a valid category from the dropdown list.",
  });
  addVal("weightUnit", { type: "list", formulae: ['"g,kg"'], errorTitle: "Weight Unit", error: "Choose g or kg." });
  addVal("returnable", { type: "list", formulae: ['"Yes,No"'], errorTitle: "Returnable", error: "Choose Yes or No." });
  addVal("price", { type: "decimal", operator: "greaterThan", formulae: [0], errorTitle: "Price Error", error: "Price must be greater than 0." });
  addVal("salePrice", { type: "decimal", operator: "greaterThanOrEqual", formulae: [0], errorTitle: "Sale Price Error", error: "Sale price must be positive number." });
  addVal("stock", { type: "whole", operator: "greaterThanOrEqual", formulae: [0], errorTitle: "Stock Error", error: "Stock must be whole number (0 or more)." });

  wsProducts.views = [{ state: "frozen", ySplit: 1, xSplit: 2 }];

  // ==========================================
  // SHEET 4: STORE SETUP (स्टोर जानकारी)
  // ==========================================
  const wsStore = wb.addWorksheet("Store Setup", { properties: { tabColor: { argb: PURPLE } } });
  wsStore.getColumn(1).width = 44;
  wsStore.getColumn(2).width = 38;
  wsStore.getColumn(3).width = 16;
  wsStore.getColumn(4).width = 54;

  const storeHead = wsStore.getRow(1);
  storeHead.height = 32;
  ["स्टोर सेटअप फ़ील्ड (Setting Field)", "क्लाइंट वैल्यू भरें (Client To Fill)", "अनिवार्य / Must?", "फ़ील्ड का महत्व / Purpose"].forEach((h, i) => {
    const cell = storeHead.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.fill = FILL(PURPLE);
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  STORE_FIELDS.forEach((f, idx) => {
    const row = wsStore.getRow(idx + 2);
    row.height = 26;
    row.getCell(1).value = f.field;
    row.getCell(2).value = f.example; // Pre-filled with realistic sample
    row.getCell(3).value = f.required ? "MUST" : "Optional";
    row.getCell(4).value = f.desc;

    row.getCell(1).font = { bold: true };
    row.getCell(2).font = { italic: true, color: { argb: "FF283593" } };
    row.getCell(3).font = { bold: true, color: { argb: f.required ? RED : BLUE } };
    row.border = { bottom: { style: "thin", color: { argb: "FFE0E0E0" } } };
  });
  wsStore.views = [{ state: "frozen", ySplit: 1 }];

  // Default active tab to Products or Readme
  wb.views = [{ activeTab: 0 }];

  await wb.xlsx.writeFile(OUTPUT_FILE);
  console.log("Successfully generated template at:", OUTPUT_FILE);
}

main().catch((err) => {
  console.error("Error generating workbook:", err);
  process.exit(1);
});
