import { buildReportCsv, productMessages, productStatusText, safeCell } from "../../shared/utils/bulkReport.js";

const ready = { name: "Rice", rows: [2], status: "ready", errors: [], warnings: [], draftReasons: [] };
const draft = { name: "Shirt", rows: [3, 4], status: "draft", draftReasons: ["photo", "parcel"], errors: [], warnings: [{ row: 3, message: "No photo link for Color: Blue." }] };
const bad = { name: "Mug", rows: [5], status: "error", draftReasons: [], errors: [{ row: 5, message: "Price is empty." }], warnings: [] };

describe("bulk report", () => {
  test("status text before and after saving", () => {
    expect(productStatusText(ready)).toBe("Ready");
    expect(productStatusText(draft)).toBe("Will be a draft (photo needed, parcel size needed)");
    expect(productStatusText(bad)).toBe("Needs fixing");
    expect(productStatusText({ ...ready, result: { status: "created" } })).toBe("Saved and live");
    expect(productStatusText({ ...draft, result: { status: "created_draft", draftReasons: ["photo"] } })).toBe("Saved as draft (photo needed)");
    expect(productStatusText({ ...bad, result: { status: "skipped" } })).toBe("Skipped (needs fixing)");
  });
  test("messages: errors first, then warnings", () => {
    const m = productMessages({ ...bad, warnings: [{ row: 5, message: "w" }], result: { status: "failed", message: "SKU exists", warnings: [{ row: null, message: "photo failed" }] } });
    expect(m.map((x) => x.type)).toEqual(["error", "error", "warning", "warning"]);
  });
  test("csv lists only what needs attention, quoted, with BOM, formula-safe", () => {
    const csv = buildReportCsv([ready, draft, { ...bad, name: "=HYPERLINK(\"x\")" }]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).not.toMatch(/Rice/);
    expect(csv).toMatch(/"Shirt","3, 4","Will be a draft/);
    expect(csv).toMatch(/Note: Row 3: No photo link/);
    expect(csv).toMatch(/FIX: Row 5: Price is empty\./);
    expect(csv).toMatch(/"'=HYPERLINK/);
  });
  test("all rows when asked", () => {
    expect(buildReportCsv([ready], { onlyAttention: false })).toMatch(/Rice/);
  });
  test("safeCell", () => {
    expect(safeCell("=1+1")).toBe("'=1+1");
    expect(safeCell(null)).toBe("");
  });
});
