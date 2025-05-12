const socket = io("http://localhost:3000", {
  transports: ["websocket"],  // Тек WebSocket қосылымын қолдану
});


socket.on("connect_error", (err) => {
  console.error("Серверге қосылу қатесі:", err);
});

const form = document.getElementById("joinForm");

form.addEventListener("submit", function (e) {
  e.preventDefault();

  const nickname = document.getElementById("nickname").value.trim();
  const promoCode = document.getElementById("promocode").value.trim();

  if (!nickname || !promoCode) {
    alert("Барлық өрістерді толтырыңыз!");
    return;
  }

  localStorage.setItem("nickname", nickname);
  localStorage.setItem("promoCode", promoCode);

  socket.emit("join_game", { nickname, promoCode });
});

socket.on("usersCount", (count) => {
  document.getElementById("users-count").textContent = count;
});

socket.on("invalid_promo", () => {
  alert("❌ Промокод қате!");
});

socket.on("game_not_started", () => {
  alert("⏳ Игра еще не создана!");
});

// ✅ Міне осы жер өзгертілді
socket.on("join_success", ({ playerId }) => {
  // MongoDB ID-ны сақтау
  localStorage.setItem("playerId", playerId);

  window.location.href = "waiting.html";
});

socket.on("nickname_taken", () => {
  alert("❗ Бұл никнейм қазір қолданыста. Басқасын таңдаңыз.");
});
