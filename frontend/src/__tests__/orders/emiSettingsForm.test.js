import {
  rulesToRows,
  rowsToRules,
  rowsProblem,
  slabsProblem,
  slabRangeLabel,
  firstEmiExample,
} from "../../shared/utils/emiSettingsForm.js";

const saved = [
  { fromDay: 1, toDay: 10, dueDay: 1 },
  { fromDay: 11, toDay: 20, dueDay: 10 },
  { fromDay: 21, toDay: 31, dueDay: 20 },
];

describe("first EMI date rows", () => {
  it("saved rules become simple rows and come back identical", () => {
    const rows = rulesToRows(saved);
    expect(rows).toEqual([
      { toDay: "10", dueDay: "1" },
      { toDay: "20", dueDay: "10" },
      { toDay: "31", dueDay: "20" },
    ]);
    expect(rowsToRules(rows)).toEqual(saved);
  });

  it("the 'from' day is always the previous row's last day + 1, so gaps and overlaps cannot exist", () => {
    const rules = rowsToRules([
      { toDay: "5", dueDay: "2" },
      { toDay: "17", dueDay: "9" },
      { toDay: "whatever", dueDay: "20" },
    ]);
    expect(rules.map((r) => [r.fromDay, r.toDay])).toEqual([[1, 5], [6, 17], [18, 31]]);
  });

  it("unsorted saved rules are shown in order and the last row always ends at 31", () => {
    const rows = rulesToRows([saved[2], saved[0], saved[1]]);
    expect(rows.map((r) => r.toDay)).toEqual(["10", "20", "31"]);
    expect(rulesToRows([{ fromDay: 1, toDay: 28, dueDay: 5 }])[0].toDay).toBe("31");
  });

  it("a single rule covers the whole month", () => {
    expect(rowsToRules([{ toDay: "31", dueDay: "5" }])).toEqual([{ fromDay: 1, toDay: 31, dueDay: 5 }]);
  });

  it.each([
    [[], /at least one/i],
    [[{ toDay: "10", dueDay: "1" }, { toDay: "10", dueDay: "5" }, { toDay: "31", dueDay: "9" }], /Row 2/],
    [[{ toDay: "20", dueDay: "1" }, { toDay: "10", dueDay: "5" }, { toDay: "31", dueDay: "9" }], /Row 2/],
    [[{ toDay: "", dueDay: "1" }, { toDay: "31", dueDay: "9" }], /Row 1/],
    [[{ toDay: "31", dueDay: "1" }, { toDay: "31", dueDay: "9" }], /Row 1/],
    [[{ toDay: "10", dueDay: "30" }, { toDay: "31", dueDay: "9" }], /EMI day/],
    [[{ toDay: "10", dueDay: "0" }, { toDay: "31", dueDay: "9" }], /EMI day/],
    [[{ toDay: "10", dueDay: "1" }, { toDay: "31", dueDay: "" }], /Row 2/],
  ])("%j is refused with a plain message", (rows, pattern) => {
    expect(rowsProblem(rows)).toMatch(pattern);
  });

  it("good rows have no problem", () => {
    expect(rowsProblem(rulesToRows(saved))).toBe("");
  });
});

describe("example line (what the customer would get today)", () => {
  const rules = saved;
  it.each([
    [new Date(2026, 10, 5), 5, "01 Dec 2026"],
    [new Date(2026, 10, 15), 15, "10 Dec 2026"],
    [new Date(2026, 10, 25), 25, "20 Dec 2026"],
    [new Date(2026, 11, 15), 15, "10 Jan 2027"],
  ])("%s", (today, day, text) => {
    expect(firstEmiExample(rules, today)).toEqual({ day, text });
  });
});

describe("file charge table", () => {
  const slabs = [
    { upTo: "10000", fileCharge: "750" },
    { upTo: "20000", fileCharge: "1500" },
    { upTo: "", fileCharge: "2000" },
  ];

  it("each row says in words which amounts it covers", () => {
    expect(slabs.map((_, i) => slabRangeLabel(slabs, i))).toEqual(["Up to", "₹10,000 to", "Above ₹20,000"]);
    expect(slabRangeLabel([{ upTo: "", fileCharge: "100" }], 0)).toBe("Any amount");
  });

  it("limits must go up", () => {
    expect(slabsProblem(slabs)).toBe("");
    expect(slabsProblem([{ upTo: "20000" }, { upTo: "10000" }, { upTo: "" }])).toMatch(/Row 2/);
    expect(slabsProblem([{ upTo: "" }, { upTo: "" }])).toMatch(/Row 1/);
    expect(slabsProblem([{ upTo: "0" }, { upTo: "" }])).toMatch(/Row 1/);
  });
});
