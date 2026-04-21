// backend/routes/dashboard.routes.js
const express = require("express");
const router = express.Router();

const controller = require("../controllers/dashboard.controller");
const { authMiddleware, adminOnly } = require("../middleware/auth.middleware");

router.get("/stats", controller.getStats);

module.exports = router;
