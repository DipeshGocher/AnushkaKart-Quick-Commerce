import mongoose from "mongoose";
import Joi from "joi";
import { getErrorStatus } from "../app/utils/httpError.js";

describe("getErrorStatus", () => {
  it("keeps an explicit statusCode", () => {
    const err = new Error("Order not found");
    err.statusCode = 404;
    expect(getErrorStatus(err)).toBe(404);
  });

  it("maps a malformed ObjectId to 400", () => {
    const err = new mongoose.Error.CastError("ObjectId", "not-an-id", "_id");
    expect(getErrorStatus(err)).toBe(400);
  });

  it("maps schema validation failures to 400", () => {
    const Model = mongoose.model(
      "HttpErrorStatusProbe",
      new mongoose.Schema({ name: { type: String, required: true } }),
    );
    const err = new Model({}).validateSync();
    expect(getErrorStatus(err)).toBe(400);
  });

  it("maps Joi validation failures to 400", () => {
    const { error } = Joi.object({ a: Joi.number().required() }).validate({});
    expect(getErrorStatus(error)).toBe(400);
  });

  it("maps duplicate-key conflicts to 409", () => {
    expect(getErrorStatus({ code: 11000, message: "E11000 duplicate key" })).toBe(409);
  });

  it("treats everything else as 500", () => {
    expect(getErrorStatus(new Error("boom"))).toBe(500);
    expect(getErrorStatus(undefined)).toBe(500);
    expect(getErrorStatus({ statusCode: 200 })).toBe(500);
  });
});
