const Player = require("../models/Player");
const Question = require("../models/Question");
const redisClient = require("../utils/redisClient");

function socketHandler(io, socket) {
  let gameStartTime = null; // Таймерді сақтау үшін айнымалы

  socket.emit("message", "Сіз сервермен сәтті қосылдыңыз!");
  console.log("🔌 Қатысушы қосылды:", socket.id);

  const ROOM_CODE = "1952";

  socket.on("join_game", async ({ nickname, promoCode }) => {
    const gameActive = await redisClient.get("gameActive");
    if (gameActive !== "true") {
      socket.emit("game_not_started");
      return;
    }

    if (promoCode !== ROOM_CODE) {
      socket.emit("invalid_promo");
      return;
    }

    const allPlayers = await redisClient.hKeys("players");
    await redisClient.hSet("players", nickname, socket.id); // 👉 ойыншыны Redis ішіне қосамыз

    if (allPlayers.includes(nickname)) {
      socket.emit("nickname_taken");
      return;
    }

    socket.join(promoCode);
    console.log(`${nickname} бөлмеге қосылды! (${socket.id})`);

    await redisClient.set(`socket:${socket.id}`, nickname);

    // Ойыншы санын есептеу және Redis-те жаңарту
    const playersMap = await redisClient.hGetAll("players");
    const playerCount = Object.keys(playersMap).length; // Дұрыс есептеу
    await redisClient.set("playerCount", playerCount); // Жаңарту
    io.emit("update_player_count", playerCount); // Клиентке жаңартылған санды жіберу
    socket.emit("join_success", {
      nickname,
      socketId: socket.id,
    });
  });

  socket.on("disconnect", async () => {
    try {
      const nickname = await redisClient.get(`socket:${socket.id}`);
      if (nickname) {
        await redisClient.hDel("players", nickname);
        await redisClient.del(`socket:${socket.id}`);

        // Ойыншылар санын қайта есептеу
        const allPlayers = await redisClient.hGetAll("players");
        const playerCount = Object.keys(allPlayers).length; // Ойыншылар санын қайта есептеу
        await redisClient.set("playerCount", playerCount); // Redis-те жаңарту
        io.emit("update_player_count", playerCount); // Ойыншы санын клиентке жіберу
        console.log(`❌ Қатысушы шықты: ${nickname}`);
      }
    } catch (error) {
      console.error("❌ disconnect қатесі:", error);
    }
  });

  socket.on("reconnect_player", async ({ nickname }) => {
    try {
      const playerData = await redisClient.hGet("players", nickname);
      if (!playerData) return;

      const parsed = JSON.parse(playerData);
      parsed.socketId = socket.id;

      await redisClient.hSet("players", nickname, JSON.stringify(parsed));
      await redisClient.set(`socket:${socket.id}`, nickname);

      playerSockets.set(nickname, socket.id);

      // Ойыншылардың санын жаңарту
      const playersMap = await redisClient.hGetAll("players");
      const playerCount = Object.keys(playersMap).length;
      await redisClient.set("playerCount", playerCount); // Тек бір рет жаңарту
      io.emit("update_player_count", playerCount); // Жаңартылған санды клиентке жіберу

      console.log(`🔄 Ойыншы қайта қосылды: ${nickname}`);
    } catch (error) {
      console.error("❌ reconnect_player қатесі:", error);
    }
  });

  socket.on("create_game", async () => {
    try {
      // Redis-те барлық ойын деректерін өшіру
      await redisClient.del("players"); // Ойыншыларды тазалау
      await redisClient.del("playerCount"); // Ойыншылар саны
      await redisClient.del("leaderboard"); // Лидерборд
      await redisClient.del("questions"); // Сұрақтар
      await redisClient.del("correctAnswers"); // Дұрыс жауаптар
      await redisClient.del("currentQuestionIndex"); // Қазіргі сұрақтың индексі
      await redisClient.del("selectionOrder"); // Таңдау ретін сақтау

      // Базадан ойыншыларды өшіру
      await Player.deleteMany();
      console.log("🧹 Барлық ескі деректер Redis-те және базада тазаланды");

      // Жаңа ойын бастау
      await redisClient.set("gameActive", "true");

      await redisClient.set("count", 0); // Ойыншы саны
      io.emit("update_player_count", 0); // Клиенттерге ойыншылар саны

      console.log("🎮 Жаңа ойын құрылды");
    } catch (error) {
      console.error("❌ create_game қатесі:", error);
    }
  });

  socket.on("start_game", async () => {
    gameStartTime = Date.now(); // Сервердің нақты уақыты
    io.emit("game_started", { startTime: gameStartTime }); // Барлық ойыншыларға сервер уақытын жібереміз
    console.log(`Ойын басталды. Сервер уақыты: ${gameStartTime}`);

    // Ойын сұрақтарын жіберу
    let cachedQuestions = await redisClient.get("questions");
    if (!cachedQuestions) {
      currentQuestions = await Question.find().sort({ question_number: 1 });
      await redisClient.set("questions", JSON.stringify(currentQuestions), {
        EX: 60 * 5,
      });
    } else {
      currentQuestions = JSON.parse(cachedQuestions);
    }

    // Ойынның бірінші сұрағын көрсету
    const firstQuestionIndex = 0;
    await redisClient.set("currentQuestionIndex", firstQuestionIndex);
    io.emit("game_started", { startTime: gameStartTime });
    setTimeout(() => {
      sendCurrentQuestion(); // Алғашқы сұрақты жіберу
    }, 2000);
  });

  socket.on(
    "submit_answer",
    async ({ nickname, selectedIndex, questionNumber }) => {
      try {
        // Ойыншының жауап беру уақыты тек сервер уақытына негізделеді
        const timestamp = Date.now() - gameStartTime; // Сервер уақыты
        console.log(`${nickname} жауап берді. Уақыты: ${timestamp} мс`);

        // Сұрақты алу
        const number = Number(questionNumber) + 1;
        const currentQuestion = await Question.findOne({
          question_number: number,
        });
        if (!currentQuestion) {
          console.warn("❌ Сұрақ табылмады:", number);
          return;
        }

        const userAnswer = Number(selectedIndex);
        const correctAnswer = Number(currentQuestion.correctIndex);
        const isCorrect = userAnswer === correctAnswer;

        // Қате жауап болса, балл берілмейді
        if (!isCorrect) {
          console.log(`${nickname} қате жауап берді, балл берілмейді.`);
          return; // Балл бермеу
        }

        console.log("📩 Жауап қабылданды:", {
          nickname,
          selectedIndex,
          correctIndex: currentQuestion.correctIndex,
          isCorrect,
          timestamp,
        });

        // Ойыншының уақытын және жауап берген уақытын сақтау
        await redisClient.rPush(
          "correctAnswers",
          JSON.stringify({ nickname, timestamp })
        );

        // Таңдау ретін сақтау
        await handlePlayerSelection(socket, nickname, questionNumber);

        // Барлық ойыншылар жауап берген соң баллдарды есептеу
        const playersAnswered = await redisClient.lRange(
          "correctAnswers",
          0,
          -1
        );
        const playerCount = await redisClient.hLen("players");

        if (playersAnswered.length === playerCount) {
          await processAnswers(questionNumber);
        }
      } catch (error) {
        console.error("❌ submit_answer қатесі:", error);
      }
    }
  );

  async function handlePlayerSelection(socket, nickname, questionNumber) {
    const playerSelectionOrder = await redisClient.get(
      `selectionOrder:${questionNumber}`
    );

    const order = playerSelectionOrder ? JSON.parse(playerSelectionOrder) : [];

    // Ойыншының никнеймін және уақытын тізімге қосамыз
    order.push({ nickname, timestamp: Date.now() - gameStartTime }); // Сервер уақыты бойынша салыстыру

    // Рет бойынша сұрыптаймыз: бірінші жауап бергендер алдымен
    order.sort((a, b) => a.timestamp - b.timestamp);

    // Тізімді Redis-ке сақтаймыз
    await redisClient.set(
      `selectionOrder:${questionNumber}`,
      JSON.stringify(order)
    );
  }

  async function processAnswers(questionNumber) {
    const playerSelectionOrder = await redisClient.get(
      `selectionOrder:${questionNumber}`
    );

    if (!playerSelectionOrder) {
      console.log("Реттелген тізім жоқ!");
      return;
    }

    const order = JSON.parse(playerSelectionOrder);

    // Қате жауап бергендерді алып тастау
    const correctAnswers = await redisClient.lRange(
      `correctAnswers:${questionNumber}`,
      0,
      -1
    );

    const correctNicknames = correctAnswers.map(
      (answer) => JSON.parse(answer).nickname
    );

    // Тек дұрыс жауап бергендерді фильтрациялау
    const filteredOrder = order.filter((item) =>
      correctNicknames.includes(item.nickname)
    );

    // Дұрыс жауап бергендерге балл беру
    let baseScore = 5000;
    for (let i = 0; i < filteredOrder.length; i++) {
      const { nickname } = filteredOrder[i];
      let scoreToAdd = baseScore - i * 3; // Баллды сұрыптау бойынша есептеу
      if (scoreToAdd < 1000) scoreToAdd = 1000; // Балл минимумы

      // Ойыншыға балл беру
      await redisClient.zIncrBy("leaderboard", scoreToAdd, nickname);

      const redisPlayer = await redisClient.hGet("players", nickname);
      if (redisPlayer) {
        const parsed = JSON.parse(redisPlayer);
        const newScore = (parsed.score || 0) + scoreToAdd;

        await redisClient.hSet(
          "players",
          nickname,
          JSON.stringify({ socketId: parsed.socketId, score: newScore })
        );

        const socketId = parsed.socketId;
        if (socketId) {
          io.to(socketId).emit("score_update", { added: scoreToAdd });
        }
      }
    }

    // Ойыншылардың санын жаңарту
    const playerCount = filteredOrder.length;
    await redisClient.set("playerCount", playerCount);
    io.emit("update_player_count", playerCount);
  }

  async function sendCurrentQuestion() {
    const currentQuestionIndex = parseInt(
      (await redisClient.get("currentQuestionIndex")) || "0"
    );
    const cachedQuestions = await redisClient.get("questions");
    if (!cachedQuestions) return;

    const currentQuestions = JSON.parse(cachedQuestions);
    const q = currentQuestions[currentQuestionIndex];

    if (!q) {
      console.error("Сұрақ табылмады. Индекс:", currentQuestionIndex);
      return;
    }

    io.emit("question_quiz", {
      text: q.text,
      answers: q.options,
      correctIndex: q.correctIndex,
      number: currentQuestionIndex + 1,
      motivation: q.motivation,
    });
  }

  socket.on("next_question", async () => {
    try {
      const rawAnswers = await redisClient.lRange("correctAnswers", 0, -1);
      const correctAnswers = rawAnswers.map((str) => JSON.parse(str));
      correctAnswers.sort((a, b) => a.timestamp - b.timestamp);

      let baseScore = 5000;
      for (let i = 0; i < correctAnswers.length; i++) {
        const { nickname } = correctAnswers[i];
        let scoreToAdd = baseScore - i * 3;
        if (scoreToAdd < 1000) scoreToAdd = 1000;

        await redisClient.zIncrBy("leaderboard", scoreToAdd, nickname);

        const redisPlayer = await redisClient.hGet("players", nickname);
        if (redisPlayer) {
          const parsed = JSON.parse(redisPlayer);
          const newScore = (parsed.score || 0) + scoreToAdd;

          await redisClient.hSet(
            "players",
            nickname,
            JSON.stringify({ socketId: parsed.socketId, score: newScore })
          );

          const socketId = parsed.socketId;
          if (socketId) {
            io.to(socketId).emit("score_update", { added: scoreToAdd });
          }
        }
      }

      await redisClient.del("correctAnswers");

      let currentQuestionIndex = parseInt(
        (await redisClient.get("currentQuestionIndex")) || "0"
      );
      currentQuestionIndex += 1;
      await redisClient.set("currentQuestionIndex", currentQuestionIndex);

      const cachedQuestions = await redisClient.get("questions");
      if (!cachedQuestions) return;

      const currentQuestions = JSON.parse(cachedQuestions);

      if (currentQuestionIndex < currentQuestions.length) {
        const q = currentQuestions[currentQuestionIndex];
        io.emit("next_question_data", {
          text: q.text,
          answers: q.options,
          correctIndex: q.correctIndex,
          number: currentQuestionIndex + 1,
          motivation: q.motivation,
          startTime: Date.now(), // Сервер уақытын жібереміз
        });
      } else {
        console.log("✅ Барлық сұрақтар аяқталды");

        const allPlayers = await redisClient.hGetAll("players");
        const scores = await redisClient.zRangeWithScores(
          "leaderboard",
          0,
          -1,
          { REV: true }
        );

        console.log("🧾 Redis-тен алынған leaderboard:", scores);
        console.log("🔍 allPlayers map:", allPlayers);

        for (const entry of scores) {
          const nickname = entry.value;
          const score = entry.score;
          let socketId = "";
          const redisPlayerStr = await redisClient.hGet("players", nickname);
          if (redisPlayerStr) {
            try {
              const redisPlayer = JSON.parse(redisPlayerStr);
              socketId = redisPlayer.socketId || "";
            } catch (err) {
              console.error("❌ JSON parse error:", nickname, err);
            }
          }

          console.log("💾 MongoDB-ге жазып жатыр:", nickname, score, socketId);

          await Player.findOneAndUpdate(
            { nickname },
            { $set: { score, socketId } },
            { upsert: true }
          );
        }

        await redisClient.del("leaderboard");

        io.emit("quiz_finished");
      }
    } catch (error) {
      console.error("❌ next_question қатесі:", error);
    }
  });

  socket.on("end_game", async () => {
    try {
      gameActive = false;
      await redisClient.set("count", 0);
      await redisClient.set("gameActive", "false"); // Ойын аяқталды
      io.emit("update_player_count", 0);

      console.log("🏁 Ойын аяқталды");
    } catch (error) {
      console.error("❌ end_game қатесі:", error);
    }
  });

  socket.on("show_motivation", () => {
    socket.broadcast.emit("show_motivation");
  });
}

module.exports = socketHandler;
