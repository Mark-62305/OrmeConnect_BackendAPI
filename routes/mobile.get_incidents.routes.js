const router6 = require("express").Router();
const controller6 = require("../controllers/mobile.get_incidents.controller");

router6.get("/incidents", controller6.getIncidents);

module.exports = router6;