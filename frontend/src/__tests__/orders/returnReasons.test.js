import { FALLBACK_RETURN_REASONS } from "../../shared/constants/returnReasons.js";
import { RETURN_REASONS } from "../../../../backend/app/constants/returnReasons.js";

describe("return reasons: the app's fallback list matches the server's list", () => {
  it("same codes, labels and faults in the same order", () => {
    expect(FALLBACK_RETURN_REASONS).toEqual(RETURN_REASONS.map(({ code, label, fault }) => ({ code, label, fault })));
  });

  it("every reason can be chosen by a customer (has a label)", () => {
    for (const r of FALLBACK_RETURN_REASONS) expect(r.label.trim().length).toBeGreaterThan(3);
  });
});
