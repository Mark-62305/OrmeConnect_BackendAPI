const router7 = require("express").Router();
const controller7 = require("../controllers/mobile.report_incident.controller");

router7.post("/incidents/report", controller7.reportIncident);

module.exports = router7;