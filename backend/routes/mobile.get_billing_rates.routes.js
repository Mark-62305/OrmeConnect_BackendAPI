const router5 = require("express").Router();
const controller5 = require("../controllers/mobile.get_billing_rates.controller");

router5.get("/billing_rates", controller5.getBillingRates);

module.exports = router5;