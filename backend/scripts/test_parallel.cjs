const dotenv = require('dotenv');
const path = require('path');
const cloudinary = require('cloudinary').v2;

dotenv.config({ path: path.join(__dirname, '../.env') });

cloudinary.config({
  cloud_name: (process.env.CLOUDINARY_CLOUD_NAME || '').trim(),
  api_key: (process.env.CLOUDINARY_API_KEY || '').trim(),
  api_secret: (process.env.CLOUDINARY_API_SECRET || '').trim(),
  secure: true,
});

async function uploadOne(url, folder) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Referer': 'https://pngimg.com/'
    }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, format: 'png', resource_type: 'image' },
      (err, result) => {
        if (err) reject(err);
        else resolve(result.secure_url);
      }
    );
    stream.end(buf);
  });
}

async function testParallel() {
  const urls = [
    'https://pngimg.com/uploads/banana/banana_PNG104277.png',
    'https://pngimg.com/uploads/orange/orange_PNG813.png',
    'https://pngimg.com/uploads/carrot/carrot_PNG99151.png',
    'https://pngimg.com/uploads/laptop/laptop_PNG101838.png',
    'https://pngimg.com/uploads/headphones/headphones_PNG101985.png'
  ];
  console.time('5 parallel uploads');
  const results = await Promise.all(urls.map(u => uploadOne(u, 'anushkakart/test')));
  console.timeEnd('5 parallel uploads');
  console.log('Results:', results);
}

testParallel().catch(console.error);
