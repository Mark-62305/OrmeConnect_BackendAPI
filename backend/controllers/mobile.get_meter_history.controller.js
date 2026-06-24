const pool = require("../db.cjs");

/**
 * GET /api/mobile/meter_history
 * query: meter_id, limit (default 60)
 */
async function getMeterHistory(req, res) {
  const meterId = Number.parseInt(String(req.query?.meter_id ?? "0"), 10);
  const limit = Number.parseInt(String(req.query?.limit ?? "60"), 10);

  if (!Number.isFinite(meterId) || meterId <= 0) {
    return res.json({
      status: "fail",
      message: "Invalid meter_id",
      count: 0,
      values: [],
    });
  }

  // Validate and sanitize limit (must be a safe integer)
  const safeLimit = Number.isFinite(limit) && limit > 0 && limit <= 1000 ? limit : 60;

  try {
    // FIXED: Don't use placeholder for LIMIT, interpolate the validated number directly
    // This is safe because safeLimit is validated as a number
    const sql = `
      SELECT kwh, reading_date
      FROM meter_readings
      WHERE meter_id = ?
      ORDER BY reading_date ASC, id ASC
      LIMIT ${safeLimit}
    `;

    // Only one parameter now: meterId
    const [rows] = await pool.execute(sql, [meterId]);

    const values = (Array.isArray(rows) ? rows : []).map((r) => ({
      kwh: String(r.kwh),
      reading_date: r.reading_date,
    }));

    console.log(`[getMeterHistory] meter_id=${meterId}, limit=${safeLimit}, found ${values.length} readings`);

    return res.json({
      status: "success",
      message: "OK",
      count: values.length,
      values,
    });
  } catch (err) {
    console.error("[getMeterHistory] Error:", err);
    return res.json({
      status: "fail",
      message: `Server error: ${err?.message || String(err)}`,
      count: 0,
      values: [],
    });
  }
}

module.exports = { getMeterHistory };