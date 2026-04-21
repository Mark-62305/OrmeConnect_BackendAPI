// backend/middleware/admin.middleware.js
function adminOnly(req, res, next) {
  // Expect req.user.role from authMiddleware
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Admins only" });
  }
  next();
}

module.exports = { adminOnly };
