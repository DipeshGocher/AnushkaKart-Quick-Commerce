import dotenv from "dotenv";
import dns from "dns";
import mongoose from "mongoose";
import connectDB from "./app/dbConfig/dbConfig.js";
import Category from "./app/models/category.js";
import Product from "./app/models/product.js";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (e) {}

dotenv.config();

// Curated dictionary of high-resolution stock photos matching grocery & retail categories/products exactly
const IMAGE_MAP = [
  // Fruits & Vegetables
  { keywords: ["avocado"], url: "https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?q=80&w=800&auto=format&fit=crop" },
  { keywords: ["fig"], url: "https://images.unsplash.com/photo-1601379327928-1fed57e437c6?q=80&w=800&auto=format&fit=crop" },
  { keywords: ["lychee"], url: "https://images.unsplash.com/photo-1596701062351-be5f6a45546b?q=80&w=800&auto=format&fit=crop" },
  { keywords: ["pear"], url: "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?q=80&w=800&auto=format&fit=crop" },
  { keywords: ["jackfruit"], url: "https://images.unsplash.com/photo-1569420078235-a45fe70b89f8?q=80&w=800&auto=format&fit=crop" },
  { keywords: ["kiwi"], url: "https://images.unsplash.com/photo-1585059819970-31398d646399?q=80&w=800&auto=format&fit=crop" },
  { keywords: ["mulberry"], url: "https://images.unsplash.com/photo-1563245372-f21724e3856d?q=80&w=800&auto=format&fit=crop" },
  { keywords: ["grapes"], url: "https://images.unsplash.com/photo-1596368708356-6e1e1025ee73?q=80&w=800&auto=format&fit=crop" },
  { keywords: ["lime", "lemon"], url: "https://images.unsplash.com/photo-1534531141161-e4ea27141d1d?q=80&w=800&auto=format&fit=crop" },
  { keywords: ["pineapple"], url: "https://images.unsplash.com/photo-1550258987-190a2d41a8ba?q=80&w=800&auto=format&fit=crop" },
  { keywords: ["plum"], url: "https://images.unsplash.com/photo-1567306301408-9b74779a11af?q=80&w=800&auto=format&fit=crop" },
  { keywords: ["peach"], url: "https://images.unsplash.com/photo-1532704868953-d85f24176d73?q=80&w=800&auto=format&fit=crop" },
  { keywords: ["cherry"], url: "https://images.unsplash.com/photo-1528825871115-3581a5387919?q=80&w=800&auto=format&fit=crop" },
  { keywords: ["narangi", "orange"], url: "https://images.unsplash.com/photo-1547514701-42782101795e?q=80&w=800&auto=format&fit=crop" },
  { keywords: ["cranberry"], url: "https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?q=80&w=800&auto=format&fit=crop" },
  { keywords: ["dragon fruit"], url: "https://images.unsplash.com/photo-1527325678964-54921646f988?q=80&w=800&auto=format&fit=crop" },
  { keywords: ["pomegranate"], url: "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?q=80&w=800&auto=format&fit=crop" },
  { keywords: ["banana"], url: "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?q=80&w=800&auto=format&fit=crop" },
  { keywords: ["apple"], url: "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?q=80&w=800&auto=format&fit=crop" },
  { keywords: ["blueberry"], url: "https://images.unsplash.com/photo-1498557850523-fd3d118b962e?q=80&w=800&auto=format&fit=crop" },
  { keywords: ["watermelon"], url: "https://images.unsplash.com/photo-1587049352847-4a222e784d38?q=80&w=800&auto=format&fit=crop" },
  { keywords: ["fresh fruits", "fruit"], url: "https://images.unsplash.com/photo-1619566636858-adf3ef46400b?q=80&w=800&auto=format&fit=crop" },
  { keywords: ["fresh vegetables", "frozen veg", "hydroponic", "leafies"], url: "https://images.unsplash.com/photo-1540420773420-3366772f4999?q=80&w=800&auto=format&fit=crop" },
  { keywords: ["sprouts"], url: "https://images.unsplash.com/photo-1592417817098-8f3d6ef23a24?q=80&w=800&auto=format&fit=crop" },
  { keywords: ["flowers & leaves"], url: "https://images.unsplash.com/photo-1508615070457-7baeba4003ab?q=80&w=800&auto=format&fit=crop" },
  { keywords: ["fruits & vegetables"], url: "https://images.unsplash.com/photo-1610348725531-843dff563e2c?q=80&w=800&auto=format&fit=crop" },

  // Dairy, Eggs & Bakery
  { keywords: ["paneer", "tofu"], url: "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?q=80&w=800&auto=format&fit=crop" },
  { keywords: ["curd", "yogurt", "yougurt"], url: "https://images.unsplash.com/photo-1488477181946-6428a0291777?q=80&w=800&auto=format&fit=crop" },
  { keywords: ["cream & whitener", "condensed milk", "cream"], url: "https://images.unsplash.com/photo-1550583724-b2692b85b150?q=80&w=800&auto=format&fit=crop" },
  { keywords: ["cheese"], url: "https://images.unsplash.com/photo-1452195100486-9cc805987862?q=80&w=800&auto=format&fit=crop" },
  { keywords: ["milk"], url: "https://images.unsplash.com/photo-1563636619-e9143da7973b?q=80&w=800&auto=format&fit=crop" },
  { keywords: ["butter"], url: "https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?q=80&w=800&auto=format&fit=crop" },
  { keywords: ["ghee"], url: "https://images.unsplash.com/photo-1605640840605-14ac1855827b?q=80&w=800&auto=format&fit=crop" },
  { keywords: ["dairy & breads", "bread & pav", "bread"], url: "https://images.unsplash.com/photo-1509440159596-0249088772ff?q=80&w=800&auto=format&fit=crop" },
  { keywords: ["eggs"], url: "https://images.unsplash.com/photo-1516448620398-c5f44bf9f441?q=80&w=800&auto=format&fit=crop" },
  { keywords: ["cakes", "cake"], url: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?q=80&w=800&auto=format&fit=crop" },

  // Staple Foods & Oils
  { keywords: ["mustard oil", "oil"], url: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?q=80&w=800&auto=format&fit=crop" },
  { keywords: ["atta", "flour", "wheat", "maida", "besan", "sooji"], url: "https://images.unsplash.com/photo-1509440159596-0249088772ff?q=80&w=800&auto=format&fit=crop" },
  { keywords: ["rice", "poha", "daliya", "vermicelli"], url: "https://images.unsplash.com/photo-1586201375761-83865001e31c?q=80&w=800&auto=format&fit=crop" },
  { keywords: ["dal", "rajma", "chhole", "moong", "urad", "toor", "masoor"], url: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?q=80&w=800&auto=format&fit=crop" },
  { keywords: ["aata, dal & rice"], url: "https://images.unsplash.com/photo-1586201375761-83865001e31c?q=80&w=800&auto=format&fit=crop" },
  { keywords: ["salt", "sugar", "jaggery"], url: "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?q=80&w=800&auto=format&fit=crop" },

  // Spices & Condiments
  { keywords: ["masala & spices", "powdered spices", "whole spices", "spices"], url: "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?q=80&w=800&auto=format&fit=crop" },
  { keywords: ["cumin", "jeera", "ajwain", "saunf"], url: "https://images.unsplash.com/photo-1509358271058-acd01cc9386a?q=80&w=800&auto=format&fit=crop" },
  { keywords: ["ketchup", "sauce", "vinegar", "chutney", "pickle"], url: "https://images.unsplash.com/photo-1584947897817-ad708442c325?q=80&w=800&auto=format&fit=crop" },
  { keywords: ["jam & spreads", "peanut butter", "honey", "syrups"], url: "https://images.unsplash.com/photo-1587049352847-4a222e784d38?q=80&w=800&auto=format&fit=crop" },

  // Snacks & Chocolates
  { keywords: ["ferrero", "dairy milk", "kitkat", "chocolate", "chocolates"], url: "https://images.unsplash.com/photo-1511381939415-e44015466834?q=80&w=800&auto=format&fit=crop" },
  { keywords: ["biscuits", "cookies", "rusks", "wafers"], url: "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?q=80&w=800&auto=format&fit=crop" },
  { keywords: ["chips", "crisps", "nachos", "popcorn", "makhana", "namkeen", "bhujia", "bhel"], url: "https://images.unsplash.com/photo-1566478989037-eec170784d0b?q=80&w=800&auto=format&fit=crop" },
  { keywords: ["noodles", "pasta", "soup", "ramen"], url: "https://images.unsplash.com/photo-1612927601601-6638404737ce?q=80&w=800&auto=format&fit=crop" },
  { keywords: ["ice cream", "dessert"], url: "https://images.unsplash.com/photo-1563805042-7684c019e1cb?q=80&w=800&auto=format&fit=crop" },
  { keywords: ["sweets", "mithai"], url: "https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?q=80&w=800&auto=format&fit=crop" },
  { keywords: ["dry fruits", "dates", "nuts", "seeds"], url: "https://images.unsplash.com/photo-1508061252971-380b2a3637e1?q=80&w=800&auto=format&fit=crop" },
  { keywords: ["oats", "muesli", "granola", "cereal"], url: "https://images.unsplash.com/photo-1517673400267-0251440c45dc?q=80&w=800&auto=format&fit=crop" },

  // Drinks & Beverages
  { keywords: ["tea", "green tea", "chai"], url: "https://images.unsplash.com/photo-1576092768241-dec231879fc3?q=80&w=800&auto=format&fit=crop" },
  { keywords: ["coffee", "cold coffe"], url: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?q=80&w=800&auto=format&fit=crop" },
  { keywords: ["hot chocolate"], url: "https://images.unsplash.com/photo-1542990253-0d0f5be5f0ed?q=80&w=800&auto=format&fit=crop" },
  { keywords: ["juices", "juice", "mango drinks"], url: "https://images.unsplash.com/photo-1600271886742-f049cd451bba?q=80&w=800&auto=format&fit=crop" },
  { keywords: ["soft drinks", "soda", "energy drinks"], url: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?q=80&w=800&auto=format&fit=crop" },
  { keywords: ["coconut water"], url: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?q=80&w=800&auto=format&fit=crop" },
  { keywords: ["water & ice"], url: "https://images.unsplash.com/photo-1548839140-29a749e1bc4e?q=80&w=800&auto=format&fit=crop" },

  // Non-Food Categories
  { keywords: ["coolers & fans", "cooler", "fan"], url: "https://images.unsplash.com/photo-1618941721653-9652a233b827?q=80&w=800&auto=format&fit=crop" },
  { keywords: ["iron & more", "iron"], url: "https://images.unsplash.com/photo-1585837575652-267c041d77d4?q=80&w=800&auto=format&fit=crop" },
  { keywords: ["cookware", "kitchen"], url: "https://images.unsplash.com/photo-1584992236310-6edddc08acff?q=80&w=800&auto=format&fit=crop" },
  { keywords: ["cleaning gadgets", "cleaning", "wipe & dry"], url: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?q=80&w=800&auto=format&fit=crop" },
  { keywords: ["tv & mobiles", "electronics", "electronicss"], url: "https://images.unsplash.com/photo-1593784991095-a205069470b6?q=80&w=800&auto=format&fit=crop" },
  { keywords: ["dog food", "cat food", "pet food", "pet grooming", "pet toys", "pet supplies"], url: "https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?q=80&w=800&auto=format&fit=crop" },
  { keywords: ["kids food", "baby food", "kids essentials", "baby wipes", "baby gifting", "kids", "feeding", "nursing", "dispers"], url: "https://images.unsplash.com/photo-1555252333-9f8e92e65df9?q=80&w=800&auto=format&fit=crop" },
  { keywords: ["toys"], url: "https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?q=80&w=800&auto=format&fit=crop" },
  { keywords: ["cricket", "basketball", "swimming", "fitness", "sports"], url: "https://images.unsplash.com/photo-1517649763962-0c623266010b?q=80&w=800&auto=format&fit=crop" },
  { keywords: ["bridal", "wedding"], url: "https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=800&auto=format&fit=crop" },
  { keywords: ["mosturiser", "moisturiser", "creams", "beauty", "skin", "glow", "hygiene", "oral"], url: "https://images.unsplash.com/photo-1556228720-195a672e8a03?q=80&w=800&auto=format&fit=crop" },
  { keywords: ["shirts", "apparel"], url: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?q=80&w=800&auto=format&fit=crop" },
  { keywords: ["grocery", "all"], url: "https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=800&auto=format&fit=crop" }
];

function findMatchingImage(name) {
  if (!name) return "https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=800&auto=format&fit=crop";
  const lower = name.toLowerCase();

  for (const item of IMAGE_MAP) {
    for (const kw of item.keywords) {
      if (lower.includes(kw)) {
        return item.url;
      }
    }
  }

  return "https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=800&auto=format&fit=crop";
}

async function run() {
  await connectDB();

  console.log("=== UPDATING GROCERY CATEGORY IMAGES ===");
  const categories = await Category.find({ catalogType: { $ne: "refurbished" } });
  let catUpdated = 0;

  for (const c of categories) {
    const newImg = findMatchingImage(c.name);
    await Category.updateOne({ _id: c._id }, { $set: { image: newImg } });
    catUpdated++;
    console.log(`[Category] ${c.name} (${c.type}) -> Updated Image`);
  }

  console.log(`\n=== UPDATING GROCERY PRODUCT IMAGES ===`);
  const products = await Product.find({ isRefurbished: { $ne: true } });
  let prodUpdated = 0;

  for (const p of products) {
    const newImg = findMatchingImage(p.name);
    await Product.updateOne(
      { _id: p._id },
      {
        $set: {
          mainImage: newImg,
          image: newImg,
          galleryImages: [newImg, newImg]
        }
      }
    );
    prodUpdated++;
    console.log(`[Product] ${p.name} -> Updated Image`);
  }

  console.log(`\nSuccessfully updated ${catUpdated} Grocery categories and ${prodUpdated} Grocery products!`);
  process.exit(0);
}

run().catch(err => {
  console.error("Error updating grocery images:", err);
  process.exit(1);
});
