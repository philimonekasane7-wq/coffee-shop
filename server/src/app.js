
const express = require("express");
const cors = require("cors");

const app = express();

const menuRoutes = require("./routes/menuRoutes");
const authRoutes = require("./routes/authRoutes");
const orderRoutes = require("./routes/orderRoutes");

app.use(cors({
  origin: [
    "http://localhost:5173",
    process.env.CLIENT_ORIGIN
  ].filter(Boolean)
}));

app.use(express.json());

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Coffee Shop API is running!"
  });
});

app.use("/api/menu", menuRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/orders", orderRoutes);

module.exports = app;
