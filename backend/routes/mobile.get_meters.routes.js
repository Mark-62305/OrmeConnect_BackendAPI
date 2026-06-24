const router3 = require("express").Router();
const controller3 = require("../controllers/mobile.get_meters.controller");

router3.get("/meters", controller3.getMeters);

module.exports = router3;