import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dns from 'dns';
import Category from './app/models/category.js';
import Product from './app/models/product.js';
import Seller from './app/models/seller.js';

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  console.log("Failed to set DNS servers:", e.message);
}

dotenv.config();

async function inspect() {
  try {
    console.log("Connecting to:", process.env.MONGO_URI);
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB successfully!");

    const categories = await Category.find({ catalogType: 'refurbished' });
    console.log("Refurbished Categories Count:", categories.length);
    categories.forEach(c => {
      console.log(`- ID: ${c._id}, Name: ${c.name}, Type: ${c.type}, Parent: ${c.parentId}`);
    });

    const sellers = await Seller.find({});
    console.log("Sellers Count:", sellers.length);
    sellers.forEach(s => {
      console.log(`- Seller ID: ${s._id}, Name: ${s.name}, Email: ${s.email}`);
    });

    const productsCount = await Product.countDocuments({ conditionType: 'refurbished' });
    console.log("Current Refurbished Products Count:", productsCount);

    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

inspect();
