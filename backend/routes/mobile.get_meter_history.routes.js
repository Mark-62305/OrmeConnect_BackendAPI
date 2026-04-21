const router4 = require("express").Router();
const controller4 = require("../controllers/mobile.get_meter_history.controller");

router4.get("/meter_history", controller4.getMeterHistory);

module.exports = router4;