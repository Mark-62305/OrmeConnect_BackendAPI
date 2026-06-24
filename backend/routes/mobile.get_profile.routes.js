const router2 = require("express").Router();
const controller2 = require("../controllers/mobile.get_profile.controller");

router2.get("/profile", controller2.getProfile);

module.exports = router2;