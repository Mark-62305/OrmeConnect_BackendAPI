const express = require("express");
const router = express.Router();

const { authMiddleware } = require("../middleware/auth.middleware");
const { adminOnly } = require("../middleware/admin.middleware");

const billingController = require("../controllers/billing.controller");

// GET all billing rates
router.get(
  "/rates",
  authMiddleware,
  adminOnly,
  billingController.getRates
);

// Create new rate
router.post(
  "/rates",
  authMiddleware,
  adminOnly,
  billingController.createRate
);

// Update rate
router.put(
  "/rates/:id",
  authMiddleware,
  adminOnly,
  billingController.updateRate
);

// Delete rate
router.delete(
  "/rates/:id",
  authMiddleware,
  adminOnly,
  billingController.deleteRate
);

module.exports = router;
