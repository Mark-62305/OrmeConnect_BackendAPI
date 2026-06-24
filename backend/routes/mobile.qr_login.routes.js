const router = require("express").Router();
const controller = require("../controllers/mobile.qr_login.controller");

router.post("/qr-login", controller.qrLogin);

module.exports = router;