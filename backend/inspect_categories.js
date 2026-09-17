import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "./app/dbConfig/dbConfig.js";
import Category from "./app/models/category.js";

dotenv.config();

async function run() {
  await connectDB();
  const allCats = await Category.find({}).lean();
  console.log(`Total Categories in DB: ${allCats.length}`);
  
  const headers = allCats.filter(c => c.type === "header");
  const categories = allCats.filter(c => c.type === "category");
  const subcategories = allCats.filter(c => c.type === "subcategory");

  console.log(`Headers (Level 1): ${headers.length}`);
  console.log(`Categories (Level 2): ${categories.length}`);
  console.log(`Subcategories (Level 3): ${subcategories.length}`);

  headers.forEach(h => {
    console.log(`\nHeader: ${h.name} (${h._id})`);
    const children = categories.filter(c => String(c.parentId) === String(h._id));
    children.forEach(c => {
      console.log(`  └─ Category: ${c.name} (${c._id})`);
      const subs = subcategories.filter(sc => String(sc.parentId) === String(c._id));
      if (subs.length === 0) {
        console.log(`      └─ (NO SUBCATEGORIES IN DB)`);
      } else {
        subs.forEach(sc => {
          console.log(`      └─ Subcategory: ${sc.name} (${sc._id})`);
        });
      }
    });
  });

  // Also print any orphan subcategories whose parentId doesn't match Level 2 or Level 1
  console.log("\nChecking all subcategories status...");
  subcategories.forEach(sc => {
    const parent = allCats.find(c => String(c._id) === String(sc.parentId));
    console.log(`Subcategory: ${sc.name} -> Parent: ${parent ? parent.name + " (" + parent.type + ")" : "NOT FOUND (" + sc.parentId + ")"}`);
  });

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
