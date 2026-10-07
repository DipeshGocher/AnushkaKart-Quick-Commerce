import mongoose from "mongoose";

const attributeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Attribute name is required"],
      trim: true,
      unique: true,
    },
    inputType: {
      type: String,
      enum: ["text", "dropdown", "number", "boolean"],
      default: "text",
    },
    options: [
      {
        type: String,
        trim: true,
      },
    ],
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Attribute", attributeSchema);
