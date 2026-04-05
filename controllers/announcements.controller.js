const db = require("../config/db");

async function getAll(req, res) {
  try {
    const [rows] = await db.query(
      "SELECT * FROM announcements ORDER BY created_at DESC"
    );
    res.json(rows);
  } catch (err) {
    console.error("getAll error:", err);
    res.status(500).json({ message: "Server error" });
  }
}

async function create(req, res) {
  try {
    const { title, body, target_role } = req.body;
    const userId = req.user.id;

    const [r] = await db.query(
      "INSERT INTO announcements (title, body, created_by, target_role) VALUES (?, ?, ?, ?)",
      [title, body, userId, target_role]
    );

    res.json({ id: r.insertId });
  } catch (err) {
    console.error("create error:", err);
    res.status(500).json({ message: "Server error" });
  }
}

async function update(req, res) {
  try {
    const { id } = req.params;
    const { title, body, target_role } = req.body;

    await db.query(
      "UPDATE announcements SET title=?, body=?, target_role=? WHERE id=?",
      [title, body, target_role, id]
    );

    res.json({ message: "Updated" });
  } catch (err) {
    console.error("update error:", err);
    res.status(500).json({ message: "Server error" });
  }
}

async function remove(req, res) {
  try {
    const { id } = req.params;

    await db.query("DELETE FROM announcements WHERE id=?", [id]);

    res.json({ message: "Deleted" });
  } catch (err) {
    console.error("remove error:", err);
    res.status(500).json({ message: "Server error" });
  }
}

module.exports = {
  getAll,
  create,
  update,
  remove,
};
