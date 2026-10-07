const testGalleries = [
  // Appliances
  { group: 'home_appliances', name: 'air_conditioner' },
  { group: 'home_appliances', name: 'blender' },
  { group: 'home_appliances', name: 'toaster' },
  { group: 'home_appliances', name: 'kettle' },
  { group: 'home_appliances', name: 'fan' },
  { group: 'home_appliances', name: 'water_filter' },
  // Electronics
  { group: 'electronic', name: 'tablet' },
  { group: 'electronic', name: 'photo_camera' },
  { group: 'electronic', name: 'computer_mouse' },
  { group: 'electronic', name: 'keyboard' },
  { group: 'electronic', name: 'audio_speakers' },
  { group: 'electronic', name: 'gamepad' },
  { group: 'electronic', name: 'powerbank' },
  { group: 'electronic', name: 'hard_drive' },
  { group: 'electronic', name: 'usb' },
  // Watches
  { group: 'watches', name: 'watch' },
  // Clothes & Fashion
  { group: 'clothing', name: 'shoes' },
  { group: 'clothing', name: 'boots' },
  { group: 'clothes', name: 'dress' },
  { group: 'clothes', name: 'jacket' },
  { group: 'clothes', name: 'suit' },
  { group: 'clothes', name: 'shirt' },
  { group: 'clothes', name: 'shorts' },
  { group: 'bags', name: 'bag' },
  { group: 'clothing', name: 'belt' },
  { group: 'clothing', name: 'wallet' },
  // Beauty & Medical
  { group: 'objects', name: 'cream' },
  { group: 'objects', name: 'soap' },
  { group: 'objects', name: 'hair_dryer' },
  { group: 'objects', name: 'syringe' },
  { group: 'objects', name: 'bandage' },
  { group: 'objects', name: 'medical_mask' },
  // Food & Grocery
  { group: 'food', name: 'cheese' },
  { group: 'food', name: 'egg' },
  { group: 'food', name: 'honey' },
  { group: 'food', name: 'rice' },
  { group: 'food', name: 'cookies' },
  { group: 'food', name: 'coffee_beans' },
  { group: 'drinks', name: 'juice' },
  { group: 'drinks', name: 'coca_cola' }
];

async function check() {
  for (const item of testGalleries) {
    const url = `https://pngimg.com/images/${item.group}/${item.name}`;
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (res.ok) {
        const text = await res.text();
        const matches = [...new Set(text.match(/https:\/\/pngimg\.com\/uploads\/[a-zA-Z0-9_]+\/[a-zA-Z0-9_]+\.png/g) || [])];
        console.log(`FOUND ${item.name} (${matches.length} pngs) at ${url}`);
      } else {
        console.log(`MISSING ${item.name} at ${url} (status: ${res.status})`);
      }
    } catch (e) {
      console.log(`ERROR ${item.name}: ${e.message}`);
    }
  }
}
check();
