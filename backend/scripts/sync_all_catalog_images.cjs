const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const dns = require('dns');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const {
  uploadToCloudinary,
  getNextImageFromGalleries,
  getGalleryKeysForText,
  saveCache
} = require('./catalog_image_helpers.cjs');

const HARSH_SELLER_ID = '6999782fd49e8099e8a7b11c';

async function run() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB!');

  const Category = mongoose.connection.collection('categories');
  const Product = mongoose.connection.collection('products');

  const headers = await Category.find({ type: 'header', slug: { $ne: 'all' } }).toArray();
  console.log(`Found ${headers.length} header categories.`);

  let updatedCats = 0;
  let updatedSubs = 0;
  let updatedProds = 0;

  for (const h of headers) {
    console.log(`\n================ Processing Header: ${h.name} (${h.slug}) ================`);
    const mainCats = await Category.find({ parentId: h._id, type: 'category' }).toArray();
    console.log(`Found ${mainCats.length} main categories under ${h.name}`);

    for (const mc of mainCats) {
      // 1. Assign image for Main Category
      const mcKeys = getGalleryKeysForText(`${mc.name} ${h.name}`);
      const mcSourceUrl = getNextImageFromGalleries(mcKeys);
      console.log(`  [MAIN CAT] "${mc.name}" -> uploading ${mcKeys[0]} image...`);
      const mcCloudinaryUrl = await uploadToCloudinary(mcSourceUrl);
      if (mcCloudinaryUrl) {
        await Category.updateOne({ _id: mc._id }, { $set: { image: mcCloudinaryUrl } });
        updatedCats++;
      }

      // 2. Assign image for each Subcategory (ENSURING EACH IS DIFFERENT!)
      const subs = await Category.find({ parentId: mc._id, type: 'subcategory' }).toArray();
      for (const sub of subs) {
        const subKeys = getGalleryKeysForText(`${sub.name} ${mc.name} ${h.name}`);
        const subSourceUrl = getNextImageFromGalleries(subKeys);
        console.log(`      [SUB] "${sub.name}" -> uploading distinct ${subKeys[0]} image...`);
        const subCloudinaryUrl = await uploadToCloudinary(subSourceUrl);
        if (subCloudinaryUrl) {
          await Category.updateOne({ _id: sub._id }, { $set: { image: subCloudinaryUrl } });
          updatedSubs++;
        }
      }

      // Save cache progress
      saveCache();
    }
  }

  // 3. Update all products:
  // - All products with broken pngimg/d/ links
  // - All products in catalog to have proper unique transparent PNGs matching their names
  console.log('\n================ Updating Products ================');
  const allProducts = await Product.find({}).toArray();
  console.log(`Total products to inspect: ${allProducts.length}`);

  for (const prod of allProducts) {
    const isBroken = !prod.mainImage || prod.mainImage.includes('pngimg.com/d/') || !prod.mainImage.includes('cloudinary');
    
    // Check if image is broken OR if user wants fresh PNG
    if (isBroken) {
      const prodKeys = getGalleryKeysForText(prod.name);
      const prodSourceUrl = getNextImageFromGalleries(prodKeys);
      console.log(`  [PROD] "${prod.name}" (${prodKeys[0]}) -> uploading transparent PNG...`);
      const prodCloudinaryUrl = await uploadToCloudinary(prodSourceUrl);
      if (prodCloudinaryUrl) {
        await Product.updateOne(
          { _id: prod._id },
          {
            $set: {
              mainImage: prodCloudinaryUrl,
              galleryImages: [prodCloudinaryUrl],
              image: prodCloudinaryUrl,
              sellerId: HARSH_SELLER_ID
            }
          }
        );
        updatedProds++;
      }
    } else {
      // Ensure sellerId is Harsh's Hub
      await Product.updateOne(
        { _id: prod._id },
        { $set: { sellerId: HARSH_SELLER_ID } }
      );
    }
  }

  saveCache();

  console.log('\n================ FINAL STATS ================');
  console.log(`Updated Categories: ${updatedCats}`);
  console.log(`Updated Subcategories: ${updatedSubs}`);
  console.log(`Updated Products: ${updatedProds}`);

  // Verification: check broken images
  const remainingBrokenProds = await Product.countDocuments({
    mainImage: { $regex: 'pngimg.com/d/' }
  });
  const remainingBrokenCats = await Category.countDocuments({
    image: { $regex: 'pngimg.com/d/' }
  });
  console.log(`Remaining broken product images: ${remainingBrokenProds}`);
  console.log(`Remaining broken category images: ${remainingBrokenCats}`);

  process.exit(0);
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
