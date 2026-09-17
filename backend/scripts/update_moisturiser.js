import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import dns from 'dns';

dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

async function fix() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  const moisturiserUrl = 'https://res.cloudinary.com/b5hik8gu/image/upload/v1789472764/anushkakart/categories/ffghqzimdhczf5uo3bpl.jpg';
  await db.collection('categories').updateOne({ name: { $regex: /mosturiser/i } }, { $set: { image: moisturiserUrl } });
  console.log('Successfully updated Mosturiser & Creams category with Cloudinary URL');

  const catList = await db.collection('categories').find({
    name: { $regex: /beauty|mosturiser|daily glow|basketball|sports/i }
  }).toArray();
  catList.forEach(c => console.log(`Category: ${c.name} (${c.type}) -> Image: ${c.image}`));

  await mongoose.disconnect();
}

fix().catch(console.error);
