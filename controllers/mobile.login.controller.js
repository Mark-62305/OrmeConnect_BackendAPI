const pool = require("../db.cjs");

/**
 * POST login.php
 * body: email, password
 * role forced to "member"
 */
async function login(req, res) {
  if (req.method !== "POST") {
    return res.json({ status: "fail", message: "Invalid request method" });
  }

  const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const role = "member";

  if (!email || !password) {
    return res.json({
      status: "fail",
      message: "Email, password, and role are required",
    });
  }

  try {
    const sql = `
      SELECT
        u.id,
        u.email,
        u.full_name,
        r.name AS role_name
      FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r       ON r.id      = ur.role_id
      WHERE u.email = ?
        AND u.password_hash = SHA2(?, 256)
        AND u.is_active = 1
        AND r.name = ?
      LIMIT 1
    `;

    const [rows] = await pool.execute(sql, [email, password, role]);

    if (Array.isArray(rows) && rows.length > 0) {
      const row = rows[0];
      return res.json({
        status: "success",
        message: "Login successful",
        user: {
          id: Number(row.id),
          email: row.email,
          full_name: row.full_name,
          role: row.role_name,
        },
      });
    }

    return res.json({ status: "fail", message: "Invalid credentials or role" });
  } catch (err) {
    return res.json({
      status: "fail",
      message: `Server error: ${err?.message || String(err)}`,
    });
  }
}

module.exports = { login };