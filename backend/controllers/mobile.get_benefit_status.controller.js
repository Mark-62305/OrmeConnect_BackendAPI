const pool10 =require("../db.cjs");

/**
 * GET get_benefit_status.php
 * query: user_id
 */
async function getBenefitStatus(req, res) {
  const userId = Number.parseInt(String(req.query?.user_id ?? "0"), 10);

  if (!Number.isFinite(userId) || userId <= 0) {
    return res.json({ status: "error", history: [], message: "Invalid user_id" });
  }

  try {
    const sqlCurrent = `
      SELECT status
      FROM benefit_applications
      WHERE user_id = ?
      ORDER BY applied_at DESC
      LIMIT 1
    `;
    const [currentRows] = await pool10.execute(sqlCurrent, [userId]);
    const currentStatus =
      Array.isArray(currentRows) && currentRows.length > 0 ? currentRows[0].status : null;

    const sqlHist = `
      SELECT b.name AS benefit_name,
             ba.status,
             DATE(ba.applied_at) AS date
      FROM benefit_applications ba
      JOIN benefits b ON b.id = ba.benefit_id
      WHERE ba.user_id = ?
      ORDER BY ba.applied_at DESC
    `;
    const [historyRows] = await pool10.execute(sqlHist, [userId]);

    return res.json({
      status: "success",
      current_application_status: currentStatus,
      history: Array.isArray(historyRows) ? historyRows : [],
    });
  } catch (err) {
    return res.json({
      status: "fail",
      message: `Server error: ${err?.message || String(err)}`,
      current_application_status: null,
      history: [],
    });
  }
}

module.exports = { getBenefitStatus };