import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';
import dns from 'dns';

// Fix DNS resolution issues on Windows Node.js for MongoDB SRV records
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

const uri1 = process.env.MONGO_URI;
const uri2 = "mongodb+srv://playeronline4076_db_user:GeNraYqFkAWOeNr0@cluster0.4a1dx9s.mongodb.net/quickcom?retryWrites=true&w=majority&appName=Cluster0";

console.log('Using Cloudinary Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME);

async function run() {
  let connected = false;
  for (const uri of [uri1, uri2]) {
    if (!uri) continue;
    try {
      console.log('Connecting to Mongo URI...');
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
      console.log('Successfully connected to MongoDB!');
      connected = true;
      break;
    } catch (e) {
      console.log('Connection failed for URI:', e.message);
    }
  }

  if (!connected) {
    console.error('Failed to connect to Mongo');
    return;
  }

  const db = mongoose.connection.db;
  const cols = await db.listCollections().toArray();
  console.log('\nCollections:', cols.map(c => c.name));

  const Category = mongoose.model('Category', new mongoose.Schema({}, { strict: false }));
  const categories = await Category.find({});
  console.log(`\nFound ${categories.length} categories:`);
  categories.forEach(c => {
    console.log(`- ID: ${c._id}, Name: "${c.name}", Slug: "${c.slug}", Type: "${c.type}", Image: "${c.image}", IconId: "${c.iconId}"`);
  });

  const Product = mongoose.model('Product', new mongoose.Schema({}, { strict: false }));
  const products = await Product.find({});
  console.log(`\nFound ${products.length} products:`);
  products.forEach(p => {
    console.log(`- Product ID: ${p._id}, Name: "${p.name}", mainImage: "${p.mainImage}", images: ${JSON.stringify(p.images)}`);
  });

  await mongoose.disconnect();
}

run().catch(console.error);
