const express = require("express");
const router = express.Router();

const {
  addHoliday,
  getHolidays,
} = require("../controllers/holidaysController");

router.post("/add-holiday", addHoliday);
router.get("/get-holiday", getHolidays);

module.exports = router;