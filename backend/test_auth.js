import mongoose from 'mongoose';
import dns from 'node:dns';

dns.setServers(['8.8.8.8', '8.8.4.4']);

const uri = "mongodb+srv://dipeshgurjer000_db_user:v9S5tCslCEbzllhg@anushkastore.w6bkfrk.mongodb.net/quickcom?retryWrites=true&w=majority&appName=Cluster0";

console.log("Testing Mongoose with 8.8.8.8 DNS + family:4...");

try {
  await mongoose.connect(uri, {
    family: 4,
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
  });
  console.log("SUCCESS! Connected to MongoDB Atlas!");
  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log("Collections count:", collections.length);
  await mongoose.disconnect();
} catch (err) {
  console.error("Mongoose failed:", err);
}
