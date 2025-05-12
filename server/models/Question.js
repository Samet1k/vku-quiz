const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema({
  text: String,
  options: [String],
  correctIndex: Number,
  question_number: Number, // 🆕 Қосылады
  motivation: String,
});

module.exports = mongoose.model("Question", questionSchema);
