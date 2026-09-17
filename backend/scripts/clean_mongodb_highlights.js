import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import dns from 'dns';

dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

async function cleanMongoHighlights() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const db = mongoose.connection.db;
  const productsCol = db.collection('products');

  const allProducts = await productsCol.find({}).toArray();
  console.log(`Auditing ${allProducts.length} products...`);

  let updatedCount = 0;
  for (const p of allProducts) {
    if (Array.isArray(p.highlights)) {
      const valid = p.highlights.filter(
        (h) => h && typeof h.label === 'string' && h.label.trim().length > 0
      );
      if (valid.length !== p.highlights.length) {
        await productsCol.updateOne({ _id: p._id }, { $set: { highlights: valid } });
        console.log(`Cleaned highlights for product "${p.name}" (${p._id}): ${valid.length} valid highlights remaining`);
        updatedCount++;
      }
    }
  }

  console.log(`\nUpdated ${updatedCount} products.`);

  const ponds = await productsCol.findOne({ name: { $regex: /ponds/i } });
  console.log('\nPonds UltraLight Get Cream updated document:');
  console.log('highlights:', JSON.stringify(ponds.highlights, null, 2));

  await mongoose.disconnect();
}

cleanMongoHighlights().catch(console.error);
