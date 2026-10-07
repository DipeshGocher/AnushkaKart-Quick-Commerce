const mongoose = require('mongoose');
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const headers = await mongoose.connection.collection('categories').find({ type: 'header', slug: { $ne: 'all' } }).toArray();
  for (const h of headers) {
    const prods = await mongoose.connection.collection('products').find({
      $or: [{ headerId: h._id }, { headerCategoryId: h._id }]
    }).toArray();
    console.log(`${h.name} (${h._id}) has ${prods.length} products`);
  }
  process.exit(0);
}
run();
