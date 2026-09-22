/**
 * C2C Marketplace Mock Data & LocalStorage Store
 * Powers the OLX-style C2C module with realistic listings, categories, sellers, and chats.
 */

const STORAGE_KEY_ADS = 'c2c_marketplace_ads';
const STORAGE_KEY_FAVORITES = 'c2c_marketplace_favorites';
const STORAGE_KEY_CHATS = 'c2c_marketplace_chats';

export const C2C_CATEGORIES = [
  { 
    id: 'mobiles', 
    name: 'Mobile', 
    icon: '📱', 
    image: 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=200&auto=format&fit=crop&q=80',
    subCategories: [
      { id: 'mobiles-smartphones', name: 'Smartphones & iPhones', image: 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=200&auto=format&fit=crop&q=80' },
      { id: 'mobiles-tablets', name: 'Tablets & iPads', image: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=200&auto=format&fit=crop&q=80' },
      { id: 'mobiles-accessories', name: 'Accessories & Chargers', image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=200&auto=format&fit=crop&q=80' },
      { id: 'mobiles-feature', name: 'Feature Phones', image: 'https://images.unsplash.com/photo-1580910051074-3eb694886505?w=200&auto=format&fit=crop&q=80' },
    ]
  },
  { 
    id: 'laptops', 
    name: 'Laptop', 
    icon: '💻', 
    image: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=200&auto=format&fit=crop&q=80',
    subCategories: [
      { id: 'laptop-notebooks', name: 'Laptops & Notebooks', image: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=200&auto=format&fit=crop&q=80' },
      { id: 'laptop-gaming', name: 'Gaming Laptops', image: 'https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=200&auto=format&fit=crop&q=80' },
      { id: 'laptop-desktops', name: 'Desktop PCs & Monitors', image: 'https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?w=200&auto=format&fit=crop&q=80' },
      { id: 'laptop-accessories', name: 'Computer Accessories', image: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=200&auto=format&fit=crop&q=80' },
    ]
  },
  { 
    id: 'smartwatches', 
    name: 'SmartWatch', 
    icon: '⌚', 
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200&auto=format&fit=crop&q=80',
    subCategories: [
      { id: 'watch-apple', name: 'Apple Watch', image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200&auto=format&fit=crop&q=80' },
      { id: 'watch-android', name: 'Android Smartwatches', image: 'https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=200&auto=format&fit=crop&q=80' },
      { id: 'watch-fitness', name: 'Fitness Bands & Trackers', image: 'https://images.unsplash.com/photo-1575311373937-040b8e1fd5b6?w=200&auto=format&fit=crop&q=80' },
      { id: 'watch-straps', name: 'Smartwatch Straps & Dials', image: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=200&auto=format&fit=crop&q=80' },
    ]
  },
  { 
    id: 'earphones', 
    name: 'Earphones', 
    icon: '🎧', 
    image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=200&auto=format&fit=crop&q=80',
    subCategories: [
      { id: 'ear-tws', name: 'TWS Earbuds & AirPods', image: 'https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?w=200&auto=format&fit=crop&q=80' },
      { id: 'ear-headphones', name: 'Over-Ear Headphones', image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200&auto=format&fit=crop&q=80' },
      { id: 'ear-neckbands', name: 'Bluetooth Neckbands', image: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=200&auto=format&fit=crop&q=80' },
      { id: 'ear-speakers', name: 'Bluetooth Speakers', image: 'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=200&auto=format&fit=crop&q=80' },
    ]
  },
  { 
    id: 'cameras', 
    name: 'Camera', 
    icon: '📷', 
    image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=200&auto=format&fit=crop&q=80',
    subCategories: [
      { id: 'cam-dslr', name: 'DSLR & Mirrorless', image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=200&auto=format&fit=crop&q=80' },
      { id: 'cam-action', name: 'Action Cameras (GoPro)', image: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=200&auto=format&fit=crop&q=80' },
      { id: 'cam-lenses', name: 'Camera Lenses & Filters', image: 'https://images.unsplash.com/photo-1617005082133-548c4dd27f35?w=200&auto=format&fit=crop&q=80' },
      { id: 'cam-tripods', name: 'Gimbals & Tripods', image: 'https://images.unsplash.com/photo-1502982720700-bfff97f2da6d?w=200&auto=format&fit=crop&q=80' },
    ]
  },
  { 
    id: 'tv', 
    name: 'TV', 
    icon: '📺', 
    image: 'https://images.unsplash.com/photo-1593784991095-a205069470b6?w=200&auto=format&fit=crop&q=80',
    subCategories: [
      { id: 'tv-smart', name: 'Smart & OLED TVs', image: 'https://images.unsplash.com/photo-1593784991095-a205069470b6?w=200&auto=format&fit=crop&q=80' },
      { id: 'tv-streaming', name: 'Streaming Devices (FireStick)', image: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=200&auto=format&fit=crop&q=80' },
      { id: 'tv-audio', name: 'Soundbars & Theatres', image: 'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=200&auto=format&fit=crop&q=80' },
      { id: 'tv-projectors', name: 'Projectors & Screens', image: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=200&auto=format&fit=crop&q=80' },
    ]
  },
  { 
    id: 'gaming', 
    name: 'Gaming', 
    icon: '🎮', 
    image: 'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?w=200&auto=format&fit=crop&q=80',
    subCategories: [
      { id: 'game-playstation', name: 'PlayStation (PS5 & PS4)', image: 'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?w=200&auto=format&fit=crop&q=80' },
      { id: 'game-xbox', name: 'Xbox Series X / S', image: 'https://images.unsplash.com/photo-1621259182978-fbf93132d53d?w=200&auto=format&fit=crop&q=80' },
      { id: 'game-nintendo', name: 'Nintendo Switch', image: 'https://images.unsplash.com/photo-1578303512597-81e6cc155b3e?w=200&auto=format&fit=crop&q=80' },
      { id: 'game-accessories', name: 'Controllers & Discs', image: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=200&auto=format&fit=crop&q=80' },
    ]
  },
  { 
    id: 'appliances', 
    name: 'Appliances', 
    icon: '⚡', 
    image: 'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?w=200&auto=format&fit=crop&q=80',
    subCategories: [
      { id: 'app-kitchen', name: 'Kitchen Appliances', image: 'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?w=200&auto=format&fit=crop&q=80' },
      { id: 'app-cooling', name: 'ACs & Air Coolers', image: 'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?w=200&auto=format&fit=crop&q=80' },
      { id: 'app-refrigerators', name: 'Refrigerators', image: 'https://images.unsplash.com/photo-1584992236310-6edddc08acff?w=200&auto=format&fit=crop&q=80' },
      { id: 'app-washing', name: 'Washing Machines', image: 'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?w=200&auto=format&fit=crop&q=80' },
    ]
  },
];

export const INITIAL_C2C_ADS = [
  {
    id: 'c2c-1',
    title: 'iPhone 14 Pro Max 256GB Deep Purple (Like New)',
    price: 68500,
    originalPrice: 139900,
    category: 'mobiles',
    categoryName: 'Mobiles',
    condition: 'Like New',
    location: 'Vijay Nagar, Indore',
    city: 'Indore',
    postedAt: 'Today',
    images: [
      'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=800&auto=format&fit=crop&q=80',
    ],
    description: 'iPhone 14 Pro Max 256GB in pristine condition with 91% battery health. Comes with original Apple box, USB-C to Lightning cable, and bill. Always used with screen protector and case. No scratches or dents. Testing on spot welcome.',
    seller: {
      id: 'seller-1',
      name: 'Aman Verma',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80',
      memberSince: 'Oct 2023',
      verified: true,
      phone: '+91 98260 XXXXX',
      rating: 4.9,
      totalAds: 4,
    },
    specs: {
      'Brand': 'Apple',
      'Model': 'iPhone 14 Pro Max',
      'Storage': '256 GB',
      'RAM': '6 GB',
      'Battery Health': '91%',
      'Bill & Box': 'Available',
      'Warranty': 'Expired',
    },
    isElite: true,
    views: 412,
  },
  {
    id: 'c2c-2',
    title: 'Apple Watch Ultra 2 (GPS + Cellular, 49mm Titanium) Trail Loop',
    price: 54000,
    originalPrice: 89900,
    category: 'smartwatches',
    subCategory: 'Apple Watch',
    categoryName: 'SmartWatch',
    condition: 'Like New',
    location: 'Palasia, Indore',
    city: 'Indore',
    postedAt: '2 days ago',
    images: [
      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=800&auto=format&fit=crop&q=80',
    ],
    description: 'Apple Watch Ultra 2 in mint condition with 49mm aerospace-grade titanium case. 100% battery health, original magnetic fast charger, and box. Supports cellular connectivity and precision dual-frequency GPS.',
    seller: {
      id: 'seller-2',
      name: 'Vikram Rajput',
      avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=120&auto=format&fit=crop&q=80',
      memberSince: 'Jan 2024',
      verified: true,
      phone: '+91 97550 XXXXX',
      rating: 4.8,
      totalAds: 2,
    },
    specs: {
      'Brand': 'Apple',
      'Model': 'Watch Ultra 2',
      'Case': '49mm Titanium',
      'Connectivity': 'GPS + Cellular',
      'Battery Health': '100%',
      'Strap': 'Orange/Beige Trail Loop',
    },
    isElite: true,
    views: 890,
  },
  {
    id: 'c2c-3',
    title: 'MacBook Air M2 (8GB RAM / 256GB SSD) Midnight',
    price: 64999,
    originalPrice: 114900,
    category: 'laptops',
    subCategory: 'Laptops & Notebooks',
    categoryName: 'Laptop',
    condition: 'Like New',
    location: 'Bhawarkua, Indore',
    city: 'Indore',
    postedAt: 'Yesterday',
    images: [
      'https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&auto=format&fit=crop&q=80',
    ],
    description: 'Purchased for college coding projects. Battery cycle count only 42, 100% capacity. Includes MagSafe charger, braided cable, box, and bill. Selling because upgraded to office laptop.',
    seller: {
      id: 'seller-3',
      name: 'Sneha Patel',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80',
      memberSince: 'Mar 2024',
      verified: true,
      phone: '+91 88780 XXXXX',
      rating: 5.0,
      totalAds: 1,
    },
    specs: {
      'Processor': 'Apple M2 8-Core',
      'RAM': '8 GB Unified',
      'Storage': '256 GB NVMe SSD',
      'Display': '13.6-inch Liquid Retina',
      'Battery Cycles': '42 Cycles',
    },
    isElite: false,
    views: 320,
  },
  {
    id: 'c2c-4',
    title: 'Sony Alpha 7 III Mirrorless Camera + 28-70mm Lens Kit',
    price: 84000,
    originalPrice: 161990,
    category: 'cameras',
    subCategory: 'DSLR & Mirrorless',
    categoryName: 'Camera',
    condition: 'Like New',
    location: 'Chandan Nagar, Indore',
    city: 'Indore',
    postedAt: '3 days ago',
    images: [
      'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1502982720700-bfff97f2da6d?w=800&auto=format&fit=crop&q=80',
    ],
    description: 'Full-frame Sony Alpha A7 III mirrorless digital camera in pristine condition. Low shutter count of 4,200. Comes with 28-70mm OSS lens, 2 original Sony batteries, 64GB high-speed SD card, and camera bag.',
    seller: {
      id: 'seller-4',
      name: 'Mohit Agrawal',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
      memberSince: 'Dec 2022',
      verified: true,
      phone: '+91 94250 XXXXX',
      rating: 4.8,
      totalAds: 3,
    },
    specs: {
      'Brand': 'Sony',
      'Model': 'Alpha 7 III (ILCE-7M3K)',
      'Sensor': '24.2 MP Full-Frame Exmor R CMOS',
      'Lens': 'FE 28-70mm F3.5-5.6 OSS',
      'Shutter Count': '4,200',
    },
    isElite: true,
    views: 615,
  },
  {
    id: 'c2c-5',
    title: 'Sony PlayStation 5 Disc Edition + 2 Controllers',
    price: 36000,
    originalPrice: 54990,
    category: 'gaming',
    subCategory: 'PlayStation (PS5 & PS4)',
    categoryName: 'Gaming',
    condition: 'Like New',
    location: 'Geeta Bhawan, Indore',
    city: 'Indore',
    postedAt: 'Today',
    images: [
      'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=800&auto=format&fit=crop&q=80',
    ],
    description: 'Sony PS5 Disc Edition in mint condition. Includes 2 DualSense wireless controllers, HDMI cable, power cord, and 2 game discs (Spider-Man 2 and GTA V). Tested and working 100%.',
    seller: {
      id: 'seller-5',
      name: 'Rohan Joshi',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80',
      memberSince: 'Feb 2024',
      verified: true,
      phone: '+91 91110 XXXXX',
      rating: 4.9,
      totalAds: 2,
    },
    specs: {
      'Edition': 'Disc Edition',
      'Storage': '825 GB High Speed SSD',
      'Accessories': '2 DualSense Controllers',
      'Games Included': 'Spider-Man 2 + GTA V',
    },
    isElite: true,
    views: 650,
  },
  {
    id: 'c2c-6',
    title: 'Samsung Galaxy S23 Ultra 5G (12GB/256GB) Phantom Black',
    price: 52000,
    originalPrice: 124999,
    category: 'mobiles',
    categoryName: 'Mobiles',
    condition: 'Like New',
    location: 'Annapurna, Indore',
    city: 'Indore',
    postedAt: '4 days ago',
    images: [
      'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1580910051074-3eb694886505?w=800&auto=format&fit=crop&q=80',
    ],
    description: 'Samsung S23 Ultra with S-Pen. 200MP camera produces stunning clarity. 5000mAh battery lasts 1.5 days. Original box and bill available. Tempered glass applied from Day 1.',
    seller: {
      id: 'seller-6',
      name: 'Deepak Sharma',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&auto=format&fit=crop&q=80',
      memberSince: 'Jun 2023',
      verified: true,
      phone: '+91 99260 XXXXX',
      rating: 4.7,
      totalAds: 1,
    },
    specs: {
      'Brand': 'Samsung',
      'Model': 'Galaxy S23 Ultra',
      'RAM': '12 GB',
      'Storage': '256 GB',
      'Camera': '200MP + 10x Optical Zoom',
      'Stylus': 'Original S-Pen Included',
    },
    isElite: false,
    views: 480,
  },
  {
    id: 'c2c-7',
    title: 'Samsung Galaxy S22 Ultra 5G (Phantom Black 12GB/256GB)',
    price: 31000,
    originalPrice: 109999,
    category: 'mobiles',
    subCategory: 'Mobile Phones',
    categoryName: 'Mobiles',
    condition: 'Like New',
    location: 'Pipaliyahana',
    city: 'Indore',
    postedAt: '25 August',
    isFeatured: true,
    images: [
      'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1580910051074-3eb694886505?w=800&auto=format&fit=crop&q=80'
    ],
    description: 'Samsung Galaxy S22 Ultra 12GB RAM 256GB storage in Phantom Black. S-Pen included, flawless display with 120Hz AMOLED. Bill, box, and fast charger included.',
    seller: {
      id: 'seller-7',
      name: 'Rohan Malviya',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80',
      memberSince: 'Jul 2021',
      verified: true,
      phone: '+91 98270 XXXXX',
      rating: 4.9,
      totalAds: 3,
    },
    specs: {
      'Brand': 'Samsung',
      'Model': 'Galaxy S22 Ultra',
      'RAM': '12 GB',
      'Storage': '256 GB',
      'Condition': 'Flawless with S-Pen',
    },
    isElite: true,
    views: 920,
  },
  {
    id: 'c2c-8',
    title: 'S22 ultra display cracked',
    price: 14999,
    originalPrice: 109999,
    category: 'mobiles',
    subCategory: 'Mobile Phones',
    categoryName: 'Mobiles',
    condition: 'Display Cracked',
    location: 'Kailash Park',
    city: 'Indore',
    postedAt: '21 September',
    isFeatured: false,
    images: [
      'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1580910051074-3eb694886505?w=800&auto=format&fit=crop&q=80'
    ],
    description: 'S22 Ultra with minor glass crack at bottom right corner. Touch works 100% smoothly across entire screen, all cameras, stylus and motherboard in perfect running condition. Selling as-is.',
    seller: {
      id: 'seller-8',
      name: 'Kunal Sharma',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
      memberSince: 'Jan 2022',
      verified: false,
      phone: '+91 94250 XXXXX',
      rating: 4.5,
      totalAds: 1,
    },
    specs: {
      'Brand': 'Samsung',
      'Model': 'Galaxy S22 Ultra',
      'RAM': '12 GB',
      'Storage': '256 GB',
      'Issue': 'Display glass crack (touch works)',
    },
    isElite: false,
    views: 640,
  },
  {
    id: 'c2c-9',
    title: 'iPhone 12 128GB Blue (Battery 88%, Box Available)',
    price: 24500,
    originalPrice: 69900,
    category: 'mobiles',
    subCategory: 'Mobile Phones',
    categoryName: 'Mobiles',
    condition: 'Like New',
    location: 'Palasia, Indore',
    city: 'Indore',
    postedAt: '18 September',
    isFeatured: true,
    images: [
      'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=800&auto=format&fit=crop&q=80'
    ],
    description: 'Apple iPhone 12 128GB in Pacific Blue. Original box, brand new cable, tempered glass and Spigen cover. Battery health 88%, FaceID and true tone perfectly working.',
    seller: {
      id: 'seller-9',
      name: 'Ashwin Joshi',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80',
      memberSince: 'Mar 2023',
      verified: true,
      phone: '+91 97550 XXXXX',
      rating: 4.8,
      totalAds: 2,
    },
    specs: {
      'Brand': 'Apple',
      'Model': 'iPhone 12',
      'Storage': '128 GB',
      'Battery': '88%',
    },
    isElite: true,
    views: 780,
  },
  {
    id: 'c2c-10',
    title: 'iPhone 12 Mini 64GB Black (Single Hand Used)',
    price: 19500,
    originalPrice: 59900,
    category: 'mobiles',
    subCategory: 'Mobile Phones',
    categoryName: 'Mobiles',
    condition: 'Good',
    location: 'Bhawarkua, Indore',
    city: 'Indore',
    postedAt: '15 September',
    isFeatured: false,
    images: [
      'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=800&auto=format&fit=crop&q=80'
    ],
    description: 'Compact iPhone 12 Mini in Black. Excellent pocket size, 64GB storage, battery 84%. Comes with original invoice and box.',
    seller: {
      id: 'seller-10',
      name: 'Pooja Tiwari',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80',
      memberSince: 'Aug 2023',
      verified: true,
      phone: '+91 91110 XXXXX',
      rating: 4.7,
      totalAds: 1,
    },
    specs: {
      'Brand': 'Apple',
      'Model': 'iPhone 12 Mini',
      'Storage': '64 GB',
      'Battery': '84%',
    },
    isElite: false,
    views: 450,
  },
  {
    id: 'c2c-11',
    title: 'Acer Nitro 5 Gaming Laptop (RTX 3050 / 16GB RAM / 512GB SSD)',
    price: 42000,
    originalPrice: 78990,
    category: 'electronics',
    subCategory: 'Computers & Laptops',
    categoryName: 'Electronics & Appliances',
    condition: 'Like New',
    location: 'Vijay Nagar, Indore',
    city: 'Indore',
    postedAt: '19 September',
    isFeatured: true,
    images: [
      'https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=800&auto=format&fit=crop&q=80'
    ],
    description: 'Acer Nitro 5 Gaming Laptop with Intel Core i5 11th Gen, NVIDIA GeForce RTX 3050 (4GB GDDR6), 16GB DDR4 RAM, 512GB NVMe SSD, 144Hz FHD IPS display, RGB keyboard. Runs GTA V, Valorant, Cyberpunk with high FPS. 180W original charger included.',
    seller: {
      id: 'seller-11',
      name: 'Aditya Rajput',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80',
      memberSince: 'Nov 2022',
      verified: true,
      phone: '+91 98930 XXXXX',
      rating: 4.9,
      totalAds: 2,
    },
    specs: {
      'Brand': 'Acer',
      'Model': 'Nitro 5 AN515',
      'GPU': 'NVIDIA RTX 3050 (4GB)',
      'RAM': '16 GB',
      'Storage': '512 GB NVMe SSD',
      'Screen': '15.6" 144Hz FHD',
    },
    isElite: true,
    views: 1100,
  },
  {
    id: 'c2c-11',
    title: 'Acer Nitro 5 Gaming Laptop (RTX 3050 / 16GB RAM / 512GB SSD)',
    price: 42000,
    originalPrice: 78990,
    category: 'laptops',
    subCategory: 'Gaming Laptops',
    categoryName: 'Laptop',
    condition: 'Like New',
    location: 'Vijay Nagar, Indore',
    city: 'Indore',
    postedAt: '19 September',
    isFeatured: true,
    images: [
      'https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=800&auto=format&fit=crop&q=80'
    ],
    description: 'Acer Nitro 5 Gaming Laptop with Intel Core i5 11th Gen, NVIDIA GeForce RTX 3050 (4GB GDDR6), 16GB DDR4 RAM, 512GB NVMe SSD, 144Hz FHD IPS display, RGB keyboard. Runs GTA V, Valorant, Cyberpunk with high FPS. 180W original charger included.',
    seller: {
      id: 'seller-11',
      name: 'Aditya Rajput',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80',
      memberSince: 'Nov 2022',
      verified: true,
      phone: '+91 98930 XXXXX',
      rating: 4.9,
      totalAds: 2,
    },
    specs: {
      'Brand': 'Acer',
      'Model': 'Nitro 5 AN515',
      'GPU': 'NVIDIA RTX 3050 (4GB)',
      'RAM': '16 GB',
      'Storage': '512 GB NVMe SSD',
      'Screen': '15.6" 144Hz FHD',
    },
    isElite: true,
    views: 1100,
  },
  {
    id: 'c2c-12',
    title: 'Acer Aspire 7 Intel Core i5 12th Gen Laptop (512GB SSD)',
    price: 32500,
    originalPrice: 62000,
    category: 'laptops',
    subCategory: 'Laptops & Notebooks',
    categoryName: 'Laptop',
    condition: 'Good',
    location: 'Geeta Bhawan, Indore',
    city: 'Indore',
    postedAt: '12 September',
    isFeatured: false,
    images: [
      'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&auto=format&fit=crop&q=80'
    ],
    description: 'Acer Aspire 7 thin and lightweight performance laptop. GTX 1650 graphics, 8GB RAM, 512GB SSD. Perfect for coding, graphic design, and video editing. 6 hours battery life.',
    seller: {
      id: 'seller-12',
      name: 'Naveen Chouhan',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&auto=format&fit=crop&q=80',
      memberSince: 'Apr 2023',
      verified: true,
      phone: '+91 94066 XXXXX',
      rating: 4.6,
      totalAds: 1,
    },
    specs: {
      'Brand': 'Acer',
      'Model': 'Aspire 7',
      'CPU': 'Intel Core i5-1240P',
      'RAM': '8 GB DDR4',
      'Storage': '512 GB SSD',
    },
    isElite: false,
    views: 520,
  },
  {
    id: 'c2c-13',
    title: 'Dell Inspiron 15 3520 (Core i3, 8GB RAM, 512GB SSD)',
    price: 23000,
    originalPrice: 42000,
    category: 'laptops',
    subCategory: 'Laptops & Notebooks',
    categoryName: 'Laptop',
    condition: 'Like New',
    location: 'Annapurna, Indore',
    city: 'Indore',
    postedAt: '5 September',
    isFeatured: false,
    images: [
      'https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=800&auto=format&fit=crop&q=80'
    ],
    description: 'Dell 15.6 inch laptop with Anti-Glare Full HD display, Windows 11 Home + MS Office 2021 pre-installed. Excellent condition without single mark. Best for college or office work.',
    seller: {
      id: 'seller-13',
      name: 'Harish Mehta',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
      memberSince: 'May 2023',
      verified: true,
      phone: '+91 98260 XXXXX',
      rating: 4.7,
      totalAds: 1,
    },
    specs: {
      'Brand': 'Dell',
      'Model': 'Inspiron 3520',
      'RAM': '8 GB',
      'Storage': '512 GB SSD',
    },
    isElite: false,
    views: 310,
  },
  {
    id: 'c2c-14',
    title: 'Sony WH-1000XM5 Wireless Noise Cancelling Headphones (Silver)',
    price: 19500,
    originalPrice: 34990,
    category: 'earphones',
    subCategory: 'Over-Ear Headphones',
    categoryName: 'Earphones',
    condition: 'Like New',
    location: 'Palasia, Indore',
    city: 'Indore',
    postedAt: 'Just now',
    isFeatured: true,
    images: [
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800&auto=format&fit=crop&q=80'
    ],
    description: 'Sony WH-1000XM5 flagship noise-cancelling headphones in Silver. Industry leading Active Noise Cancellation with 30-hour battery life. Includes original carrying case, 3.5mm cable, and box. Barely used 2 weeks.',
    seller: {
      id: 'seller-14',
      name: 'Priya Rathore',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80',
      memberSince: 'Aug 2023',
      verified: true,
      phone: '+91 98935 XXXXX',
      rating: 4.9,
      totalAds: 1,
    },
    specs: {
      'Brand': 'Sony',
      'Model': 'WH-1000XM5',
      'ANC': 'Auto NC Optimizer with 8 Microphones',
      'Battery': '30 Hours',
      'Color': 'Silver Platinum',
    },
    isElite: true,
    views: 430,
  },
  {
    id: 'c2c-15',
    title: 'LG 55-inch 4K Ultra HD Smart OLED evo TV (with Magic Remote)',
    price: 58000,
    originalPrice: 129990,
    category: 'tv',
    subCategory: 'Smart & OLED TVs',
    categoryName: 'TV',
    condition: 'Like New',
    location: 'Vijay Nagar, Indore',
    city: 'Indore',
    postedAt: 'Yesterday',
    isFeatured: true,
    images: [
      'https://images.unsplash.com/photo-1593784991095-a205069470b6?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=800&auto=format&fit=crop&q=80'
    ],
    description: 'LG 55-inch OLED 4K TV with α9 Gen5 AI Processor. Perfect blacks, Dolby Vision IQ & Dolby Atmos. Wall mount and table stand both available with original box. No burn-in, pristine panel.',
    seller: {
      id: 'seller-15',
      name: 'Arun Khurana',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80',
      memberSince: 'Oct 2022',
      verified: true,
      phone: '+91 94255 XXXXX',
      rating: 4.9,
      totalAds: 2,
    },
    specs: {
      'Brand': 'LG',
      'Screen Size': '55 Inch',
      'Resolution': '4K OLED Ultra HD (3840 x 2160)',
      'Refresh Rate': '120Hz Native',
      'Audio': '40W Dolby Atmos',
    },
    isElite: true,
    views: 790,
  }
];

export const INITIAL_C2C_CHATS = [
  {
    id: 'chat-1',
    adId: 'c2c-1',
    adTitle: 'iPhone 14 Pro Max 256GB Deep Purple',
    adPrice: 68500,
    adImage: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=800&auto=format&fit=crop&q=80',
    sellerId: 'seller-1',
    sellerName: 'Aman Verma',
    sellerAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80',
    type: 'buying', // 'buying' or 'selling'
    unread: true,
    lastMessage: 'Haan bhaiya, box aur bill dono available hai. Kab dekhne aa sakte ho?',
    lastMessageTime: '10:42 AM',
    messages: [
      { id: 'm-1', sender: 'me', text: 'Hi Aman, is this iPhone still available?', time: '10:30 AM' },
      { id: 'm-2', sender: 'seller', text: 'Hello! Yes, it is still available.', time: '10:32 AM' },
      { id: 'm-3', sender: 'me', text: 'Does it have the original bill and box?', time: '10:38 AM' },
      { id: 'm-4', sender: 'seller', text: 'Haan bhaiya, box aur bill dono available hai. Kab dekhne aa sakte ho?', time: '10:42 AM' },
    ]
  },
  {
    id: 'chat-2',
    adId: 'c2c-5',
    adTitle: 'Sony PlayStation 5 Disc Edition',
    adPrice: 36000,
    adImage: 'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?w=800&auto=format&fit=crop&q=80',
    sellerId: 'seller-5',
    sellerName: 'Rohan Joshi',
    sellerAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80',
    type: 'buying',
    unread: false,
    lastMessage: '34,000 final de sakta hu, dono games sath me.',
    lastMessageTime: 'Yesterday',
    messages: [
      { id: 'm-5', sender: 'me', text: 'Offer: ₹32,000', time: 'Yesterday 4:10 PM', isOffer: true, amount: 32000 },
      { id: 'm-6', sender: 'seller', text: '34,000 final de sakta hu, dono games sath me.', time: 'Yesterday 4:15 PM' },
    ]
  },
  {
    id: 'chat-3',
    adId: 'c2c-1',
    adTitle: 'iPhone 14 Pro Max 256GB Deep Purple',
    adPrice: 68500,
    adImage: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=800&auto=format&fit=crop&q=80',
    sellerId: 'buyer-1',
    sellerName: 'Neha Sharma',
    sellerAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80',
    type: 'selling',
    unread: true,
    lastMessage: 'Bhai kya 65000 mein doge? I can come today.',
    lastMessageTime: '11:20 AM',
    messages: [
      { id: 'm-7', sender: 'seller', text: 'Hi! Is this iPhone still available?', time: '11:10 AM' },
      { id: 'm-8', sender: 'me', text: 'Yes, it is! Come and check it anytime.', time: '11:15 AM' },
      { id: 'm-9', sender: 'seller', text: 'Bhai kya 65000 mein doge? I can come today.', time: '11:20 AM' },
    ]
  },
  {
    id: 'chat-4',
    adId: 'c2c-1',
    adTitle: 'iPhone 14 Pro Max 256GB Deep Purple',
    adPrice: 68500,
    adImage: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=800&auto=format&fit=crop&q=80',
    sellerId: 'buyer-2',
    sellerName: 'Vikram Patil',
    sellerAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80',
    type: 'selling',
    unread: false,
    lastMessage: 'Ok bhai, will come tomorrow morning.',
    lastMessageTime: 'Yesterday',
    messages: [
      { id: 'm-10', sender: 'seller', text: 'Hello, is the iPhone available for exchange?', time: 'Yesterday 2:00 PM' },
      { id: 'm-11', sender: 'me', text: 'No exchange, only cash.', time: 'Yesterday 2:05 PM' },
      { id: 'm-12', sender: 'seller', text: 'Ok bhai, will come tomorrow morning.', time: 'Yesterday 2:10 PM' },
    ]
  }
];


// Helper functions using localStorage
export const getC2CAds = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_ADS);
    if (!stored) {
      localStorage.setItem(STORAGE_KEY_ADS, JSON.stringify(INITIAL_C2C_ADS));
      return INITIAL_C2C_ADS;
    }
    const parsed = JSON.parse(stored);
    // If stored contains legacy non-electronics categories, refresh seed ads
    const hasLegacyCategories = parsed.some(a => ['vehicles', 'bikes', 'cars', 'furniture', 'properties'].includes(a.category));
    if (hasLegacyCategories) {
      const userAds = parsed.filter(a => a.isUserAd || a.id?.startsWith('c2c-user-'));
      const combined = [...userAds, ...INITIAL_C2C_ADS];
      localStorage.setItem(STORAGE_KEY_ADS, JSON.stringify(combined));
      return combined;
    }
    const existingIds = new Set(parsed.map(a => a.id));
    const merged = [...parsed];
    let changed = false;
    INITIAL_C2C_ADS.forEach(ad => {
      if (!existingIds.has(ad.id)) {
        merged.push(ad);
        changed = true;
      }
    });
    if (changed) {
      localStorage.setItem(STORAGE_KEY_ADS, JSON.stringify(merged));
    }
    return merged;
  } catch {
    return INITIAL_C2C_ADS;
  }
};

export const getC2CAdById = (id) => {
  const ads = getC2CAds();
  return ads.find(ad => ad.id === id) || INITIAL_C2C_ADS[0];
};

export const addC2CAd = (newAd) => {
  const ads = getC2CAds();
  const created = {
    ...newAd,
    id: `c2c-user-${Date.now()}`,
    postedAt: 'Just now',
    views: 1,
    isUserAd: true,
  };
  const updated = [created, ...ads];
  localStorage.setItem(STORAGE_KEY_ADS, JSON.stringify(updated));
  return created;
};

export const updateC2CAd = (id, updatedFields) => {
  const ads = getC2CAds();
  const updated = ads.map(a => a.id === id ? { ...a, ...updatedFields } : a);
  localStorage.setItem(STORAGE_KEY_ADS, JSON.stringify(updated));
  return updated.find(a => a.id === id) || null;
};

export const deleteC2CAd = (id) => {
  const ads = getC2CAds();
  const filtered = ads.filter(a => a.id !== id);
  localStorage.setItem(STORAGE_KEY_ADS, JSON.stringify(filtered));
  return filtered;
};

export const getC2CFavorites = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_FAVORITES);
    return stored ? JSON.parse(stored) : ['c2c-1', 'c2c-5'];
  } catch {
    return ['c2c-1', 'c2c-5'];
  }
};

export const toggleC2CFavorite = (id) => {
  const favs = getC2CFavorites();
  const isFav = favs.includes(id);
  const updated = isFav ? favs.filter(f => f !== id) : [...favs, id];
  localStorage.setItem(STORAGE_KEY_FAVORITES, JSON.stringify(updated));
  return !isFav;
};

export const getC2CUserAds = () => {
  const ads = getC2CAds();
  return ads.filter(a => a.isUserAd || a.id === 'c2c-1');
};

export const getC2CChats = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_CHATS);
    if (!stored) {
      localStorage.setItem(STORAGE_KEY_CHATS, JSON.stringify(INITIAL_C2C_CHATS));
      return INITIAL_C2C_CHATS;
    }
    const parsed = JSON.parse(stored);
    // If no selling-type chats exist, merge in seed selling chats (one-time migration)
    const hasSellingChats = parsed.some(c => c.type === 'selling');
    if (!hasSellingChats) {
      const sellingSeeds = INITIAL_C2C_CHATS.filter(c => c.type === 'selling');
      const existingIds = new Set(parsed.map(c => c.id));
      const newSeeds = sellingSeeds.filter(c => !existingIds.has(c.id));
      if (newSeeds.length > 0) {
        const merged = [...parsed, ...newSeeds];
        localStorage.setItem(STORAGE_KEY_CHATS, JSON.stringify(merged));
        return merged;
      }
    }
    return parsed;
  } catch {
    return INITIAL_C2C_CHATS;
  }
};


export const sendC2CMessage = (chatId, text, isOffer = false, amount = null) => {
  const chats = getC2CChats();
  const chat = chats.find(c => c.id === chatId);
  if (!chat) return chats;

  const newMsg = {
    id: `m-${Date.now()}`,
    sender: 'me',
    text,
    time: 'Just now',
    isOffer,
    amount,
  };

  chat.messages.push(newMsg);
  chat.lastMessage = text;
  chat.lastMessageTime = 'Just now';

  localStorage.setItem(STORAGE_KEY_CHATS, JSON.stringify(chats));
  return [...chats];
};

export const createOrGetC2CChat = (ad) => {
  const chats = getC2CChats();
  let existing = chats.find(c => c.adId === ad.id);
  if (existing) return existing;

  const newChat = {
    id: `chat-${Date.now()}`,
    adId: ad.id,
    adTitle: ad.title,
    adPrice: ad.price,
    adImage: ad.images?.[0],
    sellerId: ad.seller?.id || `seller-${Date.now()}`,
    sellerName: ad.seller?.name || 'Seller',
    sellerAvatar: ad.seller?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80',
    type: 'buying',
    unread: false,
    lastMessage: 'Chat started',
    lastMessageTime: 'Just now',
    messages: [
      {
        id: `m-init-${Date.now()}`,
        sender: 'seller',
        text: `Hello! Thanks for your interest in "${ad.title}". How can I help you?`,
        time: 'Just now'
      }
    ]
  };

  const updated = [newChat, ...chats];
  localStorage.setItem(STORAGE_KEY_CHATS, JSON.stringify(updated));
  return newChat;
};

const STORAGE_KEY_NOTIFICATIONS = 'c2c_marketplace_notifications';

export const INITIAL_C2C_NOTIFICATIONS = [
  // Selling notifications
  {
    id: 'notif-s1',
    type: 'selling',
    title: 'New Offer Received!',
    message: 'Kunal Sharma offered ₹28,000 for your listed item "Samsung Galaxy S22 Ultra 5G"',
    time: '10 mins ago',
    unread: true,
    actionType: 'chat',
    actionLink: '/marketplace/chats',
    icon: 'tag'
  },
  {
    id: 'notif-s2',
    type: 'selling',
    title: 'Image Request from Buyer',
    message: 'A buyer requested more images for your listing "iPhone 14 Pro Max 256GB"',
    time: '1 hour ago',
    unread: true,
    actionType: 'chat',
    actionLink: '/marketplace/chats',
    icon: 'camera'
  },
  {
    id: 'notif-s3',
    type: 'selling',
    title: 'Your Listing is Trending! 🔥',
    message: 'Your ad "Royal Enfield Classic 350" got 120 new views in Indore today.',
    time: 'Yesterday',
    unread: false,
    actionType: 'view',
    icon: 'trending'
  },
  // Buying notifications
  {
    id: 'notif-b1',
    type: 'buying',
    title: 'Price Drop Alert! 📉',
    message: 'Sony PlayStation 5 Disc Edition in your wishlist just dropped to ₹34,000!',
    time: '2 hours ago',
    unread: true,
    actionType: 'product',
    actionLink: '/marketplace/product/c2c-5',
    icon: 'price-drop'
  },
  {
    id: 'notif-b2',
    type: 'buying',
    title: 'New Seller Message',
    message: 'Aman Verma replied: "Haan bhaiya, box aur bill dono available hai..."',
    time: '4 hours ago',
    unread: true,
    actionType: 'chat',
    actionLink: '/marketplace/chats',
    icon: 'message'
  },
  {
    id: 'notif-b3',
    type: 'buying',
    title: 'Fresh Arrivals in Mobiles',
    message: '5 new listings for "Samsung S22" and "iPhone 12" just posted near Pipaliyahana.',
    time: '1 day ago',
    unread: false,
    actionType: 'search',
    actionLink: '/marketplace/products?category=mobiles',
    icon: 'sparkles'
  }
];

export const getC2CNotifications = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_NOTIFICATIONS);
    if (!stored) {
      localStorage.setItem(STORAGE_KEY_NOTIFICATIONS, JSON.stringify(INITIAL_C2C_NOTIFICATIONS));
      return INITIAL_C2C_NOTIFICATIONS;
    }
    return JSON.parse(stored);
  } catch {
    return INITIAL_C2C_NOTIFICATIONS;
  }
};

export const markC2CNotificationAsRead = (id) => {
  const notifs = getC2CNotifications();
  const updated = notifs.map(n => n.id === id ? { ...n, unread: false } : n);
  localStorage.setItem(STORAGE_KEY_NOTIFICATIONS, JSON.stringify(updated));
  return updated;
};

export const markAllC2CNotificationsAsRead = () => {
  const notifs = getC2CNotifications();
  const updated = notifs.map(n => ({ ...n, unread: false }));
  localStorage.setItem(STORAGE_KEY_NOTIFICATIONS, JSON.stringify(updated));
  return updated;
};
