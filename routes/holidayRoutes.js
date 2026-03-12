const express = require("express");
const router = express.Router();

const {
  addHoliday,
  getHolidays
} = require("../controllers/holidayController");

// Admin add holiday
router.post("/add-holiday", addHoliday);

// Student view holidays
router.get("/holidays", getHolidays);

module.exports = router;