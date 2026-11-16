import { classifyDevice, getPerformanceMode } from "../../core/utils/devicePerformance.js";

describe("classifyDevice (which phones get the lighter look)", () => {
  test("a budget phone (4 GB or less) is low", () => {
    expect(classifyDevice({ deviceMemory: 4, hardwareConcurrency: 8 })).toBe("low");
    expect(classifyDevice({ deviceMemory: 2, hardwareConcurrency: 8 })).toBe("low");
    expect(classifyDevice({ deviceMemory: 0.5 })).toBe("low");
  });

  test("4 cores or fewer is low", () => {
    expect(classifyDevice({ deviceMemory: 8, hardwareConcurrency: 4 })).toBe("low");
  });

  test("data saver or reduce-motion is low even on a strong phone", () => {
    expect(classifyDevice({ deviceMemory: 8, hardwareConcurrency: 8, saveData: true })).toBe("low");
    expect(classifyDevice({ deviceMemory: 8, hardwareConcurrency: 8, reducedMotion: true })).toBe("low");
  });

  test("a good phone stays high", () => {
    expect(classifyDevice({ deviceMemory: 8, hardwareConcurrency: 8 })).toBe("high");
    expect(classifyDevice({ deviceMemory: 6, hardwareConcurrency: 8 })).toBe("high");
  });

  test("when the browser reports nothing (Safari / iPhone) it is NOT treated as low", () => {
    expect(classifyDevice({})).toBe("high");
    expect(classifyDevice()).toBe("high");
    expect(classifyDevice({ deviceMemory: undefined, hardwareConcurrency: undefined })).toBe("high");
  });

  test("outside a browser it falls back to high", () => {
    expect(getPerformanceMode()).toBe("high");
  });
});
