import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dns from 'dns';
import Category from './app/models/category.js';
import Product from './app/models/product.js';
import Seller from './app/models/seller.js';

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  console.log("DNS set warning:", e.message);
}

dotenv.config();

// Curated pool of high-res distinct phone images (Front, Back, Angle)
const BRAND_PRODUCTS_DATA = {
  Apple: [
    {
      name: "Apple iPhone 15 Pro Max (256GB) - Natural Titanium",
      price: 94999, originalPrice: 159900, grade: "Grade A (Superb)", battery: 96, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1695048133142-1a20484d2569?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1695048132960-900824b22f25?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Apple iPhone 15 (128GB) - Blue",
      price: 56999, originalPrice: 79900, grade: "Like New (Superb)", battery: 98, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1695048132960-900824b22f25?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1663499482523-1c0c1bae4ce1?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Apple iPhone 14 Pro (128GB) - Deep Purple",
      price: 71999, originalPrice: 129900, grade: "Grade A (Superb)", battery: 94, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1663499482523-1c0c1bae4ce1?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1663499482512-1f481fec3b57?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1574944985070-8f3ebc6b79d2?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Apple iPhone 14 (128GB) - Midnight Black",
      price: 47999, originalPrice: 69900, grade: "Grade B (Good)", battery: 91, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1663499482512-1f481fec3b57?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1632661674596-df8be070a5c5?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1603891128711-11b4b0320d31?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Apple iPhone 13 (128GB) - Starlight",
      price: 39999, originalPrice: 59900, grade: "Grade A (Superb)", battery: 93, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1632661674596-df8be070a5c5?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1632661674598-c116c4f346b9?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1605236453806-6ff36851218e?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Apple iPhone 13 Mini (128GB) - Pink",
      price: 34999, originalPrice: 64900, grade: "Grade B (Good)", battery: 89, warranty: 3,
      images: [
        'https://images.unsplash.com/photo-1632661674598-c116c4f346b9?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1603891128711-11b4b0320d31?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Apple iPhone 12 Pro (256GB) - Pacific Blue",
      price: 42999, originalPrice: 119900, grade: "Grade A (Superb)", battery: 90, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1603891128711-11b4b0320d31?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1605236453806-6ff36851218e?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1574944985070-8f3ebc6b79d2?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Apple iPhone 12 (64GB) - Purple",
      price: 29999, originalPrice: 49900, grade: "Grade B (Good)", battery: 88, warranty: 3,
      images: [
        'https://images.unsplash.com/photo-1605236453806-6ff36851218e?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1574944985070-8f3ebc6b79d2?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?q=80&w=800&auto=format&fit=crop'
      ]
    },
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
      name: "Samsung Galaxy S24 Ultra (5G, 256GB) - Titanium Gray",
      price: 89999, originalPrice: 129999, grade: "Like New (Superb)", battery: 99, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1707227184294-8142a781b16c?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1678911820864-e2c567c655d7?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Samsung Galaxy S23 Ultra (5G, 256GB) - Phantom Black",
      price: 64999, originalPrice: 124999, grade: "Grade A (Superb)", battery: 95, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1678911820864-e2c567c655d7?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1678911820888-eb28532f1709?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1628009368231-7bb7cfcb0def?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Samsung Galaxy S23 FE (5G, 128GB) - Mint Green",
      price: 32999, originalPrice: 59999, grade: "Grade A (Superb)", battery: 96, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1678911820888-eb28532f1709?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1644982647869-e1337f992828?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1580910051074-3eb694886505?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Samsung Galaxy Z Fold 5 (5G, 512GB) - Icy Blue",
      price: 84999, originalPrice: 164999, grade: "Grade A (Superb)", battery: 94, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1628009368231-7bb7cfcb0def?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1707227184294-8142a781b16c?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Samsung Galaxy Z Flip 5 (5G, 256GB) - Lavender",
      price: 49999, originalPrice: 99999, grade: "Grade A (Superb)", battery: 93, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1644982647869-e1337f992828?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1565849904461-04a58ad377e0?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Samsung Galaxy S22 5G (128GB) - Emerald Green",
      price: 28999, originalPrice: 72999, grade: "Grade B (Good)", battery: 90, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1644982647869-e1337f992828?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1580910051074-3eb694886505?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1610945264803-cda261b667c5?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Samsung Galaxy A54 5G (128GB) - Awesome Violet",
      price: 19999, originalPrice: 38999, grade: "Grade A (Superb)", battery: 95, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1580910051074-3eb694886505?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1565849904461-04a58ad377e0?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1610945264803-cda261b667c5?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Samsung Galaxy S21 FE 5G (128GB) - Olive",
      price: 21999, originalPrice: 54999, grade: "Grade B (Good)", battery: 89, warranty: 3,
      images: [
        'https://images.unsplash.com/photo-1610945264803-cda261b667c5?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1678911820888-eb28532f1709?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1707227184294-8142a781b16c?q=80&w=800&auto=format&fit=crop'
      ]
    },
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
      name: "Motorola Edge 50 Ultra 5G (512GB) - Peach Fuzz",
      price: 44999, originalPrice: 59999, grade: "Like New (Superb)", battery: 99, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1567581935884-3349723552ca?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1546054454-aa26e2b734c7?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Motorola Edge 50 Pro 5G (256GB) - Luxe Lavender",
      price: 24999, originalPrice: 31999, grade: "Grade A (Superb)", battery: 97, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1567581935884-3349723552ca?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1546054454-aa26e2b734c7?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1585060544812-6b45742d762f?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Motorola Razr 40 Ultra (256GB) - Viva Magenta",
      price: 42999, originalPrice: 89999, grade: "Grade A (Superb)", battery: 94, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1546054454-aa26e2b734c7?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1585060544812-6b45742d762f?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1598327105666-5b89351aff97?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Motorola Edge 40 Neo 5G (128GB) - Caneel Bay",
      price: 16999, originalPrice: 23999, grade: "Grade A (Superb)", battery: 95, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1585060544812-6b45742d762f?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1598327105666-5b89351aff97?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1533228876829-65c94e7b5025?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Moto G85 5G (128GB) - Olive Green",
      price: 14499, originalPrice: 18999, grade: "Grade A (Superb)", battery: 98, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1598327105666-5b89351aff97?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1533228876829-65c94e7b5025?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1523206489230-c012c64b2b48?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Moto G64 5G (128GB) - Ice Lilac",
      price: 11999, originalPrice: 14999, grade: "Grade B (Good)", battery: 94, warranty: 3,
      images: [
        'https://images.unsplash.com/photo-1533228876829-65c94e7b5025?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1523206489230-c012c64b2b48?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1574944985070-8f3ebc6b79d2?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Motorola Edge 30 Fusion (128GB) - Solar Gold",
      price: 19999, originalPrice: 42999, grade: "Grade B (Good)", battery: 90, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1523206489230-c012c64b2b48?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1574944985070-8f3ebc6b79d2?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Moto G54 5G (256GB) - Mint Green",
      price: 12999, originalPrice: 18999, grade: "Grade B (Good)", battery: 92, warranty: 3,
      images: [
        'https://images.unsplash.com/photo-1574944985070-8f3ebc6b79d2?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1567581935884-3349723552ca?q=80&w=800&auto=format&fit=crop'
      ]
    },
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
  ],
  OnePlus: [
    {
      name: "OnePlus 12 (5G, 256GB) - Silky Black",
      price: 48999, originalPrice: 64999, grade: "Like New (Superb)", battery: 98, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1678911820888-eb28532f1709?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1644982647869-e1337f992828?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "OnePlus 12R (5G, 256GB) - Cool Blue",
      price: 34999, originalPrice: 45999, grade: "Grade A (Superb)", battery: 97, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1644982647869-e1337f992828?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1580910051074-3eb694886505?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "OnePlus 11 5G (256GB) - Titan Black",
      price: 38999, originalPrice: 61999, grade: "Grade A (Superb)", battery: 94, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1580910051074-3eb694886505?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1565849904461-04a58ad377e0?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "OnePlus 11R 5G (128GB) - Sonic Black",
      price: 24999, originalPrice: 39999, grade: "Grade A (Superb)", battery: 95, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1580910051074-3eb694886505?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1565849904461-04a58ad377e0?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1567581935884-3349723552ca?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "OnePlus Nord 4 (5G, 256GB) - Mercurial Silver",
      price: 26999, originalPrice: 32999, grade: "Grade A (Superb)", battery: 99, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1565849904461-04a58ad377e0?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1567581935884-3349723552ca?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1546054454-aa26e2b734c7?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "OnePlus Nord CE 4 5G (128GB) - Celadon Marble",
      price: 18499, originalPrice: 24999, grade: "Grade A (Superb)", battery: 96, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1567581935884-3349723552ca?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1546054454-aa26e2b734c7?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1585060544812-6b45742d762f?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "OnePlus 10 Pro 5G (256GB) - Emerald Forest",
      price: 29999, originalPrice: 66999, grade: "Grade B (Good)", battery: 91, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1546054454-aa26e2b734c7?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1585060544812-6b45742d762f?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1598327105666-5b89351aff97?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "OnePlus Nord 3 5G (128GB) - Misty Green",
      price: 19999, originalPrice: 33999, grade: "Grade B (Good)", battery: 92, warranty: 3,
      images: [
        'https://images.unsplash.com/photo-1585060544812-6b45742d762f?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1598327105666-5b89351aff97?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1533228876829-65c94e7b5025?q=80&w=800&auto=format&fit=crop'
      ]
    }
  ],
  Xiaomi: [
    {
      name: "Xiaomi 14 5G (512GB) - Jade Green",
      price: 49999, originalPrice: 69999, grade: "Like New (Superb)", battery: 99, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1533228876829-65c94e7b5025?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1523206489230-c012c64b2b48?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1574944985070-8f3ebc6b79d2?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Xiaomi 13 Pro 5G (256GB) - Ceramic Black",
      price: 42999, originalPrice: 79999, grade: "Grade A (Superb)", battery: 94, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1523206489230-c012c64b2b48?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1574944985070-8f3ebc6b79d2?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Redmi Note 13 Pro+ 5G (256GB) - Fusion Purple",
      price: 22999, originalPrice: 31999, grade: "Grade A (Superb)", battery: 96, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1574944985070-8f3ebc6b79d2?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Redmi Note 13 Pro 5G (128GB) - Midnight Black",
      price: 17999, originalPrice: 24999, grade: "Grade A (Superb)", battery: 95, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1695048133142-1a20484d2569?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Redmi Note 13 5G (128GB) - Prism Gold",
      price: 13499, originalPrice: 17999, grade: "Grade A (Superb)", battery: 97, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1695048133142-1a20484d2569?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1663499482523-1c0c1bae4ce1?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Xiaomi 11T Pro 5G (256GB) - Celestial Magic",
      price: 18999, originalPrice: 41999, grade: "Grade B (Good)", battery: 91, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1695048133142-1a20484d2569?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1663499482523-1c0c1bae4ce1?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1632661674596-df8be070a5c5?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Redmi Note 12 Pro 5G (128GB) - Glacier Blue",
      price: 14999, originalPrice: 24999, grade: "Grade B (Good)", battery: 92, warranty: 3,
      images: [
        'https://images.unsplash.com/photo-1663499482523-1c0c1bae4ce1?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1632661674596-df8be070a5c5?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1603891128711-11b4b0320d31?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Redmi 13C 5G (128GB) - Starlight Black",
      price: 9499, originalPrice: 13999, grade: "Grade A (Superb)", battery: 98, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1632661674596-df8be070a5c5?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1603891128711-11b4b0320d31?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1533228876829-65c94e7b5025?q=80&w=800&auto=format&fit=crop'
      ]
    }
  ],
  Realme: [
    {
      name: "Realme GT 6 5G (256GB) - Fluid Silver",
      price: 31999, originalPrice: 40999, grade: "Like New (Superb)", battery: 98, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1603891128711-11b4b0320d31?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1605236453806-6ff36851218e?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1707227184294-8142a781b16c?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Realme GT 6T 5G (256GB) - Razor Green",
      price: 23999, originalPrice: 32999, grade: "Grade A (Superb)", battery: 97, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1605236453806-6ff36851218e?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1707227184294-8142a781b16c?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1678911820864-e2c567c655d7?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Realme 12 Pro+ 5G (256GB) - Submarine Blue",
      price: 21999, originalPrice: 31999, grade: "Grade A (Superb)", battery: 96, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1707227184294-8142a781b16c?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1678911820864-e2c567c655d7?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1628009368231-7bb7cfcb0def?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Realme 12 Pro 5G (128GB) - Navigator Beige",
      price: 17999, originalPrice: 25999, grade: "Grade A (Superb)", battery: 94, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1678911820864-e2c567c655d7?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1628009368231-7bb7cfcb0def?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1644982647869-e1337f992828?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Realme 12+ 5G (128GB) - Pioneer Green",
      price: 14999, originalPrice: 20999, grade: "Grade A (Superb)", battery: 95, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1628009368231-7bb7cfcb0def?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1644982647869-e1337f992828?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1580910051074-3eb694886505?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Realme 11 Pro+ 5G (256GB) - Oasis Green",
      price: 18499, originalPrice: 29999, grade: "Grade B (Good)", battery: 92, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1644982647869-e1337f992828?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1580910051074-3eb694886505?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1565849904461-04a58ad377e0?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Realme Narzo 70 Pro 5G (128GB) - Glass Green",
      price: 13499, originalPrice: 19999, grade: "Grade A (Superb)", battery: 96, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1580910051074-3eb694886505?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1565849904461-04a58ad377e0?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1567581935884-3349723552ca?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Realme P1 Pro 5G (128GB) - Parrot Blue",
      price: 15999, originalPrice: 21999, grade: "Grade A (Superb)", battery: 97, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1565849904461-04a58ad377e0?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1567581935884-3349723552ca?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1546054454-aa26e2b734c7?q=80&w=800&auto=format&fit=crop'
      ]
    }
  ],
  Vivo: [
    {
      name: "Vivo X100 Pro 5G (512GB) - Asteroid Black",
      price: 64999, originalPrice: 89999, grade: "Like New (Superb)", battery: 98, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1546054454-aa26e2b734c7?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1585060544812-6b45742d762f?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1598327105666-5b89351aff97?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Vivo V30 Pro 5G (512GB) - Andaman Blue",
      price: 33999, originalPrice: 46999, grade: "Grade A (Superb)", battery: 97, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1585060544812-6b45742d762f?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1598327105666-5b89351aff97?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1533228876829-65c94e7b5025?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Vivo V30 5G (256GB) - Peacock Green",
      price: 26999, originalPrice: 35999, grade: "Grade A (Superb)", battery: 96, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1598327105666-5b89351aff97?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1533228876829-65c94e7b5025?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1523206489230-c012c64b2b48?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Vivo T3 Pro 5G (128GB) - Emerald Green",
      price: 20999, originalPrice: 27999, grade: "Grade A (Superb)", battery: 98, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1533228876829-65c94e7b5025?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1523206489230-c012c64b2b48?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1574944985070-8f3ebc6b79d2?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Vivo V29 5G (128GB) - Himalayan Blue",
      price: 22499, originalPrice: 32999, grade: "Grade B (Good)", battery: 93, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1523206489230-c012c64b2b48?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1574944985070-8f3ebc6b79d2?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Vivo Y200 5G (128GB) - Desert Gold",
      price: 14999, originalPrice: 21999, grade: "Grade A (Superb)", battery: 95, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1574944985070-8f3ebc6b79d2?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Vivo T2 Pro 5G (128GB) - Dune Gold",
      price: 16999, originalPrice: 23999, grade: "Grade B (Good)", battery: 92, warranty: 3,
      images: [
        'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1546054454-aa26e2b734c7?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Vivo X90 5G (256GB) - Breeze Blue",
      price: 35999, originalPrice: 63999, grade: "Grade B (Good)", battery: 90, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1546054454-aa26e2b734c7?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1585060544812-6b45742d762f?q=80&w=800&auto=format&fit=crop'
      ]
    }
  ],
  Oppo: [
    {
      name: "Oppo Reno 11 Pro 5G (256GB) - Pearl White",
      price: 28999, originalPrice: 39999, grade: "Like New (Superb)", battery: 97, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1695048133142-1a20484d2569?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1663499482523-1c0c1bae4ce1?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1632661674596-df8be070a5c5?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Oppo Reno 11 5G (128GB) - Wave Green",
      price: 22499, originalPrice: 29999, grade: "Grade A (Superb)", battery: 96, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1663499482523-1c0c1bae4ce1?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1632661674596-df8be070a5c5?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1603891128711-11b4b0320d31?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Oppo Find N3 Flip (256GB) - Sleek Black",
      price: 49999, originalPrice: 94999, grade: "Grade A (Superb)", battery: 94, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1632661674596-df8be070a5c5?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1603891128711-11b4b0320d31?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1605236453806-6ff36851218e?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Oppo Reno 10 Pro+ 5G (256GB) - Silvery Grey",
      price: 31999, originalPrice: 54999, grade: "Grade A (Superb)", battery: 93, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1603891128711-11b4b0320d31?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1605236453806-6ff36851218e?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1707227184294-8142a781b16c?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Oppo F25 Pro 5G (128GB) - Lava Red",
      price: 18499, originalPrice: 23999, grade: "Grade A (Superb)", battery: 98, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1605236453806-6ff36851218e?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1707227184294-8142a781b16c?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1678911820864-e2c567c655d7?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Oppo A79 5G (128GB) - Mystery Black",
      price: 13499, originalPrice: 19999, grade: "Grade B (Good)", battery: 94, warranty: 3,
      images: [
        'https://images.unsplash.com/photo-1707227184294-8142a781b16c?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1678911820864-e2c567c655d7?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1628009368231-7bb7cfcb0def?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Oppo Reno 8 Pro 5G (256GB) - Glazed Green",
      price: 23999, originalPrice: 45999, grade: "Grade B (Good)", battery: 90, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1678911820864-e2c567c655d7?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1628009368231-7bb7cfcb0def?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1644982647869-e1337f992828?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Oppo F23 5G (128GB) - Bold Gold",
      price: 15999, originalPrice: 24999, grade: "Grade B (Good)", battery: 91, warranty: 3,
      images: [
        'https://images.unsplash.com/photo-1628009368231-7bb7cfcb0def?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1644982647869-e1337f992828?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1580910051074-3eb694886505?q=80&w=800&auto=format&fit=crop'
      ]
    }
  ],
  iQOO: [
    {
      name: "iQOO 12 5G (256GB) - Legend White",
      price: 44999, originalPrice: 59999, grade: "Like New (Superb)", battery: 98, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1580910051074-3eb694886505?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1565849904461-04a58ad377e0?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "iQOO Neo 9 Pro 5G (256GB) - Fiery Red",
      price: 31999, originalPrice: 39999, grade: "Grade A (Superb)", battery: 96, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1580910051074-3eb694886505?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1565849904461-04a58ad377e0?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1567581935884-3349723552ca?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "iQOO Z9s Pro 5G (128GB) - Flamboyant Orange",
      price: 21999, originalPrice: 28999, grade: "Grade A (Superb)", battery: 97, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1565849904461-04a58ad377e0?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1567581935884-3349723552ca?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1546054454-aa26e2b734c7?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "iQOO Z9 5G (128GB) - Brushed Green",
      price: 15999, originalPrice: 21999, grade: "Grade A (Superb)", battery: 95, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1567581935884-3349723552ca?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1546054454-aa26e2b734c7?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1585060544812-6b45742d762f?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "iQOO 11 5G (256GB) - Alpha Black",
      price: 34999, originalPrice: 61999, grade: "Grade B (Good)", battery: 92, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1546054454-aa26e2b734c7?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1585060544812-6b45742d762f?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1598327105666-5b89351aff97?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "iQOO Neo 7 Pro 5G (128GB) - Fearless Flame",
      price: 25999, originalPrice: 39999, grade: "Grade A (Superb)", battery: 94, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1585060544812-6b45742d762f?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1598327105666-5b89351aff97?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1533228876829-65c94e7b5025?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "iQOO Z7 Pro 5G (128GB) - Blue Lagoon",
      price: 17999, originalPrice: 24999, grade: "Grade B (Good)", battery: 93, warranty: 3,
      images: [
        'https://images.unsplash.com/photo-1598327105666-5b89351aff97?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1533228876829-65c94e7b5025?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1523206489230-c012c64b2b48?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "iQOO Z9x 5G (128GB) - Tornado Green",
      price: 11999, originalPrice: 16999, grade: "Grade A (Superb)", battery: 96, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1533228876829-65c94e7b5025?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1523206489230-c012c64b2b48?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1574944985070-8f3ebc6b79d2?q=80&w=800&auto=format&fit=crop'
      ]
    }
  ],
  'Google Pixel': [
    {
      name: "Google Pixel 8 Pro (5G, 128GB) - Bay Blue",
      price: 59999, originalPrice: 106999, grade: "Like New (Superb)", battery: 97, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1598327105666-5b89351aff97?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1580910051074-3eb694886505?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Google Pixel 8 (5G, 128GB) - Hazel",
      price: 42999, originalPrice: 75999, grade: "Grade A (Superb)", battery: 96, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1580910051074-3eb694886505?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Google Pixel 8a (5G, 128GB) - Aloe Green",
      price: 36999, originalPrice: 52999, grade: "Grade A (Superb)", battery: 98, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1574944985070-8f3ebc6b79d2?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Google Pixel 7 Pro (5G, 128GB) - Obsidian",
      price: 39999, originalPrice: 84999, grade: "Grade A (Superb)", battery: 94, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1574944985070-8f3ebc6b79d2?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1695048133142-1a20484d2569?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Google Pixel 7 (5G, 128GB) - Lemongrass",
      price: 28999, originalPrice: 59999, grade: "Grade B (Good)", battery: 92, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1574944985070-8f3ebc6b79d2?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1695048133142-1a20484d2569?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1663499482523-1c0c1bae4ce1?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Google Pixel 7a (5G, 128GB) - Coral",
      price: 24999, originalPrice: 43999, grade: "Grade A (Superb)", battery: 95, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1695048133142-1a20484d2569?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1663499482523-1c0c1bae4ce1?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1632661674596-df8be070a5c5?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Google Pixel 6 Pro (128GB) - Sorta Sunny",
      price: 27999, originalPrice: 79999, grade: "Grade B (Good)", battery: 89, warranty: 3,
      images: [
        'https://images.unsplash.com/photo-1663499482523-1c0c1bae4ce1?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1632661674596-df8be070a5c5?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1603891128711-11b4b0320d31?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Google Pixel 6a (128GB) - Sage",
      price: 17999, originalPrice: 34999, grade: "Grade B (Good)", battery: 88, warranty: 3,
      images: [
        'https://images.unsplash.com/photo-1632661674596-df8be070a5c5?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1603891128711-11b4b0320d31?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1598327105666-5b89351aff97?q=80&w=800&auto=format&fit=crop'
      ]
    }
  ],
  Nothing: [
    {
      name: "Nothing Phone (2) (5G, 256GB) - Dark Grey",
      price: 31999, originalPrice: 49999, grade: "Like New (Superb)", battery: 97, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Nothing Phone (2a) (5G, 256GB) - White",
      price: 20999, originalPrice: 25999, grade: "Grade A (Superb)", battery: 98, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1580910051074-3eb694886505?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Nothing Phone (2a) Plus (5G, 256GB) - Metallic Grey",
      price: 24999, originalPrice: 29999, grade: "Grade A (Superb)", battery: 99, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1580910051074-3eb694886505?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1565849904461-04a58ad377e0?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Nothing Phone (1) (5G, 256GB) - Black",
      price: 22999, originalPrice: 38999, grade: "Grade A (Superb)", battery: 93, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1580910051074-3eb694886505?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1565849904461-04a58ad377e0?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1567581935884-3349723552ca?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "CMF Phone 1 by Nothing (128GB) - Light Green",
      price: 12999, originalPrice: 15999, grade: "Grade A (Superb)", battery: 100, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1565849904461-04a58ad377e0?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1567581935884-3349723552ca?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1546054454-aa26e2b734c7?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Nothing Phone (2) (128GB) - White",
      price: 28999, originalPrice: 44999, grade: "Grade B (Good)", battery: 94, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1567581935884-3349723552ca?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1546054454-aa26e2b734c7?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1585060544812-6b45742d762f?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Nothing Phone (1) (128GB) - White",
      price: 19999, originalPrice: 33999, grade: "Grade B (Good)", battery: 90, warranty: 3,
      images: [
        'https://images.unsplash.com/photo-1546054454-aa26e2b734c7?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1585060544812-6b45742d762f?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1598327105666-5b89351aff97?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "CMF Phone 1 (256GB) - Orange",
      price: 14999, originalPrice: 17999, grade: "Grade A (Superb)", battery: 98, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1585060544812-6b45742d762f?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1598327105666-5b89351aff97?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1533228876829-65c94e7b5025?q=80&w=800&auto=format&fit=crop'
      ]
    }
  ],
  Poco: [
    {
      name: "Poco F6 5G (256GB) - Titanium Gray",
      price: 24999, originalPrice: 33999, grade: "Like New (Superb)", battery: 98, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1598327105666-5b89351aff97?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1533228876829-65c94e7b5025?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1523206489230-c012c64b2b48?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Poco X6 Pro 5G (256GB) - Racing Yellow",
      price: 21999, originalPrice: 28999, grade: "Grade A (Superb)", battery: 96, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1533228876829-65c94e7b5025?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1523206489230-c012c64b2b48?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1574944985070-8f3ebc6b79d2?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Poco X6 5G (128GB) - Mirror Black",
      price: 15999, originalPrice: 21999, grade: "Grade A (Superb)", battery: 97, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1523206489230-c012c64b2b48?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1574944985070-8f3ebc6b79d2?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Poco F5 5G (256GB) - Electric Blue",
      price: 19999, originalPrice: 29999, grade: "Grade A (Superb)", battery: 93, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1574944985070-8f3ebc6b79d2?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Poco M6 Pro 5G (128GB) - Forest Green",
      price: 10999, originalPrice: 15999, grade: "Grade B (Good)", battery: 94, warranty: 3,
      images: [
        'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1695048133142-1a20484d2569?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Poco C65 (128GB) - Pastel Blue",
      price: 7499, originalPrice: 10999, grade: "Grade A (Superb)", battery: 99, warranty: 6,
      images: [
        'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1695048133142-1a20484d2569?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1663499482523-1c0c1bae4ce1?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Poco X5 Pro 5G (128GB) - Horizon Blue",
      price: 14999, originalPrice: 22999, grade: "Grade B (Good)", battery: 91, warranty: 3,
      images: [
        'https://images.unsplash.com/photo-1695048133142-1a20484d2569?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1663499482523-1c0c1bae4ce1?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1632661674596-df8be070a5c5?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: "Poco M6 5G (128GB) - Galactic Black",
      price: 8999, originalPrice: 12999, grade: "Grade B (Good)", battery: 95, warranty: 3,
      images: [
        'https://images.unsplash.com/photo-1663499482523-1c0c1bae4ce1?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1632661674596-df8be070a5c5?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1603891128711-11b4b0320d31?q=80&w=800&auto=format&fit=crop'
      ]
    }
  ]
};

async function seedRefurbishedPhones() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB!");

    // 1. Get Mobile Header Category
    let mobileHeader = await Category.findOne({ name: 'Mobile', catalogType: 'refurbished' });
    if (!mobileHeader) {
      mobileHeader = await Category.create({
        name: 'Mobile',
        slug: 'refurbished-mobile-' + Date.now(),
        type: 'header',
        catalogType: 'refurbished',
        status: 'active'
      });
      console.log("Created Mobile Header Category");
    }

    // 2. Find seller
    const seller = await Seller.findOne({ email: 'harsh@appzeto.com' }) || await Seller.findOne({});
    if (!seller) {
      console.error("No seller found in MongoDB!");
      process.exit(1);
    }
    console.log("Using seller ID:", seller._id);

    // 3. Delete old refurbished items to re-seed cleanly
    const deletedCount = await Product.deleteMany({ conditionType: 'refurbished' });
    console.log(`Cleared ${deletedCount.deletedCount} old refurbished products.`);

    let totalCreated = 0;

    // 4. Seed products with unique images
    for (const [brandName, productsList] of Object.entries(BRAND_PRODUCTS_DATA)) {
      let brandCategory = await Category.findOne({
        name: brandName,
        catalogType: 'refurbished'
      });

      if (!brandCategory) {
        brandCategory = await Category.create({
          name: brandName,
          slug: `refurbished-brand-${brandName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`,
          type: 'category',
          catalogType: 'refurbished',
          parentId: mobileHeader._id,
          status: 'active'
        });
        console.log(`Created Brand Category: ${brandName}`);
      }

      for (let i = 0; i < productsList.length; i++) {
        const item = productsList[i];
        const uniqueSlug = item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
        const uniqueSku = 'REF-' + brandName.substring(0, 3).toUpperCase() + '-' + Date.now() + '-' + i;

        const mainImage = item.images[0];
        const galleryImages = item.images;

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
          mainImage: mainImage,
          galleryImages: galleryImages,
          headerId: mobileHeader._id,
          categoryId: brandCategory._id,
          subcategoryId: null,
          sellerId: seller._id,
          status: 'active',
          approvalStatus: 'approved',
          isFeatured: i < 3,
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
            refurbishedImages: galleryImages
          }
        });

        await product.save();
        totalCreated++;
      }
      console.log(`Successfully seeded ${productsList.length} products with unique images for brand: ${brandName}`);
    }

    console.log(`\n🎉 SEEDING COMPLETE! Total refurbished phones created with unique images: ${totalCreated}`);
    process.exit(0);
  } catch (err) {
    console.error("Seeding Error:", err);
    process.exit(1);
  }
}

seedRefurbishedPhones();
