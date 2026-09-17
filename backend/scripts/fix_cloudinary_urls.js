import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import dns from 'dns';

dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const beautyCloudinaryUrl = "https://res.cloudinary.com/b5hik8gu/image/upload/v1789470290/anushkakart/categories/beauty_category.jpg";
const basketballCloudinaryUrl = "https://res.cloudinary.com/b5hik8gu/image/upload/v1789470291/anushkakart/categories/basketball_category.jpg";

async function fixUrls() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to DB');

  const db = mongoose.connection.db;
  const categoriesCol = db.collection('categories');
  const productsCol = db.collection('products');

  // Update Beauty & Skin header / level 2 categories
  const resBeauty = await categoriesCol.updateMany(
    { name: { $regex: /beauty/i } },
    { $set: { image: beautyCloudinaryUrl } }
  );
  console.log('Beauty categories updated:', resBeauty.modifiedCount);

  // Update Basketball categories
  const resBB = await categoriesCol.updateMany(
    { name: { $regex: /basketball|sports/i } },
    { $set: { image: basketballCloudinaryUrl } }
  );
  console.log('Basketball / Sports categories updated:', resBB.modifiedCount);

  // Update all categories with old phonepe URLs to Cloudinary
  const resPhonePeCats = await categoriesCol.updateMany(
    { image: { $regex: /phonepe/i } },
    { $set: { image: basketballCloudinaryUrl } }
  );
  console.log('Old PhonePe category URLs updated:', resPhonePeCats.modifiedCount);

  // Update Basketball product mainImage and images array
  const resBBProd = await productsCol.updateMany(
    { $or: [{ name: { $regex: /basketball/i } }, { mainImage: { $regex: /phonepe/i } }] },
    { $set: { mainImage: basketballCloudinaryUrl, images: [basketballCloudinaryUrl] } }
  );
  console.log('Basketball products updated:', resBBProd.modifiedCount);

  console.log('\n--- Verification ---');
  const catList = await categoriesCol.find({ name: { $regex: /beauty|basketball|sports/i } }).toArray();
  catList.forEach(c => console.log(`Category: ${c.name} (${c.type}) -> Image: ${c.image}`));

  const prodList = await productsCol.find({ name: { $regex: /basketball/i } }).toArray();
  prodList.forEach(p => console.log(`Product: ${p.name} -> mainImage: ${p.mainImage}`));

  await mongoose.disconnect();
}

fixUrls().catch(console.error);
