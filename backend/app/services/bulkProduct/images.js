/**
 * Downloads a photo from a web link (bulk upload). Only public http(s) links are fetched:
 * localhost / private network addresses are refused so a sheet cannot probe our own network.
 */
import dns from "dns/promises";
import net from "net";
import axios from "axios";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export function isPrivateAddress(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 10 || a === 127 || a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    );
  }
  if (net.isIPv6(ip)) {
    const t = ip.toLowerCase();
    return (
      t === "::1" || t === "::" || t.startsWith("fc") || t.startsWith("fd") || t.startsWith("fe80") ||
      t.startsWith("::ffff:127.") || t.startsWith("::ffff:10.") || t.startsWith("::ffff:192.168.")
    );
  }
  return true;
}

async function assertPublic(url) {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("This link points to a private address.");
  }
  const addresses = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true });
  if (!addresses.length || addresses.some((a) => isPrivateAddress(a.address))) {
    throw new Error("This link points to a private address.");
  }
}

/** -> { buffer, mimeType }. Throws an Error with a short reason when the photo cannot be used. */
export async function fetchImage(rawUrl) {
  let url = new URL(rawUrl);
  let res;
  // follow up to 3 redirects by hand, checking every hop is a public address (Google Drive redirects)
  for (let hop = 0; hop <= 3; hop += 1) {
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Not a web link.");
    await assertPublic(url);
    res = await getOnce(url);
    if (res.status >= 300 && res.status < 400 && res.headers.location) {
      if (hop === 3) throw new Error("The link redirects too many times.");
      url = new URL(res.headers.location, url);
      continue;
    }
    break;
  }
  if (res.status !== 200) throw new Error(`The link answered with an error (${res.status}).`);
  const mimeType = String(res.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
  if (!ALLOWED_TYPES.has(mimeType)) throw new Error("The link is not a JPG / PNG / WEBP photo.");
  return { buffer: Buffer.from(res.data), mimeType };
}

async function getOnce(url) {
  try {
    return await axios.get(url.toString(), {
      responseType: "arraybuffer",
      timeout: 12000,
      maxContentLength: MAX_BYTES,
      maxBodyLength: MAX_BYTES,
      maxRedirects: 0, // redirects are followed by hand above, each one checked
      validateStatus: () => true,
      headers: { "User-Agent": "AnushkaConnect-BulkUpload/1.0" },
    });
  } catch (e) {
    if (e?.code === "ECONNABORTED") throw new Error("The link took too long to answer.");
    if (/maxContentLength|exceeded/i.test(String(e?.message))) throw new Error("The photo is larger than 5 MB.");
    throw new Error("The photo could not be downloaded.");
  }
}
