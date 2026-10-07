import Attribute from "../models/attribute.js";
import Category from "../models/category.js";
import handleResponse from "../utils/helper.js";

/**
 * Get all available attributes
 */
export const getAttributes = async (req, res) => {
  try {
    const { status, search } = req.query;
    const query = {};
    if (status) {
      query.status = status;
    }
    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    const attributes = await Attribute.find(query).sort({ name: 1 }).lean();
    return handleResponse(res, 200, "Attributes fetched successfully", attributes);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/**
 * Create a new attribute
 */
export const createAttribute = async (req, res) => {
  try {
    const { name, inputType, options, status } = req.body;
    if (!name || !name.trim()) {
      return handleResponse(res, 400, "Attribute name is required");
    }

    const existing = await Attribute.findOne({ name: name.trim() });
    if (existing) {
      return handleResponse(res, 400, "Attribute with this name already exists");
    }

    const newAttribute = await Attribute.create({
      name: name.trim(),
      inputType: inputType || "text",
      options: Array.isArray(options) ? options.map((o) => String(o).trim()).filter(Boolean) : [],
      status: status || "active",
    });

    return handleResponse(res, 201, "Attribute created successfully", newAttribute);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/**
 * Update an existing attribute
 */
export const updateAttribute = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, inputType, options, status } = req.body;

    const attribute = await Attribute.findById(id);
    if (!attribute) {
      return handleResponse(res, 404, "Attribute not found");
    }

    if (name && name.trim() !== attribute.name) {
      const existing = await Attribute.findOne({ name: name.trim(), _id: { $ne: id } });
      if (existing) {
        return handleResponse(res, 400, "Another attribute with this name already exists");
      }
      attribute.name = name.trim();
    }

    if (inputType) attribute.inputType = inputType;
    if (Array.isArray(options)) {
      attribute.options = options.map((o) => String(o).trim()).filter(Boolean);
    }
    if (status) attribute.status = status;

    await attribute.save();
    return handleResponse(res, 200, "Attribute updated successfully", attribute);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/**
 * Delete an attribute
 */
export const deleteAttribute = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Attribute.findByIdAndDelete(id);
    if (!deleted) {
      return handleResponse(res, 404, "Attribute not found");
    }
    // Also remove from any category mappings
    await Category.updateMany(
      { "mappedAttributes.attributeId": id },
      { $pull: { mappedAttributes: { attributeId: id } } }
    );

    return handleResponse(res, 200, "Attribute deleted successfully");
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/**
 * Get effective attributes for a category (and its ancestors)
 * Useful for the dynamic "Add Product" form.
 */
export const getCategoryAttributes = async (req, res) => {
  try {
    const { categoryId } = req.params;
    if (!categoryId) {
      return handleResponse(res, 400, "Category ID is required");
    }

    // Traverse ancestors up to root header
    const categoryChain = [];
    let currentId = categoryId;

    while (currentId) {
      const cat = await Category.findById(currentId)
        .populate("mappedAttributes.attributeId")
        .select("name type parentId mappedAttributes")
        .lean();

      if (!cat) break;
      categoryChain.push(cat);
      currentId = cat.parentId;
    }

    // Merge attributes, avoiding duplicates (lower-level/specific overrides or combines)
    const attributeMap = new Map();

    // Iterate backwards (from root header down to subcategory) so subcategory overrides if needed
    for (let i = categoryChain.length - 1; i >= 0; i--) {
      const cat = categoryChain[i];
      if (Array.isArray(cat.mappedAttributes)) {
        for (const item of cat.mappedAttributes) {
          if (item && item.attributeId) {
            const attr = item.attributeId;
            attributeMap.set(String(attr._id), {
              _id: attr._id,
              name: attr.name,
              inputType: attr.inputType,
              options: attr.options || [],
              isRequired: !!item.isRequired,
              inheritedFrom: cat.name,
              categoryType: cat.type,
            });
          }
        }
      }
    }

    const mergedAttributes = Array.from(attributeMap.values());
    return handleResponse(res, 200, "Category attributes fetched successfully", mergedAttributes);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};
