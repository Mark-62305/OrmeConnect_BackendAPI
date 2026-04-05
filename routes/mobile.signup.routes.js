/* =========================================================
 * file: routes/mobile.signup.routes.js
 * Add /health so you can confirm DB from the same server instance
 * ========================================================= */
const router = require("express").Router();
const controller = require("../controllers/mobile.signup.controller");

router.post("/signup", controller.signup);
router.get("/health", controller.health);

module.exports = router;
