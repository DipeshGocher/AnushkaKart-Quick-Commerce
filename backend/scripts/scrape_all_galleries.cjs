const fs = require('fs');
const path = require('path');

const galleryDefinitions = {
  // --- HOME APPLIANCES ---
  refrigerator: 'https://pngimg.com/images/home_appliances/refrigerator',
  washing_machine: 'https://pngimg.com/images/home_appliances/washing_machine',
  air_conditioner: 'https://pngimg.com/images/home_appliances/air_conditioner',
  microwave: 'https://pngimg.com/images/home_appliances/microwave',
  iron: 'https://pngimg.com/images/home_appliances/iron',
  vacuum_cleaner: 'https://pngimg.com/images/home_appliances/vacuum_cleaner',
  toaster: 'https://pngimg.com/images/home_appliances/toaster',
  kettle: 'https://pngimg.com/images/home_appliances/kettle',
  fan: 'https://pngimg.com/images/home_appliances/fan',

  // --- MOBILE & GADGETS ---
  smartphone: 'https://pngimg.com/images/electronic/smartphone',
  iphone: 'https://pngimg.com/images/electronic/iphone',
  apple_watch: 'https://pngimg.com/images/electronic/apple_watch',
  watches: 'https://pngimg.com/images/watches/watches',
  tablet: 'https://pngimg.com/images/electronic/tablet',
  usb: 'https://pngimg.com/images/electronic/usb',

  // --- ELECTRONICS ---
  laptop: 'https://pngimg.com/images/electronic/laptop',
  tv: 'https://pngimg.com/images/electronic/tv',
  monitor: 'https://pngimg.com/images/electronic/monitor',
  headphones: 'https://pngimg.com/images/electronic/headphones',
  audio_speakers: 'https://pngimg.com/images/electronic/audio_speakers',
  photo_camera: 'https://pngimg.com/images/electronic/photo_camera',
  keyboard: 'https://pngimg.com/images/electronic/keyboard',
  computer_mouse: 'https://pngimg.com/images/electronic/computer_mouse',
  gamepad: 'https://pngimg.com/images/electronic/gamepad',

  // --- FASHION ---
  tshirt: 'https://pngimg.com/images/clothes/tshirt',
  jeans: 'https://pngimg.com/images/clothes/jeans',
  dress: 'https://pngimg.com/images/clothes/dress',
  jacket: 'https://pngimg.com/images/clothes/jacket',
  suit: 'https://pngimg.com/images/clothes/suit',
  sunglasses: 'https://pngimg.com/images/clothing/sunglasses',
  backpack: 'https://pngimg.com/images/bags/backpack',
  belt: 'https://pngimg.com/images/clothing/belt',
  wallet: 'https://pngimg.com/images/clothing/wallet',
  boots: 'https://pngimg.com/images/clothing/boots',
  men_shoes: 'https://pngimg.com/images/clothing/men_shoes',
  women_shoes: 'https://pngimg.com/images/clothing/women_shoes',
  cap: 'https://pngimg.com/images/clothing/cap',
  hat: 'https://pngimg.com/images/clothing/hat',
  scarf: 'https://pngimg.com/images/clothing/scarf',

  // --- BEAUTY & SKIN ---
  perfume: 'https://pngimg.com/images/objects/perfume',
  lipstick: 'https://pngimg.com/images/objects/lipstick',
  shampoo: 'https://pngimg.com/images/objects/shampoo',
  soap: 'https://pngimg.com/images/objects/soap',
  hair_dryer: 'https://pngimg.com/images/objects/hair_dryer',

  // --- MEDICINE ---
  pills: 'https://pngimg.com/images/objects/pills',
  thermometer: 'https://pngimg.com/images/objects/thermometer',
  syringe: 'https://pngimg.com/images/objects/syringe',
  bandage: 'https://pngimg.com/images/objects/bandage',
  medical_mask: 'https://pngimg.com/images/objects/medical_mask',

  // --- GROCERY ---
  apple: 'https://pngimg.com/images/fruits/apple',
  banana: 'https://pngimg.com/images/fruits/banana',
  mango: 'https://pngimg.com/images/fruits/mango',
  strawberry: 'https://pngimg.com/images/fruits/strawberry',
  orange: 'https://pngimg.com/images/fruits/orange',
  tomato: 'https://pngimg.com/images/vegetables/tomato',
  carrot: 'https://pngimg.com/images/vegetables/carrot',
  milk: 'https://pngimg.com/images/food/milk',
  cheese: 'https://pngimg.com/images/food/cheese',
  butter: 'https://pngimg.com/images/food/butter',
  bread: 'https://pngimg.com/images/food/bread',
  egg: 'https://pngimg.com/images/food/egg',
  honey: 'https://pngimg.com/images/food/honey',
  rice: 'https://pngimg.com/images/food/rice',
  chocolate: 'https://pngimg.com/images/food/chocolate',
  tea: 'https://pngimg.com/images/drinks/tea',
  coffee_beans: 'https://pngimg.com/images/food/coffee_beans',
  juice: 'https://pngimg.com/images/drinks/juice',
  water: 'https://pngimg.com/images/drinks/water',
  bottle: 'https://pngimg.com/images/drinks/bottle'
};

async function scrapeAll() {
  const result = {};
  console.log('Scraping image URLs from ' + Object.keys(galleryDefinitions).length + ' galleries...');
  for (const [key, url] of Object.entries(galleryDefinitions)) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!res.ok) {
        console.warn(`[WARN] Failed to fetch gallery ${key}: ${res.status}`);
        result[key] = [];
        continue;
      }
      const html = await res.text();
      const matches = [...new Set(html.match(/https:\/\/pngimg\.com\/uploads\/[a-zA-Z0-9_]+\/[a-zA-Z0-9_]+\.png/g) || [])];
      result[key] = matches;
      console.log(`[OK] ${key}: ${matches.length} png images`);
    } catch (e) {
      console.error(`[ERR] ${key}: ${e.message}`);
      result[key] = [];
    }
  }

  const outPath = path.join(__dirname, 'all_scraped_galleries.json');
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(`Saved all galleries to ${outPath}`);
}

scrapeAll();
