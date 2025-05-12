document.addEventListener("DOMContentLoaded", function () {
    const startBtn = document.getElementById("startGameBtn");
    if (startBtn) {  // Егер элемент табылса
      startBtn.addEventListener("click", () => {
        socket.emit("start_game");
      });
    } else {
      console.log("startGameBtn элементі табылмады");
    }
  });