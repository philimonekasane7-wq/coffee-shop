const { redisClient } = require("../config/redis");
const { randomUUID } = require("crypto");

// GET all menu items
async function getMenu(req, res) {
  try {
    const ids = await redisClient.sMembers("menu:ids");

    const items = await Promise.all(
      ids.map(async (id) => {
        const data = await redisClient.get(`menu:item:${id}`);
        return data ? JSON.parse(data) : null;
      })
    );

    res.status(200).json(items.filter(Boolean));
  } catch (error) {
    res.status(500).json({ error: "Failed to retrieve menu." });
  }
}

// GET one menu item
async function getMenuItem(req, res) {
  try {
    const item = await redisClient.get(
      `menu:item:${req.params.id}`
    );

    if (!item) {
      return res.status(404).json({ error: "Menu item not found." });
    }

    res.status(200).json(JSON.parse(item));
  } catch (error) {
    res.status(500).json({ error: "Failed to retrieve menu item." });
  }
}

// ADD a menu item
async function addMenuItem(req, res) {
  try {
    const { name, description, price, available } = req.body;

    if (!name || typeof name !== "string" ||
        typeof price !== "number" || !Number.isFinite(price) ||
        price <= 0 || typeof available !== "boolean") {
      return res.status(400).json({
        error: "Provide a valid name, positive price and availability."
      });
    }

    const item = {
      id: randomUUID(),
      name: name.trim(),
      description: description || "",
      price,
      available
    };

    await redisClient.set(
      `menu:item:${item.id}`,
      JSON.stringify(item)
    );

    await redisClient.sAdd("menu:ids", item.id);

    res.status(201).json(item);
  } catch (error) {
    res.status(500).json({ error: "Failed to add menu item." });
  }
}

// UPDATE a menu item
async function updateMenuItem(req, res) {
  try {
    const key = `menu:item:${req.params.id}`;
    const existing = await redisClient.get(key);

    if (!existing) {
      return res.status(404).json({ error: "Menu item not found." });
    }

    const oldItem = JSON.parse(existing);
    const { name, description, price, available } = req.body;

    if (name !== undefined &&
        (typeof name !== "string" || !name.trim())) {
      return res.status(400).json({ error: "Invalid name." });
    }

    if (price !== undefined &&
        (typeof price !== "number" || !Number.isFinite(price) || price <= 0)) {
      return res.status(400).json({ error: "Invalid price." });
    }

    if (available !== undefined && typeof available !== "boolean") {
      return res.status(400).json({ error: "Invalid availability." });
    }

    const updated = {
      ...oldItem,
      ...(name !== undefined && { name: name.trim() }),
      ...(description !== undefined && { description }),
      ...(price !== undefined && { price }),
      ...(available !== undefined && { available })
    };

    await redisClient.set(key, JSON.stringify(updated));

    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to update menu item." });
  }
}

// DELETE a menu item
async function deleteMenuItem(req, res) {
  try {
    const key = `menu:item:${req.params.id}`;
    const exists = await redisClient.exists(key);

    if (!exists) {
      return res.status(404).json({ error: "Menu item not found." });
    }

    await redisClient.del(key);
    await redisClient.sRem("menu:ids", req.params.id);

    res.status(200).json({
      success: true,
      message: "Menu item deleted successfully."
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete menu item." });
  }
}

module.exports = {
  getMenu,
  getMenuItem,
  addMenuItem,
  updateMenuItem,
  deleteMenuItem
};