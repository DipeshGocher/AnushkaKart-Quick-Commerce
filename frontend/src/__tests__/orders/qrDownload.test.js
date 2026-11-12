import { buildStandaloneSvg } from "../../shared/utils/qrDownload.js";

describe("buildStandaloneSvg (QR -> image for the gallery)", () => {
  const rendered =
    '<svg height="175" width="175" viewBox="0 0 29 29" style="height: auto; max-width: 100%;"><path d="M0 0h1v1H0z" fill="#000"/></svg>';

  it("sets a fixed pixel size and the SVG namespace so it renders as a standalone image", () => {
    const out = buildStandaloneSvg(rendered, 1024);
    expect(out).toMatch(/^<svg /);
    expect(out).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(out).toContain('width="1024"');
    expect(out).toContain('height="1024"');
  });

  it("drops the old on-screen width/height and keeps the viewBox and the QR modules", () => {
    const out = buildStandaloneSvg(rendered, 512);
    expect(out).not.toContain('width="175"');
    expect(out).not.toContain('height="175"');
    expect(out).toContain('viewBox="0 0 29 29"');
    expect(out).toContain('<path d="M0 0h1v1H0z" fill="#000"/>');
  });

  it("does not add the namespace twice", () => {
    const out = buildStandaloneSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg>', 100);
    expect(out.match(/xmlns=/g)).toHaveLength(1);
  });

  it("refuses anything that is not an <svg>", () => {
    expect(() => buildStandaloneSvg("<div>hi</div>")).toThrow();
    expect(() => buildStandaloneSvg("")).toThrow();
    expect(() => buildStandaloneSvg(null)).toThrow();
  });
});
