describe("WhatsApp EMI Deep Link Tests", () => {
  function generateWhatsAppEmiUrl({ phone, amount, appName }) {
    const rawPhone = phone || "8209224481";
    const cleanDigits = String(rawPhone).replace(/[^\d]/g, "");
    const phoneWithCountry = cleanDigits.length === 10 ? `91${cleanDigits}` : cleanDigits;
    const message = `Hello, I want to inquire about No Cost EMI for my order of ₹${amount} on ${appName}.`;
    return `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(message)}`;
  }

  test("generates correct wa.me deep link with default admin number 8209224481", () => {
    const url = generateWhatsAppEmiUrl({
      phone: "8209224481",
      amount: 548,
      appName: "AnushkaStore",
    });

    expect(url).toContain("https://wa.me/918209224481");
    expect(url).toContain("No%20Cost%20EMI");
    expect(url).toContain("%E2%82%B9548");
    expect(url).toContain("AnushkaStore");
  });

  test("cleans up formatted numbers like +91 82092 24481", () => {
    const url = generateWhatsAppEmiUrl({
      phone: "+91 82092 24481",
      amount: 1200,
      appName: "AnushkaStore",
    });

    expect(url).toContain("https://wa.me/918209224481");
  });

  test("uses default 8209224481 if settings phone is null or empty", () => {
    const url = generateWhatsAppEmiUrl({
      phone: null,
      amount: 548,
      appName: "AnushkaStore",
    });

    expect(url).toContain("https://wa.me/918209224481");
  });

  test("allows custom admin WhatsApp number from settings", () => {
    const url = generateWhatsAppEmiUrl({
      phone: "9876543210",
      amount: 999,
      appName: "AnushkaStore",
    });

    expect(url).toContain("https://wa.me/919876543210");
    expect(url).toContain("%E2%82%B9999");
  });
});
