// backend/controllers/dashboard.controller.js
const Dashboard = require("../models/dashboard.model");

exports.getStats = async (req, res) => {
  try {
    const stats = await Dashboard.getStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({
      error: "Failed to load dashboard stats",
      details: err.message
    });
  }
};
