const authenticateToken = require("../middleware/authMiddleware");

const express = require("express");

const router = express.Router();

const {
  getMenu,
  getMenuItem,
  addMenuItem,
  updateMenuItem,
  deleteMenuItem
} = require("../controllers/menuController");

// Retrieve all menu items
router.get("/", getMenu);

// Retrieve one menu item
router.get("/:id", getMenuItem);

// Add a menu item
router.post("/", addMenuItem);

// Update a menu item
router.put("/:id", updateMenuItem);

// Delete a menu item
router.delete("/:id", deleteMenuItem);

module.exports = router;