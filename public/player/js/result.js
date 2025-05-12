window.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const nickname = urlParams.get("nickname"); // ✅ playerId емес, nickname

  if (!nickname) {
    return showError("Nickname табылмады.");
  }

  try {
    // 1. Ойыншы деректерін алу
    const playerRes = await fetch(`/api/player-nick/${nickname}`); // ✅ Түзетілген маршрут
    if (!playerRes.ok) throw new Error("Player табылмады.");
    const playerData = await playerRes.json();

    // 2. Рейтинг алу
    const rankRes = await fetch(`/my-rank-nick/${nickname}`); // ✅ Жаңа маршрут
    if (!rankRes.ok) throw new Error("Рейтинг табылмады.");
    const rankData = await rankRes.json();

    // 3. Көрсету
    document.getElementById("nickname").textContent = `Player: ${playerData.nickname}`;
    document.getElementById("score").textContent = `Score: ${playerData.score}`;
    document.getElementById("place").textContent = `Place: ${rankData.rank}`;
  } catch (err) {
    console.error(err);
    showError("Қате шықты.");
  }
});

function showError(message) {
  document.getElementById("nickname").textContent = message;
  document.getElementById("score").textContent = "";
  document.getElementById("place").textContent = "";
}

function goHome() {
  window.location.href = "../player/index.html";
}
