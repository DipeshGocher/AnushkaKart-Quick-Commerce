// Writes a .gz and a .br copy next to every compressible file in dist/ (for nginx gzip_static / brotli_static).
// Run through `npm run build:web`. It is NOT part of `npm run build` on purpose: the mobile app copies dist/
// into the APK, and extra .gz/.br files would only make the app bigger.
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync, brotliCompressSync, constants } from "node:zlib";

// default: frontend/dist ; or pass another folder:  node scripts/precompress.mjs path/to/dist
const dist = process.argv[2] || join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const COMPRESSIBLE = new Set([".js", ".css", ".html", ".svg", ".json", ".webmanifest", ".txt", ".xml", ".ico"]);
const MIN_BYTES = 1024;

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

let files = 0;
let raw = 0;
let gz = 0;
let br = 0;
for (const file of walk(dist)) {
  if (!COMPRESSIBLE.has(extname(file).toLowerCase())) continue;
  const buf = readFileSync(file);
  if (buf.length < MIN_BYTES) continue;
  const g = gzipSync(buf, { level: 9 });
  const b = brotliCompressSync(buf, { params: { [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_SIZE_HINT]: buf.length } });
  // only keep a compressed copy when it is really smaller
  if (g.length < buf.length) writeFileSync(`${file}.gz`, g);
  if (b.length < buf.length) writeFileSync(`${file}.br`, b);
  files += 1;
  raw += buf.length;
  gz += g.length;
  br += b.length;
}
const kb = (n) => `${Math.round(n / 1024)} KB`;
console.log(`precompress: ${files} files  raw ${kb(raw)}  gzip ${kb(gz)}  brotli ${kb(br)}`);
