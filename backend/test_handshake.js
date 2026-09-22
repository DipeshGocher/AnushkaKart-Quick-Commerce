import { MongoClient } from 'mongodb';
import dns from 'node:dns';

dns.setServers(['8.8.8.8', '8.8.4.4']);

const uri = "mongodb+srv://dipeshgurjer000_db_user:v9S5tCslCEbzllhg@anushkastore.w6bkfrk.mongodb.net/quickcom?retryWrites=true&w=majority&appName=Cluster0";

const client = new MongoClient(uri, {
  serverSelectionTimeoutMS: 5000,
});

client.on('serverDescriptionChanged', (event) => {
  console.log(`Server changed ${event.address}:`, event.newDescription.error || 'No error');
});

try {
  console.log("Connecting with MongoClient...");
  await client.connect();
  console.log("SUCCESS! Connected to MongoDB Atlas!");
  const db = client.db('quickcom');
  const collections = await db.listCollections().toArray();
  console.log("Collections:", collections.map(c => c.name));
  await client.close();
} catch (err) {
  console.error("MongoClient connection error:", err);
}
