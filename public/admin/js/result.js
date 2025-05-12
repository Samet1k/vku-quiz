document.addEventListener("DOMContentLoaded", async () => {
  try {
    const response = await fetch("/top10");
    const topPlayers = await response.json();

    const top10List = document.getElementById("top10List");
    top10List.innerHTML = "";

    topPlayers.forEach((player, index) => {
      const place = getOrdinal(index + 1);
      const item = document.createElement("div");
      item.classList.add("top10-item");
      item.textContent = `${place} | ${player.nickname}: ${player.score} ұпай`;
      top10List.appendChild(item);
    });
  } catch (error) {
    console.error("Ошибка при загрузке топ-10:", error);
  }
});

function getOrdinal(n) {
  const s = ["th", "st", "nd", "rd"],
    v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

const socket = io("http://localhost:3000", {
  transports: ["websocket"], // Тек WebSocket қосылымын қолдану
});

function goHome() {
  socket.emit("end_game");
  window.location.href = "../admin/index.html";
}
