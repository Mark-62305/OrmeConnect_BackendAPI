// backend/middleware/auth.middleware.js
const jwt = require("jsonwebtoken");

function authMiddleware(req, res, next) {
  const header = req.headers["authorization"];
  if (!header) {
    return res.status(401).json({ message: "No authorization header" });
  }

  const parts = header.split(" ");
  const token = parts.length === 2 ? parts[1] : null;

  if (!token) {
    return res.status(401).json({ message: "Token missing" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // e.g. { id, email, role }
    req.user = decoded;
    next();
  } catch (err) {
    console.error("JWT verify error:", err);
    return res.status(401).json({ message: "Invalid token" });
  }
}

module.exports = { authMiddleware };
