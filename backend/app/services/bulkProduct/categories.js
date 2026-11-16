/**
 * Valid "Header > Category > Sub-category" paths for the template, and the lookup that turns the
 * text a seller picked back into the three ids a product needs.
 */

const norm = (s) =>
  String(s == null ? "" : s)
    .split(/[>›→\/]/)
    .map((p) => p.trim().replace(/\s+/g, " ").toLowerCase())
    .filter(Boolean)
    .join(" > ");

/**
 * categories = lean docs { _id, name, type, parentId, status, catalogType }
 * -> { paths: ["Header > Category > Sub", ...], resolve(text) }
 */
export function buildCategoryIndex(categories = []) {
  const active = categories.filter((c) => (c.status || "active") === "active");
  const byParent = new Map();
  for (const c of active) {
    const k = c.parentId ? String(c.parentId) : "root";
    if (!byParent.has(k)) byParent.set(k, []);
    byParent.get(k).push(c);
  }
  const kids = (id) => (byParent.get(String(id)) || []).sort((a, b) => String(a.name).localeCompare(String(b.name)));
  const headers = active.filter((c) => c.type === "header").sort((a, b) => String(a.name).localeCompare(String(b.name)));

  const index = new Map(); // normalized path -> ref
  const needsSub = new Map(); // normalized "H > C" that has sub-categories -> example paths
  const paths = [];
  for (const h of headers) {
    for (const c of kids(h._id).filter((x) => x.type === "category")) {
      const subs = kids(c._id).filter((x) => x.type === "subcategory");
      const catPath = `${h.name} > ${c.name}`;
      if (subs.length === 0) {
        paths.push(catPath);
        index.set(norm(catPath), { headerId: h._id, categoryId: c._id, subcategoryId: null, path: catPath, catalogType: h.catalogType });
      } else {
        needsSub.set(norm(catPath), subs.slice(0, 3).map((s) => `${catPath} > ${s.name}`));
        for (const s of subs) {
          const p = `${catPath} > ${s.name}`;
          paths.push(p);
          index.set(norm(p), { headerId: h._id, categoryId: c._id, subcategoryId: s._id, path: p, catalogType: h.catalogType });
        }
      }
    }
  }

  const resolve = (text) => {
    const key = norm(text);
    if (!key) return { ok: false, message: "Category is empty. Pick one from the dropdown." };
    const hit = index.get(key);
    if (hit) {
      if (hit.catalogType === "refurbished") {
        return { ok: false, message: `"${hit.path}" is a refurbished category. Refurbished products need extra details, please add them with Add Product.` };
      }
      return { ok: true, ref: hit };
    }
    if (needsSub.has(key)) {
      return { ok: false, message: `"${text}" has sub-categories. Choose one, for example: ${needsSub.get(key).join(" / ")}` };
    }
    // a helpful guess: same last part
    const last = key.split(" > ").pop();
    const guess = paths.find((p) => norm(p).split(" > ").pop() === last);
    return {
      ok: false,
      message: `Category "${text}" is not in the list.${guess ? ` Did you mean "${guess}"?` : ""} Pick one from the dropdown.`,
    };
  };

  return { paths, resolve };
}
