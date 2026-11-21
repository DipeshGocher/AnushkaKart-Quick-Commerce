import { maskAccount, parseWithdrawAmount, validateAccountInput } from "../app/services/finance/customerWithdrawalService.js";

describe("withdrawal amount", () => {
  it("₹1 is the smallest amount, whole or with paise, never more than the wallet holds", () => {
    expect(parseWithdrawAmount(1, 500)).toBe(1);
    expect(parseWithdrawAmount("1", 500)).toBe(1);
    expect(parseWithdrawAmount("250.50", 500)).toBe(250.5);
    expect(parseWithdrawAmount(500, 500)).toBe(500);
    expect(parseWithdrawAmount(0.01 + 1, 500)).toBe(1.01);
  });
  it.each([
    [0, /smallest amount you can withdraw is ₹1/],
    [0.5, /smallest amount you can withdraw is ₹1/],
    [-10, /smallest amount you can withdraw is ₹1/],
    [1.234, /at most 2 decimal places/],
    ["", /Enter the amount/],
    ["abc", /Enter the amount/],
    [null, /Enter the amount/],
    [undefined, /Enter the amount/],
    [NaN, /Enter the amount/],
    [Infinity, /Enter the amount/],
    [500.01, /only have ₹500/],
    [100000, /only have ₹500/],
  ])("%j is refused", (value, message) => {
    let caught;
    try { parseWithdrawAmount(value, 500); } catch (e) { caught = e; }
    expect(caught).toBeTruthy();
    expect(caught.statusCode).toBe(400);
    expect(caught.message).toMatch(message);
  });
});

describe("payout account", () => {
  const bank = { method: "bank", holderName: "Rahul Verma", bankName: "State Bank of India", accountNumber: "123456789012", ifsc: "sbin0001234" };

  it("a good bank account is cleaned (IFSC upper case, spaces out of the number)", () => {
    expect(validateAccountInput({ ...bank, accountNumber: "1234 5678 9012" })).toEqual({ ...bank, accountNumber: "123456789012", ifsc: "SBIN0001234" });
  });

  it("a good UPI id is accepted in any letter case and stored lower case", () => {
    expect(validateAccountInput({ method: "upi", upiId: " Rahul.V@OkSBI " })).toEqual({ method: "upi", upiId: "rahul.v@oksbi", holderName: "" });
    expect(validateAccountInput({ method: "upi", upiId: "9876543210@ybl", holderName: "Rahul Verma" }).upiId).toBe("9876543210@ybl");
  });

  it.each([
    [{ method: "bank", holderName: "R", bankName: "SBI", accountNumber: "123456789012", ifsc: "SBIN0001234" }, /account holder name/],
    [{ method: "bank", holderName: "Rahul 123", bankName: "SBI", accountNumber: "123456789012", ifsc: "SBIN0001234" }, /account holder name/],
    [{ method: "bank", holderName: "Rahul Verma", bankName: "", accountNumber: "123456789012", ifsc: "SBIN0001234" }, /bank name/],
    [{ method: "bank", holderName: "Rahul Verma", bankName: "SBI", accountNumber: "12345678", ifsc: "SBIN0001234" }, /account number/],
    [{ method: "bank", holderName: "Rahul Verma", bankName: "SBI", accountNumber: "1234567890123456789", ifsc: "SBIN0001234" }, /account number/],
    [{ method: "bank", holderName: "Rahul Verma", bankName: "SBI", accountNumber: "12345678901a", ifsc: "SBIN0001234" }, /account number/],
    [{ method: "bank", holderName: "Rahul Verma", bankName: "SBI", accountNumber: "123456789012", ifsc: "SBIN1001234" }, /IFSC/],
    [{ method: "bank", holderName: "Rahul Verma", bankName: "SBI", accountNumber: "123456789012", ifsc: "" }, /IFSC/],
    [{ method: "upi", upiId: "rahul" }, /UPI ID/],
    [{ method: "upi", upiId: "rahul@" }, /UPI ID/],
    [{ method: "upi", upiId: "@bank" }, /UPI ID/],
    [{ method: "upi", upiId: "ra hul@bank" }, /UPI ID/],
    [{ method: "cash" }, /Bank account or UPI/],
    [{}, /Bank account or UPI/],
    [null, /Bank account or UPI/],
  ])("%j is refused", (input, message) => {
    let caught;
    try { validateAccountInput(input); } catch (e) { caught = e; }
    expect(caught).toBeTruthy();
    expect(caught.statusCode).toBe(400);
    expect(caught.message).toMatch(message);
  });

  it("the customer only ever sees the last 4 digits of the account", () => {
    const masked = maskAccount({ method: "bank", holderName: "Rahul", bankName: "SBI", accountNumberEnc: "v1:secret", accountLast4: "9012", ifsc: "SBIN0001234" });
    expect(masked).toEqual({ method: "bank", holderName: "Rahul", bankName: "SBI", accountMasked: "XXXXXX9012", ifsc: "SBIN0001234" });
    expect(JSON.stringify(masked)).not.toMatch(/secret|Enc/);
    expect(maskAccount({ method: "upi", upiId: "a@b" })).toEqual({ method: "upi", upiId: "a@b", holderName: "" });
    expect(maskAccount(null)).toBeNull();
  });
});
