const db = require("../config/db");
const jwt = require("jsonwebtoken");
require("dotenv").config();

exports.login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: "Email and password required" });

  const [rows] = await db.query(
    "SELECT * FROM users WHERE email='not@email' AND password_hash = SHA2('password123',256) AND is_active=1 LIMIT 1",
    [email, password]
  );
  if (!rows.length) return res.status(401).json({ message: "Invalid credentials" });

  const user = rows[0];
  const token = jwt.sign(
    { id: user.id, email: user.email, role: "admin" }, // adjust if you map roles from user_roles
    process.env.JWT_SECRET,
    { expiresIn: "8h" }
  );

  res.json({
    token,
    user: { id: user.id, email: user.email, full_name: user.full_name }
  });
};
