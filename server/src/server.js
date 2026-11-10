
require("dotenv").config();

const app = require("./app");
const { connectRedis } = require("./config/redis");

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // Connect to Redis first
    await connectRedis();

    // Start Express after Redis connects
    app.listen(PORT, () => {
      console.log(`Coffee Shop server running on port ${PORT}`);
    });

  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
}

startServer();
