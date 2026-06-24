const express = require("express");
const router = express.Router();

const { authMiddleware } = require("../middleware/auth.middleware");
const { adminOnly } = require("../middleware/admin.middleware");
const reportsController = require("../controllers/reports.controller");

router.get("/overview", authMiddleware, adminOnly, reportsController.getOverview);

module.exports = router;