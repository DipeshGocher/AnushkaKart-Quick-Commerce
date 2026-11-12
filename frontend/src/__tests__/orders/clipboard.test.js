import { jest } from "@jest/globals";
import { copyText } from "../../shared/utils/clipboard.js";

describe("copyText", () => {
  const originalNavigator = global.navigator;
  const originalDocument = global.document;

  afterEach(() => {
    Object.defineProperty(global, "navigator", { value: originalNavigator, configurable: true });
    global.document = originalDocument;
  });

  it("uses the clipboard API when it is there", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(global, "navigator", { value: { clipboard: { writeText } }, configurable: true });
    await expect(copyText("hello\nworld")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("hello\nworld");
  });

  it("falls back to a hidden textarea when the clipboard API refuses", async () => {
    const writeText = jest.fn().mockRejectedValue(new Error("not allowed"));
    Object.defineProperty(global, "navigator", { value: { clipboard: { writeText } }, configurable: true });
    const area = { style: {}, setAttribute: jest.fn(), select: jest.fn(), setSelectionRange: jest.fn() };
    global.document = {
      createElement: jest.fn(() => area),
      body: { appendChild: jest.fn(), removeChild: jest.fn() },
      execCommand: jest.fn(() => true),
    };
    await expect(copyText("quote")).resolves.toBe(true);
    expect(area.value).toBe("quote");
    expect(global.document.execCommand).toHaveBeenCalledWith("copy");
    expect(global.document.body.removeChild).toHaveBeenCalledWith(area);
  });

  it("returns false when nothing works, and for empty text", async () => {
    Object.defineProperty(global, "navigator", { value: {}, configurable: true });
    global.document = {
      createElement: () => {
        throw new Error("no dom");
      },
    };
    await expect(copyText("x")).resolves.toBe(false);
    await expect(copyText("")).resolves.toBe(false);
    await expect(copyText(null)).resolves.toBe(false);
  });
});
