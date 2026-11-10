const { redisClient } = require("../config/redis");
const { randomUUID } = require("crypto");

// CREATE a customer order
async function createOrder(req, res) {
  try {
    const { customerName, customerContact, items } = req.body;

    // Validate customer details
    if (
      typeof customerName !== "string" ||
      !customerName.trim() ||
      typeof customerContact !== "string" ||
      !customerContact.trim()
    ) {
      return res.status(400).json({
        error: "Customer name and contact are required."
      });
    }

    // Validate order items
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: "Please add at least one item to your order."
      });
    }

    const orderItems = [];
    let total = 0;

    // Retrieve products and calculate the total on the server
    for (const requestedItem of items) {
      const { id, quantity } = requestedItem;

      if (
        typeof id !== "string" ||
        !Number.isInteger(quantity) ||
        quantity <= 0
      ) {
        return res.status(400).json({
          error: "Each item needs a valid ID and positive quantity."
        });
      }

      const productData = await redisClient.get(`menu:item:${id}`);

      if (!productData) {
        return res.status(404).json({
          error: `Menu item ${id} was not found.`
        });
      }

      const product = JSON.parse(productData);

      if (!product.available) {
        return res.status(400).json({
          error: `${product.name} is currently unavailable.`
        });
      }

      const itemTotal = product.price * quantity;
      total += itemTotal;

      orderItems.push({
        id: product.id,
        name: product.name,
        price: product.price,
        quantity,
        itemTotal
      });
    }

    // Create the order
    const orderId = randomUUID();

    const order = {
      id: orderId,
      orderNumber: `CS-${Date.now()}`,
      customerName: customerName.trim(),
      customerContact: customerContact.trim(),
      items: orderItems,
      total: Number(total.toFixed(2)),
      status: "Pending",
      createdAt: new Date().toISOString()
    };

    // Save the order in Redis
    await redisClient.set(
      `order:${orderId}`,
      JSON.stringify(order)
    );

    await redisClient.sAdd("orders:ids", orderId);

    res.status(201).json({
      success: true,
      message: "Order placed successfully.",
      order
    });

  } catch (error) {
    console.error("Create order error:", error.message);

    res.status(500).json({
      error: "Failed to place order."
    });
  }
}

// GET all customer orders
async function getOrders(req, res) {
  try {
    const ids = await redisClient.sMembers("orders:ids");

    const orders = await Promise.all(
      ids.map(async (id) => {
        const data = await redisClient.get(`order:${id}`);
        return data ? JSON.parse(data) : null;
      })
    );

    const validOrders = orders.filter(Boolean);

    // Display newest orders first
    validOrders.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    res.status(200).json(validOrders);

  } catch (error) {
    console.error("Get orders error:", error.message);

    res.status(500).json({
      error: "Failed to retrieve orders."
    });
  }
}


async function getOrderById(req, res) {
  try {
    const orderId = req.params.id;

    console.log("Searching for order:", orderId);

    const data = await redisClient.get(`order:${orderId}`);

    console.log("Redis returned:", data);

    if (!data) {
      return res.status(404).json({
        error: "Order not found."
      });
    }

    const order = JSON.parse(data);

    res.status(200).json({
      success: true,
      order
    });

  } catch (error) {
    console.error("Get order by ID error:", error);

    res.status(500).json({
      error: "Failed to retrieve order.",
      details: error.message
    });
  }
}


// UPDATE order status
async function updateOrderStatus(req, res) {
  try {
    const { status } = req.body;
    const orderId = req.params.id;

    const allowedStatuses = [
      "Pending",
      "Preparing",
      "Ready",
      "Collected"
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        error: "Invalid order status."
      });
    }

    const key = `order:${orderId}`;
    const data = await redisClient.get(key);

    if (!data) {
      return res.status(404).json({
        error: "Order not found."
      });
    }

    const order = JSON.parse(data);

    order.status = status;

    await redisClient.set(key, JSON.stringify(order));

    res.status(200).json({
      success: true,
      message: "Order status updated successfully.",
      order
    });

  } catch (error) {
    console.error("Update order status error:", error.message);

    res.status(500).json({
      error: "Failed to update order status."
    });
  }
}

module.exports = {
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus
};