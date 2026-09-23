import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';
import dns from 'dns';

dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const CLOUD_NAME = (process.env.CLOUDINARY_CLOUD_NAME || '').trim();
const API_KEY = (process.env.CLOUDINARY_API_KEY || '').trim();
const API_SECRET = (process.env.CLOUDINARY_API_SECRET || '').trim();

if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
  console.error('Missing Cloudinary credentials in .env!');
  process.exit(1);
}

cloudinary.config({
  cloud_name: CLOUD_NAME,
  api_key: API_KEY,
  api_secret: API_SECRET,
  secure: true,
});

const MAPPING_FILE = path.join(__dirname, 'cloudinary_uploaded_mapping.json');

function loadMapping() {
  try {
    if (fs.existsSync(MAPPING_FILE)) {
      return JSON.parse(fs.readFileSync(MAPPING_FILE, 'utf8'));
    }
  } catch (e) {
    console.warn('Could not read mapping file, starting fresh.');
  }
  return {};
}

function saveMapping(mapping) {
  try {
    fs.writeFileSync(MAPPING_FILE, JSON.stringify(mapping, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to save mapping file:', e);
  }
}

const urlMapping = loadMapping();

async function uploadFileOrUrl(source, folder = 'anushkakart/assets') {
  if (urlMapping[source]) {
    return urlMapping[source];
  }

  // If already hosted on user's Cloudinary
  if (typeof source === 'string' && source.includes(`res.cloudinary.com/${CLOUD_NAME}`)) {
    urlMapping[source] = source;
    return source;
  }

  try {
    console.log(`Uploading: ${source} ...`);
    const res = await cloudinary.uploader.upload(source, {
      folder,
      resource_type: 'auto',
    });

    if (res && res.secure_url) {
      console.log(`-> Success: ${res.secure_url}`);
      urlMapping[source] = res.secure_url;
      saveMapping(urlMapping);
      return res.secure_url;
    }
  } catch (err) {
    console.error(`Failed to upload ${source}:`, err.message);
    return null;
  }
  return null;
}

// Recursively find files in a directory
function getFilesRecursively(dir, filterExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg']) {
  let results = [];
  if (!fs.existsSync(dir)) return results;

  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFilesRecursively(filePath, filterExtensions));
    } else {
      const ext = path.extname(file).toLowerCase();
      if (filterExtensions.includes(ext)) {
        results.push(filePath);
      }
    }
  }
  return results;
}

async function uploadLocalImages() {
  console.log('\n=== STEP 1: Uploading Local Images ===');

  // 1. backend/public/uploads
  const backendUploadsDir = path.join(__dirname, '../public/uploads');
  const backendFiles = getFilesRecursively(backendUploadsDir);
  console.log(`Found ${backendFiles.length} local files in backend/public/uploads.`);

  for (const file of backendFiles) {
    const relFromUploads = path.relative(backendUploadsDir, file).replace(/\\/g, '/');
    const folder = `anushkakart/uploads/${path.dirname(relFromUploads)}`.replace(/\/+$/, '');
    
    // Key forms that might appear in DB
    const relativeKey = `/uploads/${relFromUploads}`;
    const cleanKey = `uploads/${relFromUploads}`;
    
    if (!urlMapping[relativeKey]) {
      const uploadedUrl = await uploadFileOrUrl(file, folder);
      if (uploadedUrl) {
        urlMapping[relativeKey] = uploadedUrl;
        urlMapping[cleanKey] = uploadedUrl;
        urlMapping[file] = uploadedUrl;
        saveMapping(urlMapping);
      }
    }
  }

  // 2. frontend/public images (static assets)
  const frontendPublicDir = path.join(__dirname, '../../frontend/public');
  const frontendFiles = getFilesRecursively(frontendPublicDir);
  console.log(`Found ${frontendFiles.length} local files in frontend/public.`);

  for (const file of frontendFiles) {
    const filename = path.basename(file);
    const relKey = `/${filename}`;
    if (!urlMapping[relKey]) {
      const uploadedUrl = await uploadFileOrUrl(file, 'anushkakart/frontend_assets');
      if (uploadedUrl) {
        urlMapping[relKey] = uploadedUrl;
        urlMapping[filename] = uploadedUrl;
        urlMapping[file] = uploadedUrl;
        saveMapping(urlMapping);
      }
    }
  }

  console.log('Local images upload step complete.');
}

async function uploadRemoteDbImages() {
  console.log('\n=== STEP 2: Scanning & Uploading Remote DB Images to Cloudinary ===');
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.');

  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();

  // Find all unique remote URLs in the DB that are not in user's Cloudinary
  const targetUrls = new Set();

  for (const colInfo of collections) {
    const colName = colInfo.name;
    const col = db.collection(colName);
    const docs = await col.find({}).toArray();

    for (const doc of docs) {
      const docStr = JSON.stringify(doc);
      const matches = docStr.match(/https?:\/\/[^"\s\\,]+|\/uploads\/[^"\s\\,]+/g) || [];
      for (const m of matches) {
        if (m.startsWith('/uploads/')) {
          targetUrls.add(m);
        } else if (
          (m.match(/\.(jpg|jpeg|png|webp|gif|svg|avif)/i) || m.includes('cloudinary') || m.includes('unsplash')) &&
          !m.includes(`res.cloudinary.com/${CLOUD_NAME}`)
        ) {
          targetUrls.add(m);
        }
      }
    }
  }

  const urlList = Array.from(targetUrls);
  console.log(`Found ${urlList.length} unique remote/local image URLs in DB to process.`);

  let count = 0;
  for (const url of urlList) {
    count++;
    if (urlMapping[url]) {
      continue;
    }

    // Determine folder
    let folder = 'anushkakart/catalog';
    if (url.includes('category') || url.includes('categories')) {
      folder = 'anushkakart/categories';
    } else if (url.includes('banner')) {
      folder = 'anushkakart/banners';
    } else if (url.includes('settings')) {
      folder = 'anushkakart/settings';
    }

    console.log(`[${count}/${urlList.length}] Processing: ${url.slice(0, 70)}...`);
    // If it's a relative /uploads/ path and we have the local file
    if (url.startsWith('/uploads/')) {
      const localPath = path.join(__dirname, '../public', url);
      if (fs.existsSync(localPath)) {
        await uploadFileOrUrl(localPath, folder);
      }
    } else {
      await uploadFileOrUrl(url, folder);
    }
  }

  console.log('\n=== STEP 3: Updating MongoDB Documents with Cloudinary URLs ===');
  let totalDocsUpdated = 0;

  for (const colInfo of collections) {
    const colName = colInfo.name;
    const col = db.collection(colName);
    const docs = await col.find({}).toArray();

    for (const doc of docs) {
      let docStr = JSON.stringify(doc);
      let changed = false;

      for (const [oldUrl, newUrl] of Object.entries(urlMapping)) {
        if (!newUrl || oldUrl === newUrl) continue;
        if (docStr.includes(oldUrl)) {
          // Replace all occurrences of oldUrl with newUrl
          docStr = docStr.split(oldUrl).join(newUrl);
          changed = true;
        }
      }

      if (changed) {
        try {
          const updatedDoc = JSON.parse(docStr);
          const docId = doc._id;
          delete updatedDoc._id; // avoid immutable _id field update
          await col.replaceOne({ _id: docId }, updatedDoc);
          totalDocsUpdated++;
        } catch (e) {
          console.error(`Error updating doc in ${colName} (${doc._id}):`, e.message);
        }
      }
    }
  }

  console.log(`\nSuccessfully updated ${totalDocsUpdated} documents in MongoDB with your Cloudinary URLs!`);
  await mongoose.disconnect();
}

async function main() {
  try {
    await uploadLocalImages();
    await uploadRemoteDbImages();
    console.log('\n==========================================');
    console.log('ALL PHOTOS UPLOADED TO CLOUDINARY AND DB UPDATED SUCCESSFULLY!');
    console.log(`Cloudinary Cloud Name: ${CLOUD_NAME}`);
    console.log(`Mapping entries saved: ${Object.keys(urlMapping).length}`);
    console.log('==========================================\n');
  } catch (err) {
    console.error('Migration failed with error:', err);
    process.exit(1);
  }
}

main();
