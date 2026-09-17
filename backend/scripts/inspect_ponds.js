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
  const p = await mongoose.connection.db.collection('products').findOne({ name: { $regex: /ponds/i } });
  console.log('Ponds Product:', JSON.stringify(p, null, 2));
  await mongoose.disconnect();
}

run().catch(console.error);
