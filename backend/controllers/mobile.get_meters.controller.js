const pool = require("../db.cjs");

/**
 * GET /api/mobile/meters
 * query: user_id
 */
async function getMeters(req, res) {
  const userId = Number.parseInt(String(req.query?.user_id ?? "0"), 10);

  if (!Number.isFinite(userId) || userId <= 0) {
    return res.json({
      status: "fail",
      message: "Invalid user_id",
      count: 0,
      meters: [],
    });
  }

  try {
    const sql = `
      SELECT
        m.id,
        m.meter_number,
        m.status,
        COALESCE((
          SELECT mr.kwh
          FROM meter_readings mr
          WHERE mr.meter_id = m.id
          ORDER BY mr.reading_date DESC, mr.id DESC
          LIMIT 1
        ), 0) AS last_reading_kwh,
        NULL AS bill_amount
      FROM meters m
      WHERE m.user_id = ?
    `;

    const [rows] = await pool.execute(sql, [userId]);

    const meters = (Array.isArray(rows) ? rows : []).map((r) => ({
      id: Number(r.id),
      meter_number: r.meter_number,
      status: r.status,
      last_reading_kwh: Number(r.last_reading_kwh),
      bill_amount: r.bill_amount !== null ? Number(r.bill_amount) : null,
    }));

    console.log(`[getMeters] user_id=${userId}, found ${meters.length} meters`);

    return res.json({
      status: "success",
      message: "OK",
      count: meters.length,
      meters,
    });
  } catch (err) {
    console.error("[getMeters] Error:", err);
    return res.json({
      status: "fail",
      message: `Server error: ${err?.message || String(err)}`,
      count: 0,
      meters: [],
    });
  }
}

module.exports = { getMeters };