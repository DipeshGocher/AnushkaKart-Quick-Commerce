import dotenv from "dotenv";
import dns from "dns";
import connectDB from "./app/dbConfig/dbConfig.js";
import Category from "./app/models/category.js";
import Product from "./app/models/product.js";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (e) {}

dotenv.config();

async function main() {
  await connectDB();

  const cats = await Category.find({ catalogType: { $ne: "refurbished" } }).lean();
  console.log("=== ALL CATEGORIES ===");
  cats.forEach(c => console.log(JSON.stringify({ id: c._id, name: c.name, type: c.type, currentImg: c.image })));

  const prods = await Product.find({ isRefurbished: { $ne: true } }).lean();
  console.log("=== ALL PRODUCTS ===");
  prods.forEach(p => console.log(JSON.stringify({ id: p._id, name: p.name, currentImg: p.mainImage || p.image })));

  process.exit(0);
}

main();
