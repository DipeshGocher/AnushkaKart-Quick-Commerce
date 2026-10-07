import mongoose from "mongoose";
import dotenv from "dotenv";
import Attribute from "./app/models/attribute.js";
import Category from "./app/models/category.js";

dotenv.config();

const INITIAL_ATTRIBUTES = [
  { name: "Size", inputType: "dropdown", options: ["XS", "S", "M", "L", "XL", "XXL"] },
  { name: "Color", inputType: "text" },
  { name: "Weight", inputType: "text" },
  { name: "Expiry Date", inputType: "text" },
  { name: "MFD Date", inputType: "text" },
  { name: "Brand Name", inputType: "text" },
  { name: "RAM", inputType: "dropdown", options: ["4GB", "6GB", "8GB", "12GB", "16GB"] },
  { name: "Storage", inputType: "dropdown", options: ["64GB", "128GB", "256GB", "512GB", "1TB"] },
  { name: "Dosage", inputType: "text" },
];

async function runSeed() {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error("MONGO_URI is missing in .env");
      process.exit(1);
    }
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB");

    const attrMap = {};
    for (const attr of INITIAL_ATTRIBUTES) {
      let doc = await Attribute.findOne({ name: attr.name });
      if (!doc) {
        doc = await Attribute.create(attr);
        console.log(`Created attribute: ${attr.name}`);
      } else {
        console.log(`Attribute exists: ${attr.name}`);
      }
      attrMap[attr.name] = doc._id;
    }

    // 1. Map to Fashion category / header
    const fashionCats = await Category.find({
      $or: [
        { name: { $regex: /fashion/i } },
        { slug: { $regex: /fashion/i } },
      ],
    });
    for (const cat of fashionCats) {
      cat.mappedAttributes = [
        { attributeId: attrMap["Size"], isRequired: true },
        { attributeId: attrMap["Color"], isRequired: true },
      ];
      await cat.save();
      console.log(`Mapped Size & Color to ${cat.name} (${cat.type})`);
    }

    // 2. Map to Mobile / Electronics
    const mobileCats = await Category.find({
      $or: [
        { name: { $regex: /mobile|phone/i } },
        { slug: { $regex: /mobile|phone/i } },
      ],
    });
    for (const cat of mobileCats) {
      cat.mappedAttributes = [
        { attributeId: attrMap["RAM"], isRequired: true },
        { attributeId: attrMap["Storage"], isRequired: true },
        { attributeId: attrMap["Color"], isRequired: false },
      ];
      await cat.save();
      console.log(`Mapped RAM, Storage & Color to ${cat.name} (${cat.type})`);
    }

    // 3. Map to Fresh Vegetables / Fruits
    const vegCats = await Category.find({
      $or: [
        { name: { $regex: /vegetable|fruit/i } },
        { slug: { $regex: /vegetable|fruit/i } },
      ],
    });
    for (const cat of vegCats) {
      cat.mappedAttributes = [
        { attributeId: attrMap["Weight"], isRequired: true },
        { attributeId: attrMap["Expiry Date"], isRequired: false },
      ];
      await cat.save();
      console.log(`Mapped Weight & Expiry Date to ${cat.name} (${cat.type})`);
    }

    // 4. Map to Packaged / Staples / Flour / Dal
    const stapleCats = await Category.find({
      $or: [
        { name: { $regex: /staple|flour|atta|dal|packaged/i } },
        { slug: { $regex: /staple|flour|atta|dal|packaged/i } },
      ],
    });
    for (const cat of stapleCats) {
      cat.mappedAttributes = [
        { attributeId: attrMap["Brand Name"], isRequired: true },
        { attributeId: attrMap["Weight"], isRequired: true },
        { attributeId: attrMap["MFD Date"], isRequired: false },
        { attributeId: attrMap["Expiry Date"], isRequired: false },
      ];
      await cat.save();
      console.log(`Mapped Brand, Weight, MFD to ${cat.name} (${cat.type})`);
    }

    console.log("Seeding attributes completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Seeding error:", error);
    process.exit(1);
  }
}

runSeed();
