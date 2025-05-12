const countdown = document.getElementById("countdown_quiz");
const timerDisplay = document.getElementById("timer_quiz");
const questionNumber = document.getElementById("question-number_quiz");
const questionBox = document.getElementById("question_quiz");
const answers = document.querySelectorAll(".answer");
const answersBox = document.querySelector(".answers");
const motivationBox = document.getElementById("motivationText");

const socket = io("http://localhost:3000", {
  transports: ["websocket"], // Тек WebSocket қосылымын қолдану
});

const playerId = localStorage.getItem("playerId");
const nickname = localStorage.getItem("nickname");

if (playerId && nickname) {
  socket.emit("reconnect_player", { playerId, nickname });
}

// ------------------------------

let currentQuestionNumber = 0;

let time = 10;
let countdownTime = 3;
let countdownInterval;
let timerInterval;
let correctIndex = 0; // дұрыс жауаптың индексі

// Элементтерді жасырып қоямыз
function hideQuizUI() {
  document.querySelector(".top-bar").style.display = "none";
  questionBox.style.display = "none";
  document.querySelector(".answers").style.display = "none";
}

// Көрсету функциясы
function showQuizUI() {
  document.querySelector(".top-bar").style.display = "flex";
  questionBox.style.display = "block";
  document.querySelector(".answers").style.display = "grid";
}

// 3 секундтық санақ
function startCountdown() {
  countdown.style.display = "flex";
  countdown.textContent = countdownTime;
  hideQuizUI();

  countdownInterval = setInterval(() => {
    countdownTime--;
    countdown.textContent = countdownTime;
    if (countdownTime === 0) {
      clearInterval(countdownInterval);
      countdown.style.display = "none";
      showQuizUI();
      startTimer();
    }
  }, 1000);
}

motivationBox.style.display = "none";

let currentMotivation = "";

// 10 секундтық таймер
function startTimer() {
  time = 10;
  timerDisplay.textContent = `00:${time < 10 ? "0" + time : time}`;
  timerInterval = setInterval(() => {
    time--;
    timerDisplay.textContent = `00:${time < 10 ? "0" + time : time}`;
    if (time === 0) {
      clearInterval(timerInterval);
      showCorrectAnswer();
    }
  }, 1000);
}

socket.on("game_started", (data) => {
  gameStartTime = data.startTime; // Серверден келген уақыт
});

// Жауапты көрсету
// Жауапты көрсету
function showCorrectAnswer() {
  answers.forEach((btn, idx) => {
    btn.classList.remove("selected"); // Көк түсін алып тастаймыз

    if (selectedIndex === null) {
      console.log("⚠️ Жауап таңдалмады");
      // Мүлде жауап таңдалмады
      if (idx === correctIndex) {
        btn.classList.add("correct");
      } else {
        btn.classList.add("incorrect");
      }
    } else if (selectedIndex === correctIndex) {
      // Дұрыс жауап таңдалды — тек оны жасылмен боя
      if (idx === correctIndex) {
        btn.classList.add("correct");
      }
    } else {
      // Қате жауап таңдалды
      if (idx === selectedIndex) {
        btn.classList.add("incorrect");
      } else if (idx === correctIndex) {
        btn.classList.add("correct");
      }
      // Қалған жауаптар unchanged
    }
  });

  console.log("📤 submit_answer жіберілді:", {
    playerId,
    selectedIndex,
    questionNumber: currentQuestionNumber,
  });

  // ✅ Жібереміз, таңдалса да, таңдалмаса да
  socket.emit("submit_answer", {
    nickname: nickname, // ✅ localStorage-тен алынған nickname
    selectedIndex: selectedIndex, // ✅ қолданушы таңдаған нақты жауап
    questionNumber: currentQuestionNumber, // ✅ нақты сұрақ нөмірі
  });

  selectedIndex = null; // ✅ келесі сұрақ үшін тазарту
  motivationBox.style.display = "none"; // Келесі сұраққа дайындық
}

// Жауап басу
let selectedIndex = null; // қолданушы таңдаған жауап

answers.forEach((btn, idx) => {
  btn.addEventListener("click", () => {
    if (selectedIndex !== null) return; // қайта басылмау үшін

    selectedIndex = idx;

    answers.forEach((b) => (b.disabled = true));
    btn.classList.add("selected"); // көк түс (CSS)
  });
});

// Тапсырыс: бірінші 3 секунд → сосын сұрақ
startCountdown();

// -------------------------------------------------

// ------------------ Next btn logic ----------------

socket.on("next_question_data", (data) => {
  console.log("Ағымдағы сұрақ нөмірі:", currentQuestionNumber);

  countdownTime = 3;
  countdown.textContent = countdownTime;
  countdown.style.display = "flex";

  // Осы жолды қосыңыз:
  motivationBox.style.display = "none";

  hideQuizUI(); // Сұрақ пен жауаптарды жасыру

  const countdownInterval = setInterval(() => {
    countdownTime--;
    countdown.textContent = countdownTime;

    if (countdownTime === 0) {
      clearInterval(countdownInterval);
      countdown.style.display = "none";

      // Сұрақты көрсету
      showQuizUI();
      questionNumber.textContent = `Вопрос №${data.number}`;
      currentQuestionNumber = data.number - 1;
      questionBox.textContent = data.text;

      answers.forEach((btn, idx) => {
        btn.textContent = data.answers[idx];
        btn.classList.remove("correct", "incorrect", "selected");
        btn.style.display = "block";
        btn.disabled = false;
      });

      correctIndex = data.correctIndex;
      selectedIndex = null;

      currentMotivation = data.motivation || "";
      motivationBox.style.display = "none"; // Тағы да қосыңыз

      startTimer();
    }
  }, 1000);
});


// 'question_quiz' оқиғасын тыңдау
socket.on("question_quiz", (data) => {
  console.log(data); // Сұрақты консольға шығару

  currentQuestionNumber = data.number - 1;

  // Сұрақты көрсету
  questionNumber.textContent = `Вопрос №${data.number}`;

  questionBox.textContent = data.text;

  currentMotivation = data.motivation || "";

  const answers = document.querySelectorAll(".answer");
  answers.forEach((btn, idx) => {
    btn.textContent = data.answers[idx];
    btn.style.display = "block"; // Жауаптарды көрсету
  });

  // Дұрыс жауаптың индексі
  correctIndex = data.correctIndex;
});

socket.on("show_motivation", () => {
  questionBox.style.display = "none";
  answersBox.style.display = "none";
  motivationBox.textContent = currentMotivation || "Жарайсың! Жалғастыр!";
  motivationBox.style.display = "block";
});

socket.on("score_update", ({ added }) => {
  let total = Number(localStorage.getItem("score")) || 0;
  total += added;
  localStorage.setItem("score", total);
});

socket.on("join_success", (data) => {
  localStorage.setItem("nickname", data.nickname);
  localStorage.setItem("playerId", data.socketId); // ✅ міндетті түрде керек
});

socket.on("quiz_finished", () => {
  const nickname = localStorage.getItem("nickname");
  if (nickname) {
    window.location.href = `/player/result.html?nickname=${nickname}`;
  } else {
    console.error("Nickname табылмады!");
  }
});
