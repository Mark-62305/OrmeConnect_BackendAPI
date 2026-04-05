const express = require("express");
const router = express.Router();

const { authMiddleware } = require("../middleware/auth.middleware");
const { adminOnly } = require("../middleware/admin.middleware");

const benefitsController = require("../controllers/benefits.controller");

// Get all benefits
router.get(
  "/",
  authMiddleware,
  adminOnly,
  benefitsController.getAllBenefits
);

// Create benefit
router.post(
  "/",
  authMiddleware,
  adminOnly,
  benefitsController.createBenefit
);

// Update benefit
router.put(
  "/:id",
  authMiddleware,
  adminOnly,
  benefitsController.updateBenefit
);

// Delete benefit
router.delete(
  "/:id",
  authMiddleware,
  adminOnly,
  benefitsController.deleteBenefit
);

// Get all benefit applications
router.get(
  "/applications",
  authMiddleware,
  adminOnly,
  benefitsController.getApplications
);

// Approve/reject an application
router.put(
  "/applications/:id",
  authMiddleware,
  adminOnly,
  benefitsController.updateApplicationStatus
);

module.exports = router;
