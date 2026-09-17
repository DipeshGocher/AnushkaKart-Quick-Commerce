import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import dns from 'dns';
import { v2 as cloudinary } from 'cloudinary';

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

async function uploadToCloudinary(urlOrPath, folder = 'anushkakart') {
  try {
    const res = await cloudinary.uploader.upload(urlOrPath, {
      folder,
      resource_type: 'auto',
    });
    console.log(`[Cloudinary Success] ${urlOrPath} -> ${res.secure_url}`);
    return res.secure_url;
  } catch (err) {
    console.error(`[Cloudinary Error] Failed for ${urlOrPath}:`, err.message);
    return null;
  }
}

async function processUploads() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const db = mongoose.connection.db;
  const categoriesCol = db.collection('categories');
  const productsCol = db.collection('products');

  // Find all categories with phonepe or non-cloudinary URLs
  const phonePeCats = await categoriesCol.find({
    $or: [
      { image: { $regex: /phonepe/i } },
      { name: { $regex: /beauty|skin|mosturiser|moistur|basketball/i } }
    ]
  }).toArray();

  console.log(`Processing ${phonePeCats.length} categories...`);

  for (const cat of phonePeCats) {
    if (cat.image && (cat.image.includes('phonepe') || !cat.image.includes('cloudinary.com/b5hik8gu'))) {
      console.log(`Uploading category image for "${cat.name}" (${cat.type}): ${cat.image}`);
      const newUrl = await uploadToCloudinary(cat.image, 'anushkakart/categories');
      if (newUrl) {
        await categoriesCol.updateOne({ _id: cat._id }, { $set: { image: newUrl } });
        console.log(`Updated category "${cat.name}" with Cloudinary URL: ${newUrl}`);
      }
    }
  }

  // Find all products with phonepe URLs or matching names
  const phonePeProds = await productsCol.find({
    $or: [
      { mainImage: { $regex: /phonepe/i } },
      { name: { $regex: /basketball|nivea|ponds|cream|moistur/i } }
    ]
  }).toArray();

  console.log(`Processing ${phonePeProds.length} products...`);

  for (const prod of phonePeProds) {
    if (prod.mainImage && (prod.mainImage.includes('phonepe') || !prod.mainImage.includes('cloudinary.com/b5hik8gu'))) {
      console.log(`Uploading product mainImage for "${prod.name}": ${prod.mainImage}`);
      const newUrl = await uploadToCloudinary(prod.mainImage, 'anushkakart/products');
      if (newUrl) {
        await productsCol.updateOne(
          { _id: prod._id },
          { $set: { mainImage: newUrl, images: [newUrl] } }
        );
        console.log(`Updated product "${prod.name}" with Cloudinary URL: ${newUrl}`);
      }
    }
  }

  console.log('\n--- VERIFICATION AFTER CLOUDINARY UPLOADS ---');
  const updatedCats = await categoriesCol.find({
    $or: [
      { name: { $regex: /beauty|skin|mosturiser|moistur|basketball|sports|glow/i } }
    ]
  }).toArray();
  updatedCats.forEach(c => console.log(`Category: ${c.name} (${c.type}) -> Image: ${c.image}`));

  const updatedProds = await productsCol.find({
    $or: [
      { name: { $regex: /basketball|nivea|ponds|cream|moistur/i } }
    ]
  }).toArray();
  updatedProds.forEach(p => console.log(`Product: ${p.name} -> mainImage: ${p.mainImage}`));

  await mongoose.disconnect();
}

processUploads().catch(console.error);
