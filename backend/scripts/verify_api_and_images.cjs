const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function verify() {
  await mongoose.connect(process.env.MONGO_URI);
  const Category = mongoose.connection.collection('categories');
  const Product = mongoose.connection.collection('products');

  console.log('--- Database Audit ---');

  // 1. Broken images check
  const brokenCatImages = await Category.countDocuments({
    $or: [{ image: /pngimg\.com/ }, { image: /\/d\// }]
  });
  const brokenProdImages = await Product.countDocuments({
    $or: [{ mainImage: /pngimg\.com/ }, { mainImage: /\/d\// }, { image: /pngimg\.com/ }]
  });

  console.log('Broken Category Images:', brokenCatImages);
  console.log('Broken Product Images:', brokenProdImages);

  // 2. Duplicates check
  const cats = await Category.find({ type: { $ne: 'header' } }).toArray();
  const catImgMap = {};
  for (const c of cats) {
    if (c.image) {
      catImgMap[c.image] = (catImgMap[c.image] || 0) + 1;
    }
  }
  const duplicateCats = Object.entries(catImgMap).filter(([_, count]) => count > 1);
  console.log('Total Categories inspected:', cats.length);
  console.log('Unique Category Images:', Object.keys(catImgMap).length);
  console.log('Duplicate Category Images count:', duplicateCats.length);

  const prods = await Product.find({}).toArray();
  const prodImgMap = {};
  for (const p of prods) {
    const img = p.mainImage || p.image;
    if (img) {
      prodImgMap[img] = (prodImgMap[img] || 0) + 1;
    }
  }
  const duplicateProds = Object.entries(prodImgMap).filter(([_, count]) => count > 1);
  console.log('Total Products inspected:', prods.length);
  console.log('Unique Product Images:', Object.keys(prodImgMap).length);
  console.log('Duplicate Product Images count:', duplicateProds.length);

  // 3. Seller check
  const nonHarsh = await Product.countDocuments({
    sellerId: { $ne: '6999782fd49e8099e8a7b11c' }
  });
  console.log('Products with non-Harsh sellerId:', nonHarsh);

  // 4. Live GET fetch of random 10 Cloudinary URLs
  console.log('\n--- Testing GET request on 10 random Cloudinary image URLs ---');
  const sampleUrls = [
    cats[5]?.image,
    cats[25]?.image,
    cats[50]?.image,
    cats[100]?.image,
    cats[200]?.image,
    prods[5]?.mainImage,
    prods[25]?.mainImage,
    prods[50]?.mainImage,
    prods[100]?.mainImage,
    prods[200]?.mainImage
  ].filter(Boolean);

  let successCount = 0;
  for (const u of sampleUrls) {
    try {
      const res = await fetch(u);
      if (res.status === 200 && res.headers.get('content-type')?.includes('image')) {
        successCount++;
        console.log(`[PASS] HTTP 200 (${res.headers.get('content-type')}): ${u.slice(0, 75)}...`);
      } else {
        console.log(`[WARN] HTTP ${res.status} (${res.headers.get('content-type')}): ${u}`);
      }
    } catch (e) {
      console.error(`[FAIL] ${u}:`, e.message);
    }
  }
  console.log(`\nVerified ${successCount}/${sampleUrls.length} images loaded with HTTP 200 OK.`);

  process.exit(0);
}

verify().catch(err => {
  console.error(err);
  process.exit(1);
});
