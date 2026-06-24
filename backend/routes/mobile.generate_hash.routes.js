const router11 = require("express").Router();
const controller11 = require("../controllers/mobile.generate_hash.controller");

router11.get("/hash", controller11.generateHash);

module.exports = router11;