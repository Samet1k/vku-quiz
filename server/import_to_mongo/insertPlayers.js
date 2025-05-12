const mongoose = require("mongoose");
const Player = require("../models/Player"); // Модель дұрыс жолда тұрғанына көз жеткіз

mongoose.connect("mongodb+srv://chidorykz:qwerty123@quizdb.canw8yf.mongodb.net/quizdb?retryWrites=true&w=majority&appName=quizdb")
  .then(async () => {
    console.log("✅ MongoDB-ге қосылды!");

    await Player.deleteMany(); // Ескі ойыншыларды өшіреміз
    console.log("🧹 Ескі ойыншылар тазаланды");

    const samplePlayers = [
      { nickname: "Алия", score: 35000 },
      { nickname: "Нурбол", score: 34000 },
      { nickname: "Меруерт", score: 33000 },
      { nickname: "Ерасыл", score: 32000 },
      { nickname: "Жансая", score: 31000 },
      { nickname: "Арман", score: 30000 },
      { nickname: "Диас", score: 29500 },
      { nickname: "Сая", score: 29000 },
      { nickname: "Аяжан", score: 28500 },
      { nickname: "Мақсат", score: 28000 },
      { nickname: "Айдана", score: 27500 },
      { nickname: "Талғат", score: 27000 },
      { nickname: "Жаннұр", score: 26500 },
      { nickname: "Серік", score: 26000 },
      { nickname: "Асел", score: 25000 },
    ];

    await Player.insertMany(samplePlayers);
    console.log("✅ Барлық ойыншылар енгізілді!");

    mongoose.disconnect();
  })
  .catch(err => console.error("❌ Қате:", err));
