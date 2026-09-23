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
  } catch (e) {}
  return {};
}

function saveMapping(mapping) {
  try {
    fs.writeFileSync(MAPPING_FILE, JSON.stringify(mapping, null, 2), 'utf8');
  } catch (e) {}
}

const urlMapping = loadMapping();

function generatePhoneSvg(title, brand, colorName, primaryHex, accentHex) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f8fafc"/>
      <stop offset="100%" stop-color="#e2e8f0"/>
    </linearGradient>
    <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${primaryHex}"/>
      <stop offset="100%" stop-color="${accentHex}"/>
    </linearGradient>
    <linearGradient id="screenGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="130%" height="130%">
      <feDropShadow dx="0" dy="16" stdDeviation="20" flood-opacity="0.18"/>
    </filter>
  </defs>

  <rect width="800" height="800" rx="32" fill="url(#bgGrad)"/>

  <!-- Phone Body -->
  <g filter="url(#shadow)">
    <rect x="250" y="100" width="300" height="560" rx="44" fill="url(#bodyGrad)" stroke="#cbd5e1" stroke-width="4"/>
    <!-- Screen Bezel -->
    <rect x="264" y="114" width="272" height="532" rx="34" fill="url(#screenGrad)"/>
    <!-- Dynamic Island / Notch -->
    <rect x="360" y="128" width="80" height="18" rx="9" fill="#000000"/>
    <circle cx="425" cy="137" r="4" fill="#1e293b"/>
    <!-- Screen Display Elements -->
    <text x="400" y="240" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="700" font-size="20" fill="#94a3b8" text-anchor="middle" letter-spacing="3">${brand.toUpperCase()}</text>
    <text x="400" y="320" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="36" fill="#f8fafc" text-anchor="middle">${colorName}</text>
    <text x="400" y="360" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="600" font-size="16" fill="#38bdf8" text-anchor="middle">5G Certified • Super Retina</text>

    <!-- Camera lens shine circle -->
    <circle cx="400" cy="460" r="44" fill="${accentHex}" opacity="0.3"/>
    <circle cx="400" cy="460" r="28" fill="${primaryHex}" opacity="0.6"/>
    <circle cx="400" cy="460" r="14" fill="#ffffff" opacity="0.9"/>
  </g>

  <!-- Title Badge Bottom -->
  <rect x="120" y="700" width="560" height="60" rx="16" fill="#ffffff" opacity="0.95" filter="url(#shadow)"/>
  <text x="400" y="738" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="700" font-size="20" fill="#0f172a" text-anchor="middle">${title}</text>
</svg>`;
}

function generateSnackSvg(title, brand, bgColor, accentColor, subtitle) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
  <defs>
    <linearGradient id="wrapGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${bgColor}"/>
      <stop offset="100%" stop-color="${accentColor}"/>
    </linearGradient>
    <filter id="packShadow" x="-10%" y="-10%" width="130%" height="130%">
      <feDropShadow dx="0" dy="14" stdDeviation="18" flood-opacity="0.2"/>
    </filter>
  </defs>

  <rect width="800" height="800" fill="#fffbeb" rx="32"/>

  <!-- Chocolate Bar Wrapper -->
  <g filter="url(#packShadow)">
    <rect x="200" y="160" width="400" height="480" rx="28" fill="url(#wrapGrad)"/>
    <rect x="220" y="180" width="360" height="440" rx="20" fill="none" stroke="#ffffff" stroke-width="2" stroke-dasharray="8 6" opacity="0.4"/>
    
    <text x="400" y="270" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="26" fill="#fef08a" text-anchor="middle" letter-spacing="4">${brand.toUpperCase()}</text>
    <text x="400" y="360" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="44" fill="#ffffff" text-anchor="middle">${title}</text>
    <text x="400" y="420" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="600" font-size="20" fill="#fde047" text-anchor="middle">${subtitle}</text>

    <!-- Decorative Wafers/Chocolate squares -->
    <rect x="290" y="470" width="100" height="80" rx="12" fill="#451a03" stroke="#78350f" stroke-width="4"/>
    <rect x="410" y="470" width="100" height="80" rx="12" fill="#451a03" stroke="#78350f" stroke-width="4"/>
  </g>

  <rect x="160" y="700" width="480" height="56" rx="14" fill="#ffffff" filter="url(#packShadow)"/>
  <text x="400" y="736" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="700" font-size="20" fill="#1e293b" text-anchor="middle">${title} • Premium Chocolate</text>
</svg>`;
}

async function uploadSvg(svgContent, publicId, folder = 'anushkakart/products') {
  const dataUri = 'data:image/svg+xml;base64,' + Buffer.from(svgContent).toString('base64');
  console.log(`Uploading ${publicId} to Cloudinary...`);
  const res = await cloudinary.uploader.upload(dataUri, {
    public_id: publicId,
    folder,
    resource_type: 'image',
    overwrite: true,
  });
  console.log(`-> Uploaded ${publicId}: ${res.secure_url}`);
  return res.secure_url;
}

async function main() {
  console.log('Generating and uploading replacement product images...');

  // 1. Phones
  const phoneItems = [
    {
      title: 'iPhone 15 Plus (128GB)',
      brand: 'Apple',
      color: 'Blue',
      primaryHex: '#0284c7',
      accentHex: '#38bdf8',
      oldUrl: 'https://images.unsplash.com/photo-1695048132960-900824b22f25?q=80&w=800&auto=format&fit=crop',
      id: 'iphone_15_plus_blue'
    },
    {
      title: 'iPhone 15 Pro (256GB)',
      brand: 'Apple',
      color: 'Natural Titanium',
      primaryHex: '#71717a',
      accentHex: '#a1a1aa',
      oldUrl: 'https://images.unsplash.com/photo-1663499482512-1f481fec3b57?q=80&w=800&auto=format&fit=crop',
      id: 'iphone_15_pro_titanium'
    },
    {
      title: 'iPhone 14 Plus (128GB)',
      brand: 'Apple',
      color: 'Purple',
      primaryHex: '#9333ea',
      accentHex: '#c084fc',
      oldUrl: 'https://images.unsplash.com/photo-1632661674598-c116c4f346b9?q=80&w=800&auto=format&fit=crop',
      id: 'iphone_14_plus_purple'
    },
    {
      title: 'Samsung Galaxy S24+ (5G, 256GB)',
      brand: 'Samsung',
      color: 'Cobalt Violet',
      primaryHex: '#6366f1',
      accentHex: '#818cf8',
      oldUrl: 'https://images.unsplash.com/photo-1707227184294-8142a781b16c?q=80&w=800&auto=format&fit=crop',
      id: 'samsung_s24_plus_violet'
    },
    {
      title: 'Samsung Galaxy S23 (5G, 128GB)',
      brand: 'Samsung',
      color: 'Cream',
      primaryHex: '#d97706',
      accentHex: '#fbbf24',
      oldUrl: 'https://images.unsplash.com/photo-1678911820888-eb28532f1709?q=80&w=800&auto=format&fit=crop',
      id: 'samsung_s23_cream'
    },
    {
      title: 'Samsung Galaxy Z Flip 4 (5G, 128GB)',
      brand: 'Samsung',
      color: 'Bora Purple',
      primaryHex: '#a855f7',
      accentHex: '#d8b4fe',
      oldUrl: 'https://images.unsplash.com/photo-1610945264803-cda261b667c5?q=80&w=800&auto=format&fit=crop',
      id: 'samsung_z_flip_4'
    },
    {
      title: 'Pixel 6a / Poco M6 5G',
      brand: 'Android 5G',
      color: 'Sage / Black',
      primaryHex: '#059669',
      accentHex: '#34d399',
      oldUrl: 'https://images.unsplash.com/photo-1603891128711-11b4b0320d31?q=80&w=800&auto=format&fit=crop',
      id: 'android_5g_phones'
    }
  ];

  for (const item of phoneItems) {
    const svg = generatePhoneSvg(item.title, item.brand, item.color, item.primaryHex, item.accentHex);
    const newUrl = await uploadSvg(svg, item.id);
    urlMapping[item.oldUrl] = newUrl;
  }

  // 2. Snacks / Chocolates
  const snackItems = [
    {
      title: 'KitKat',
      brand: 'Nestlé',
      bg: '#dc2626',
      accent: '#991b1b',
      subtitle: 'Crispy Cocoa Wafer Bar',
      oldUrl: 'https://images.unsplash.com/photo-1511381939415-e440c9c4004c?auto=format&fit=crop&q=80&w=400&h=400',
      id: 'kitkat_wafer_bar'
    },
    {
      title: 'Dairy Milk Silk',
      brand: 'Cadbury',
      bg: '#4c1d95',
      accent: '#312e81',
      subtitle: 'Pure Milk Chocolate',
      oldUrl: 'https://images.unsplash.com/photo-1548883354-94bcfe321cfa?auto=format&fit=crop&q=80&w=400&h=400',
      id: 'dairy_milk_silk'
    }
  ];

  for (const item of snackItems) {
    const svg = generateSnackSvg(item.title, item.brand, item.bg, item.accent, item.subtitle);
    const newUrl = await uploadSvg(svg, item.id);
    urlMapping[item.oldUrl] = newUrl;
  }

  // 3. Map Delivery & Seller documents to our valid uploaded Cloudinary assets
  const docMapping = {
    // Delivery 1
    'https://res.cloudinary.com/dv1l9sb4p/image/upload/v1785396976/delivery/documents/nuwhloaq1f3r56vve8sk.jpg': 'https://res.cloudinary.com/b5hik8gu/image/upload/v1790141079/anushkakart/catalog/okxwhmizmdxdjwq3bden.png',
    'https://res.cloudinary.com/dv1l9sb4p/image/upload/v1785396977/delivery/documents/lbreofhlwqd8ccjokepw.jpg': 'https://res.cloudinary.com/b5hik8gu/image/upload/v1790141081/anushkakart/catalog/fdpmftky1zxrtlkqdkfr.png',
    'https://res.cloudinary.com/dv1l9sb4p/image/upload/v1785396979/delivery/documents/qwvaln8mirfawsgmunqc.jpg': 'https://res.cloudinary.com/b5hik8gu/image/upload/v1790141081/anushkakart/catalog/bniy0azrh9ccffskwxfg.png',
    'https://res.cloudinary.com/dv1l9sb4p/image/upload/v1785396975/delivery/profiles/itpbtn10zlsdktioj5yw.jpg': 'https://res.cloudinary.com/b5hik8gu/image/upload/v1790141082/anushkakart/catalog/b4mnxujbcymskdbriebx.png',
    // Delivery 2
    'https://res.cloudinary.com/dv1l9sb4p/image/upload/v1785611536/delivery/documents/pjyts947qbmspweejcwz.jpg': 'https://res.cloudinary.com/b5hik8gu/image/upload/v1790141079/anushkakart/catalog/okxwhmizmdxdjwq3bden.png',
    'https://res.cloudinary.com/dv1l9sb4p/image/upload/v1785611536/delivery/documents/lcqr51xpqyv61lwdhrxi.jpg': 'https://res.cloudinary.com/b5hik8gu/image/upload/v1790141081/anushkakart/catalog/fdpmftky1zxrtlkqdkfr.png',
    'https://res.cloudinary.com/dv1l9sb4p/image/upload/v1785611537/delivery/documents/i0krodad91nxsrdd3tgh.jpg': 'https://res.cloudinary.com/b5hik8gu/image/upload/v1790141081/anushkakart/catalog/bniy0azrh9ccffskwxfg.png',
    'https://res.cloudinary.com/dv1l9sb4p/image/upload/v1785611535/delivery/profiles/fva03gpnxtzypw1hbakr.jpg': 'https://res.cloudinary.com/b5hik8gu/image/upload/v1790141082/anushkakart/catalog/b4mnxujbcymskdbriebx.png',
    // Seller Palash
    'https://res.cloudinary.com/dv1l9sb4p/image/upload/v1785824772/docs/zabmqig4ooqwarivuhaq.png': 'https://res.cloudinary.com/b5hik8gu/image/upload/v1790140888/anushkakart/uploads/docs/pzr5c2osnb29tzrlj5te.png',
    'https://res.cloudinary.com/dv1l9sb4p/image/upload/v1785824773/docs/ths5yhvldrkapudyi00o.png': 'https://res.cloudinary.com/b5hik8gu/image/upload/v1790140890/anushkakart/uploads/docs/bk0hwsqx8rmjwijh5hul.png',
    'https://res.cloudinary.com/dv1l9sb4p/image/upload/v1785824774/docs/pqbnypja8rdmf6wliyeq.png': 'https://res.cloudinary.com/b5hik8gu/image/upload/v1790140891/anushkakart/uploads/docs/h58v0peu8ogtoqc3vgmm.png',
    // Old test order product snapshots -> valid existing Cloudinary catalog images
    'https://res.cloudinary.com/dv1l9sb4p/image/upload/v1785239690/products/pb6qome6yznwrtddxvbm.png': 'https://res.cloudinary.com/b5hik8gu/image/upload/v1790141013/anushkakart/catalog/tozny2hbjpzlwpt4l9ko.jpg',
    'https://res.cloudinary.com/dv1l9sb4p/image/upload/v1785240184/media/images/oiqzztkmgbuqmosydbm5.png': 'https://res.cloudinary.com/b5hik8gu/image/upload/v1790140968/anushkakart/catalog/f6hhslk2falzm1xz8ra8.jpg',
    'https://res.cloudinary.com/dv1l9sb4p/image/upload/v1785717555/products/uygtytoz0od70s0ncyup.jpg': 'https://res.cloudinary.com/b5hik8gu/image/upload/v1790140981/anushkakart/catalog/yoahc09ytobmew9lh10p.jpg',
    'https://res.cloudinary.com/dv1l9sb4p/image/upload/v1785717051/products/v0bd4zik2mj5vvfqutkk.png': 'https://res.cloudinary.com/b5hik8gu/image/upload/v1790140983/anushkakart/catalog/gmypjyivrkbgspj6e3wh.jpg',
    'https://res.cloudinary.com/dv1l9sb4p/image/upload/v1785761979/products/xoa14rs962zzbzxr9yhw.jpg': 'https://res.cloudinary.com/b5hik8gu/image/upload/v1790141027/anushkakart/catalog/kvngoxblpgdssrnl2kew.jpg',
    'https://res.cloudinary.com/dv1l9sb4p/image/upload/v1785717144/products/zbuvhllvd7if0bw7zneg.jpg': 'https://res.cloudinary.com/b5hik8gu/image/upload/v1790141030/anushkakart/catalog/w5proubpsimrkktzha3q.jpg',
    'https://res.cloudinary.com/dv1l9sb4p/image/upload/v1785717104/products/atz3nt3jhcjso1ivrcwy.jpg': 'https://res.cloudinary.com/b5hik8gu/image/upload/v1790141044/anushkakart/catalog/bk1p4thqqnifzsd8peee.jpg',
  };

  for (const [k, v] of Object.entries(docMapping)) {
    urlMapping[k] = v;
  }

  saveMapping(urlMapping);

  console.log('\nAll replacements prepared. Updating MongoDB documents...');
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.');

  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();

  let totalUpdated = 0;

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
          docStr = docStr.split(oldUrl).join(newUrl);
          changed = true;
        }
      }

      if (changed) {
        try {
          const updatedDoc = JSON.parse(docStr);
          const docId = doc._id;
          delete updatedDoc._id;
          await col.replaceOne({ _id: docId }, updatedDoc);
          totalUpdated++;
          console.log(`Updated doc in [${colName}]: ${doc._id}`);
        } catch (e) {
          console.error(`Failed to update doc in ${colName}:`, e.message);
        }
      }
    }
  }

  console.log(`\nUpdated ${totalUpdated} documents across all collections in MongoDB!`);
  await mongoose.disconnect();
}

main().catch(console.error);
