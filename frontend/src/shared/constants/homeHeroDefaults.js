const HOME_BANNER_ITEMS = [
  {
    imageUrl: "https://res.cloudinary.com/b5hik8gu/image/upload/v1790140962/anushkakart/banners/aephuk8qenpoq2lurg2b.png",
    title: "Fastrack Smart Vox CirQ",
    subtitle: "Effortless style | Powered by AI",
    linkType: "none",
    linkValue: "",
    status: "active",
  },
  {
    imageUrl: "https://res.cloudinary.com/b5hik8gu/image/upload/v1790140963/anushkakart/banners/vmljeub0wsbphxmhmm08.png",
    title: "Alienware Gaming",
    subtitle: "Start From Exchange Offer",
    linkType: "none",
    linkValue: "",
    status: "active",
  },
  {
    imageUrl: "https://res.cloudinary.com/b5hik8gu/image/upload/v1790140964/anushkakart/banners/pht5fztjgtuaj4fsx2sh.png",
    title: "Mega Deals",
    subtitle: "Exclusive offers for you",
    linkType: "none",
    linkValue: "",
    status: "active",
  },
];

export const MIN_HOME_HERO_BANNERS = 1;

export const getDefaultHomeHeroBanners = () =>
  HOME_BANNER_ITEMS.map((banner) => ({ ...banner }));

