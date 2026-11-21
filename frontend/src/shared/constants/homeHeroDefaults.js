// There are NO built-in home banners. Until the admin adds banners (Admin > Hero & Page Banners), the home
// page simply shows no banner strip. (It used to fall back to three pictures hosted on an old Cloudinary
// account, which kept showing on a brand new store.)
const HOME_BANNER_ITEMS = [];

export const MIN_HOME_HERO_BANNERS = 1;

export const getDefaultHomeHeroBanners = () =>
  HOME_BANNER_ITEMS.map((banner) => ({ ...banner }));
