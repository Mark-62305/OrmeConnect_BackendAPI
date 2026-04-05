let bcrypt;
try {
  bcrypt = require("bcryptjs");
} catch (e) {
  bcrypt = null;
}

/**
 * GET generate_hash.php
 * query: password (default "123456")
 * NOTE: requires: npm i bcryptjs
 */
async function generateHash(req, res) {
  const password =
    typeof req.query?.password === "string" && req.query.password.length > 0
      ? req.query.password
      : "123456";

  if (!bcrypt) {
    return res.json({
      status: "fail",
      message: "bcryptjs not installed. Run: npm i bcryptjs",
    });
  }

  const hash = await bcrypt.hash(password, 10);
  return res.json({ status: "success", password, hash });
}

module.exports = { generateHash };
