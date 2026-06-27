const express = require("express");
const bookingController = require("../controllers/bookingController");

const router = express.Router();

router.post("/book", bookingController.bookAppointment);
router.get("/appointments", bookingController.getAppointments);

module.exports = router;
