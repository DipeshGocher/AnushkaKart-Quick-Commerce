import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';
import dns from 'dns';

dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

cloudinary.config({
  cloud_name: (process.env.CLOUDINARY_CLOUD_NAME || '').trim(),
  api_key: (process.env.CLOUDINARY_API_KEY || '').trim(),
  api_secret: (process.env.CLOUDINARY_API_SECRET || '').trim(),
  secure: true,
});

async function testUpload() {
  console.log('Testing Cloudinary upload for cloud:', process.env.CLOUDINARY_CLOUD_NAME);
  
  // High-res public Unsplash image URLs for Beauty and Basketball
  const beautyImageUrl = "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&q=80&w=800&h=800";
  const basketballImageUrl = "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&q=80&w=800&h=800";

  console.log('Uploading Beauty image to Cloudinary...');
  const resBeauty = await cloudinary.uploader.upload(beautyImageUrl, {
    folder: 'anushkakart/categories',
    public_id: 'beauty_category'
  });
  console.log('Beauty Cloudinary URL:', resBeauty.secure_url);

  console.log('Uploading Basketball image to Cloudinary...');
  const resBasketball = await cloudinary.uploader.upload(basketballImageUrl, {
    folder: 'anushkakart/categories',
    public_id: 'basketball_category'
  });
  console.log('Basketball Cloudinary URL:', resBasketball.secure_url);

  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to DB');

  const Category = mongoose.model('Category', new mongoose.Schema({}, { strict: false }));
  const Product = mongoose.model('Product', new mongoose.Schema({}, { strict: false }));

  // Find Beauty categories
  const beautyCats = await Category.find({ name: { $regex: /beauty/i } });
  console.log(`Found ${beautyCats.length} Beauty categories`);
  for (const cat of beautyCats) {
    cat.image = resBeauty.secure_url;
    await cat.save();
    console.log(`Updated Beauty category ${cat._id} (${cat.name}) with URL: ${resBeauty.secure_url}`);
  }

  // Find Basketball categories
  const basketballCats = await Category.find({ name: { $regex: /basketball|sports/i } });
  console.log(`Found ${basketballCats.length} Basketball/Sports categories`);
  for (const cat of basketballCats) {
    if (cat.name.toLowerCase().includes('basketball')) {
      cat.image = resBasketball.secure_url;
      await cat.save();
      console.log(`Updated Basketball category ${cat._id} (${cat.name}) with URL: ${resBasketball.secure_url}`);
    }
  }

  // Find Basketball products
  const bbProducts = await Product.find({ name: { $regex: /basketball/i } });
  console.log(`Found ${bbProducts.length} Basketball products`);
  for (const prod of bbProducts) {
    prod.mainImage = resBasketball.secure_url;
    if (Array.isArray(prod.variants) && prod.variants.length > 0) {
      prod.variants.forEach(v => {
        v.images = [resBasketball.secure_url];
      });
    }
    await prod.save();
    console.log(`Updated product ${prod._id} (${prod.name}) with Cloudinary image URL: ${resBasketball.secure_url}`);
  }

  // Also check any categories or products that use api-preprod.phonepe.com image URLs
  const phonepeCats = await Category.find({ image: { $regex: /phonepe/i } });
  console.log(`Found ${phonepeCats.length} categories with old PhonePe image URLs`);
  for (const cat of phonepeCats) {
    if (cat.name.toLowerCase().includes('beauty')) {
      cat.image = resBeauty.secure_url;
    } else {
      cat.image = resBasketball.secure_url;
    }
    await cat.save();
    console.log(`Updated category ${cat._id} (${cat.name}) image`);
  }

  const phonepeProducts = await Product.find({ mainImage: { $regex: /phonepe/i } });
  console.log(`Found ${phonepeProducts.length} products with old PhonePe image URLs`);
  for (const prod of phonepeProducts) {
    prod.mainImage = resBasketball.secure_url;
    await prod.save();
    console.log(`Updated product ${prod._id} (${prod.name}) mainImage`);
  }

  await mongoose.disconnect();
  console.log('Done uploading and updating DB!');
}

testUpload().catch(console.error);
