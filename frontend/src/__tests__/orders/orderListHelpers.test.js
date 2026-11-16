import {
  headerChips,
  matchesHeader,
  orderHeaderIds,
  canRateOrder,
  ratableItems,
  itemProductId,
} from "../../shared/utils/orderListHelpers.js";

const item = (pid, header, name = "P") => ({ product: { _id: pid, headerId: header, name }, name, quantity: 1, price: 100 });
const delivered = (items, over = {}) => ({ orderId: "ORD-1", workflowVersion: 2, workflowStatus: "DELIVERED", status: "delivered", items, ...over });

describe("header-category chips", () => {
  const cats = [
    { _id: "h2", type: "header", name: "Mobile", sortOrder: 2, status: "active" },
    { _id: "h1", type: "header", name: "Grocery", sortOrder: 1, status: "active" },
    { _id: "hA", type: "header", name: "All", slug: "all", status: "active" },
    { _id: "c1", type: "category", name: "Phones", status: "active" },
    { _id: "h3", type: "header", name: "Fashion", sortOrder: 3, status: "inactive" },
    { _id: "h4", type: "header", name: "  Electronics  ", sortOrder: 4 },
  ];

  it("only active header categories, in the admin's order, without a header called All", () => {
    expect(headerChips(cats)).toEqual([
      { id: "h1", label: "Grocery" },
      { id: "h2", label: "Mobile" },
      { id: "h4", label: "Electronics" },
    ]);
  });

  it("follows the live list: a removed header disappears, a new one appears", () => {
    expect(headerChips(cats.filter((c) => c._id !== "h2")).map((c) => c.label)).toEqual(["Grocery", "Electronics"]);
    expect(headerChips([...cats, { _id: "h9", type: "header", name: "Toys", sortOrder: 0 }])[0]).toEqual({ id: "h9", label: "Toys" });
  });

  it("copes with a missing or broken list", () => {
    expect(headerChips(undefined)).toEqual([]);
    expect(headerChips([null, {}, { type: "header" }])).toEqual([]);
  });
});

describe("which orders show under a category chip", () => {
  const grocery = delivered([item("p1", "h1")]);
  const mobile = delivered([item("p2", "h2")]);
  const mixed = delivered([item("p1", "h1"), item("p2", "h2")]);

  it("an order shows under every category it contains, and under All", () => {
    expect(orderHeaderIds(mixed).sort()).toEqual(["h1", "h2"]);
    expect(matchesHeader(grocery, "h1")).toBe(true);
    expect(matchesHeader(grocery, "h2")).toBe(false);
    expect(matchesHeader(mixed, "h1") && matchesHeader(mixed, "h2")).toBe(true);
    expect(matchesHeader(mobile, "all")).toBe(true);
    expect(matchesHeader(mobile, "")).toBe(true);
  });

  it("works when the header id is a plain string/ObjectId-like or missing", () => {
    expect(matchesHeader({ items: [{ product: { _id: "p", headerId: { _id: "h1" } } }] }, "h1")).toBe(true);
    expect(matchesHeader({ items: [{ product: "p-only-id" }] }, "h1")).toBe(false);
    expect(matchesHeader({ items: [] }, "h1")).toBe(false);
    expect(matchesHeader({}, "h1")).toBe(false);
  });
});

describe("Rate & Review only for delivered products", () => {
  it("delivered orders can be rated", () => {
    expect(canRateOrder(delivered([item("p1", "h1")]))).toBe(true);
    expect(canRateOrder({ workflowVersion: 1, status: "delivered", items: [item("p1", "h1")] })).toBe(true);
  });

  it.each([
    ["pending", { workflowVersion: 2, workflowStatus: "SELLER_PENDING", status: "pending" }],
    ["confirmed", { workflowVersion: 2, workflowStatus: "SELLER_ACCEPTED", status: "confirmed" }],
    ["packed", { workflowVersion: 2, workflowStatus: "PICKUP_READY", status: "packed" }],
    ["out for delivery", { workflowVersion: 2, workflowStatus: "OUT_FOR_DELIVERY", status: "out_for_delivery" }],
    ["cancelled", { workflowVersion: 2, workflowStatus: "CANCELLED", status: "cancelled" }],
    ["legacy shipped", { workflowVersion: 1, status: "packed" }],
  ])("a %s order cannot be rated", (_n, over) => {
    expect(canRateOrder({ ...over, items: [item("p1", "h1")] })).toBe(false);
    expect(ratableItems({ ...over, items: [item("p1", "h1")] })).toEqual([]);
  });

  it("not once a return or refund has started", () => {
    expect(canRateOrder(delivered([item("p1", "h1")], { returnStatus: "requested" }))).toBe(false);
    expect(canRateOrder(delivered([item("p1", "h1")], { returnStatus: "none" }))).toBe(true);
    expect(canRateOrder(delivered([item("p1", "h1")], { status: "refunded" }))).toBe(false);
    expect(canRateOrder(null)).toBe(false);
  });

  it("each product of a delivered order is offered once, with its id", () => {
    const o = delivered([item("p1", "h1", "A"), item("p2", "h2", "B"), item("p1", "h1", "A again")]);
    const r = ratableItems(o);
    expect(r.map((i) => i.productId)).toEqual(["p1", "p2"]);
    expect(itemProductId(o.items[0])).toBe("p1");
    expect(itemProductId({ product: "abc" })).toBe("abc");
    expect(itemProductId({})).toBe("");
  });
});
