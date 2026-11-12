import { customerApi } from "./customerApi";

// Which header categories (e.g. Mobile) offer finance. One small request, shared by every product page.
let cache = { at: 0, data: null, pending: null };
const TTL_MS = 5 * 60 * 1000;

export async function loadEmiHeaders() {
  const now = Date.now();
  if (cache.data && now - cache.at < TTL_MS) return cache.data;
  if (cache.pending) return cache.pending;
  cache.pending = customerApi
    .getEmiHeaders()
    .then((res) => {
      const result = res.data?.result || { enabled: false, headerIds: [] };
      cache = { at: Date.now(), data: result, pending: null };
      return result;
    })
    .catch(() => {
      cache.pending = null;
      return { enabled: false, headerIds: [] };
    });
  return cache.pending;
}

export function isFinanceHeader(headers, product) {
  if (!headers?.enabled || !product) return false;
  const id = String(product.headerId?._id || product.headerId || "");
  return Boolean(id) && headers.headerIds.includes(id);
}
