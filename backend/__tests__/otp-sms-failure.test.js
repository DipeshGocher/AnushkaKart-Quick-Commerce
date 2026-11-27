import { jest } from "@jest/globals";

const mockCustomerFindOne = jest.fn();
const mockSendSms = jest.fn();

jest.unstable_mockModule("../app/models/customer.js", () => ({
  default: { findOne: mockCustomerFindOne, create: jest.fn(), findById: jest.fn() },
}));

jest.unstable_mockModule("../app/utils/otp.js", () => ({
  generateOTP: jest.fn(() => "4821"),
  useRealSMS: jest.fn(() => true),
}));

jest.unstable_mockModule("../app/services/smsIndiaHubService.js", () => ({
  sendSmsIndiaHubOtp: mockSendSms,
}));

const { issueCustomerOtp } = await import("../app/services/otpAuthService.js");

function buildCustomer(overrides = {}) {
  return {
    _id: "customer-1",
    name: "Harsh",
    phone: "+917879363299",
    isVerified: false,
    otpHash: "old-hash",
    otpExpiresAt: new Date(Date.now() + 60 * 1000),
    otpFailedAttempts: 2,
    otpLockedUntil: null,
    otpLastSentAt: null,
    otpSessionVersion: 3,
    save: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

const select = (customer) => mockCustomerFindOne.mockReturnValue({ select: jest.fn().mockResolvedValue(customer) });

describe("OTP when the SMS provider fails", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.OTP_RESEND_COOLDOWN_SECONDS = "60";
    process.env.OTP_HASH_SECRET = "otp-test-secret";
  });

  it("gives the resend cooldown back, so the customer can try again at once", async () => {
    const customer = buildCustomer();
    select(customer);
    mockSendSms.mockRejectedValueOnce(Object.assign(new Error("SMS provider rejected the request"), { statusCode: 502 }));

    await expect(
      issueCustomerOtp({ name: "Harsh", rawPhone: "7879363299", flow: "signup", ipAddress: "127.0.0.1" }),
    ).rejects.toMatchObject({ statusCode: 502 });

    // back to how it was before this attempt: no cooldown, old code state
    expect(customer.otpLastSentAt).toBeNull();
    expect(customer.otpHash).toBe("old-hash");
    expect(customer.otpFailedAttempts).toBe(2);
    expect(customer.otpSessionVersion).toBe(3);
    expect(customer.save).toHaveBeenCalledTimes(2); // once to store the new code, once to restore

    // the very next try is allowed (no "Please wait ...s") and sends the SMS
    mockSendSms.mockResolvedValueOnce({ ok: true });
    const result = await issueCustomerOtp({ name: "Harsh", rawPhone: "7879363299", flow: "signup", ipAddress: "127.0.0.1" });
    expect(result.sent).toBe(true);
    expect(mockSendSms).toHaveBeenCalledTimes(2);
    expect(customer.otpLastSentAt).toBeInstanceOf(Date);
  });

  it("still applies the cooldown after an SMS that WAS sent", async () => {
    const customer = buildCustomer();
    select(customer);
    mockSendSms.mockResolvedValue({ ok: true });

    await issueCustomerOtp({ name: "Harsh", rawPhone: "7879363299", flow: "signup", ipAddress: "127.0.0.1" });
    await expect(
      issueCustomerOtp({ name: "Harsh", rawPhone: "7879363299", flow: "signup", ipAddress: "127.0.0.1" }),
    ).rejects.toMatchObject({ statusCode: 429, message: expect.stringMatching(/Please wait \d+s/) });
    expect(mockSendSms).toHaveBeenCalledTimes(1);
  });
});
