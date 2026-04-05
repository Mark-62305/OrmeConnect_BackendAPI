const express = require("express");
const router = express.Router();

const { authMiddleware } = require("../middleware/auth.middleware");
const { adminOnly } = require("../middleware/admin.middleware");
const announcementController = require("../controllers/announcements.controller");

// GET all announcements
router.get("/", authMiddleware, adminOnly, announcementController.getAll);

// CREATE announcement
router.post("/", authMiddleware, adminOnly, announcementController.create);

// UPDATE announcement
router.put("/:id", authMiddleware, adminOnly, announcementController.update);

// DELETE announcement
router.delete("/:id", authMiddleware, adminOnly, announcementController.remove);

module.exports = router;
