const router = require("express").Router();
const controller = require("../controllers/mobile.seminar_schedule.controller");

router.post("/seminar-schedule-requests", controller.createScheduleRequest);
router.get("/seminar-schedule-requests/latest", controller.getLatestScheduleRequest);

module.exports = router;