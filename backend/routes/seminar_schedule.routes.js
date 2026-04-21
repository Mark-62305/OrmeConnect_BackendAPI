const express = require("express");
const router = express.Router();

const { authMiddleware } = require("../middleware/auth.middleware");
const { adminOnly } = require("../middleware/admin.middleware");
const seminarScheduleController = require("../controllers/seminar_schedule.controller");

router.get("/", authMiddleware, adminOnly, seminarScheduleController.getAllScheduleRequests);
router.put("/:id/status", authMiddleware, adminOnly, seminarScheduleController.updateScheduleRequestStatus);

module.exports = router;