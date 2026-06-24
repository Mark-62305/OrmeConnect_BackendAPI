const router = require("express").Router();
const controller = require("../controllers/mobile.login.controller");

router.post("/login", controller.login);

module.exports = router;