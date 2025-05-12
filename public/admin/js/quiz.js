const countdown = document.getElementById("countdown_quiz");
const timerDisplay = document.getElementById("timer_quiz");
const questionNumber = document.getElementById("question-number_quiz");
const questionBox = document.getElementById("question_quiz");
const answers = document.querySelectorAll(".answer");
const answersBox = document.querySelector(".answers");
const nextButton = document.getElementById("nextBtn_quiz");
const motivBtn = document.getElementById("motivBtn_quiz");
const motivationBox = document.getElementById("motivationText");

// ------------------------------

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

nextButton.style.display = "none";
motivBtn.style.display = "none";
motivationBox.style.display = "none";

let selectedIndex = null;
let currentMotivation = "";

// Тапсырыс: бірінші 3 секунд → сосын сұрақ
startCountdown();

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

// Жауапты көрсету
function showCorrectAnswer() {
  answers.forEach((btn, idx) => {
    btn.classList.remove("selected"); // Көк түсін алып тастаймыз

    if (selectedIndex === null) {
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

  // Мотивация мәтіні жоқ болса — "Келесі" батырмасын көрсетеміз
  if (!currentMotivation || currentMotivation.trim() === "") {
    nextButton.style.display = "inline-block";
    motivBtn.style.display = "none";
  } else {
    nextButton.style.display = "none";
    motivBtn.style.display = "inline-block";
    motivationBox.style.display = "none";
  }
}

motivBtn.addEventListener("click", () => {
  // UI өзгерістер
  questionBox.style.display = "none";
  answersBox.style.display = "none";
  motivationBox.textContent = currentMotivation || "Жарайсың! Жалғастыр!";
  motivationBox.style.display = "block";
  motivBtn.style.display = "none";
  nextButton.style.display = "inline-block";

  // Қатысушыларға мотивация көрсету сигналы
  socket.emit("show_motivation");
});

// ------------------ Next btn logic ----------------

const socket = io("http://localhost:3000", {
  transports: ["websocket"], // Тек WebSocket қосылымын қолдану
});

const nextBtn = document.getElementById("nextBtn_quiz");

// Батырма басылғанда серверге келесі сұрақты сұратамыз
nextBtn.addEventListener("click", () => {
  motivationBox.style.display = "none";
  socket.emit("next_question");
  nextBtn.style.display = "none"; // Қайтадан жасырып қоямыз
});

socket.on("next_question_data", (data) => {
  countdownTime = 3;
  countdown.textContent = countdownTime;
  countdown.style.display = "flex";

  hideQuizUI(); // Сұрақ пен жауаптарды жасыру

  // clearInterval(countdownInterval);
  const countdownInterval = setInterval(() => {
    countdownTime--;
    countdown.textContent = countdownTime;

    if (countdownTime === 0) {
      clearInterval(countdownInterval);
      countdown.style.display = "none";

      // Сұрақты көрсету
      showQuizUI();
      questionNumber.textContent = `Вопрос №${data.number}`;
      questionBox.textContent = data.text;

      answers.forEach((btn, idx) => {
        btn.textContent = data.answers[idx];
        btn.classList.remove("correct", "incorrect", "selected");
        btn.style.display = "block";
      });

      correctIndex = data.correctIndex;
      selectedIndex = null;

      currentMotivation = data.motivation || "";
      motivBtn.style.display = "none";
      motivationBox.style.display = "none";

      startTimer();
    }
  }, 1000);
});

// ------------------------------------------------------------------

// console.log('aiaiaiaiiaiiaufdsfhahsdkjfhsakdjhhf');

// ----------------------

// 'question_quiz' оқиғасын тыңдау
socket.on("question_quiz", (data) => {
  console.log(data); // Сұрақты консольға шығару

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

socket.on("quiz_finished", (top10) => {
  // localStorage арқылы деректерді result.html бетіне өткізу
  window.location.href = "../admin/result.html";
});
