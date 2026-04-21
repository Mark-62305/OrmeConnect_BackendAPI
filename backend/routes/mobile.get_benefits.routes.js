const express = require("express");
const { getBenefits } = require("../controllers/mobile.get_benefits.controller");

const router = express.Router();
router.get(["/benefits", "/get_benefits.php"], getBenefits);

module.exports = router;