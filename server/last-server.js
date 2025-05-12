const express = require("express");
const mongoose = require("mongoose");
const http = require("http");
const path = require("path");
const cors = require("cors");
const Question = require("./models/Question");
const Player = require("./models/Player");
const PORT = 3000;
const app = express();
const socketIo = require("socket.io");

const server = http.createServer(app);
const io = socketIo(server);

let correctAnswers = []; // Дұрыс жауап бергендердің тізімі (playerId + timestamp)
const playerSockets = new Map(); // playerId → socketId байланысы

let players = []; // Жадтағы ойыншылар тізімі

// Static файлдарды беру (frontend HTML, CSS, JS)
app.use(express.static(path.join(__dirname, "../public")));

app.use(
  cors({
    origin: "*", // немесе нақты домен
    credentials: true,
  })
);

// ----------------------

// MongoDB қосылу
mongoose
  .connect(
    "mongodb+srv://chidorykz:qwerty123@quizdb.canw8yf.mongodb.net/quizdb?retryWrites=true&w=majority&appName=quizdb"
  )
  .then(async () => {
    console.log("✅ MongoDB-ге қосылды");
    server.listen(PORT, () => {
      console.log(
        `🚀 Сервер http://localhost:${PORT} портында жұмыс істеп тұр`
      );
    });
  })
  .catch((err) => console.error("❌ MongoDB қате:", err));

app.get("/top10", async (req, res) => {
  try {
    const topPlayers = await Player.find().sort({ score: -1 }).limit(10);
    res.json(topPlayers);
  } catch (error) {
    res.status(500).json({ error: "Сервер қатесі" });
  }
});

app.post("/join", async (req, res) => {
  const { nickname } = req.body;

  const newPlayer = new Player({ nickname, score: 0 });
  await newPlayer.save();

  res.json({
    playerId: newPlayer._id,
    nickname: newPlayer.nickname,
  });
});

app.get("/my-rank/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const players = await Player.find().sort({ score: -1 });

    const index = players.findIndex((p) => p._id.toString() === id);

    if (index !== -1) {
      res.json({ rank: index + 1 });
    } else {
      res.status(404).json({ error: "Player not found" });
    }
  } catch (error) {
    res.status(500).json({ error: "Сервер қатесі" });
  }
});

app.get("/api/player/:id", async (req, res) => {
  const playerId = req.params.id;
  const player = await Player.findById(playerId);
  if (!player) return res.status(404).json({ error: "Player not found" });
  res.json(player);
});

// Ойын күйі
let gameActive = false;
let currentQuestions = [];
let currentQuestionIndex = 0;

//--------- Socket логикасы -------------

io.on("connection", (socket) => {
  socket.emit("message", "Сіз сервермен сәтті қосылдыңыз!");
  console.log("🔌 Қатысушы қосылды:", socket.id);

  //----------- check --------------------

  // socket.on("answer", (data) => {
  //   console.log("📨 Answer received:", data.nickname);
  //   socket.emit("answer-received", { success: true });
  // });

  // ------- join ------------

  socket.on("join_game", async ({ nickname, promoCode }) => {
    if (!gameActive) {
      socket.emit("game_not_started");
      return;
    }

    if (promoCode !== "1952") {
      socket.emit("invalid_promo");
      return;
    }

    // ✅ Бір сессия ішінде ғана бірегей болу үшін
    const duplicateInMemory = players.find((p) => p.nickname === nickname);
    if (duplicateInMemory) {
      socket.emit("nickname_taken");
      return;
    }

    // ✅ Ескі ойыншылардан тазарту (ескі мәліметтер базада қалуы мүмкін)
    let player = await Player.findOne({ nickname });
    if (!player) {
      player = new Player({
        nickname,
        score: 0,
        socketId: socket.id,
      });
      await player.save();
      console.log(`✅ Жаңа ойыншы қосылды: ${nickname}`);
    } else {
      // Мұнда ескі ойыншы қайта қосылып жатса — тек ойын белсенді болса ғана
      player.socketId = socket.id;
      await player.save();
      console.log(`♻️ Қайта қосылған ойыншы: ${nickname}`);
      console.log(player.socketId);
    }

    players.push({ id: socket.id, nickname });
    io.emit("update_player_count", players.length);

    socket.emit("join_success", {
      playerId: player._id,
      nickname: player.nickname,
    });

    playerSockets.set(player._id.toString(), socket.id);
  });

  // --------------------------------

  socket.on("reconnect_player", async ({ playerId, nickname }) => {
    const player = await Player.findById(playerId);
    if (player) {
      player.socketId = socket.id;
      await player.save();
      console.log(`🔄 Ойыншы қайта қосылды (quiz.html): ${nickname}`);
      console.log(player.socketId);

      // Егер disconnect кезінде players массивінен алынып тасталса — қайта қосу:
      const exists = players.find((p) => p.id === socket.id);
      if (!exists) {
        players.push({ id: socket.id, nickname });
        io.emit("update_player_count", players.length);
      }
    }
  });

  // --------------------------------

  socket.on(
    "submit_answer",
    async ({ playerId, selectedIndex, questionNumber }) => {
      console.log("📩 Жауап қабылданды:", {
        playerId,
        selectedIndex,
        questionNumber,
      });

      const number = Number(questionNumber) + 1;

      if (isNaN(number)) {
        console.error("❌ questionNumber is not a number:", questionNumber);
        return;
      }

      const currentQuestion = await Question.findOne({
        question_number: number,
      });
      if (!currentQuestion) return;

      const isCorrect = selectedIndex === currentQuestion.correctIndex;

      const player = players.find((p) => p.id === socket.id);
      if (!player) return;

      const alreadyAnswered = correctAnswers.some(
        (p) => p.playerId === playerId
      );
      if (alreadyAnswered) return;

      if (isCorrect) {
        correctAnswers.push({
          playerId,
          nickname: player.nickname,
          timestamp: Date.now(),
        });
      }
    }
  );

  // -------------------------------

  socket.on("create_game", async () => {
    await Player.deleteMany();
    console.log("🧹 Ескі ойыншылар тазаланды");
    gameActive = true;
    players = [];
    currentQuestions = [];
    currentQuestionIndex = 0;
    io.emit("update_player_count", 0);
    console.log("🎮 Жаңа ойын құрылды");
  });

  socket.on("start_game", async () => {
    currentQuestions = await Question.find().sort({ question_number: 1 });
    // console.log("📦 Сұрақтар:", currentQuestions);
    currentQuestionIndex = 0;
    io.emit("game_started");

    setTimeout(() => {
      sendCurrentQuestion();
    }, 2000);
  });

  function sendCurrentQuestion() {
    const q = currentQuestions[currentQuestionIndex];
    // console.log("📤 Сұрақ жіберілді:", q);
    io.emit("question_quiz", {
      text: q.text,
      answers: q.options,
      correctIndex: q.correctIndex,
      number: currentQuestionIndex + 1,
      motivation: q.motivation,
    });
  }

  socket.on("end_game", () => {
    gameActive = false;
    players = [];
    io.emit("update_player_count", 0);
    console.log("🏁 Ойын аяқталды");
  });

  socket.on("disconnect", () => {
    const index = players.findIndex((p) => p.id === socket.id);
    if (index !== -1) {
      const nickname = players[index].nickname;
      players.splice(index, 1);
      console.log(`❌ Қатысушы шықты: ${nickname}`);
      io.emit("update_player_count", players.length);
    }
  });

  socket.on("show_motivation", () => {
    // Барлық қатысушыларға жібереміз
    socket.broadcast.emit("show_motivation");
  });

  //----------- next question -------------------

  socket.on("next_question", async () => {
    console.log("✅ Дұрыс жауап бергендер:", correctAnswers);

    correctAnswers.sort((a, b) => a.timestamp - b.timestamp);
    let baseScore = 5000; // 🟢 Дәл осы жол 5000-ды бастапқы ұпай ретінде қояды

    for (let i = 0; i < correctAnswers.length; i++) {
      const { playerId, nickname } = correctAnswers[i];
      const scoreToAdd = baseScore - i * 3;

      await Player.findByIdAndUpdate(playerId, { $inc: { score: scoreToAdd } });

      console.log(`✅ ${nickname} (${playerId}) ұпай алды: ${scoreToAdd}`);

      const socketId = playerSockets.get(playerId);
      if (socketId) {
        io.to(socketId).emit("score_update", { added: scoreToAdd });
      }
    }

    correctAnswers = [];

    currentQuestionIndex++;
    if (currentQuestionIndex < currentQuestions.length) {
      const q = currentQuestions[currentQuestionIndex];
      console.log("📤 Келесі сұрақ in (next_question):", q);
      io.emit("next_question_data", {
        text: q.text,
        answers: q.options,
        correctIndex: q.correctIndex,
        number: currentQuestionIndex + 1,
        motivation: q.motivation,
      });
    } else {
      console.log("✅ Барлық сұрақтар аяқталды");
      io.emit("quiz_finished");
    }
  });
});

// ---------------------------
