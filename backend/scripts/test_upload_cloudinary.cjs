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

async function testUpload() {
  const sourceUrl = 'https://pngimg.com/uploads/apple/apple_PNG12509.png';
  console.log('Testing upload of:', sourceUrl);
  
  // Download buffer first so we have complete control over headers
  const res = await fetch(sourceUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      'Referer': 'https://pngimg.com/'
    }
  });
  console.log('Fetch status:', res.status, res.headers.get('content-type'));
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  console.log('Buffer size:', buffer.length, 'bytes');

  // Upload buffer to Cloudinary
  const uploadRes = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'anushkakart/categories',
        format: 'png',
        resource_type: 'image'
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    stream.end(buffer);
  });

  console.log('Upload success! Secure URL:', uploadRes.secure_url);
}

testUpload().catch(console.error);
