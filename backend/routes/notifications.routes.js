const express = require("express");
const router = express.Router();

const { authMiddleware } = require("../middleware/auth.middleware");
const { adminOnly } = require("../middleware/admin.middleware");
const controller = require("../controllers/notifications.controller");

router.get("/", authMiddleware, adminOnly, controller.getNotifications);
router.patch("/read-all", authMiddleware, adminOnly, controller.markAll);
router.patch("/:id/read", authMiddleware, adminOnly, controller.updateReadStatus);
router.delete("/:id", authMiddleware, adminOnly, controller.deleteNotification);

module.exports = router;