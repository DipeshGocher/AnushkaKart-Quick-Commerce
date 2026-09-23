import dotenv from 'dotenv';
import mongoose from 'mongoose';
import dns from 'dns';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
dotenv.config({ path: path.join(__dirname, '../.env') });

async function scanDbImages() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.');

  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();

  const nonCloudinary = [];
  const localUploads = [];

  for (const colInfo of collections) {
    const colName = colInfo.name;
    const col = db.collection(colName);
    const docs = await col.find({}).toArray();

    for (const doc of docs) {
      const docStr = JSON.stringify(doc);
      // check any url-like or image-like field
      const matches = docStr.match(/https?:\/\/[^"\s\\,]+|\/uploads\/[^"\s\\,]+/g) || [];
      for (const m of matches) {
        if (m.includes('/uploads/')) {
          localUploads.push({
            collection: colName,
            id: doc._id,
            name: doc.name || doc.title || doc.slug,
            image: m
          });
        }
        if (m.match(/\.(jpg|jpeg|png|webp|gif|svg|avif)/i) || m.includes('/uploads/') || m.includes('unsplash')) {
          if (!m.includes('res.cloudinary.com/b5hik8gu')) {
            nonCloudinary.push({
              collection: colName,
              id: doc._id,
              name: doc.name || doc.title || doc.slug,
              image: m
            });
          }
        }
      }
    }
  }

  console.log(`\n=== LOCAL UPLOADS IN DB (/uploads/...) ===: ${localUploads.length}`);
  localUploads.forEach(u => console.log(`[${u.collection}] ${u.name}: ${u.image}`));

  console.log(`\n=== ALL NON-CLOUDINARY IMAGES IN DB ===: ${nonCloudinary.length}`);
  const byCol = {};
  for (const item of nonCloudinary) {
    byCol[item.collection] = (byCol[item.collection] || 0) + 1;
  }
  console.log('Breakdown by collection:', byCol);

  const uniqueUrls = [...new Set(nonCloudinary.map(i => i.image))];
  console.log(`Unique URLs (${uniqueUrls.length}):`);
  uniqueUrls.slice(0, 50).forEach(u => console.log(' -', u));

  await mongoose.disconnect();
}

scanDbImages().catch(console.error);
