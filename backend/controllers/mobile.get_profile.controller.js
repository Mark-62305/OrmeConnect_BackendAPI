const pool2 =require("../db.cjs");

/**
 * GET get_profile.php
 * query: user_id
 * success response is the user object (no "status"), matching PHP
 */
async function getProfile(req, res) {
  if (req.method !== "GET") {
    return res.json({ status: "fail", message: "Invalid request method" });
  }

  const userId = Number.parseInt(String(req.query?.user_id ?? "0"), 10);

  if (!Number.isFinite(userId) || userId <= 0) {
    return res.json({ status: "fail", message: "Missing or invalid user_id" });
  }

  try {
    const sql = `
      SELECT
        u.id,
        COALESCE(m.name, u.full_name) AS name,
        m.member_code,
        m.address,
        COALESCE(m.contact_number, u.phone) AS contact_number
      FROM users u
      LEFT JOIN members m ON m.user_id = u.id
      WHERE u.id = ? AND u.is_active = 1
      LIMIT 1
    `;

    const [rows] = await pool2.execute(sql, [userId]);

    if (Array.isArray(rows) && rows.length > 0) {
      const row = rows[0];
      return res.json({
        id: Number(row.id),
        memberId: row.member_code,
        fullName: row.name,
        address: row.address,
        contactNumber: row.contact_number,
      });
    }

    return res.json({ status: "fail", message: "User not found" });
  } catch (err) {
    return res.json({
      status: "fail",
      message: `Server error: ${err?.message || String(err)}`,
    });
  }
}

module.exports = { getProfile };