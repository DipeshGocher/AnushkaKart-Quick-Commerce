import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function checkIphone() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const Product = mongoose.model('Product', new mongoose.Schema({}, { strict: false }));
    const prods = await Product.find({ name: { $regex: /iphone/i } });
    console.log('IPHONE PRODUCTS IN ATLAS DB:', JSON.stringify(prods, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
checkIphone();
