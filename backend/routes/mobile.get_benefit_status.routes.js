const router10 = require("express").Router();
const controller10 = require("../controllers/mobile.get_benefit_status.controller");

router10.get("/benefits/status", controller10.getBenefitStatus);

module.exports = router10;