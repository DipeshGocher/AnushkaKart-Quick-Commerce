import { parseWeightInput, composeWeight, validateParcel, parcelWarningText } from "../../shared/utils/parcel.js";

describe("parcel weight input", () => {
  test("parses text weights into number + unit", () => {
    expect(parseWeightInput("500g")).toEqual({ value: "500", unit: "g" });
    expect(parseWeightInput("1.5 kg")).toEqual({ value: "1.5", unit: "kg" });
    expect(parseWeightInput("250 grams")).toEqual({ value: "250", unit: "g" });
  });
  test("unclear text like '500 gram pack' is not accepted as a weight", () => {
    expect(parseWeightInput("500 gram pack")).toEqual({ value: "", unit: "g" });
    expect(parseWeightInput("")).toEqual({ value: "", unit: "g" });
    expect(parseWeightInput(null)).toEqual({ value: "", unit: "g" });
  });
  test("composeWeight", () => {
    expect(composeWeight("500", "g")).toBe("500 g");
    expect(composeWeight("1.5", "kg")).toBe("1.5 kg");
    expect(composeWeight("", "kg")).toBe("");
  });
});

describe("validateParcel", () => {
  const ok = { weight: "500 g", length: 20, breadth: 15, height: 5 };
  test("fine when everything is filled", () => expect(validateParcel(ok)).toBeNull());
  test("weight required and must be a clear number + unit", () => {
    expect(validateParcel({ ...ok, weight: "" })).toMatch(/weight/i);
    expect(validateParcel({ ...ok, weight: "500 gram pack" })).toMatch(/weight/i);
    expect(validateParcel({ ...ok, weight: "0 g" })).toMatch(/weight/i);
  });
  test("each box side is required and positive", () => {
    expect(validateParcel({ ...ok, length: "" })).toMatch(/length/i);
    expect(validateParcel({ ...ok, breadth: 0 })).toMatch(/width/i);
    expect(validateParcel({ ...ok, height: undefined })).toMatch(/height/i);
    expect(validateParcel({ ...ok, height: -3 })).toMatch(/height/i);
  });
});

describe("seller warning text", () => {
  test("names the product and what is missing", () => {
    const t = parcelWarningText([{ name: "Jeans", weight: true, size: false }, { name: "Mug", weight: false, size: true }]);
    expect(t).toMatch(/Jeans: weight not filled/);
    expect(t).toMatch(/Mug: box size not filled/);
    expect(t).toMatch(/payout/);
  });
});
