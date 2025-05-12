const { createClient } = require("redis");

const redisClient = createClient({
  url: "redis://localhost:6379", // Егер Docker қолдансаңыз, host басқа болуы мүмкін
});

redisClient.on("error", (err) => console.error("❌ Redis error", err));
redisClient.on("connect", () => console.log("✅ Redis қосылды"));

(async () => {
  await redisClient.connect();
})();



module.exports = redisClient;
