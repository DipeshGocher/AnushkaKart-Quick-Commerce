import * as freeClassicIcons from "react-icons/fa6";

export const fontAwesomeFreeClassicIcons = Object.entries(freeClassicIcons)
  .filter(([name, Icon]) => name.startsWith("Fa") && typeof Icon === "function")
  .map(([componentName, Icon]) => ({
    id: "fa6:" + componentName,
    componentName,
    name: componentName
      .slice(2)
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2"),
    Icon,
  }))
  .sort((a, b) => a.name.localeCompare(b.name));
