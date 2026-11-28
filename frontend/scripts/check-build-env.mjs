/**
 * Runs before `npm run build:web` (the live build).
 *
 * Vite bakes every VITE_* value into the JavaScript at BUILD time, and frontend/.env is not in git. A server
 * that builds without that file ships a site whose Google Maps key is "" - the seller shop-location map and
 * the customer address search then silently do nothing (this happened on the live site). So the live build
 * refuses to continue when the Maps key is missing.
 *
 *   Needed:  VITE_GOOGLE_MAPS_API_KEY            -> the build stops
 *   Advised: VITE_API_URL, VITE_FIREBASE_*       -> a warning
 *   Escape hatch (builds that really have no maps): ALLOW_MISSING_ENV=1 npm run build:web
 */
import { loadEnv } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Same rule Vite uses: .env files first, real environment variables win.
const fileEnv = loadEnv("production", root, "");
const get = (name) => String(process.env[name] ?? fileEnv[name] ?? "").trim();

const REQUIRED = [["VITE_GOOGLE_MAPS_API_KEY", "Google Maps / address search (seller shop location, customer addresses)"]];
const ADVISED = [
  ["VITE_API_URL", "API address (the site falls back to its own address when empty)"],
  ["VITE_FIREBASE_API_KEY", "push notifications"],
  ["VITE_FIREBASE_PROJECT_ID", "push notifications"],
  ["VITE_FIREBASE_APP_ID", "push notifications"],
];

const missingRequired = REQUIRED.filter(([name]) => !get(name));
const missingAdvised = ADVISED.filter(([name]) => !get(name));

for (const [name, what] of missingAdvised) console.warn(`[build env] WARNING: ${name} is empty - ${what} will not work.`);

if (missingRequired.length > 0 && process.env.ALLOW_MISSING_ENV !== "1") {
  console.error("\n==================== BUILD STOPPED ====================");
  for (const [name, what] of missingRequired) console.error(`  ${name} is empty -> ${what} would be broken on the live site.`);
  console.error(`\n  Put it in ${path.join(root, ".env")} (that file is not in git, it must exist on the server):`);
  console.error("      VITE_GOOGLE_MAPS_API_KEY=your-key");
  console.error("  then run the build again. (Intentionally building without it: ALLOW_MISSING_ENV=1 npm run build:web)");
  console.error("=======================================================\n");
  process.exit(1);
}
console.log("[build env] OK - Google Maps key is set.");
