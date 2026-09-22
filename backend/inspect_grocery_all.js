import dotenv from "dotenv";
import dns from "dns";
import connectDB from "./app/dbConfig/dbConfig.js";
import Category from "./app/models/category.js";
import Product from "./app/models/product.js";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (e) {
  console.log("DNS set warning:", e.message);
}

dotenv.config();

async function main() {
  await connectDB();
  
  const cats = await Category.find({ catalogType: { $ne: "refurbished" } }).lean();
  console.log("================ GROCERY CATEGORIES (" + cats.length + ") ================");
  for (const c of cats) {
    console.log(`[${c.type}] ID: ${c._id} | Name: "${c.name}" | Image: ${c.image}`);
  }

  const prods = await Product.find({ isRefurbished: { $ne: true } }).lean();
  console.log("\n================ GROCERY PRODUCTS (" + prods.length + ") ================");
  for (const p of prods) {
    console.log(`ID: ${p._id} | Name: "${p.name}" | Category: "${p.categoryName || p.category}" | Image: ${p.mainImage || p.image}`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
