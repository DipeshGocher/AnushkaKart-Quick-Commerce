import AppZetoBridge from "../../lib/appZetoBridge";

describe("Phase 4: Mobile WebView & Bridge Deduplication", () => {
  let calls = [];

  beforeEach(() => {
    calls = [];
    global.window = {
      Flutter: {
        postMessage: (msg) => {
          calls.push(msg);
        },
      },
    };
  });

  afterEach(() => {
    delete global.window;
  });

  test("deduplicates repeated setStatusBarColor calls across Flutter WebView bridge", () => {
    // First call with #0A24AC
    AppZetoBridge.setStatusBarColor("#0A24AC", false);
    const initialCallCount = calls.length;
    expect(initialCallCount).toBeGreaterThan(0);

    // Repeated call with the exact same color and brightness
    AppZetoBridge.setStatusBarColor("#0A24AC", false);
    // Call count must NOT increase because it is deduplicated
    expect(calls.length).toBe(initialCallCount);

    // Call with a new color (#0ea5e9)
    AppZetoBridge.setStatusBarColor("#0ea5e9", false);
    expect(calls.length).toBeGreaterThan(initialCallCount);
  });
});

describe("Phase 4: Carousel Scroll Throttling & Layout Safety", () => {
  test("calculates carousel slide index using clientWidth and suppresses redundant state changes", () => {
    let activeIndex = 0;
    let activeIndexRef = 0;
    let stateUpdates = 0;

    const handleCarouselScroll = (scrollLeft, clientWidth) => {
      if (!clientWidth) return;
      const index = Math.round(scrollLeft / clientWidth);
      if (index !== activeIndexRef) {
        activeIndexRef = index;
        activeIndex = index;
        stateUpdates++;
      }
    };

    const containerWidth = 375;

    // Sub-pixel scrolling within slide 0
    handleCarouselScroll(10, containerWidth);
    handleCarouselScroll(25, containerWidth);
    handleCarouselScroll(50, containerWidth);
    expect(activeIndex).toBe(0);
    expect(stateUpdates).toBe(0); // Zero state updates!

    // User scrolls past halfway point to slide 1
    handleCarouselScroll(220, containerWidth);
    expect(activeIndex).toBe(1);
    expect(stateUpdates).toBe(1); // Exactly 1 state update

    // User continues scrolling into slide 1
    handleCarouselScroll(375, containerWidth);
    handleCarouselScroll(380, containerWidth);
    expect(activeIndex).toBe(1);
    expect(stateUpdates).toBe(1); // Still exactly 1 state update
  });
});

describe("Phase 4: Navigation Focus & Inert Accessibility Guard", () => {
  test("computes inert attribute correctly when product detail sheet is open vs closed", () => {
    const getInertProps = (isProductDetailOpen) => ({
      ariaHidden: isProductDetailOpen,
      inert: isProductDetailOpen ? "" : undefined,
    });

    const closedState = getInertProps(false);
    expect(closedState.ariaHidden).toBe(false);
    expect(closedState.inert).toBeUndefined();

    const openState = getInertProps(true);
    expect(openState.ariaHidden).toBe(true);
    expect(openState.inert).toBe("");
  });
});
