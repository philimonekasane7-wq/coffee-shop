const { createClient } = require("redis");

const redisClient = createClient({
  url: process.env.REDIS_URL
});

redisClient.on("error", (error) => {
  console.error("Redis connection error:", error.message);
});

async function connectRedis() {
  if (!process.env.REDIS_URL) {
    throw new Error("REDIS_URL is missing from the .env file.");
  }

  if (!redisClient.isOpen) {
    await redisClient.connect();
  }

  console.log("Connected to Redis successfully!");
}

module.exports = {
  redisClient,
  connectRedis
};