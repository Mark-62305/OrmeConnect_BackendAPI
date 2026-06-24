// controllers/mobile.qr_login.controller.js
const pool = require("../db.cjs");
const jwt = require("jsonwebtoken");

/**
 * POST /api/mobile/qr-login
 * body: { member_code }
 * role forced to "member"
 */
async function qrLogin(req, res) {
  const member_code =
    typeof req.body?.member_code === "string" ? req.body.member_code.trim() : "";
  const role = "member";

  if (!member_code) {
    return res.json({ status: "fail", message: "member_code is required" });
  }

  try {
    const sql = `
      SELECT
        u.id, u.email, u.full_name, u.phone, u.is_active,
        r.name AS role_name,
        m.member_code, m.name AS member_name, m.address, m.contact_number
      FROM members m
      JOIN users u       ON u.id = m.user_id
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r       ON r.id = ur.role_id
      WHERE m.member_code = ?
        AND u.is_active = 1
        AND r.name = ?
      LIMIT 1
    `;

    const [rows] = await pool.execute(sql, [member_code, role]);

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.json({ status: "fail", message: "Invalid member code or role" });
    }

    const row = rows[0];

    const accessToken = jwt.sign(
      { user_id: Number(row.id), role: row.role_name, member_code: row.member_code },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    return res.json({
      status: "success",
      message: "QR login successful",
      accessToken,
      user: {
        id: Number(row.id),
        email: row.email,
        full_name: row.full_name,
        phone: row.phone,
        role: row.role_name,
        is_active: Number(row.is_active) === 1,
        member_code: row.member_code,
        member_name: row.member_name,
        address: row.address,
        contact_number: row.contact_number,
      },
    });
  } catch (err) {
    return res.json({ status: "fail", message: `Server error: ${err?.message || String(err)}` });
  }
}

module.exports = { qrLogin };