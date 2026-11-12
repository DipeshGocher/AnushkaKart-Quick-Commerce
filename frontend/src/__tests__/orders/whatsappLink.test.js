import { buildWhatsappLinks, isMobileDevice, parseWhatsappUrl } from "../../shared/utils/whatsappLink.js";

const message = "*EMI Quotation Request* (FQ-ABC)\nCustomer: राहुल & Sons\nProduct price: Rs 18,000 / 100% ₹ + more?";
const serverUrl = `https://wa.me/918808802020?text=${encodeURIComponent(message)}`;

describe("WhatsApp links", () => {
  it("reads the number and the exact message back out of the server's link", () => {
    expect(parseWhatsappUrl(serverUrl)).toEqual({ phone: "918808802020", text: message });
  });

  it("builds the app link (computer), the phone link and the WhatsApp Web link from one message", () => {
    const l = buildWhatsappLinks(serverUrl);
    expect(l.app.startsWith("whatsapp://send?phone=918808802020&text=")).toBe(true);
    expect(l.web.startsWith("https://wa.me/918808802020?text=")).toBe(true);
    expect(l.webClient.startsWith("https://web.whatsapp.com/send/?phone=918808802020&text=")).toBe(true);
    expect(l.webClient.endsWith("&type=phone_number&app_absent=0")).toBe(true);
    // all three carry the same message, with newlines, Hindi, &, %, ₹ and ? intact
    for (const link of [l.app, l.web, l.webClient]) {
      expect(new URL(link.replace("whatsapp://", "https://x/")).searchParams.get("text")).toBe(message);
    }
  });

  it("copes with a number written with plus signs or spaces", () => {
    expect(parseWhatsappUrl("https://wa.me/+91%2088088%2002020?text=hi").phone).toBe("918808802020");
  });

  it("also understands the api.whatsapp.com style link", () => {
    expect(parseWhatsappUrl("https://api.whatsapp.com/send/?phone=918808802020&text=hello").phone).toBe("918808802020");
  });
});

describe("phone or computer", () => {
  it.each([
    ["Android Chrome", { userAgent: "Mozilla/5.0 (Linux; Android 14; SM-S918B) Chrome/126 Mobile Safari/537.36" }, true],
    ["iPhone Safari", { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Safari/604.1" }, true],
    ["iPad that looks like a Mac", { userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15", maxTouchPoints: 5 }, true],
    ["Windows Chrome", { userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126 Safari/537.36", maxTouchPoints: 0 }, false],
    ["Windows touch laptop", { userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126 Safari/537.36", maxTouchPoints: 10 }, false],
    ["Mac", { userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15", maxTouchPoints: 0 }, false],
    ["browser says mobile", { userAgent: "x", userAgentData: { mobile: true } }, true],
  ])("%s", (_name, nav, expected) => {
    expect(isMobileDevice(nav)).toBe(expected);
  });
});
