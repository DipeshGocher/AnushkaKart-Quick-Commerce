/**
 * The only file that talks to the Excel library (exceljs). It draws the template from the plain
 * spec in templateSpec.js and reads the "Products" sheet back into rows of cell values.
 * Everything else in bulkProduct/ works on plain arrays, so it is tested without Excel files.
 */
import { MAX_ROWS, SHEET_CATEGORIES, SHEET_PRODUCTS, SHEET_README, COLUMNS } from "./columns.js";

async function loadExcelJS() {
  try {
    const mod = await import("exceljs");
    return mod.default || mod;
  } catch {
    const err = new Error("Excel support is not installed on the server (package exceljs).");
    err.statusCode = 503;
    throw err;
  }
}

const letter = (n) => {
  let s = "";
  let x = n;
  while (x > 0) {
    const m = (x - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
};

const FILL = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const RED = "FFC62828";
const BLUE = "FF1565C0";
const GREY = "FFEFEFEF";

function drawReadme(ws, lines) {
  ws.getColumn(1).width = 26;
  ws.getColumn(2).width = 10;
  ws.getColumn(3).width = 78;
  ws.getColumn(4).width = 30;
  let r = 1;
  const wide = (text, opts = {}) => {
    ws.mergeCells(r, 1, r, 4);
    const cell = ws.getCell(r, 1);
    cell.value = text;
    cell.alignment = { wrapText: true, vertical: "top" };
    if (opts.font) cell.font = opts.font;
    if (opts.fill) cell.fill = opts.fill;
    ws.getRow(r).height = Math.max(18, Math.ceil(String(text).length / 120) * 17 + 3);
    r += 1;
  };
  for (const line of lines) {
    if (line.kind === "gap") { r += 1; continue; }
    if (line.kind === "title") { wide(line.text, { font: { bold: true, size: 18, color: { argb: "FF0D47A1" } } }); ws.getRow(r - 1).height = 30; continue; }
    if (line.kind === "h") { wide(line.text, { font: { bold: true, size: 13, color: { argb: "FFFFFFFF" } }, fill: FILL(BLUE) }); continue; }
    if (line.kind === "step") { wide(line.text, { font: { size: 11 } }); continue; }
    if (line.kind === "bullet") { wide(`•  ${line.text}`, { font: { size: 11 } }); continue; }
    if (line.kind === "p") { wide(line.text, { font: { size: 11 } }); continue; }
    if (line.kind === "table") {
      line.header.forEach((h, i) => {
        const c = ws.getCell(r, i + 1);
        c.value = h;
        c.font = { bold: true, color: { argb: "FFFFFFFF" } };
        c.fill = FILL("FF37474F");
        c.alignment = { vertical: "middle" };
      });
      r += 1;
      for (const row of line.rows) {
        row.forEach((v, i) => {
          const c = ws.getCell(r, i + 1);
          c.value = v;
          c.alignment = { wrapText: true, vertical: "top" };
          c.border = { bottom: { style: "hair", color: { argb: "FFBDBDBD" } } };
          if (i === 1) c.font = { bold: true, color: { argb: v === "MUST" ? RED : BLUE } };
        });
        ws.getRow(r).height = Math.max(18, Math.ceil(String(row[2]).length / 85) * 16 + 2);
        r += 1;
      }
    }
  }
}

function drawProducts(wb, ws, spec) {
  const textCols = new Set(["group", "sku", "opt1Value", "opt2Value", "fssai", "name"]);
  ws.columns = COLUMNS.map((c) => ({ key: c.key, width: c.width, style: textCols.has(c.key) ? { numFmt: "@" } : {} }));
  const header = ws.getRow(1);
  COLUMNS.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    cell.value = c.title;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = FILL(c.required ? RED : BLUE);
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.note = c.hint;
  });
  header.height = 34;
  ws.views = [{ state: "frozen", ySplit: 1, xSplit: 2 }];

  spec.examples.forEach((ex, idx) => {
    const row = ws.getRow(idx + 2);
    COLUMNS.forEach((c, i) => {
      const v = ex[c.key];
      const cell = row.getCell(i + 1);
      if (v !== undefined && v !== "") cell.value = v;
      cell.fill = FILL(GREY);
      cell.font = { italic: true, color: { argb: "FF757575" } };
    });
  });

  const last = MAX_ROWS + 20;
  const col = (key) => letter(COLUMNS.findIndex((c) => c.key === key) + 1);
  const range = (key) => `${col(key)}2:${col(key)}${last}`;
  const add = (key, def) => ws.dataValidations.add(range(key), { allowBlank: true, showErrorMessage: true, errorStyle: "stop", ...def });
  if (spec.categories.length > 0) {
    add("category", {
      type: "list",
      formulae: [`'${SHEET_CATEGORIES}'!$A$2:$A$${spec.categories.length + 1}`],
      errorTitle: "Pick a category",
      error: "Please choose a category from the dropdown list.",
    });
  }
  add("weightUnit", { type: "list", formulae: ['"g,kg"'], errorTitle: "Weight Unit", error: "Choose g or kg." });
  add("returnable", { type: "list", formulae: ['"Yes,No"'], errorTitle: "Returnable", error: "Choose Yes or No." });
  add("price", { type: "decimal", operator: "greaterThan", formulae: [0], errorTitle: "Price", error: "Write a number greater than 0." });
  add("salePrice", { type: "decimal", operator: "greaterThanOrEqual", formulae: [0], errorTitle: "Sale Price", error: "Write a number, or leave it empty." });
  add("stock", { type: "whole", operator: "greaterThanOrEqual", formulae: [0], errorTitle: "Stock", error: "Write a whole number (0 or more)." });
  for (const k of ["length", "breadth", "height", "weight"]) {
    add(k, { type: "decimal", operator: "greaterThan", formulae: [0], errorTitle: "Number needed", error: "Write a number greater than 0, or leave it empty." });
  }
}

function drawCategories(ws, paths) {
  ws.getColumn(1).width = 80;
  const head = ws.getCell(1, 1);
  head.value = "Valid categories (choose one of these in the Products sheet)";
  head.font = { bold: true, color: { argb: "FFFFFFFF" } };
  head.fill = FILL(BLUE);
  paths.forEach((p, i) => { ws.getCell(i + 2, 1).value = p; });
  ws.views = [{ state: "frozen", ySplit: 1 }];
}

/** spec from buildTemplateSpec() -> Buffer of the .xlsx file */
export async function buildTemplateBuffer(spec) {
  const ExcelJS = await loadExcelJS();
  const wb = new ExcelJS.Workbook();
  wb.creator = "Anushka Connect";
  wb.created = new Date();
  const readme = wb.addWorksheet(SHEET_README, { properties: { tabColor: { argb: "FF2E7D32" } } });
  const products = wb.addWorksheet(SHEET_PRODUCTS, { properties: { tabColor: { argb: RED } } });
  const categories = wb.addWorksheet(SHEET_CATEGORIES, { properties: { tabColor: { argb: BLUE } } });
  drawReadme(readme, spec.readme);
  drawProducts(wb, products, spec);
  drawCategories(categories, spec.categories);
  wb.views = [{ activeTab: 0 }];
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const COL_LIMIT = 60;
const ROW_LIMIT = 2500;

/** Buffer of an .xlsx file -> rows of cell values of the Products sheet (index 0 = column A). */
export async function readProductsMatrix(buffer) {
  const ExcelJS = await loadExcelJS();
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer);
  } catch {
    const err = new Error("This file could not be read. Please upload the .xlsx template (not a .csv or .xls).");
    err.statusCode = 400;
    throw err;
  }
  const byName = wb.worksheets.find((w) => String(w.name).trim().toLowerCase() === SHEET_PRODUCTS.toLowerCase());
  const ws = byName || wb.worksheets[0];
  if (!ws) {
    const err = new Error("The file has no sheets.");
    err.statusCode = 400;
    throw err;
  }
  const rowCount = Math.min(ws.rowCount || 0, ROW_LIMIT);
  const colCount = Math.min(ws.columnCount || 0, COL_LIMIT);
  const matrix = [];
  for (let r = 1; r <= rowCount; r += 1) {
    const row = ws.getRow(r);
    const arr = [];
    for (let c = 1; c <= colCount; c += 1) arr.push(row.getCell(c).value);
    matrix.push(arr);
  }
  return matrix;
}
