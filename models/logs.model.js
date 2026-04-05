const db = require("../config/db");

const LogsModel = {
  add(user_id, action, details, ip_address) {
    return db.query(
      "INSERT INTO logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)",
      [user_id || null, action, details || null, ip_address || null]
    );
  },

  listAll() {
    const sql = `
      SELECT l.*, u.full_name AS user_name
      FROM logs l
      LEFT JOIN users u ON l.user_id = u.id
      ORDER BY l.created_at DESC
    `;
    return db.query(sql);
  }
};

module.exports = LogsModel;
