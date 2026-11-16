import { jest } from "@jest/globals";

const mockGet = jest.fn();
jest.unstable_mockModule("axios", () => ({ default: { get: mockGet } }));
jest.unstable_mockModule("dns/promises", () => ({ default: { lookup: jest.fn(async (h) => [{ address: h === "private.test" ? "10.0.0.5" : "93.184.216.34" }]) } }));
const { fetchImage } = await import("../app/services/bulkProduct/images.js");

const ok = (type = "image/jpeg") => ({ status: 200, headers: { "content-type": type }, data: new Uint8Array([1, 2, 3]) });

describe("bulk photo download", () => {
  beforeEach(() => mockGet.mockReset());
  test("plain photo", async () => {
    mockGet.mockResolvedValueOnce(ok());
    const r = await fetchImage("https://cdn.test/a.jpg");
    expect(r.mimeType).toBe("image/jpeg");
    expect(r.buffer.length).toBe(3);
  });
  test("follows a redirect (Google Drive style) to a public host", async () => {
    mockGet.mockResolvedValueOnce({ status: 303, headers: { location: "https://lh3.test/real.png" } }).mockResolvedValueOnce(ok("image/png"));
    expect((await fetchImage("https://drive.test/uc?id=1")).mimeType).toBe("image/png");
    expect(mockGet).toHaveBeenCalledTimes(2);
  });
  test("a redirect to a private address is refused", async () => {
    mockGet.mockResolvedValueOnce({ status: 302, headers: { location: "http://private.test/x" } });
    await expect(fetchImage("https://cdn.test/a")).rejects.toThrow(/private/);
  });
  test("direct private / localhost links are refused without any request", async () => {
    await expect(fetchImage("http://127.0.0.1/a.jpg")).rejects.toThrow(/private/);
    await expect(fetchImage("http://localhost/a.jpg")).rejects.toThrow(/private/);
    expect(mockGet).not.toHaveBeenCalled();
  });
  test("redirect loop, error status, wrong type", async () => {
    mockGet.mockResolvedValue({ status: 302, headers: { location: "https://cdn.test/again" } });
    await expect(fetchImage("https://cdn.test/a")).rejects.toThrow(/too many/);
    mockGet.mockReset().mockResolvedValueOnce({ status: 404, headers: {} });
    await expect(fetchImage("https://cdn.test/a")).rejects.toThrow(/404/);
    mockGet.mockReset().mockResolvedValueOnce(ok("text/html"));
    await expect(fetchImage("https://cdn.test/a")).rejects.toThrow(/not a JPG/);
  });
});
