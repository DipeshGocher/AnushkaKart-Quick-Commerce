import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import dns from 'dns';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';

dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

cloudinary.config({
  cloud_name: (process.env.CLOUDINARY_CLOUD_NAME || 'b5hik8gu').trim(),
  api_key: (process.env.CLOUDINARY_API_KEY || '').trim(),
  api_secret: (process.env.CLOUDINARY_API_SECRET || '').trim(),
  secure: true,
});

const uploadsDir = 'C:/Users/ACER/.gemini/antigravity-ide/brain/03aa7897-7984-4a39-9f79-45c1f2a6e2aa/.user_uploaded';

async function uploadFileOrUrl(source, folder = 'anushkakart/categories') {
  try {
    const res = await cloudinary.uploader.upload(source, { folder, resource_type: 'auto' });
    console.log(`Uploaded ${source} -> ${res.secure_url}`);
    return res.secure_url;
  } catch (e) {
    console.error(`Upload error for ${source}:`, e.message);
    return null;
  }
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to DB');

  const db = mongoose.connection.db;
  const categoriesCol = db.collection('categories');
  const productsCol = db.collection('products');

  // 1. Beauty & Skin (Header)
  const beautyHeaderImg = "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=800&q=80";
  const beautyHeaderUrl = await uploadFileOrUrl(beautyHeaderImg, 'anushkakart/categories');

  // 2. Mosturiser & Creams (Category)
  const moisturiserImg = "https://images.unsplash.com/photo-1608248597263-0007999658b3?auto=format&fit=crop&w=800&q=80";
  const moisturiserUrl = await uploadFileOrUrl(moisturiserImg, 'anushkakart/categories');

  // 3. Daily Glow (Subcategory)
  const dailyGlowImg = "https://images.unsplash.com/photo-1571781926291-c477ebfd024b?auto=format&fit=crop&w=800&q=80";
  const dailyGlowUrl = await uploadFileOrUrl(dailyGlowImg, 'anushkakart/categories');

  // 4. Basketball (Category) & Sports
  const basketballImg = "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=800&q=80";
  const basketballUrl = await uploadFileOrUrl(basketballImg, 'anushkakart/categories');

  // 5. Ponds Cream Product
  const pondsImg = "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=800&q=80";
  const pondsUrl = await uploadFileOrUrl(pondsImg, 'anushkakart/products');

  // Update Categories in Mongo
  if (beautyHeaderUrl) {
    await categoriesCol.updateOne({ name: { $regex: /beauty & skin/i } }, { $set: { image: beautyHeaderUrl } });
    console.log('Updated Beauty & Skin header');
  }

  if (moisturiserUrl) {
    await categoriesCol.updateOne({ name: { $regex: /mosturiser/i } }, { $set: { image: moisturiserUrl } });
    console.log('Updated Mosturiser & Creams category');
  }

  if (dailyGlowUrl) {
    await categoriesCol.updateOne({ name: { $regex: /daily glow/i } }, { $set: { image: dailyGlowUrl } });
    console.log('Updated Daily Glow subcategory');
  }

  if (basketballUrl) {
    await categoriesCol.updateMany(
      { name: { $regex: /basketball|sports/i } },
      { $set: { image: basketballUrl } }
    );
    console.log('Updated Basketball & Sports categories');
  }

  // Update Products in Mongo
  if (pondsUrl) {
    await productsCol.updateOne(
      { name: { $regex: /ponds/i } },
      { $set: { mainImage: pondsUrl, images: [pondsUrl] } }
    );
    console.log('Updated Ponds product');
  }

  if (basketballUrl) {
    await productsCol.updateOne(
      { name: { $regex: /nivea basketball/i } },
      { $set: { mainImage: basketballUrl, images: [basketballUrl] } }
    );
    console.log('Updated Nivea Basketball product');
  }

  console.log('\n--- FINAL VERIFICATION ---');
  const catList = await categoriesCol.find({
    name: { $regex: /beauty|mosturiser|daily glow|basketball|sports/i }
  }).toArray();
  catList.forEach(c => console.log(`Category: ${c.name} (${c.type}) -> Image: ${c.image}`));

  const prodList = await productsCol.find({
    name: { $regex: /basketball|ponds/i }
  }).toArray();
  prodList.forEach(p => console.log(`Product: ${p.name} -> mainImage: ${p.mainImage}`));

  await mongoose.disconnect();
}

run().catch(console.error);
