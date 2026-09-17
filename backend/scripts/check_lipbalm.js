import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import dns from 'dns';

dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

async function checkLipBalm() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const db = mongoose.connection.db;
  const productsCol = db.collection('products');

  const products = await productsCol.find({ name: { $regex: /lip balm|ayurvedic/i } }).toArray();
  console.log(`Found ${products.length} products:`);
  for (const p of products) {
    console.log(`- ${p.name} (_id: ${p._id})`);
    console.log('  approvalStatus:', p.approvalStatus);
    console.log('  highlights:', JSON.stringify(p.highlights, null, 2));
  }

  await mongoose.disconnect();
}

checkLipBalm().catch(console.error);
