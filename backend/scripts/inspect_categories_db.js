import mongoose from "mongoose";
import Category from "../app/models/category.js";
import dotenv from "dotenv";

dotenv.config();

async function check() {
  const mongoUri = process.env.MONGO_URI;
  await mongoose.connect(mongoUri);
  console.log("Connected to Mongo");

  const categories = await Category.find({}).lean();
  console.log(`Total categories in DB: ${categories.length}`);
  categories.forEach((c) => {
    console.log(`Name: "${c.name}", Type: "${c.type}", ParentId: ${c.parentId}, CatalogType: "${c.catalogType}"`);
  });

  await mongoose.disconnect();
}

check().catch(console.error);
