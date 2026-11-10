
const express = require("express");
const router = express.Router();

const authenticateToken = require("../middleware/authMiddleware");

const {
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus
} = require("../controllers/orderController");

// Customer places an order
router.post("/", createOrder);

// Staff views all orders
router.get("/", authenticateToken, getOrders);

// View a specific order
router.get("/:id", getOrderById);

// Staff updates order status
router.patch("/:id/status", authenticateToken, updateOrderStatus);

module.exports = router;
