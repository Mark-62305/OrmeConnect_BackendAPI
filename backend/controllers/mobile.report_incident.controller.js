const pool7 =require("../db.cjs");

/**
 * POST report_incident.php
 * body: user_id, category, description, location(optional)
 */
async function reportIncident(req, res) {
  if (req.method !== "POST") {
    return res.json({ status: "fail", message: "Invalid method" });
  }

  const userId = Number.parseInt(String(req.body?.user_id ?? "0"), 10);
  const category = typeof req.body?.category === "string" ? req.body.category.trim() : "";
  const description =
    typeof req.body?.description === "string" ? req.body.description.trim() : "";
  const location = typeof req.body?.location === "string" ? req.body.location.trim() : "";

  if (!Number.isFinite(userId) || userId <= 0 || !category || !description) {
    return res.json({ status: "fail", message: "Missing required fields" });
  }

  try {
    const insertSql = `
      INSERT INTO incident_reports (user_id, category, description)
      VALUES (?, ?, ?)
    `;
    const [result] = await pool7.execute(insertSql, [userId, category, description]);
    const incidentId = Number(result.insertId);

    if (location) {
      const logSql = `
        INSERT INTO system_logs (user_id, action, details)
        VALUES (?, 'report_incident', ?)
      `;
      const details = `Location: ${location} | Incident ID: ${incidentId}`;
      await pool7.execute(logSql, [userId, details]);
    }

    return res.json({
      status: "success",
      message: "Incident reported",
      incident_id: incidentId,
    });
  } catch (err) {
    return res.json({
      status: "fail",
      message: `Server error: ${err?.message || String(err)}`,
    });
  }
}

module.exports = { reportIncident };
