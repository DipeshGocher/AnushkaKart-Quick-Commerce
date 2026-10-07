const mongoose = require('mongoose');
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const headers = await mongoose.connection.collection('categories').find({ type: 'header', slug: { $ne: 'all' } }).toArray();

  let totalMains = 0;
  let totalSubs = 0;
  let totalProds = 0;

  for (const h of headers) {
    const mainCats = await mongoose.connection.collection('categories').find({ parentId: h._id, type: 'category' }).toArray();
    totalMains += mainCats.length;
    console.log(`\nHEADER: ${h.name} (${mainCats.length} main categories)`);
    for (const mc of mainCats) {
      const subs = await mongoose.connection.collection('categories').find({ parentId: mc._id, type: 'subcategory' }).toArray();
      const prods = await mongoose.connection.collection('products').find({ category: mc._id }).toArray();
      totalSubs += subs.length;
      totalProds += prods.length;
      console.log(`  - Main: "${mc.name}" (Subs: ${subs.length}, Prods: ${prods.length})`);
    }
  }

  console.log(`\nTOTALS: ${headers.length} Headers, ${totalMains} Mains, ${totalSubs} Subs, ${totalProds} Products`);
  process.exit(0);
}
run();
