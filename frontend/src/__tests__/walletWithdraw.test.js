import {
  accountPayload,
  accountProblem,
  accountSummary,
  amountProblem,
  cleanAmountInput,
  emptyAccountForm,
  formatRupees,
  historyBadge,
} from "../shared/utils/walletWithdraw.js";

describe("rupees", () => {
  it("whole amounts have no paise, others always 2 decimals, Indian grouping", () => {
    expect(formatRupees(1)).toBe("₹1");
    expect(formatRupees(1500)).toBe("₹1,500");
    expect(formatRupees(120.5)).toBe("₹120.50");
    expect(formatRupees(123456.75)).toBe("₹1,23,456.75");
    expect(formatRupees(0)).toBe("₹0");
    expect(formatRupees(null)).toBe("₹0");
  });
});

describe("amount the customer types", () => {
  it("₹1 up to the whole balance is fine", () => {
    expect(amountProblem("1", 500)).toBe("");
    expect(amountProblem("250.5", 500)).toBe("");
    expect(amountProblem("500", 500)).toBe("");
  });
  it("says what is wrong", () => {
    expect(amountProblem("", 500)).toMatch(/Enter the amount/);
    expect(amountProblem("abc", 500)).toMatch(/Enter the amount/);
    expect(amountProblem("0", 500)).toMatch(/smallest amount you can withdraw is ₹1/);
    expect(amountProblem("0.5", 500)).toMatch(/smallest amount/);
    expect(amountProblem("1.234", 500)).toMatch(/2 decimal places/);
    expect(amountProblem("500.01", 500)).toMatch(/only have ₹500/);
    expect(amountProblem("1", 0)).toMatch(/only have ₹0/);
  });
  it("typing keeps digits and one dot with at most 2 decimals", () => {
    expect(cleanAmountInput("12a3")).toBe("123");
    expect(cleanAmountInput("1.2.3")).toBe("1.23");
    expect(cleanAmountInput("5.678")).toBe("5.67");
    expect(cleanAmountInput("-5")).toBe("5");
    expect(cleanAmountInput("")).toBe("");
  });
});

describe("account form", () => {
  const bank = { ...emptyAccountForm("bank"), holderName: "Rahul Verma", bankName: "SBI", accountNumber: "1234 5678 9012", ifsc: "sbin0001234" };

  it("a good bank form passes and is cleaned for the server", () => {
    expect(accountProblem(bank)).toBe("");
    expect(accountPayload(bank)).toEqual({ method: "bank", holderName: "Rahul Verma", bankName: "SBI", accountNumber: "123456789012", ifsc: "SBIN0001234" });
  });
  it("a good UPI form passes", () => {
    const upi = { ...emptyAccountForm("upi"), upiId: " Rahul@OkSBI " };
    expect(accountProblem(upi)).toBe("");
    expect(accountPayload(upi)).toEqual({ method: "upi", upiId: "rahul@oksbi", holderName: "" });
  });
  it.each([
    [{ holderName: "" }, /account holder name/],
    [{ bankName: "" }, /bank name/],
    [{ accountNumber: "123" }, /account number/],
    [{ ifsc: "SBIN1001234" }, /IFSC/],
  ])("%j is refused", (patch, msg) => {
    expect(accountProblem({ ...bank, ...patch })).toMatch(msg);
  });
  it("a UPI id needs a bank handle", () => {
    expect(accountProblem({ ...emptyAccountForm("upi"), upiId: "rahul" })).toMatch(/UPI ID/);
  });
});

describe("history and saved account text", () => {
  it("only withdrawals get a state badge", () => {
    expect(historyBadge({ kind: "refund" })).toBeNull();
    expect(historyBadge({ kind: "withdrawal", status: "pending" })).toEqual({ text: "Waiting for payment", tone: "amber" });
    expect(historyBadge({ kind: "withdrawal", status: "paid" })).toEqual({ text: "Paid", tone: "green" });
    expect(historyBadge({ kind: "withdrawal", status: "rejected" })).toEqual({ text: "Not paid, money is back", tone: "red" });
  });
  it("the saved account line never shows more than the last 4 digits", () => {
    expect(accountSummary({ method: "bank", bankName: "SBI", accountMasked: "XXXXXX9012" })).toBe("SBI (••••9012)");
    expect(accountSummary({ method: "upi", upiId: "rahul@oksbi" })).toBe("UPI rahul@oksbi");
    expect(accountSummary(null)).toBe("");
  });
});
