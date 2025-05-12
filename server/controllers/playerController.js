const Player = require('../models/Player');

exports.addPlayer = async (req, res) => {
  try {
    const { nickname } = req.body;
    const player = new Player({ nickname, score: 0 });
    await player.save();
    res.status(201).json(player);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add player' });
  }
};

exports.getTopPlayers = async (req, res) => {
  try {
    const topPlayers = await Player.find().sort({ score: -1 }).limit(10);
    res.status(200).json(topPlayers);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch top players' });
  }
};

exports.resetPlayers = async (req, res) => {
  try {
    await Player.deleteMany({});
    res.status(200).json({ message: 'All players reset' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reset players' });
  }
};
