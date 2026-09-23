/**
 * Sell Flow Draft Store & Brand Configs
 */
import { C2C_CATEGORIES } from '../../../data/c2cMockData';

const DRAFT_STORAGE_KEY = 'c2c_sell_flow_draft';

export const CATEGORY_BRANDS = {
  mobiles: [
    'Apple', 'Samsung', 'OnePlus', 'Xiaomi', 'Redmi', 'Vivo', 'Oppo', 
    'Realme', 'Google Pixel', 'Motorola', 'Nothing', 'iQOO', 'POCO', 'Honor', 'Other'
  ],
  laptops: [
    'Apple (MacBook)', 'Dell', 'HP', 'Lenovo', 'ASUS', 'Acer', 
    'MSI', 'Samsung', 'Microsoft Surface', 'LG Gram', 'Sony VAIO', 'Other'
  ],
  smartwatches: [
    'Apple Watch', 'Samsung Galaxy Watch', 'Noise', 'boAt', 'Fire-Boltt', 
    'Amazfit', 'Garmin', 'OnePlus', 'Fitbit', 'Titan', 'Fastrack', 'Other'
  ],
  earphones: [
    'Apple (AirPods)', 'Sony', 'boAt', 'JBL', 'OnePlus', 
    'Bose', 'Sennheiser', 'Realme', 'Nothing', 'Boult', 'Skullcandy', 'Marshall', 'Other'
  ],
  cameras: [
    'Canon', 'Nikon', 'Sony Alpha', 'Fujifilm', 'GoPro', 
    'Panasonic Lumix', 'DJI', 'Olympus', 'Insta360', 'Pentax', 'Other'
  ],
  tv: [
    'Samsung', 'LG', 'Sony Bravia', 'Mi / Xiaomi', 'OnePlus', 
    'TCL', 'Vu', 'Hisense', 'Acer', 'Toshiba', 'Lloyd', 'Other'
  ],
  gaming: [
    'Sony PlayStation', 'Microsoft Xbox', 'Nintendo', 'ASUS ROG', 
    'Alienware', 'Valve Steam Deck', 'Logitech G', 'Razer', 'MSI', 'Other'
  ],
  appliances: [
    'LG', 'Samsung', 'Whirlpool', 'Haier', 'Godrej', 
    'IFB', 'Bosch', 'Voltas', 'Daikin', 'Panasonic', 'Havells', 'Philips', 'Other'
  ]
};

// Initial sample mock gallery photos that simulate user's phone gallery (as shown in reference image)
export const DEFAULT_GALLERY_PHOTOS = [
  'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1621259182978-fbf93132d53d?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1593784991095-a205069470b6?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80'
];

export const getSellDraft = () => {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const saveSellDraft = (data) => {
  try {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save sell draft', e);
  }
};

export const clearSellDraft = () => {
  try {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {}
};
