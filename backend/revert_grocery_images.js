import dotenv from "dotenv";
import dns from "dns";
import fs from "fs";
import path from "path";
import connectDB from "./app/dbConfig/dbConfig.js";
import Category from "./app/models/category.js";
import Product from "./app/models/product.js";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (e) {}

dotenv.config();

const LOG_PATH = "C:\\Users\\ACER\\.gemini\\antigravity-ide\\brain\\4d0cb956-d6db-48c0-b663-224fefbb30f7\\.system_generated\\tasks\\task-691.log";

async function main() {
  await connectDB();

  console.log("Reading backup log file...");
  const content = fs.readFileSync(LOG_PATH, "utf-8");
  const lines = content.split("\n");

  let mode = null;
  let categoryUpdates = 0;
  let productUpdates = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.includes("=== ALL CATEGORIES ===")) {
      mode = "category";
      continue;
    }
    if (trimmed.includes("=== ALL PRODUCTS ===")) {
      mode = "product";
      continue;
    }

    if (!trimmed.startsWith("{")) continue;

    try {
      const data = JSON.parse(trimmed);
      if (!data.id || !data.currentImg) continue;

      if (mode === "category") {
        await Category.updateOne(
          { _id: data.id },
          { $set: { image: data.currentImg } }
        );
        categoryUpdates++;
      } else if (mode === "product") {
        await Product.updateOne(
          { _id: data.id },
          {
            $set: {
              mainImage: data.currentImg,
              image: data.currentImg,
              galleryImages: [data.currentImg]
            }
          }
        );
        productUpdates++;
      }
    } catch (e) {
      // Ignore non-json lines
    }
  }

  console.log(`Successfully reverted ${categoryUpdates} Categories and ${productUpdates} Products to their original images!`);
  process.exit(0);
}

main().catch(err => {
  console.error("Revert error:", err);
  process.exit(1);
});
