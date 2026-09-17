import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import dns from 'dns';
import Product from '../app/models/product.js';

dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

dotenv.config({ path: path.join(process.cwd(), '.env') });

const mongoUri = process.env.MONGO_URI;

async function fixUrls() {
  await mongoose.connect(mongoUri);
  console.log('Connected to DB');

  const products = await Product.find({
    $or: [
      { mainImage: { $regex: 'phonepe\\.com/uploads' } },
      { galleryImages: { $elemMatch: { $regex: 'phonepe\\.com/uploads' } } },
      { 'variants.images': { $elemMatch: { $regex: 'phonepe\\.com/uploads' } } },
      { 'variants.images': { $regex: 'phonepe\\.com/uploads' } }
    ]
  });

  console.log(`Found ${products.length} products with phonepe.com/uploads URLs`);

  for (const product of products) {
    let updated = false;
    if (product.mainImage && product.mainImage.includes('phonepe.com/uploads')) {
      product.mainImage = product.mainImage.substring(product.mainImage.indexOf('/uploads'));
      updated = true;
    }

    if (Array.isArray(product.galleryImages)) {
      product.galleryImages = product.galleryImages.map(img => {
        if (typeof img === 'string' && img.includes('phonepe.com/uploads')) {
          updated = true;
          return img.substring(img.indexOf('/uploads'));
        }
        return img;
      });
    }

    if (Array.isArray(product.variants)) {
      product.variants = product.variants.map(v => {
        if (typeof v.images === 'string' && v.images.includes('phonepe.com/uploads')) {
          updated = true;
          v.images = v.images.split(' ').map(img => img.includes('phonepe.com/uploads') ? img.substring(img.indexOf('/uploads')) : img).join(' ');
        } else if (Array.isArray(v.images)) {
          v.images = v.images.map(img => {
            if (typeof img === 'string' && img.includes('phonepe.com/uploads')) {
              updated = true;
              return img.substring(img.indexOf('/uploads'));
            }
            return img;
          });
        }
        return v;
      });
    }

    if (updated) {
      await product.save();
      console.log(`Updated product: ${product.name} (${product._id})`);
    }
  }

  console.log('Done fixing URLs in database!');
  await mongoose.disconnect();
}

fixUrls().catch(err => {
  console.error('Error fixing URLs:', err);
  mongoose.disconnect();
});
