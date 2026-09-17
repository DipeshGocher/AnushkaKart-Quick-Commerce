import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import dns from 'dns';

dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  const cats = await db.collection('categories').find({
    $or: [
      { name: { $regex: /beauty/i } },
      { name: { $regex: /skin/i } },
      { name: { $regex: /mosturiser/i } },
      { name: { $regex: /moistur/i } },
      { name: { $regex: /basketball/i } },
      { name: { $regex: /sports/i } },
      { name: { $regex: /glow/i } }
    ]
  }).toArray();

  console.log('--- CATEGORIES ---');
  cats.forEach(c => console.log(`ID: ${c._id} | Name: "${c.name}" | Type: ${c.type} | parentId: ${c.parentId} | Image: ${c.image}`));

  const prods = await db.collection('products').find({
    $or: [
      { name: { $regex: /basketball/i } },
      { name: { $regex: /nivea/i } },
      { name: { $regex: /cream/i } },
      { name: { $regex: /moistur/i } }
    ]
  }).toArray();

  console.log('\n--- PRODUCTS ---');
  prods.forEach(p => console.log(`ID: ${p._id} | Name: "${p.name}" | mainImage: ${p.mainImage}`));

  await mongoose.disconnect();
}

check().catch(console.error);
