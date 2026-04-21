const express = require("express");
const router = express.Router();
const multer = require("multer");

const { authMiddleware } = require("../middleware/auth.middleware");
const { adminOnly } = require("../middleware/admin.middleware");

const metersController = require("../controllers/meters.controller");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});
// GET all meters
router.get(
  "/",
  authMiddleware,
  adminOnly,
  metersController.getAllMeters
);


// EXPORT meters to XLSX
router.get(
  "/export",
  authMiddleware,
  adminOnly,
  metersController.exportMetersXlsx
);

// IMPORT meters from XLSX
router.post(
  "/import",
  authMiddleware,
  adminOnly,
  upload.single("file"),
  metersController.importMetersXlsx
);

// GET meter by ID
router.get(
  "/:id",
  authMiddleware,
  adminOnly,
  metersController.getMeterById
);

// CREATE meter
router.post(
  "/",
  authMiddleware,
  adminOnly,
  metersController.createMeter
);

// UPDATE meter
router.put(
  "/:id",
  authMiddleware,
  adminOnly,
  metersController.updateMeter
);

// DELETE meter
router.delete(
  "/:id",
  authMiddleware,
  adminOnly,
  metersController.deleteMeter
);

module.exports = router;
