import mongoose from 'mongoose';
import dns from 'node:dns';

dns.setServers(['8.8.8.8', '8.8.4.4']);

const directUri = "mongodb://dipeshgurjer000_db_user:v9S5tCslCEbzllhg@ac-q25rini-shard-00-00.w6bkfrk.mongodb.net:27017,ac-q25rini-shard-00-01.w6bkfrk.mongodb.net:27017,ac-q25rini-shard-00-02.w6bkfrk.mongodb.net:27017/quickcom?ssl=true&replicaSet=atlas-ve3y85-shard-0&authSource=admin&retryWrites=true&w=majority";

console.log("Testing direct connection string with replicaSet=atlas-ve3y85-shard-0...");

try {
  await mongoose.connect(directUri, { serverSelectionTimeoutMS: 10000 });
  console.log("🎉 SUCCESS! Connected directly to MongoDB Atlas!");
  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log("Found Collections:", collections.map(c => c.name));
  await mongoose.disconnect();
} catch (err) {
  console.error("Direct connection failed:", err);
}
