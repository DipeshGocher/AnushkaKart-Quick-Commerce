import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import dns from 'dns';

dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const Category = mongoose.model('Category', new mongoose.Schema({}, { strict: false }));
  const categories = await Category.find({});
  console.log(`\nAll ${categories.length} categories in DB:`);
  categories.forEach(c => {
    console.log(`- ID: ${c._id}, Name: "${c.name}", Slug: "${c.slug}", Type: "${c.type}", parentId: "${c.parentId}", Image: "${c.image}", IconId: "${c.iconId}"`);
  });

  await mongoose.disconnect();
}

run().catch(console.error);
