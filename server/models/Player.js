const mongoose = require("mongoose");

const playerSchema = new mongoose.Schema({
  nickname: { type: String, required: true, unique: true },
  score: { type: Number, default: 0 },
  // socketId: String,
});

module.exports = mongoose.model("Player", playerSchema);
