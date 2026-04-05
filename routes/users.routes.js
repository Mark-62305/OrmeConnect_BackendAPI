// backend/routes/users.routes.js
const express = require("express");
const router = express.Router();

const { authMiddleware } = require("../middleware/auth.middleware");
const { adminOnly } = require("../middleware/admin.middleware");
const usersController = require("../controllers/users.controller");

// GET /api/users
router.get(
  "/",
  authMiddleware,
  adminOnly,
  usersController.getAllUsers
);

// GET /api/users/:id
router.get(
  "/:id",
  authMiddleware,
  adminOnly,
  usersController.getUserById
);

// POST /api/users
router.post(
  "/",
  authMiddleware,
  adminOnly,
  usersController.createUser
);

// PUT /api/users/:id
router.put(
  "/:id",
  authMiddleware,
  adminOnly,
  usersController.updateUser
);

// DELETE /api/users/:id
router.delete(
  "/:id",
  authMiddleware,
  adminOnly,
  usersController.deleteUser
);

module.exports = router;
