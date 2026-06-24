const express = require("express");
const router = express.Router();

const { authMiddleware } = require("../middleware/auth.middleware");
const { adminOnly } = require("../middleware/admin.middleware");

const incidentsController = require("../controllers/incidents.controller");

// GET all incidents
router.get(
  "/",
  authMiddleware,
  adminOnly,
  incidentsController.getAllIncidents
);

// GET incident by ID
router.get(
  "/:id",
  authMiddleware,
  adminOnly,
  incidentsController.getIncidentById
);

// CREATE incident
router.post(
  "/",
  authMiddleware,
  adminOnly,
  incidentsController.createIncident
);

// UPDATE incident status
router.put(
  "/:id/status",
  authMiddleware,
  adminOnly,
  incidentsController.updateIncidentStatus
);

// DELETE incident
router.delete(
  "/:id",
  authMiddleware,
  adminOnly,
  incidentsController.deleteIncident
);

module.exports = router;
