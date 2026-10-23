const HOME_BANNER_ITEMS = [
  {
    imageUrl: "https://res.cloudinary.com/b5hik8gu/image/upload/v1791528972/banners/qe65rs7t9azgesktaxzj.png",
    title: "Anushka Store Mega Sale",
    subtitle: "Daily essentials delivered in 20-30 mins",
    linkType: "none",
    linkValue: "",
    status: "active",
  },
  {
    imageUrl: "https://res.cloudinary.com/b5hik8gu/image/upload/v1791528991/banners/avaaapzn3ymaxpg2bnc4.png",
    title: "Super Saver Grocery",
    subtitle: "Fresh fruits, vegetables & staples",
    linkType: "none",
    linkValue: "",
    status: "active",
  },
  {
    imageUrl: "https://res.cloudinary.com/b5hik8gu/image/upload/v1791528994/banners/iiryfnraxw1qkmpw154t.png",
    title: "Instant Delivery",
    subtitle: "Best prices guaranteed",
    linkType: "none",
    linkValue: "",
    status: "active",
  },
];

export const MIN_HOME_HERO_BANNERS = 1;

export const getDefaultHomeHeroBanners = () =>
  HOME_BANNER_ITEMS.map((banner) => ({ ...banner }));

