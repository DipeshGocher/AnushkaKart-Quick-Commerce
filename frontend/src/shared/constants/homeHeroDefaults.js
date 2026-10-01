const HOME_BANNER_ITEMS = [
  {
    imageUrl: "/banners/home/fresh-produce.png",
    title: "Fresh Picks, Every Day",
    subtitle: "Quality fruits and vegetables for your family.",
    linkType: "none",
    linkValue: "",
    status: "active",
  },
  {
    imageUrl: "/banners/home/electronics.png",
    title: "Upgrade Your Everyday",
    subtitle: "Discover electronics and smart essentials.",
    linkType: "none",
    linkValue: "",
    status: "active",
  },
  {
    imageUrl: "/banners/home/home-kitchen.png",
    title: "A Better Home Starts Here",
    subtitle: "Kitchen and home favorites, all in one place.",
    linkType: "none",
    linkValue: "",
    status: "active",
  },
  {
    imageUrl: "/banners/home/kids-toys.png",
    title: "Little Things, Big Smiles",
    subtitle: "Fun finds and learning essentials for kids.",
    linkType: "none",
    linkValue: "",
    status: "active",
  },
  {
    imageUrl: "/banners/home/pet-supplies.png",
    title: "For Every Good Boy and Girl",
    subtitle: "Thoughtful picks for the pets you love.",
    linkType: "none",
    linkValue: "",
    status: "active",
  },
  {
    imageUrl: "/banners/home/pantry-staples.png",
    title: "Stock Up on the Good Stuff",
    subtitle: "Pantry staples and everyday essentials.",
    linkType: "none",
    linkValue: "",
    status: "active",
  },
  {
    imageUrl: "/banners/home/dairy-bakery.png",
    title: "Make Mornings Delicious",
    subtitle: "Fresh dairy and bakery favorites for home.",
    linkType: "none",
    linkValue: "",
    status: "active",
  },
];

export const MIN_HOME_HERO_BANNERS = 6;

export const getDefaultHomeHeroBanners = () =>
  HOME_BANNER_ITEMS.map((banner) => ({ ...banner }));
