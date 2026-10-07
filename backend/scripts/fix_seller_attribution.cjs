const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function fix() {
  await mongoose.connect(process.env.MONGO_URI);
  const Product = mongoose.connection.collection('products');
  const res = await Product.updateMany({}, { $set: { sellerId: '6999782fd49e8099e8a7b11c' } });
  console.log('Fixed sellerId on all products:', res.modifiedCount);
  const remaining = await Product.countDocuments({ sellerId: { $ne: '6999782fd49e8099e8a7b11c' } });
  console.log('Remaining non-Harsh products:', remaining);
  process.exit(0);
}
fix().catch(err => {
  console.error(err);
  process.exit(1);
});
