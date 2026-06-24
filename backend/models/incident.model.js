const db = require("../config/db");

const Incident = {
  getAll() {
    const sql = `
      SELECT ir.*, u.full_name AS user_name, m.meter_number
      FROM incident_reports ir
      JOIN users u ON ir.user_id = u.id
      LEFT JOIN meters m ON ir.meter_id = m.id
      ORDER BY ir.reported_at DESC
    `;
    return db.query(sql);
  },

  updateStatus(id, { status, handled_by, resolved_at }) {
    return db.query(
      "UPDATE incident_reports SET status=?, handled_by=?, resolved_at=? WHERE id=?",
      [status, handled_by || null, resolved_at || null, id]
    );
  }
};

module.exports = Incident;
