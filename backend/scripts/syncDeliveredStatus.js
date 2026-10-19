import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import Order from '../app/models/order.js';

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const res = await Order.updateMany(
    { workflowStatus: 'DELIVERED', status: { $ne: 'delivered' } },
    { $set: { status: 'delivered' } }
  );
  console.log('Synchronized delivered orders:', res);
  await mongoose.disconnect();
}

main().catch(console.error);
