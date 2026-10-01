export const CATEGORY_BANNER_PRESET_VERSION = 1;

const CATEGORY_BANNER_PRESETS = [
  { names: ['grocery', 'groceries'], image: '/banners/categories/grocery.png' },
  { names: ['mobile', 'mobiles', 'smartphones'], image: '/banners/categories/mobile.png' },
  { names: ['home & kitchen', 'home and kitchen'], image: '/banners/categories/home-kitchen.png' },
  { names: ['kids', 'kids essentials'], image: '/banners/categories/kids.png' },
  { names: ['pet supplies', 'pets'], image: '/banners/categories/pet-supplies.png' },
  { names: ['beauty & skin', 'beauty and skin', 'beauty & personal care'], image: '/banners/categories/beauty-skin.png' },
  { names: ['sports', 'sports essentials'], image: '/banners/categories/sports.png' },
  { names: ['electronics', 'electronic'], image: '/banners/categories/electronics.png' },
  { names: ['wedding', 'weddings'], image: '/banners/categories/wedding.png' },
];

export const getCategoryBannerPreset = (name) => {
  const normalizedName = String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return CATEGORY_BANNER_PRESETS.find(({ names }) => names.includes(normalizedName)) || null;
};

export const getDefaultCategoryBannerItems = (headers) =>
  headers.flatMap((header) => {
    const preset = getCategoryBannerPreset(header.name);
    if (!preset) return [];
    const headerCategoryId = String(header._id || header.id || '');
    return [{
      image: preset.image,
      headerCategoryId,
      title: header.name,
      buttonLink: headerCategoryId ? `/category/${headerCategoryId}` : '',
    }];
  });
