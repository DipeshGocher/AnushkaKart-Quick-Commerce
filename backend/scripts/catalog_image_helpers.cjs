const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const dns = require('dns');
const cloudinary = require('cloudinary').v2;
require('dotenv').config({ path: path.join(__dirname, '../.env') });

dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

cloudinary.config({
  cloud_name: (process.env.CLOUDINARY_CLOUD_NAME || '').trim(),
  api_key: (process.env.CLOUDINARY_API_KEY || '').trim(),
  api_secret: (process.env.CLOUDINARY_API_SECRET || '').trim(),
  secure: true,
});

const GALLERIES_FILE = path.join(__dirname, 'all_scraped_galleries.json');
const CACHE_FILE = path.join(__dirname, 'png_to_cloudinary_cache.json');

const galleries = JSON.parse(fs.readFileSync(GALLERIES_FILE, 'utf-8'));
let cache = {};
if (fs.existsSync(CACHE_FILE)) {
  try {
    cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
  } catch (e) {
    cache = {};
  }
}

function saveCache() {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

// Upload buffer to Cloudinary
async function uploadToCloudinary(url) {
  if (cache[url]) return cache[url];
  if (url.includes('cloudinary.com')) return url;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Referer': 'https://pngimg.com/'
      }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'anushkakart/catalog_png',
          format: 'png',
          resource_type: 'image'
        },
        (err, res) => {
          if (err) reject(err);
          else resolve(res.secure_url);
        }
      );
      stream.end(buf);
    });

    cache[url] = result;
    return result;
  } catch (e) {
    console.error(`Failed upload for ${url}: ${e.message}`);
    return null;
  }
}

// Track used indexes per gallery to ensure DIFFERENT images for every category/subcategory
const galleryPointers = {};
function getNextImageFromGalleries(preferredKeys) {
  for (const key of preferredKeys) {
    const list = galleries[key];
    if (list && list.length > 0) {
      if (!galleryPointers[key]) galleryPointers[key] = 0;
      const idx = galleryPointers[key] % list.length;
      galleryPointers[key]++;
      return list[idx];
    }
  }
  // Fallback to any gallery
  const fallbackKey = 'apple';
  const list = galleries[fallbackKey];
  return list[0];
}

// Keyword matcher
function getGalleryKeysForText(text = '') {
  const t = text.toLowerCase();

  // Home Appliances
  if (t.includes('refrigerat') || t.includes('fridge')) return ['refrigerator'];
  if (t.includes('wash') || t.includes('dryer') && !t.includes('hair')) return ['washing_machine'];
  if (t.includes('conditioner') || t.includes('air condition') || t.includes('split ac') || t.includes('window ac')) return ['air_conditioner', 'fan'];
  if (t.includes('microwave') || t.includes('oven') || t.includes('otg')) return ['microwave'];
  if (t.includes('iron') || t.includes('steamer')) return ['iron'];
  if (t.includes('vacuum') || t.includes('cleaner') && !t.includes('face')) return ['vacuum_cleaner'];
  if (t.includes('grinder') || t.includes('blender') || t.includes('chopper') || t.includes('juicer')) return ['toaster', 'kettle'];
  if (t.includes('fryer') || t.includes('toaster') || t.includes('kettle') || t.includes('cooker') || t.includes('cooktop') || t.includes('appliance')) return ['kettle', 'toaster', 'microwave'];
  if (t.includes('purifier') || t.includes('filter') || t.includes('ro water')) return ['water', 'bottle', 'kettle'];

  // Electronics audio (checked before phone so headphone doesn't match phone)
  if (t.includes('headphone') || t.includes('earbud') || t.includes('earphone') || t.includes('tws') || t.includes('neckband') || t.includes('headset')) return ['headphones'];
  if (t.includes('speaker') || t.includes('soundbar') || t.includes('audio')) return ['audio_speakers'];

  // Mobile
  if (t.includes('smartwatch') || t.includes('smart watch') || t.includes('fitness tracker') || t.includes('amoled')) return ['apple_watch', 'watches'];
  if (t.includes('cable') || t.includes('charger') || t.includes('adapter') || t.includes('usb') || t.includes('power bank') || t.includes('powerbank')) return ['usb'];
  if ((t.includes('phone') && !t.includes('headphone') && !t.includes('earphone')) || t.includes('mobile') || t.includes('iphone') || t.includes('5g') || t.includes('gaming mobile')) return ['smartphone', 'iphone'];
  if (t.includes('cover') || t.includes('case') || t.includes('protector') || t.includes('tempered')) return ['smartphone', 'wallet'];

  // Electronics
  if (t.includes('laptop') || t.includes('macbook') || t.includes('notebook') || t.includes('ultrabook')) return ['laptop'];
  if (t.includes('tv') || t.includes('television') || t.includes('oled') || t.includes('qled')) return ['tv', 'monitor'];
  if (t.includes('tablet') || t.includes('ipad')) return ['tablet'];
  if (t.includes('camera') || t.includes('dslr') || t.includes('vlog')) return ['photo_camera'];
  if (t.includes('mouse') || t.includes('keyboard') || t.includes('computer') || t.includes('accessory') || t.includes('accessories') || t.includes('webcam') || t.includes('usb hub')) return ['computer_mouse', 'keyboard', 'monitor'];
  if (t.includes('game') || t.includes('gaming') || t.includes('console') || t.includes('controller') || t.includes('playstation') || t.includes('xbox')) return ['gamepad'];
  if (t.includes('storage') || t.includes('ssd') || t.includes('hdd') || t.includes('pendrive') || t.includes('memory card')) return ['usb'];

  // Fashion
  if (t.includes('t-shirt') || t.includes('tshirt') || t.includes('topwear') || t.includes('polo')) return ['tshirt'];
  if (t.includes('shirt') || t.includes('hoodie')) return ['tshirt', 'jacket'];
  if (t.includes('jean') || t.includes('bottomwear') || t.includes('chino') || t.includes('trouser') || t.includes('pant') || t.includes('jogger')) return ['jeans'];
  if (t.includes('dress') || t.includes('kurti') || t.includes('suit') && t.includes('women') || t.includes('anarkali') || t.includes('jumpsuit')) return ['dress'];
  if (t.includes('jacket') || t.includes('coat')) return ['jacket'];
  if (t.includes('suit') || t.includes('blazer')) return ['suit'];
  if (t.includes('shoe') || t.includes('sneaker') || t.includes('boot') || t.includes('footwear') || t.includes('sandal') || t.includes('loafer')) return ['men_shoes', 'women_shoes', 'boots'];
  if (t.includes('watch')) return ['watches', 'apple_watch'];
  if (t.includes('sunglass') || t.includes('frame') || t.includes('aviator') || t.includes('wayfarer')) return ['sunglasses'];
  if (t.includes('backpack') || t.includes('luggage') || t.includes('duffle') || t.includes('trolley') || t.includes('bag') && !t.includes('handbag')) return ['backpack'];
  if (t.includes('handbag') || t.includes('tote') || t.includes('clutch') || t.includes('purse')) return ['wallet', 'backpack'];
  if (t.includes('wallet')) return ['wallet'];
  if (t.includes('belt')) return ['belt'];
  if (t.includes('cap') || t.includes('hat')) return ['cap', 'hat'];
  if (t.includes('scarf')) return ['scarf'];

  // Beauty & Skin
  if (t.includes('perfume') || t.includes('fragrance') || t.includes('cologne') || t.includes('mist')) return ['perfume'];
  if (t.includes('lipstick') || t.includes('makeup') || t.includes('mascara') || t.includes('concealer') || t.includes('blush') || t.includes('powder')) return ['lipstick'];
  if (t.includes('shampoo') || t.includes('hair care') || t.includes('conditioner') || t.includes('hair oil') || t.includes('serum')) return ['shampoo'];
  if (t.includes('soap') || t.includes('wash') || t.includes('cleanser') || t.includes('scrub') || t.includes('bath') || t.includes('grooming')) return ['soap'];
  if (t.includes('dryer') || t.includes('straightener') || t.includes('curling') || t.includes('hair styl')) return ['hair_dryer'];
  if (t.includes('cream') || t.includes('lotion') || t.includes('moisturiz') || t.includes('sunscreen') || t.includes('gel')) return ['perfume', 'soap'];

  // Medicine
  if (t.includes('thermometer') || t.includes('oximeter') || t.includes('monitor') || t.includes('scale') || t.includes('glucometer')) return ['thermometer'];
  if (t.includes('syringe') || t.includes('injection') || t.includes('test strip') || t.includes('diabetes')) return ['syringe', 'thermometer'];
  if (t.includes('bandage') || t.includes('antiseptic') || t.includes('gauze') || t.includes('first aid') || t.includes('cotton')) return ['bandage'];
  if (t.includes('mask') || t.includes('flu') || t.includes('inhaler')) return ['medical_mask'];
  if (t.includes('pill') || t.includes('tablet') || t.includes('capsule') || t.includes('pain') || t.includes('cold') || t.includes('cough') || t.includes('vitamin') || t.includes('digestive') || t.includes('balm') || t.includes('medicine') || t.includes('supplement')) return ['pills', 'bottle'];

  // Grocery
  if (t.includes('apple')) return ['apple'];
  if (t.includes('banana')) return ['banana'];
  if (t.includes('mango')) return ['mango'];
  if (t.includes('strawberr')) return ['strawberry'];
  if (t.includes('orange') || t.includes('citrus')) return ['orange'];
  if (t.includes('fruit')) return ['apple', 'banana', 'mango', 'orange', 'strawberry'];
  if (t.includes('tomato')) return ['tomato'];
  if (t.includes('carrot')) return ['carrot'];
  if (t.includes('vegetable')) return ['tomato', 'carrot'];
  if (t.includes('milk')) return ['milk'];
  if (t.includes('cheese')) return ['cheese'];
  if (t.includes('butter') || t.includes('ghee')) return ['butter'];
  if (t.includes('bread')) return ['bread'];
  if (t.includes('egg')) return ['egg'];
  if (t.includes('honey')) return ['honey'];
  if (t.includes('rice') || t.includes('atta') || t.includes('dal') || t.includes('flour') || t.includes('wheat') || t.includes('maida') || t.includes('besan')) return ['rice', 'bread'];
  if (t.includes('chocolat') || t.includes('sweet') || t.includes('snack') || t.includes('munch') || t.includes('biscuit') || t.includes('cookie') || t.includes('chip') || t.includes('maggi') || t.includes('noodle')) return ['chocolate', 'honey', 'bread'];
  if (t.includes('tea')) return ['tea'];
  if (t.includes('coffee')) return ['coffee_beans'];
  if (t.includes('juice') || t.includes('drink') || t.includes('beverage') || t.includes('soda') || t.includes('coke') || t.includes('cola')) return ['juice', 'bottle', 'water'];
  if (t.includes('oil') || t.includes('mustard') || t.includes('sunflower') || t.includes('olive')) return ['bottle', 'honey'];
  if (t.includes('water')) return ['water', 'bottle'];

  return ['apple', 'orange', 'laptop', 'tshirt', 'perfume', 'pills'];
}

module.exports = {
  uploadToCloudinary,
  getNextImageFromGalleries,
  getGalleryKeysForText,
  saveCache,
  galleries
};
