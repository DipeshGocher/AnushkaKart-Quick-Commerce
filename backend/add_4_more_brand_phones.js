import dotenv from 'dotenv';
import dns from 'dns';
import mongoose from 'mongoose';
import connectDB from './app/dbConfig/dbConfig.js';
import Category from './app/models/category.js';
import Product from './app/models/product.js';
import Seller from './app/models/seller.js';

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

dotenv.config();

const NEW_PRODUCTS_DATA = {
  Apple: [
    {
      name: "Apple iPhone 15 Plus (128GB) - Blue",
      price: 62999, originalPrice: 89900, grade: "Like New (Superb)", battery: 97, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1695048133142-1a20484d2569?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1695048132960-900824b22f25?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Apple iPhone 15 Pro (256GB) - Natural Titanium",
      price: 84999, originalPrice: 134900, grade: "Grade A (Superb)", battery: 95, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1663499482523-1c0c1bae4ce1?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1663499482512-1f481fec3b57?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1574944985070-8f3ebc6b79d2?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Apple iPhone 14 Plus (128GB) - Purple",
      price: 49999, originalPrice: 79900, grade: "Grade A (Superb)", battery: 92, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1632661674596-df8be070a5c5?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1632661674598-c116c4f346b9?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1605236453806-6ff36851218e?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Apple iPhone 11 (128GB) - White",
      price: 21999, originalPrice: 48900, grade: "Grade B (Good)", battery: 86, warranty: 3,
      images: [
        'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1565849904461-04a58ad377e0?q=80&w=800&auto=format&fit=crop'
      ]
    }
  ],
  Samsung: [
    {
      name: "Samsung Galaxy S24+ (5G, 256GB) - Cobalt Violet",
      price: 69999, originalPrice: 99999, grade: "Like New (Superb)", battery: 98, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1707227184294-8142a781b16c?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1678911820864-e2c567c655d7?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Samsung Galaxy S23 (5G, 128GB) - Cream",
      price: 41999, originalPrice: 74999, grade: "Grade A (Superb)", battery: 94, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1678911820888-eb28532f1709?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1644982647869-e1337f992828?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1580910051074-3eb694886505?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Samsung Galaxy Z Flip 4 (5G, 128GB) - Bora Purple",
      price: 34999, originalPrice: 89999, grade: "Grade A (Superb)", battery: 91, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1628009368231-7bb7cfcb0def?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1610945264803-cda261b667c5?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1565849904461-04a58ad377e0?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Samsung Galaxy M54 5G (128GB) - Dark Blue",
      price: 16999, originalPrice: 29999, grade: "Grade B (Good)", battery: 92, warranty: 3,
      images: [
        'https://images.unsplash.com/photo-1610945264803-cda261b667c5?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1598327105666-5b89351aff97?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1567581935884-3349723552ca?q=80&w=800&auto=format&fit=crop'
      ]
    }
  ],
  Motorola: [
    {
      name: "Motorola Edge 50 Fusion 5G (128GB) - Marshmallow Blue",
      price: 20999, originalPrice: 25999, grade: "Like New (Superb)", battery: 97, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1598327105666-5b89351aff97?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1580910051074-3eb694886505?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1565849904461-04a58ad377e0?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Motorola Edge 40 5G (256GB) - Eclipse Black",
      price: 22999, originalPrice: 34999, grade: "Grade A (Superb)", battery: 94, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1565849904461-04a58ad377e0?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1567581935884-3349723552ca?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1546054454-aa26e2b734c7?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Moto G84 5G (128GB) - Viva Magenta",
      price: 13999, originalPrice: 19999, grade: "Grade A (Superb)", battery: 93, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1567581935884-3349723552ca?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1546054454-aa26e2b734c7?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1585060544812-6b45742d762f?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Moto G24 Power (128GB) - Ink Blue",
      price: 8999, originalPrice: 12999, grade: "Grade B (Good)", battery: 90, warranty: 3,
      images: [
        'https://images.unsplash.com/photo-1546054454-aa26e2b734c7?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1585060544812-6b45742d762f?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1533228876829-65c94e7b5025?q=80&w=800&auto=format&fit=crop'
      ]
    }
  ]
};

async function main() {
  await connectDB();

  let seller = await Seller.findOne({ email: "refurbished.store@anushkakart.com" });
  if (!seller) {
    seller = await Seller.findOne({});
  }

  const mobileHeader = await Category.findOne({ name: "Mobile", type: "header", catalogType: "refurbished" });
  if (!mobileHeader) {
    console.error("Refurbished Mobile header not found!");
    process.exit(1);
  }

  let totalAdded = 0;

  for (const [brandName, productsList] of Object.entries(NEW_PRODUCTS_DATA)) {
    let brandCategory = await Category.findOne({
      name: brandName,
      type: "category",
      catalogType: "refurbished"
    });

    if (!brandCategory) {
      console.error(`Brand category ${brandName} not found!`);
      continue;
    }

    for (let i = 0; i < productsList.length; i++) {
      const item = productsList[i];

      // Check if product already exists
      const existing = await Product.findOne({ name: item.name, isRefurbished: true });
      if (existing) {
        console.log(`Product already exists: ${item.name}`);
        continue;
      }

      const uniqueSlug = item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
      const uniqueSku = 'REF-' + brandName.substring(0, 3).toUpperCase() + '-' + Date.now() + '-' + i;

      const product = new Product({
        name: item.name,
        slug: uniqueSlug,
        sku: uniqueSku,
        description: `Certified refurbished ${item.name}. Passed 32+ rigorous quality checks. Includes ${item.warranty} months warranty, authentic accessories, and 7-day replacement policy.`,
        price: item.originalPrice,
        salePrice: item.price,
        stock: 15,
        brand: brandName,
        conditionType: 'refurbished',
        mainImage: item.images[0],
        galleryImages: item.images,
        headerId: mobileHeader._id,
        categoryId: brandCategory._id,
        subcategoryId: null,
        sellerId: seller._id,
        status: 'active',
        approvalStatus: 'approved',
        isFeatured: true,
        isRefurbished: true,
        highlights: [
          { icon: 'ShieldCheck', label: `${item.warranty} Months Warranty` },
          { icon: 'BatteryCharging', label: `${item.battery}% Battery Health` },
          { icon: 'CheckCircle2', label: '32 Quality Checks Passed' },
          { icon: 'RotateCcw', label: '7-Day Replacement' }
        ],
        refurbishedDetails: {
          grade: item.grade,
          batteryHealth: item.battery,
          warrantyMonths: item.warranty,
          imeiNumber: `358940${Math.floor(100000000 + Math.random() * 900000000)}`,
          qcPassed: true,
          boxItems: ['Smartphone Device', 'Charging Cable', 'SIM Ejector Pin', 'QC Audit Certificate', 'Warranty Card'],
          refurbishedImages: item.images
        }
      });

      await product.save();
      totalAdded++;
      console.log(`Added ${brandName} Phone: ${item.name}`);
    }
  }

  console.log(`\nSuccessfully added ${totalAdded} new mobile products to MongoDB!`);
  process.exit(0);
}

main().catch(err => {
  console.error("Error adding products:", err);
  process.exit(1);
});
