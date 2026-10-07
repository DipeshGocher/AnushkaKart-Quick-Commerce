const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const dns = require('dns');
const cloudinary = require('cloudinary').v2;
require('dotenv').config({ path: path.join(__dirname, '../.env') });

dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

cloudinary.config({
  cloud_name: (process.env.CLOUDINARY_CLOUD_NAME || '').trim(),
  api_key: (process.env.CLOUDINARY_API_KEY || '').trim(),
  api_secret: (process.env.CLOUDINARY_API_SECRET || '').trim(),
  secure: true,
});

const GALLERIES_FILE = path.join(__dirname, 'all_scraped_galleries.json');
const CACHE_FILE = path.join(__dirname, 'png_to_cloudinary_cache.json');
const galleries = JSON.parse(fs.readFileSync(GALLERIES_FILE, 'utf-8'));

let cache = {};
if (fs.existsSync(CACHE_FILE)) {
  try {
    cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
  } catch (e) {
    cache = {};
  }
}

function saveCache() {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

const HARSH_SELLER_ID = '6999782fd49e8099e8a7b11c';

// Safe upload with size checks and timeout
async function uploadToCloudinary(url) {
  if (!url || typeof url !== 'string') return null;
  if (cache[url]) return cache[url];
  if (url.includes('cloudinary.com')) return url;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Referer': 'https://pngimg.com/'
      }
    });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const cl = res.headers.get('content-length');
    if (cl && parseInt(cl, 10) > 10000000) {
      return null;
    }

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 10000000) {
      return null;
    }

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'anushkakart/catalog_png',
          format: 'png',
          resource_type: 'image'
        },
        (err, uploadRes) => {
          if (err) reject(err);
          else resolve(uploadRes.secure_url);
        }
      );
      stream.end(buf);
    });

    cache[url] = result;
    return result;
  } catch (e) {
    return null;
  }
}

const { getGalleryKeysForText } = require('./catalog_image_helpers.cjs');

// Gallery pointers to distribute images evenly
const galleryPointers = {};
function initPointers() {
  for (const k of Object.keys(galleries)) {
    galleryPointers[k] = 0;
  }
}
initPointers();

// Get an unused unique Cloudinary image
async function getUniqueCloudinaryImage(preferredKeys, usedSet) {
  // 1. Try preferred keys
  for (const key of preferredKeys) {
    const list = galleries[key];
    if (!list || list.length === 0) continue;

    for (let attempt = 0; attempt < Math.min(list.length, 30); attempt++) {
      if (galleryPointers[key] === undefined) galleryPointers[key] = 0;
      const idx = galleryPointers[key] % list.length;
      galleryPointers[key]++;
      const candidateUrl = list[idx];
      const uploaded = await uploadToCloudinary(candidateUrl);
      if (uploaded && !usedSet.has(uploaded)) {
        usedSet.add(uploaded);
        return uploaded;
      }
    }
  }

  // 2. Try related fallback galleries
  const allKeys = Object.keys(galleries);
  for (const key of allKeys) {
    const list = galleries[key];
    if (!list || list.length === 0) continue;
    for (let attempt = 0; attempt < Math.min(list.length, 10); attempt++) {
      if (galleryPointers[key] === undefined) galleryPointers[key] = 0;
      const idx = galleryPointers[key] % list.length;
      galleryPointers[key]++;
      const candidateUrl = list[idx];
      const uploaded = await uploadToCloudinary(candidateUrl);
      if (uploaded && !usedSet.has(uploaded)) {
        usedSet.add(uploaded);
        return uploaded;
      }
    }
  }

  return null;
}

// Simple concurrency runner
async function runConcurrent(items, limit, fn) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index++;
      try {
        results[i] = await fn(items[i], i);
      } catch (err) {
        console.error(`Error processing item ${i}:`, err.message);
        results[i] = null;
      }
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function run() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected!');

  const Category = mongoose.connection.collection('categories');
  const Product = mongoose.connection.collection('products');

  const usedCategoryImages = new Set();
  const usedProductImages = new Set();

  // Load all categories
  const allCategories = await Category.find({ type: { $ne: 'header' } }).toArray();
  const headers = await Category.find({ type: 'header', slug: { $ne: 'all' } }).toArray();
  const headerMap = {};
  for (const h of headers) headerMap[h._id.toString()] = h.name;

  console.log(`Loaded ${allCategories.length} non-header categories`);

  // First pass: identify existing valid unique Cloudinary images
  const catImageCounts = {};
  for (const c of allCategories) {
    if (c.image && c.image.includes('cloudinary.com') && !c.image.includes('pngimg.com')) {
      catImageCounts[c.image] = (catImageCounts[c.image] || 0) + 1;
    }
  }

  // If used exactly once, retain it in usedCategoryImages
  const categoriesToUpdate = [];
  for (const c of allCategories) {
    const isCloudinary = c.image && c.image.includes('cloudinary.com') && !c.image.includes('pngimg.com');
    if (isCloudinary && catImageCounts[c.image] === 1) {
      usedCategoryImages.add(c.image);
    } else {
      categoriesToUpdate.push(c);
    }
  }

  console.log(`Retaining ${usedCategoryImages.size} existing unique category images.`);
  console.log(`Categories needing new unique images: ${categoriesToUpdate.length}`);

  // Update categories needing new unique images (6 concurrent workers)
  let catProcessed = 0;
  await runConcurrent(categoriesToUpdate, 6, async (c) => {
    const parentName = headerMap[c.parentId?.toString()] || '';
    const preferredKeys = getGalleryKeysForText(`${c.name} ${parentName}`);
    const uniqueUrl = await getUniqueCloudinaryImage(preferredKeys, usedCategoryImages);

    if (uniqueUrl) {
      await Category.updateOne({ _id: c._id }, { $set: { image: uniqueUrl } });
      catProcessed++;
      if (catProcessed % 10 === 0 || catProcessed === categoriesToUpdate.length) {
        console.log(`[Categories Progress] ${catProcessed}/${categoriesToUpdate.length} updated.`);
        saveCache();
      }
    }
  });

  saveCache();
  console.log('Categories update complete!');

  // Now process products
  console.log('\n================ Updating Products ================');
  const allProducts = await Product.find({}).toArray();
  console.log(`Total products: ${allProducts.length}`);

  // Count existing product image frequencies
  const prodImageCounts = {};
  for (const p of allProducts) {
    const img = p.mainImage || p.image;
    if (img && img.includes('cloudinary.com') && !img.includes('pngimg.com')) {
      prodImageCounts[img] = (prodImageCounts[img] || 0) + 1;
    }
  }

  const productsToUpdate = [];
  for (const p of allProducts) {
    const img = p.mainImage || p.image;
    const isCloudinary = img && img.includes('cloudinary.com') && !img.includes('pngimg.com');
    // Also ensure it's a transparent PNG (not an old .jpg)
    const isPng = isCloudinary && (img.includes('.png') || img.includes('catalog_png'));

    if (isPng && prodImageCounts[img] === 1) {
      usedProductImages.add(img);
      // Still ensure sellerId is Harsh's Hub
      if (p.sellerId?.toString() !== HARSH_SELLER_ID) {
        await Product.updateOne({ _id: p._id }, { $set: { sellerId: HARSH_SELLER_ID } });
      }
    } else {
      productsToUpdate.push(p);
    }
  }

  console.log(`Retaining ${usedProductImages.size} existing unique product images.`);
  console.log(`Products needing new unique images: ${productsToUpdate.length}`);

  let prodProcessed = 0;
  await runConcurrent(productsToUpdate, 6, async (p) => {
    const preferredKeys = getGalleryKeysForText(p.name);
    const uniqueUrl = await getUniqueCloudinaryImage(preferredKeys, usedProductImages);

    if (uniqueUrl) {
      await Product.updateOne(
        { _id: p._id },
        {
          $set: {
            mainImage: uniqueUrl,
            image: uniqueUrl,
            galleryImages: [uniqueUrl],
            sellerId: HARSH_SELLER_ID
          }
        }
      );
      prodProcessed++;
      if (prodProcessed % 10 === 0 || prodProcessed === productsToUpdate.length) {
        console.log(`[Products Progress] ${prodProcessed}/${productsToUpdate.length} updated.`);
        saveCache();
      }
    }
  });

  saveCache();
  console.log('Products update complete!');

  // Verification & final stats
  console.log('\n================ FINAL VERIFICATION ================');
  const brokenCats = await Category.countDocuments({
    $or: [{ image: { $regex: 'pngimg.com' } }, { image: { $regex: '/d/' } }]
  });
  const brokenProds = await Product.countDocuments({
    $or: [
      { mainImage: { $regex: 'pngimg.com' } },
      { mainImage: { $regex: '/d/' } },
      { image: { $regex: 'pngimg.com' } }
    ]
  });

  // Verify duplicates in categories
  const finalCats = await Category.find({ type: { $ne: 'header' } }).toArray();
  const catUrlMap = {};
  let catDupes = 0;
  for (const c of finalCats) {
    if (c.image) {
      if (catUrlMap[c.image]) catDupes++;
      catUrlMap[c.image] = true;
    }
  }

  // Verify duplicates in products
  const finalProds = await Product.find({}).toArray();
  const prodUrlMap = {};
  let prodDupes = 0;
  let wrongSellerCount = 0;
  for (const p of finalProds) {
    const img = p.mainImage || p.image;
    if (img) {
      if (prodUrlMap[img]) prodDupes++;
      prodUrlMap[img] = true;
    }
    if (p.sellerId?.toString() !== HARSH_SELLER_ID) {
      wrongSellerCount++;
    }
  }

  console.log(`Remaining broken category images: ${brokenCats}`);
  console.log(`Remaining broken product images: ${brokenProds}`);
  console.log(`Category duplicate images: ${catDupes}`);
  console.log(`Product duplicate images: ${prodDupes}`);
  console.log(`Products with non-Harsh sellerId: ${wrongSellerCount}`);
  console.log(`Total unique category images in use: ${Object.keys(catUrlMap).length}`);
  console.log(`Total unique product images in use: ${Object.keys(prodUrlMap).length}`);

  process.exit(0);
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
