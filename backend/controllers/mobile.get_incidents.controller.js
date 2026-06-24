const pool6 =require("../db.cjs");

/**
 * GET get_incidents.php
 * query: user_id
 */
async function getIncidents(req, res) {
  const userId = Number.parseInt(String(req.query?.user_id ?? "0"), 10);

  if (!Number.isFinite(userId) || userId <= 0) {
    return res.json({ status: "fail", message: "Invalid user_id" });
  }

  try {
    const sql = `
      SELECT id, category, description, status, reported_at, meter_id
      FROM incident_reports
      WHERE user_id = ?
      ORDER BY reported_at DESC, id DESC
    `;

    const [rows] = await pool6.execute(sql, [userId]);

    const incidents = (Array.isArray(rows) ? rows : []).map((r) => ({
      id: Number(r.id),
      category: r.category,
      description: r.description,
      status: r.status,
      reported_at: r.reported_at,
      meter_id: r.meter_id,
    }));

    return res.json({ status: "success", count: incidents.length, incidents });
  } catch (err) {
    return res.json({
      status: "fail",
      message: `Server error: ${err?.message || String(err)}`,
    });
  }
}

module.exports = { getIncidents };