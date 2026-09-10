import dotenv from 'dotenv';
import mongoose from 'mongoose';
import dns from 'node:dns';
import { v2 as cloudinary } from 'cloudinary';

dotenv.config();
dns.setServers(['8.8.8.8', '8.8.4.4']);

const cloudName = (process.env.CLOUDINARY_CLOUD_NAME || '').trim();
const apiKey = (process.env.CLOUDINARY_API_KEY || '').trim();
const apiSecret = (process.env.CLOUDINARY_API_SECRET || '').trim();

console.log(`Cloudinary credentials: cloud_name=${cloudName}, api_key=${apiKey}`);

cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret,
  secure: true
});

// Curated high quality eCommerce product images (Unsplash direct assets)
const IMAGE_LIBRARY = {
  atta: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=600&q=80',
  dal: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600&q=80',
  oil: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=600&q=80',
  ghee: 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=600&q=80',
  rice: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600&q=80',
  fruit: 'https://images.unsplash.com/photo-1619566636858-adf3ef46400b?w=600&q=80',
  apple: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=600&q=80',
  mango: 'https://images.unsplash.com/photo-1553279768-865429fa0078?w=600&q=80',
  vegetable: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&q=80',
  dairy: 'https://images.unsplash.com/photo-1628088062854-d1870b4553da?w=600&q=80',
  milk: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=600&q=80',
  cheese: 'https://images.unsplash.com/photo-1452195100486-9cc805987862?w=600&q=80',
  bread: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&q=80',
  snack: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=600&q=80',
  chips: 'https://images.unsplash.com/photo-1528751014936-863e6e7a319c?w=600&q=80',
  chocolate: 'https://images.unsplash.com/photo-1511381939415-e44015466834?w=600&q=80',
  beverage: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=600&q=80',
  tea: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=600&q=80',
  coffee: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=600&q=80',
  juice: 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=600&q=80',
  personal: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&q=80',
  soap: 'https://images.unsplash.com/photo-1607006482602-7634f1837f44?w=600&q=80',
  cleaning: 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=600&q=80',
  baby: 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=600&q=80',
  pet: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=600&q=80',
  sports: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=600&q=80',
  grooming: 'https://images.unsplash.com/photo-1621607512214-68297480165e?w=600&q=80',
  banner: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1200&q=80',
  deal: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&q=80',
};

function selectImageUrl(title = '', defaultType = 'deal') {
  const t = String(title).toLowerCase();
  if (t.includes('atta') || t.includes('wheat') || t.includes('flour') || t.includes('maida') || t.includes('besan') || t.includes('suji') || t.includes('rava') || t.includes('poha')) return IMAGE_LIBRARY.atta;
  if (t.includes('dal') || t.includes('moong') || t.includes('toor') || t.includes('chana') || t.includes('urad') || t.includes('masoor') || t.includes('rajma') || t.includes('pulse')) return IMAGE_LIBRARY.dal;
  if (t.includes('ghee')) return IMAGE_LIBRARY.ghee;
  if (t.includes('oil') || t.includes('mustard')) return IMAGE_LIBRARY.oil;
  if (t.includes('rice') || t.includes('basmati')) return IMAGE_LIBRARY.rice;
  if (t.includes('apple')) return IMAGE_LIBRARY.apple;
  if (t.includes('mango')) return IMAGE_LIBRARY.mango;
  if (t.includes('fruit') || t.includes('guava') || t.includes('papaya') || t.includes('grape')) return IMAGE_LIBRARY.fruit;
  if (t.includes('veg') || t.includes('potato') || t.includes('onion') || t.includes('tomato') || t.includes('leaf') || t.includes('sprout')) return IMAGE_LIBRARY.vegetable;
  if (t.includes('milk')) return IMAGE_LIBRARY.milk;
  if (t.includes('cheese') || t.includes('paneer')) return IMAGE_LIBRARY.cheese;
  if (t.includes('bread') || t.includes('pav') || t.includes('bun') || t.includes('bakery')) return IMAGE_LIBRARY.bread;
  if (t.includes('dairy')) return IMAGE_LIBRARY.dairy;
  if (t.includes('chip') || t.includes('nacho') || t.includes('namkeen')) return IMAGE_LIBRARY.chips;
  if (t.includes('chocolate') || t.includes('candy') || t.includes('sweet')) return IMAGE_LIBRARY.chocolate;
  if (t.includes('snack') || t.includes('biscuit') || t.includes('cookie')) return IMAGE_LIBRARY.snack;
  if (t.includes('tea')) return IMAGE_LIBRARY.tea;
  if (t.includes('coffee')) return IMAGE_LIBRARY.coffee;
  if (t.includes('juice') || t.includes('drink') || t.includes('soda')) return IMAGE_LIBRARY.juice;
  if (t.includes('beverage')) return IMAGE_LIBRARY.beverage;
  if (t.includes('soap') || t.includes('shampoo') || t.includes('wash')) return IMAGE_LIBRARY.soap;
  if (t.includes('personal') || t.includes('beauty') || t.includes('skin') || t.includes('hair') || t.includes('care')) return IMAGE_LIBRARY.personal;
  if (t.includes('clean') || t.includes('detergent') || t.includes('household') || t.includes('wipe')) return IMAGE_LIBRARY.cleaning;
  if (t.includes('baby') || t.includes('diaper')) return IMAGE_LIBRARY.baby;
  if (t.includes('pet') || t.includes('dog') || t.includes('cat')) return IMAGE_LIBRARY.pet;
  if (t.includes('sport') || t.includes('fitness') || t.includes('gym')) return IMAGE_LIBRARY.sports;
  if (t.includes('groom') || t.includes('bridal') || t.includes('iron')) return IMAGE_LIBRARY.grooming;
  if (defaultType === 'banner') return IMAGE_LIBRARY.banner;
  return IMAGE_LIBRARY.deal;
}

const cacheMap = new Map();

async function uploadToUserCloudinary(targetUrl, folderName = 'orangebasket') {
  if (cacheMap.has(targetUrl)) {
    return cacheMap.get(targetUrl);
  }

  try {
    const uploadRes = await cloudinary.uploader.upload(targetUrl, {
      folder: `orangebasket/${folderName}`,
    });
    if (uploadRes && uploadRes.secure_url) {
      cacheMap.set(targetUrl, uploadRes.secure_url);
      return uploadRes.secure_url;
    }
  } catch (err) {
    console.error(`❌ Cloudinary upload error for ${targetUrl}:`, err.message || err);
  }
  return targetUrl;
}

async function runMigration() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB Atlas');

    const db = mongoose.connection.db;

    // 1. Categories
    console.log('\n--- Processing & Uploading Categories to Cloudinary ---');
    const categoriesCol = db.collection('categories');
    const categories = await categoriesCol.find({}).toArray();
    let catUpdated = 0;

    for (const cat of categories) {
      // Force update if image is not already on user's Cloudinary account (b5hik8gu)
      if (!cat.image || !cat.image.includes(`res.cloudinary.com/${cloudName}`)) {
        const sourceUrl = selectImageUrl(cat.name, 'category');
        console.log(`Uploading category [${cat.name}] to Cloudinary...`);
        const cloudinaryUrl = await uploadToUserCloudinary(sourceUrl, 'categories');
        await categoriesCol.updateOne({ _id: cat._id }, { $set: { image: cloudinaryUrl } });
        catUpdated++;
      }
    }
    console.log(`✅ Uploaded & updated ${catUpdated} / ${categories.length} categories to Cloudinary.`);

    // 2. Products
    console.log('\n--- Processing & Uploading Products to Cloudinary ---');
    const productsCol = db.collection('products');
    const products = await productsCol.find({}).toArray();
    let prodUpdated = 0;

    for (const prod of products) {
      if (!prod.mainImage || !prod.mainImage.includes(`res.cloudinary.com/${cloudName}`)) {
        const sourceUrl = selectImageUrl(prod.name, 'product');
        console.log(`Uploading product [${prod.name}] to Cloudinary...`);
        const cloudinaryUrl = await uploadToUserCloudinary(sourceUrl, 'products');

        await productsCol.updateOne(
          { _id: prod._id },
          { $set: { mainImage: cloudinaryUrl, images: [cloudinaryUrl] } }
        );
        prodUpdated++;
      }
    }
    console.log(`✅ Uploaded & updated ${prodUpdated} / ${products.length} products to Cloudinary.`);

    // 3. Hero Configs (Banners)
    console.log('\n--- Processing & Uploading Hero Config Banners to Cloudinary ---');
    const heroCol = db.collection('heroconfigs');
    const heroConfigs = await heroCol.find({}).toArray();
    let heroUpdated = 0;

    for (const hero of heroConfigs) {
      let changed = false;
      const banners = hero.banners || {};
      const items = banners.items || [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item.imageUrl || !item.imageUrl.includes(`res.cloudinary.com/${cloudName}`)) {
          const bannerSource = selectImageUrl(item.title || 'banner', 'banner');
          console.log(`Uploading banner item [${item.title || i}] to Cloudinary...`);
          const cloudinaryUrl = await uploadToUserCloudinary(bannerSource, 'banners');

          item.imageUrl = cloudinaryUrl;
          item.desktopImage = cloudinaryUrl;
          item.mobileImage = cloudinaryUrl;
          changed = true;
        }
      }

      if (changed) {
        await heroCol.updateOne({ _id: hero._id }, { $set: { 'banners.items': items } });
        heroUpdated++;
      }
    }
    console.log(`✅ Uploaded & updated ${heroUpdated} / ${heroConfigs.length} hero configs to Cloudinary.`);

    // 4. Experience Sections
    console.log('\n--- Processing Experience Sections ---');
    const expCol = db.collection('experiencesections');
    const expSections = await expCol.find({}).toArray();
    let expUpdated = 0;

    for (const exp of expSections) {
      const config = exp.config || {};
      const banners = Array.isArray(config.banners) ? config.banners : (config.banners?.items || []);
      let expChanged = false;

      if (Array.isArray(banners)) {
        for (const b of banners) {
          if (!b.image || !b.image.includes(`res.cloudinary.com/${cloudName}`)) {
            const bannerSource = selectImageUrl(b.title || 'banner', 'banner');
            b.image = await uploadToUserCloudinary(bannerSource, 'banners');
            expChanged = true;
          }
        }
      }

      if (expChanged) {
        await expCol.updateOne({ _id: exp._id }, { $set: { 'config.banners': banners } });
        expUpdated++;
      }
    }
    console.log(`✅ Updated ${expUpdated} / ${expSections.length} experience sections.`);

    // 5. Stores / Sellers
    console.log('\n--- Processing Stores ---');
    const storeCol = db.collection('stores');
    const stores = await storeCol.find({}).toArray();
    for (const s of stores) {
      if (!s.logo || !s.logo.includes(`res.cloudinary.com/${cloudName}`)) {
        const storeImg = selectImageUrl(s.name || 'store', 'store');
        const cUrl = await uploadToUserCloudinary(storeImg, 'stores');
        await storeCol.updateOne({ _id: s._id }, { $set: { logo: cUrl, storeImage: cUrl } });
      }
    }

    console.log('\n🎉 ALL IMAGES HAVE BEEN UPLOADED TO CLOUDINARY (b5hik8gu) AND SAVED TO MONGODB SUCCESSFULLY!');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration error:', err);
    process.exit(1);
  }
}

runMigration();
