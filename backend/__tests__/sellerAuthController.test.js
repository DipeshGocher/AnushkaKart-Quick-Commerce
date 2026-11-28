import { jest } from "@jest/globals";

const mockSellerFindOne = jest.fn();
const mockSellerCreate = jest.fn();
const mockVerifySellerVerificationToken = jest.fn();
const mockUploadToCloudinary = jest.fn();
const mockIssueSellerVerificationOtp = jest.fn();
const mockVerifySellerOtpCode = jest.fn();

jest.unstable_mockModule("../app/models/seller.js", () => ({
  default: {
    findOne: mockSellerFindOne,
    create: mockSellerCreate,
  },
}));

jest.unstable_mockModule("../app/services/sellerVerificationService.js", () => ({
  issueSellerVerificationOtp: mockIssueSellerVerificationOtp,
  verifySellerOtpCode: mockVerifySellerOtpCode,
  issueSellerResetOtp: jest.fn(),
  verifySellerResetOtpCode: jest.fn(),
  verifySellerVerificationToken: mockVerifySellerVerificationToken,
}));

jest.unstable_mockModule("../app/services/mediaService.js", () => ({
  uploadToCloudinary: mockUploadToCloudinary,
}));

const { signupSeller, sendSellerSignupOtp, verifySellerSignupOtp } = await import("../app/controller/sellerAuthController.js");

describe("sellerAuthController signupSeller", () => {
  let req;
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifySellerVerificationToken.mockReset();

    req = {
      body: {
        name: "Seller Owner",
        email: "seller@example.com",
        phone: "9876543210",
        password: "secret123",
        emailVerificationToken: "email-token",
        phoneVerificationToken: "phone-token",
        shopName: "Noyo Mart",
        category: "Groceries",
        address: "MG Road, Civil Lines",
        city: "Jhansi",
        state: "Uttar Pradesh",
        pincode: "284001",
        documents: JSON.stringify({
          tradeLicense: "https://example.com/trade-license.pdf",
          gstCertificate: "https://example.com/gst.pdf",
          idProof: "https://example.com/id-proof.pdf",
        }),
      },
      files: [],
      ip: "127.0.0.1",
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    mockSellerFindOne.mockResolvedValue(null);
    mockSellerCreate.mockImplementation(async (payload) => ({
      _id: "seller-1",
      ...payload,
    }));
  });

  it("needs NO OTP at all: no token is checked, email and phone are stored as not verified, admin approval follows", async () => {
    delete req.body.emailVerificationToken;
    delete req.body.phoneVerificationToken;
    await signupSeller(req, res);

    expect(mockVerifySellerVerificationToken).not.toHaveBeenCalled();
    expect(mockSellerCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        emailVerified: false,
        phoneVerified: false,
        isVerified: false,
        isActive: false,
        applicationStatus: "pending",
      }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("without an OTP it still refuses an email or a phone number that does not look right", async () => {
    for (const bad of [{ email: "not-an-email" }, { phone: "12345" }, { phone: "98765abcde" }]) {
      const r = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      await signupSeller({ ...req, body: { ...req.body, ...bad } }, r);
      expect(r.status).toHaveBeenCalledWith(400);
    }
    expect(mockSellerCreate).not.toHaveBeenCalled();
  });

  it("the old OTP endpoints refuse every request (nothing is sent): email, phone or anything else", async () => {
    for (const handler of [sendSellerSignupOtp, verifySellerSignupOtp]) {
      for (const channel of ["email", "phone", undefined]) {
        const r = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        await handler({ body: { channel, email: "seller@example.com", phone: "9876543210", otp: "1234" }, ip: "127.0.0.1" }, r);
        expect(r.status).toHaveBeenCalledWith(400);
      }
    }
    expect(mockIssueSellerVerificationOtp).not.toHaveBeenCalled();
    expect(mockVerifySellerOtpCode).not.toHaveBeenCalled();
  });
});
