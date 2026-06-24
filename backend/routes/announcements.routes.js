const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const { authMiddleware } = require("../middleware/auth.middleware");
const { adminOnly } = require("../middleware/admin.middleware");
const announcementController = require("../controllers/announcements.controller");

const storage = multer.diskStorage({
    destination: function(_req, _file, cb) {
        const uploadDir = path.join(__dirname, "..", "uploads", "announcement_images");
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function(req, file, cb) {
        const userId = (req.user && req.user.id) || "admin";
        const timestamp = Date.now();
        const sanitizedName = String(file.originalname || "image").replace(/[^a-zA-Z0-9.-]/g, "_");
        cb(null, `${timestamp}_${userId}_${sanitizedName}`);
    },
});

const fileFilter = (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp", "image/bmp", "image/svg+xml"];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    return cb(new Error("Invalid file type. Only image files are allowed."), false);
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024,
        files: 10,
    },
});

// GET all announcements
router.get("/", authMiddleware, adminOnly, announcementController.getAll);

// VIEW announcement attachment image
router.get("/attachments/:fileName", announcementController.getAttachmentFile);

// CREATE announcement
router.post("/", authMiddleware, adminOnly, upload.array("photos", 10), announcementController.create);

// UPDATE announcement
router.put("/:id", authMiddleware, adminOnly, upload.array("photos", 10), announcementController.update);

// DELETE announcement
router.delete("/:id", authMiddleware, adminOnly, announcementController.remove);

router.use((error, _req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({ message: "File size exceeds 10 MB limit" });
        }
        if (error.code === "LIMIT_FILE_COUNT") {
            return res.status(400).json({ message: "Too many files. Maximum 10 files allowed" });
        }
        return res.status(400).json({ message: `Upload error: ${error.message}` });
    }

    if (error) {
        return res.status(400).json({ message: error.message || "File upload failed" });
    }

    next();
});

module.exports = router;