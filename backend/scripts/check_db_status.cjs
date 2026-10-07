const mongoose = require('mongoose');
const path = require('path');
const dns = require('dns');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  const Category = mongoose.connection.collection('categories');
  const Product = mongoose.connection.collection('products');
  
  const catsWithCloudinary = await Category.countDocuments({ image: /cloudinary/ });
  const catsWithPngimg = await Category.countDocuments({ image: /pngimg/ });
  const totalCats = await Category.countDocuments({});

  const prodsWithCloudinary = await Product.countDocuments({ mainImage: /cloudinary/ });
  const prodsWithPngimg = await Product.countDocuments({ mainImage: /pngimg/ });
  const totalProds = await Product.countDocuments({});

  console.log('Category stats:', { totalCats, catsWithCloudinary, catsWithPngimg });
  console.log('Product stats:', { totalProds, prodsWithCloudinary, prodsWithPngimg });
  process.exit(0);
}
check().catch(err => {
  console.error(err);
  process.exit(1);
});
