const db = require("../config/db");

const Meter = {
  getAll() {
    const sql = `
      SELECT m.*, u.full_name AS user_name
      FROM meters m
      JOIN users u ON m.user_id = u.id
      ORDER BY m.id DESC
    `;
    return db.query(sql);
  },

  create({ meter_number, user_id, installation_address, installed_at, status }) {
    return db.query(
      "INSERT INTO meters (meter_number, user_id, installation_address, installed_at, status) VALUES (?,?,?,?,?)",
      [meter_number, user_id, installation_address, installed_at || null, status || "active"]
    );
  },

  update(id, { meter_number, user_id, installation_address, installed_at, status }) {
    return db.query(
      "UPDATE meters SET meter_number=?, user_id=?, installation_address=?, installed_at=?, status=? WHERE id=?",
      [meter_number, user_id, installation_address, installed_at || null, status, id]
    );
  },

  delete(id) {
    return db.query("DELETE FROM meters WHERE id=?", [id]);
  }
};

module.exports = Meter;
