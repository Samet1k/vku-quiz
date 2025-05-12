const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const { createAdapter } = require("@socket.io/redis-adapter");
const { createClient } = require("redis");
const path = require("path");
const socketHandler = require("./sockets/socketHandler");
const Player = require("./models/Player");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

const io = require("socket.io")(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket"],
});

const pubClient = createClient({ url: "redis://localhost:6379" });
const subClient = pubClient.duplicate();

Promise.all([
  pubClient.connect(),
  subClient.connect(),
  mongoose.connect(
    "mongodb+srv://chidorykz:qwerty123@quizdb.canw8yf.mongodb.net/quizdb?retryWrites=true&w=majority"
  ),
])
  .then(() => {
    console.log("✅ Redis және MongoDB қосылды");

    // Redis адаптерін Socket.IO-ға қосу
    io.adapter(createAdapter(pubClient, subClient));

    // Socket қосылымдарын қабылдау
    io.on("connection", (socket) => socketHandler(io, socket));

    // Серверді іске қосу
    server.listen(process.env.PORT || 3000, () => {
      console.log(`🚀 Worker ${process.pid}: http://localhost:3000`);
    });
  })
  .catch((err) => {
    console.error("❌ Redis немесе MongoDB қосылмады:", err);
    process.exit(1);
  });

// Middleware
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  })
);
app.use(express.static(path.join(__dirname, "../public")));

// Routes
app.get("/top10", async (req, res) => {
  try {
    const topPlayers = await Player.find().sort({ score: -1 }).limit(10);
    res.json(topPlayers);
  } catch (e) {
    res.status(500).json({ error: "Сервер қатесі" });
  }
});

app.get("/api/player-nick/:nickname", async (req, res) => {
  try {
    const { nickname } = req.params;
    const player = await Player.findOne({ nickname });
    if (!player) {
      return res.status(404).json({ error: "Player not found" });
    }
    res.json(player);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/my-rank-nick/:nickname", async (req, res) => {
  try {
    const { nickname } = req.params;
    const player = await Player.findOne({ nickname });
    if (!player) {
      return res.status(404).json({ error: "Player not found" });
    }
    const rank = await Player.countDocuments({ score: { $gt: player.score } }) + 1;
    res.json({ rank });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});
