import { buildTemplateSpec } from "../app/services/bulkProduct/templateSpec.js";
import { buildTemplateBuffer, readProductsMatrix } from "../app/services/bulkProduct/workbookIO.js";
import { rowsFromMatrix, planProducts } from "../app/services/bulkProduct/plan.js";
import { buildCategoryIndex } from "../app/services/bulkProduct/categories.js";
import { COLUMNS } from "../app/services/bulkProduct/columns.js";
import ExcelJS from "exceljs";

const cats = [
  { _id: "h1", name: "Fashion", type: "header", status: "active" },
  { _id: "c1", name: "Men", type: "category", parentId: "h1", status: "active" },
  { _id: "s1", name: "Shirts", type: "subcategory", parentId: "c1", status: "active" },
  { _id: "h2", name: "Grocery", type: "header", status: "active" },
  { _id: "c2", name: "Staples", type: "category", parentId: "h2", status: "active" },
];
const index = buildCategoryIndex(cats);
const ctx = { resolveCategory: index.resolve, existingSkus: new Set(), existingNames: new Set() };

describe("real Excel file", () => {
  let buf;
  beforeAll(async () => { buf = await buildTemplateBuffer(buildTemplateSpec({ categoryPaths: index.paths })); });

  test("template is a real xlsx with the 3 sheets, dropdowns and colored headings", async () => {
    expect(buf[0]).toBe(0x50); expect(buf[1]).toBe(0x4b);
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Read Me First", "Products", "Categories"]);
    const ws = wb.getWorksheet("Products");
    expect(ws.getRow(1).getCell(2).value).toBe("Product Name *");
    expect(ws.getRow(1).getCell(2).fill.fgColor.argb).toBe("FFC62828"); // required = red
    expect(ws.getRow(1).getCell(1).fill.fgColor.argb).toBe("FF1565C0"); // optional = blue
    expect(wb.getWorksheet("Categories").getCell("A2").value).toBe("Fashion > Men > Shirts");
    const dv = ws.dataValidations.model;
    expect(Object.keys(dv).length).toBeGreaterThanOrEqual(5);
    const readme = wb.getWorksheet("Read Me First");
    const text = []; readme.eachRow((r) => r.eachCell((c) => text.push(String(c.value)))); 
    expect(text.join(" ")).toMatch(/Product Group/); expect(text.join(" ")).toMatch(/DRAFT/);
  });

  test("the untouched template has only EXAMPLE rows -> friendly 'no product rows' message", async () => {
    const { rows, fileErrors } = rowsFromMatrix(await readProductsMatrix(buf));
    expect(rows).toHaveLength(0);
    expect(fileErrors[0]).toMatch(/No product rows/);
  });

  test("fill the real template (as a seller would) and read it back", async () => {
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf);
    const ws = wb.getWorksheet("Products");
    const col = (k) => COLUMNS.findIndex((c) => c.key === k) + 1;
    const put = (r, o) => Object.entries(o).forEach(([k, v]) => { ws.getRow(r).getCell(col(k)).value = v; });
    put(12, { name: "Atta 10kg", category: "Grocery > Staples", price: "₹ 450", stock: 20 });
    put(13, { group: "SH-1", name: "Shirt", category: "Fashion > Men > Shirts", price: 999, stock: 4, opt1Name: "Size", opt1Value: "M", opt2Name: "Color", opt2Value: "Red", weight: 300, weightUnit: "g", length: 30, breadth: 20, height: 4, image: "https://x.test/r.jpg" });
    put(14, { group: "SH-1", price: 999, stock: 2, opt1Name: "Size", opt1Value: "L", opt2Name: "Color", opt2Value: "Red" });
    put(15, { name: "Bad one", category: "Nowhere", price: "abc", stock: 1 });
    const out = Buffer.from(await wb.xlsx.writeBuffer());
    const { rows, fileErrors } = rowsFromMatrix(await readProductsMatrix(out));
    expect(fileErrors).toEqual([]);
    expect(rows.map((r) => r.rowNumber)).toEqual([12, 13, 14, 15]); // examples skipped
    const { products, summary } = planProducts(rows, ctx);
    expect(products.map((p) => [p.name, p.status])).toEqual([["Atta 10kg", "draft"], ["Shirt", "ready"], ["Bad one", "error"]]);
    expect(products[0].price).toBe(450);
    expect(products[1].variantCount).toBe(2);
    expect(products[1].draftReasons).toEqual([]);
    expect(summary).toMatchObject({ rows: 4, products: 3, failed: 1 });
  });

  test("garbage bytes give a clear 400-style error, not a crash", async () => {
    await expect(readProductsMatrix(Buffer.from("PK not really a zip"))).rejects.toMatchObject({ statusCode: 400 });
  });
});
