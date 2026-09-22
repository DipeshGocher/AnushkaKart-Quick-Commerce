import mongoose from 'mongoose';
import dns from 'node:dns';

const uri = "mongodb+srv://dipeshgurjer000_db_user:v9S5tCslCEbzllhg@anushkastore.w6bkfrk.mongodb.net/quickcom?retryWrites=true&w=majority&appName=Cluster0";

console.log("Testing default DNS connection...");
try {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  console.log("SUCCESS! Connected to MongoDB Atlas with default DNS!");
  await mongoose.disconnect();
} catch (err) {
  console.error("Default DNS failed:", err.message);
  
  console.log("Testing with 8.8.8.8 DNS...");
  dns.setServers(['8.8.8.8', '8.8.4.4']);
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log("SUCCESS! Connected to MongoDB Atlas with 8.8.8.8 DNS!");
    await mongoose.disconnect();
  } catch (err2) {
    console.error("8.8.8.8 DNS failed:", err2.message);
  }
}
