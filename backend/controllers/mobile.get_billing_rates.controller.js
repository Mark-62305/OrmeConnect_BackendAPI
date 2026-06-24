const pool = require("../db.cjs");

function normalizeTypeFromDescription(description) {
  const d = String(description || "").toLowerCase();

  if (d.includes("residential")) return "residential";
  if (d.includes("commercial")) return "commercial";
  if (d.includes("industrial")) return "industrial";
  if (d.includes("public")) return "public";
  if (d.includes("street")) return "street_light";

  // fallback (keeps app stable, but you should align descriptions)
  return "unknown";
}

async function getBillingRates(req, res) {
  const conn = await pool.getConnection();
  try {
    const [[fp]] = await conn.query(
      "SELECT DATABASE() AS db_name, @@hostname AS mysql_host, @@port AS mysql_port"
    );

    // “current” rates = effective_from <= today AND (effective_to is null OR >= today)
    // If multiple rows exist per category, newest effective_from wins.
    const [rows] = await conn.query(
      `
      SELECT id, effective_from, effective_to, rate_per_kwh, description
      FROM billing_rates
      WHERE effective_from <= CURDATE()
        AND (effective_to IS NULL OR effective_to >= CURDATE())
      ORDER BY effective_from DESC, id DESC
      `
    );

    // Keep only the best row per type (first seen wins due to ORDER BY)
    const bestByType = new Map();
    for (const r of rows || []) {
      const type = normalizeTypeFromDescription(r.description);
      if (!bestByType.has(type)) {
        bestByType.set(type, {
          type,
          rate_per_kwh: Number(r.rate_per_kwh),
          description: r.description,
          effective_from: r.effective_from,
          effective_to: r.effective_to,
          id: Number(r.id),
        });
      }
    }

    const rates = Array.from(bestByType.values()).filter((x) => x.type !== "unknown");

    return res.json({
      status: "success",
      rates,
      db: fp,
      rows_read: Array.isArray(rows) ? rows.length : 0,
    });
  } catch (err) {
    return res.json({
      status: "fail",
      message: `Server error: ${err?.message || String(err)}`,
      rates: [],
    });
  } finally {
    conn.release();
  }
}

module.exports = { getBillingRates };
