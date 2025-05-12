let gameActive = false;

exports.startGame = (req, res) => {
  gameActive = true;
  res.status(200).json({ message: 'Game started' });
  console.log("iiiiiiiiiiiwiuiouuishgsfsfkljk")
};

exports.endGame = (req, res) => {
  gameActive = false;
  res.status(200).json({ message: 'Game ended' });
};

exports.getGameStatus = (req, res) => {
  res.status(200).json({ active: gameActive });
};

exports.isGameActive = () => gameActive;
exports.setGameActive = (value) => {
  gameActive = value;
};
