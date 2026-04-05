// backend/controllers/users.controller.js
const db = require("../config/db"); // your mysql2 pool or connection

// GET /api/users
async function getAllUsers(req, res) {
  try {
    const [rows] = await db.query(
      "SELECT id, email, full_name, phone, is_active, created_at FROM users"
    );
    res.json(rows);
  } catch (err) {
    console.error("getAllUsers error:", err);
    res.status(500).json({ message: "Server error" });
  }
}

// GET /api/users/:id
async function getUserById(req, res) {
  try {
    const { id } = req.params;
    const [rows] = await db.query(
      "SELECT id, email, full_name, phone, is_active, created_at FROM users WHERE id = ?",
      [id]
    );
    if (!rows.length) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error("getUserById error:", err);
    res.status(500).json({ message: "Server error" });
  }
}

// POST /api/users
async function createUser(req, res) {
  try {
    const { email, full_name, phone, password, is_active } = req.body;
    if (!email || !full_name || !password) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const [result] = await db.query(
      `INSERT INTO users (email, password_hash, full_name, phone, is_active)
       VALUES (?, SHA2(?, 256), ?, ?, ?)`,
      [email, password, full_name, phone || null, is_active ? 1 : 0]
    );

    res.status(201).json({ id: result.insertId });
  } catch (err) {
    console.error("createUser error:", err);
    res.status(500).json({ message: "Server error" });
  }
}

// PUT /api/users/:id
async function updateUser(req, res) {
  try {
    const { id } = req.params;
    const { email, full_name, phone, password, is_active } = req.body;

    // Update base fields
    await db.query(
      `UPDATE users
       SET email = ?, full_name = ?, phone = ?, is_active = ?
       WHERE id = ?`,
      [email, full_name, phone || null, is_active ? 1 : 0, id]
    );

    // Optional password change
    if (password && password.trim() !== "") {
      await db.query(
        "UPDATE users SET password_hash = SHA2(?, 256) WHERE id = ?",
        [password, id]
      );
    }

    res.json({ message: "User updated" });
  } catch (err) {
    console.error("updateUser error:", err);
    res.status(500).json({ message: "Server error" });
  }
}

// DELETE /api/users/:id
async function deleteUser(req, res) {
  try {
    const { id } = req.params;
    await db.query("DELETE FROM users WHERE id = ?", [id]);
    res.json({ message: "User deleted" });
  } catch (err) {
    console.error("deleteUser error:", err);
    res.status(500).json({ message: "Server error" });
  }
}

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
};
