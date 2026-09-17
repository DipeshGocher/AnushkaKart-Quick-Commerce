const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');
require('dotenv').config({ path: 'c:/Rays software/Appzeto workspace/E-commerce/AnushkaKart/backend/.env' });
const uri = process.env.MONGO_URI;

mongoose.connect(uri).then(async () => {
  const Product = (await import('../backend/app/models/product.js')).default;
  const { getNearbySellerIdsForCustomer } = await import('../backend/app/services/customerVisibilityService.js');

  const lat = 22.71835;
  const lng = 75.87043;
  const nearbySellerIds = await getNearbySellerIdsForCustomer(lat, lng);

  console.log('nearbySellerIds:', nearbySellerIds);

  const query = {
    conditionType: 'refurbished',
    status: 'active',
    $or: [
      { sellerId: { $in: nearbySellerIds } },
      { warehouseId: { $in: nearbySellerIds } }
    ]
  };

  const items = await Product.find(query).lean();
  console.log('FOUND ITEMS WITH LOCATION:', items.length);
  items.forEach(it => console.log('ITEM:', it._id, it.name, it.headerId, it.categoryId, it.conditionType, it.status, it.approvalStatus));

  // Also query without location
  const queryNoLoc = { conditionType: 'refurbished', status: 'active' };
  const itemsNoLoc = await Product.find(queryNoLoc).lean();
  console.log('FOUND ITEMS WITHOUT LOCATION:', itemsNoLoc.length);
  itemsNoLoc.forEach(it => console.log('ITEM NO LOC:', it._id, it.name, it.headerId, it.categoryId, it.conditionType, it.status, it.approvalStatus));

  process.exit(0);
});
