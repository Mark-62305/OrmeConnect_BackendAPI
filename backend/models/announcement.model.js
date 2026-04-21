const db = require("../config/db");

const Announcement = {
  getAll() {
    const sql = `
      SELECT a.*, u.full_name AS created_by_name
      FROM announcements a
      JOIN users u ON a.created_by = u.id
      ORDER BY a.created_at DESC
    `;
    return db.query(sql);
  },

  create({ title, body, created_by, target_role }) {
    return db.query(
      "INSERT INTO announcements (title, body, created_by, target_role) VALUES (?,?,?,?)",
      [title, body, created_by, target_role || null]
    );
  },

  update(id, { title, body, target_role }) {
    return db.query(
      "UPDATE announcements SET title=?, body=?, target_role=? WHERE id=?",
      [title, body, target_role || null, id]
    );
  },

  delete(id) {
    return db.query("DELETE FROM announcements WHERE id=?", [id]);
  }
};

module.exports = Announcement;
