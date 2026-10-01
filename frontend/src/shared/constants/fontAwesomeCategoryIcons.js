import {
  FaAppleWhole,
  FaBaby,
  FaBagShopping,
  FaBasketShopping,
  FaBatteryFull,
  FaBolt,
  FaBookOpen,
  FaBottleWater,
  FaBowlFood,
  FaBreadSlice,
  FaBriefcase,
  FaBriefcaseMedical,
  FaBroom,
  FaCamera,
  FaCar,
  FaChampagneGlasses,
  FaCookieBite,
  FaDesktop,
  FaDrumstickBite,
  FaEarListen,
  FaFutbol,
  FaGem,
  FaGamepad,
  FaGlassWater,
  FaHeadphones,
  FaHouse,
  FaLaptop,
  FaMobileScreenButton,
  FaMicrophone,
  FaMusic,
  FaPalette,
  FaPaw,
  FaPen,
  FaPlug,
  FaPuzzlePiece,
  FaRadio,
  FaSeedling,
  FaShirt,
  FaSliders,
  FaScrewdriverWrench,
  FaStopwatch,
  FaSuitcaseRolling,
  FaTabletScreenButton,
  FaTag,
  FaTv,
  FaUsb,
  FaVideo,
  FaVolumeHigh,
  FaWandMagicSparkles,
} from "react-icons/fa6";

const iconsByComponentName = {
  FaAppleWhole, FaBaby, FaBagShopping, FaBasketShopping, FaBatteryFull, FaBolt,
  FaBookOpen, FaBottleWater, FaBowlFood, FaBreadSlice, FaBriefcase,
  FaBriefcaseMedical, FaBroom, FaCamera, FaCar, FaChampagneGlasses,
  FaCookieBite, FaDesktop, FaDrumstickBite, FaEarListen, FaFutbol, FaGem,
  FaGamepad, FaGlassWater, FaHeadphones, FaHouse, FaLaptop,
  FaMobileScreenButton, FaMicrophone, FaMusic, FaPalette, FaPaw, FaPen, FaPlug,
  FaPuzzlePiece, FaRadio, FaSeedling, FaShirt, FaSliders, FaScrewdriverWrench,
  FaStopwatch, FaSuitcaseRolling, FaTabletScreenButton, FaTag, FaTv, FaUsb,
  FaVideo, FaVolumeHigh, FaWandMagicSparkles,
};

const legacyIconNames = {
  electronics: "FaLaptop",
  fashion: "FaShirt",
  home: "FaHouse",
  food: "FaBowlFood",
  sports: "FaFutbol",
  books: "FaBookOpen",
  beauty: "FaWandMagicSparkles",
  toys: "FaPuzzlePiece",
  automotive: "FaCar",
  pets: "FaPaw",
  health: "FaBriefcaseMedical",
  garden: "FaSeedling",
  office: "FaBriefcase",
  music: "FaMusic",
  jewelry: "FaGem",
  baby: "FaBaby",
  tools: "FaScrewdriverWrench",
  luggage: "FaSuitcaseRolling",
  art: "FaPalette",
  grocery: "FaBasketShopping",
  beverages: "FaGlassWater",
  dairy: "FaBottleWater",
  bakery: "FaBreadSlice",
  snacks: "FaCookieBite",
  meat: "FaDrumstickBite",
  cleaning: "FaBroom",
  stationery: "FaPen",
  festival: "FaChampagneGlasses",
  smartphone: "FaMobileScreenButton",
  laptop: "FaLaptop",
  tablet: "FaTabletScreenButton",
  headphones: "FaHeadphones",
  smartwatch: "FaStopwatch",
  tv: "FaTv",
  gamepad: "FaGamepad",
  camera: "FaCamera",
  desktop: "FaDesktop",
  earbuds: "FaEarListen",
  speaker: "FaVolumeHigh",
  usb: "FaUsb",
  powerbank: "FaBatteryFull",
  remote: "FaSliders",
  microphone: "FaMicrophone",
  webcam: "FaVideo",
  radio: "FaRadio",
  cable: "FaPlug",
  handheld_game: "FaGamepad",
  gadgets: "FaBolt",
};

const categoryNameIcons = [
  [/grocery|grocer|fruit|vegetable|produce|quick.?commerce|quick.?shop/i, "FaBasketShopping"],
  [/home|kitchen|household|furniture|decor/i, "FaHouse"],
  [/kid|baby|child|toy/i, "FaBaby"],
  [/pet|animal/i, "FaPaw"],
  [/beauty|cosmetic|personal care|skin|makeup/i, "FaWandMagicSparkles"],
  [/electronic|mobile|phone|computer|gadget|tech/i, "FaMobileScreenButton"],
  [/fashion|clothing|apparel|wear/i, "FaShirt"],
  [/food|snack|bakery|bread|biscuit/i, "FaBowlFood"],
  [/dairy|milk|cheese/i, "FaBottleWater"],
  [/beverage|drink|water|juice/i, "FaGlassWater"],
  [/meat|fish|egg|chicken/i, "FaDrumstickBite"],
  [/book|stationery|office|school/i, "FaBookOpen"],
  [/sport|fitness|outdoor/i, "FaFutbol"],
  [/auto|car|vehicle/i, "FaCar"],
  [/health|medical|pharma|wellness/i, "FaBriefcaseMedical"],
  [/garden|plant|flower/i, "FaSeedling"],
  [/jewel|watch|accessor/i, "FaGem"],
  [/clean|laundry|household/i, "FaBroom"],
];

export const getFontAwesomeIconMarkup = (iconId) => {
  const match = String(iconId || "").match(/^fa6svg:(Fa[A-Za-z0-9]+):(.+)$/);
  if (!match) return "";
  try {
    const source = decodeURIComponent(match[2]);
    const viewBox = source.match(/viewBox="([0-9.\s-]+)"/)?.[1];
    const paths = [...source.matchAll(/<path d="([^"]+)"/g)].map((path) => path[1]);
    if (!viewBox || paths.length === 0 || paths.some((d) => !/^[A-Za-z0-9.,+\s-]+$/.test(d))) return "";
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + viewBox + '" fill="currentColor">' +
      paths.map((d) => '<path d="' + d + '"></path>').join("") +
      "</svg>";
  } catch {
    return "";
  }
};

export const resolveFontAwesomeCategoryIcon = (iconId, categoryName = "") => {
  const id = String(iconId || "").trim();
  if (id.startsWith("fa6svg:")) return null;
  const savedComponent = id.startsWith("fa6:") ? id.slice(4) : "";
  const componentName = savedComponent || legacyIconNames[id.toLowerCase()] || (id.startsWith("Fa") ? id : "");
  if (componentName && iconsByComponentName[componentName]) return iconsByComponentName[componentName];

  const name = String(categoryName || id).trim();
  if (!name) return null;
  const categoryMatch = categoryNameIcons.find(([pattern]) => pattern.test(name));
  return iconsByComponentName[categoryMatch?.[1] || "FaTag"];
};

export const getFontAwesomeIconId = (iconId, categoryName = "") => {
  const id = String(iconId || "").trim();
  const embedded = id.match(/^fa6svg:(Fa[A-Za-z0-9]+):/);
  if (embedded) return "fa6:" + embedded[1];
  if (id.startsWith("fa6:")) return id;
  const componentName = legacyIconNames[id.toLowerCase()];
  if (componentName) return "fa6:" + componentName;
  const Icon = resolveFontAwesomeCategoryIcon(id, categoryName);
  const matchedName = Object.entries(iconsByComponentName).find(([, Component]) => Component === Icon)?.[0];
  return matchedName ? "fa6:" + matchedName : "";
};
