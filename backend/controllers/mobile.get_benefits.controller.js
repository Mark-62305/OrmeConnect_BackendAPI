const pool8 =require("../db.cjs");

/**
 * GET get_benefits.php
 */
async function getBenefits(req, res) {
  try {
    const sql = "SELECT id, name, description FROM benefits WHERE is_active = 1";
    const [rows] = await pool8.query(sql);

    return res.json({
      status: "success",
      benefits: Array.isArray(rows) ? rows : [],
    });
  } catch (err) {
    return res.json({
      status: "fail",
      message: `Server error: ${err?.message || String(err)}`,
      benefits: [],
    });
  }
}

module.exports = { getBenefits };