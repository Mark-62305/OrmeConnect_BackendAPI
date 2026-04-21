const router9 = require("express").Router();
const controller9 = require("../controllers/mobile.apply_benefit.controller");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Configure storage for uploaded files
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, "..", "uploads", "benefit_documents");

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const userId = req.body?.user_id || "unknown";
    const timestamp = Date.now();
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
    const uniqueName = `${timestamp}_${userId}_${sanitizedName}`;
    cb(null, uniqueName);
  },
});

// File filter to accept common document types
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ];

  if (allowedMimes.includes(file.mimetype)) cb(null, true);
  else cb(new Error("Invalid file type. Only images, PDFs, and Office documents are allowed."), false);
};

// Configure multer
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB per file
    files: 10, // Maximum 10 files
  },
});

// Route with file upload middleware
router9.post(
  "/benefits/apply",
  upload.fields([
    { name: "files[]", maxCount: 10 },
    { name: "files", maxCount: 10 },
  ]),
  (req, _res, next) => {
    const f = req.files;
    if (Array.isArray(f)) {
      req.files = f;
    } else if (f && typeof f === "object") {
      req.files = Object.values(f).flat();
    } else {
      req.files = [];
    }
    next();
  },
  controller9.applyBenefit
);

// Error handling middleware for multer errors
router9.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ status: "error", message: "File size exceeds 10 MB limit" });
    }
    if (error.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({ status: "error", message: "Too many files. Maximum 10 files allowed" });
    }
    return res.status(400).json({ status: "error", message: `Upload error: ${error.message}` });
  }

  if (error) {
    return res.status(400).json({ status: "error", message: error.message || "File upload failed" });
  }

  next();
});

module.exports = router9;