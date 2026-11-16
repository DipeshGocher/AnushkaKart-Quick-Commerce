import { parseWeightKg, parcelProblems, attachParcelIssues } from "../app/utils/parcelCheck.js";

describe("parseWeightKg", () => {
  test("clear weights", () => {
    expect(parseWeightKg("500g")).toBe(0.5);
    expect(parseWeightKg("1.5 kg")).toBe(1.5);
    expect(parseWeightKg("250 grams")).toBe(0.25);
    expect(parseWeightKg(" 2 KG ")).toBe(2);
  });
  test("unclear or missing weights are null", () => {
    expect(parseWeightKg("500 gram pack")).toBeNull();
    expect(parseWeightKg("")).toBeNull();
    expect(parseWeightKg(undefined)).toBeNull();
    expect(parseWeightKg("0 g")).toBeNull();
    expect(parseWeightKg("heavy")).toBeNull();
  });
});

describe("parcelProblems", () => {
  const good = { weight: "500 g", length: 20, breadth: 15, height: 5 };
  test("ok product", () => expect(parcelProblems(good)).toEqual({ weight: false, size: false }));
  test("missing weight / any missing side", () => {
    expect(parcelProblems({ ...good, weight: "" }).weight).toBe(true);
    expect(parcelProblems({ ...good, height: undefined }).size).toBe(true);
    expect(parcelProblems({ ...good, length: 0 }).size).toBe(true);
  });
});

describe("attachParcelIssues", () => {
  const prod = (over) => ({ name: "P", weight: "500 g", length: 10, breadth: 10, height: 10, ...over });
  test("flags open courier orders with unusable products only", () => {
    const orders = [
      { orderId: "A", fulfillmentType: "SHIPROCKET", status: "confirmed", items: [{ name: "Jeans", product: prod({ weight: "" }) }, { name: "Mug", product: prod() }] },
      { orderId: "B", fulfillmentType: "SHIPROCKET", status: "confirmed", items: [{ name: "Mug", product: prod() }] },
      { orderId: "C", fulfillmentType: "LOCAL", status: "confirmed", items: [{ name: "X", product: prod({ weight: "" }) }] },
      { orderId: "D", fulfillmentType: "SHIPROCKET", status: "delivered", items: [{ name: "Y", product: prod({ weight: "" }) }] },
      { orderId: "E", fulfillmentType: "SHIPROCKET", status: "confirmed", items: [{ name: "Z", product: "64f000000000000000000001" }] }, // not populated
    ];
    attachParcelIssues(orders);
    expect(orders[0].parcelIssues).toEqual([{ name: "Jeans", weight: true, size: false }]);
    expect(orders[1].parcelIssues).toBeUndefined();
    expect(orders[2].parcelIssues).toBeUndefined(); // local rider orders do not use courier size
    expect(orders[3].parcelIssues).toBeUndefined(); // finished
    expect(orders[4].parcelIssues).toBeUndefined();
  });
});
